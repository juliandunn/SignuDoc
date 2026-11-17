import { Readable } from "node:stream";

import { Storage } from "@google-cloud/storage";

import { type EnvSource } from "../../utils/env.ts";
import { ServiceConfigurationError } from "../service-config.ts";
import {
  normalizeStorageKey,
  type StorageObjectHead,
  StorageObjectNotFoundError,
  type StorageService,
} from "./types.ts";

// Google Cloud Storage, in a private bucket: nothing in it has a public URL,
// and every read goes through the app, which checks who is asking first.
//
// The client finds its own credentials (Application Default Credentials).
// On Cloud Run that is the service's own service account, so no key file or
// secret is involved; give that account Storage Object User on the bucket.

/** The part of a GCS file this driver uses. Replaced by a fake in tests. */
export type GcsFile = {
  createReadStream(): NodeJS.ReadableStream;
  delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
  download(): Promise<[Buffer]>;
  getMetadata(): Promise<
    [
      { contentType?: string; etag?: string; size?: number | string },
      ...unknown[],
    ]
  >;
  save(
    data: Buffer,
    options: {
      contentType: string;
      preconditionOpts?: { ifGenerationMatch: number };
      resumable: false;
    },
  ): Promise<unknown>;
};

export type GcsBucket = {
  file(name: string): GcsFile;
  name: string;
};

type CreateGcsStorageServiceOptions = {
  bucket?: GcsBucket;
  env?: EnvSource;
};

function errorCode(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | null)?.code;

  return typeof code === "number" ? code : undefined;
}

export function createGcsStorageService({
  bucket,
  env = process.env,
}: CreateGcsStorageServiceOptions = {}): StorageService {
  const bucketName = env.GCS_BUCKET?.trim();

  if (!bucket && !bucketName) {
    throw new ServiceConfigurationError("storage", ["GCS_BUCKET"]);
  }

  const resolvedBucket: GcsBucket =
    bucket ?? new Storage().bucket(bucketName as string);

  async function readMetadata(key: string) {
    const normalizedKey = normalizeStorageKey(key);
    const file = resolvedBucket.file(normalizedKey);

    try {
      const [metadata] = await file.getMetadata();

      return { file, metadata, normalizedKey };
    } catch (error) {
      if (errorCode(error) === 404) {
        return { file, metadata: null, normalizedKey };
      }

      throw error;
    }
  }

  function toLength(size: number | string | undefined): number | undefined {
    return size === undefined ? undefined : Number(size);
  }

  return {
    async deleteObject(key) {
      await resolvedBucket
        .file(normalizeStorageKey(key))
        .delete({ ignoreNotFound: true });
    },
    async getObject(key) {
      const normalizedKey = normalizeStorageKey(key);
      const file = resolvedBucket.file(normalizedKey);

      try {
        const [[body], [metadata]] = await Promise.all([
          file.download(),
          file.getMetadata(),
        ]);

        return {
          body: new Uint8Array(body),
          bucketName: resolvedBucket.name,
          contentLength: body.byteLength,
          contentType: metadata.contentType,
          etag: metadata.etag,
          key: normalizedKey,
        };
      } catch (error) {
        if (errorCode(error) === 404) {
          throw new StorageObjectNotFoundError(normalizedKey);
        }

        throw error;
      }
    },
    async getObjectStream(key) {
      const { file, metadata, normalizedKey } = await readMetadata(key);

      if (!metadata) {
        throw new StorageObjectNotFoundError(normalizedKey);
      }

      return {
        bucketName: resolvedBucket.name,
        contentLength: toLength(metadata.size),
        contentType: metadata.contentType,
        key: normalizedKey,
        stream: Readable.toWeb(
          file.createReadStream() as Readable,
        ) as ReadableStream<Uint8Array>,
      };
    },
    async headObject(key): Promise<StorageObjectHead> {
      const { metadata, normalizedKey } = await readMetadata(key);

      if (!metadata) {
        return {
          bucketName: resolvedBucket.name,
          exists: false,
          key: normalizedKey,
        };
      }

      return {
        bucketName: resolvedBucket.name,
        contentLength: toLength(metadata.size),
        contentType: metadata.contentType,
        etag: metadata.etag,
        exists: true,
        key: normalizedKey,
      };
    },
    async putObject(input) {
      const normalizedKey = normalizeStorageKey(input.key);

      try {
        await resolvedBucket.file(normalizedKey).save(Buffer.from(input.body), {
          contentType: input.contentType,
          // Writes only if there is no object under this key, and the
          // bucket itself refuses the second of two writers that arrive
          // together.
          preconditionOpts: input.keepExisting
            ? { ifGenerationMatch: 0 }
            : undefined,
          resumable: false,
        });
      } catch (error) {
        // 412: an object is already stored here, which is what the caller
        // asked to be kept. Any other failure is still a failure.
        if (!(input.keepExisting && errorCode(error) === 412)) {
          throw error;
        }
      }

      return {
        bucketName: resolvedBucket.name,
        key: normalizedKey,
      };
    },
  };
}
