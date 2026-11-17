import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { Storage } from "@google-cloud/storage";

import { type BackupStore, readKeepDays } from "./backup.ts";
import { readEnv, type EnvSource } from "./utils/env.ts";

// The backup (src/lib/backup.ts) on Google Cloud Storage: the app's bucket
// is copied to a second bucket, which should live in another project so that
// deleting the install's project does not take the backup with it.
// BACKUP_GCS_BUCKET names it; the backup is off until that is set.

export type GcsBackupSettings = { bucket: string; keepDays: number };

/** The GCS backup settings, or null when backups are not set up. */
export function readGcsBackupSettings(
  env: EnvSource = process.env,
): GcsBackupSettings | null {
  const bucket = readEnv(env, "BACKUP_GCS_BUCKET");

  return bucket ? { bucket, keepDays: readKeepDays(env) } : null;
}

/**
 * True when the backup bucket is the app's own. A backup there would not
 * survive what it is for, and would copy itself every night.
 */
export function isBackupBucketTheAppBucket(
  settings: GcsBackupSettings,
  env: EnvSource = process.env,
): boolean {
  return settings.bucket === readEnv(env, "GCS_BUCKET");
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 404;
}

/** A private GCS bucket as a backup store: the app's, or the backup's. */
export function createGcsBackupStore(bucketName: string): BackupStore {
  const bucket = new Storage().bucket(bucketName);

  return {
    async delete(pathnames) {
      await Promise.all(
        pathnames.map((pathname) =>
          bucket.file(pathname).delete({ ignoreNotFound: true }),
        ),
      );
    },
    async get(pathname) {
      const file = bucket.file(pathname);

      try {
        const [metadata] = await file.getMetadata();

        return {
          contentType: metadata.contentType ?? "application/octet-stream",
          stream: Readable.toWeb(
            file.createReadStream(),
          ) as ReadableStream<Uint8Array>,
        };
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }

        throw error;
      }
    },
    async list({ cursor, prefix }) {
      const [files, next] = await bucket.getFiles({
        autoPaginate: false,
        maxResults: 1000,
        pageToken: cursor,
        prefix,
      });
      const pageToken = (next as { pageToken?: string } | null)?.pageToken;

      return {
        blobs: files.map((file) => ({
          pathname: file.name,
          size: Number(file.metadata.size ?? 0),
          uploadedAt: new Date(file.metadata.updated ?? 0),
        })),
        cursor: pageToken,
        hasMore: Boolean(pageToken),
      };
    },
    async put(pathname, body, { contentType }) {
      const file = bucket.file(pathname);

      if (typeof body === "string" || Buffer.isBuffer(body)) {
        await file.save(body, { contentType, resumable: false });
        return;
      }

      const source =
        body instanceof Readable
          ? body
          : Readable.fromWeb(body as import("node:stream/web").ReadableStream);

      await pipeline(
        source,
        file.createWriteStream({ contentType, resumable: false }),
      );
    },
  };
}
