import { NextResponse } from "next/server";

import {
  type BackupStore,
  createVercelBlobStore,
  isBackupStoreTheAppStore,
  readBackupSettings,
  runBackup,
} from "@/lib/backup";
import {
  createGcsBackupStore,
  isBackupBucketTheAppBucket,
  readGcsBackupSettings,
} from "@/lib/backup-gcs";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { identifyRetentionCaller } from "@/lib/retention-job";
import { logRouteError, logSecurityEvent } from "@/lib/security/logging";
import { getClientIpAddress, getRequestPathname } from "@/lib/security/request";
import { resolveStorageDriver } from "@/lib/services/storage/driver";

// The daily backup to a second Blob store or GCS bucket (src/lib/backup.ts),
// called by a daily scheduler (Vercel's cron job in vercel.json, or Cloud
// Scheduler). It does nothing until BACKUP_BLOB_READ_WRITE_TOKEN (Vercel
// Blob) or BACKUP_GCS_BUCKET (Google Cloud Storage) is set.
//
// Callers are trusted the same way as the daily cleanup's: with CRON_SECRET
// or RETENTION_JOB_SECRET set, only a caller that sends it gets in. Without
// one, anyone may call, and a
// run happens at most once in 20 hours whoever asks, which is the most an
// outside caller can make it cost.

export const maxDuration = 300;

const ANONYMOUS_RUN_INTERVAL_MS = 20 * 60 * 60 * 1000;
/** Leaves time to write the summary before the function is stopped. */
const COPY_BUDGET_MS = 240_000;

type BackupPlan = {
  appStoreIsBackupStore: boolean;
  keepDays: number;
  source: BackupStore;
  target: BackupStore;
};

function resolveBackupPlan(): BackupPlan | null {
  const driver = resolveStorageDriver();

  if (driver === "gcs") {
    const settings = readGcsBackupSettings();

    return settings
      ? {
          appStoreIsBackupStore: isBackupBucketTheAppBucket(settings),
          keepDays: settings.keepDays,
          source: createGcsBackupStore(process.env.GCS_BUCKET?.trim() ?? ""),
          target: createGcsBackupStore(settings.bucket),
        }
      : null;
  }

  const settings = readBackupSettings();

  return driver === "blob" && settings
    ? {
        appStoreIsBackupStore: isBackupStoreTheAppStore(settings),
        keepDays: settings.keepDays,
        source: createVercelBlobStore(),
        target: createVercelBlobStore(settings.token),
      }
    : null;
}

async function handle(request: Request) {
  const startedAt = Date.now();
  const caller = identifyRetentionCaller(request.headers.get("authorization"));

  if (caller === "denied") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const plan = resolveBackupPlan();

  if (!plan) {
    return caller === "authorized"
      ? NextResponse.json({ status: "not_configured" })
      : new NextResponse(null, { status: 204 });
  }

  if (plan.appStoreIsBackupStore) {
    logSecurityEvent("error", {
      category: "backup_misconfigured",
      message:
        "The backup store is the app's own. Make a second store or bucket for backups and use that.",
      path: getRequestPathname(request),
    });

    return NextResponse.json(
      { error: "The backup store is the app's own store." },
      { status: 500 },
    );
  }

  if (caller === "anonymous") {
    const ration = await consumeRateLimit({
      key: "job:backup",
      limit: 1,
      windowMs: ANONYMOUS_RUN_INTERVAL_MS,
    });

    if (!ration.allowed) {
      return new NextResponse(null, { status: 204 });
    }
  }

  try {
    const summary = await runBackup({
      deadline: startedAt + COPY_BUDGET_MS,
      keepDays: plan.keepDays,
      source: plan.source,
      target: plan.target,
    });
    const failed = summary.fileFailures.length > 0;

    logSecurityEvent(failed ? "error" : "info", {
      category: "backup_finished",
      message: failed
        ? `The backup finished, but ${String(summary.fileFailures.length)} files could not be copied.`
        : "The backup finished.",
      metadata: { ...summary, fileFailures: summary.fileFailures.slice(0, 20) },
    });

    if (caller === "authorized") {
      return NextResponse.json(summary, { status: failed ? 500 : 200 });
    }

    return new NextResponse(null, { status: failed ? 500 : 204 });
  } catch (error) {
    logRouteError(error, {
      category: "backup_failure",
      ipAddress: getClientIpAddress(request.headers),
      message: "The backup failed.",
      path: getRequestPathname(request),
    });

    return new NextResponse(null, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
