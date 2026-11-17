import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";

import { ServiceConfigurationError } from "../service-config.ts";
import { resolveStorageDriver, supportsDirectUploads } from "./driver.ts";
import { createGcsStorageService, type GcsBucket } from "./gcs.ts";
import { StorageObjectNotFoundError } from "./types.ts";

type Stored = { body: Buffer; contentType: string };

function gcsError(code: number) {
  return Object.assign(new Error(`GCS ${String(code)}`), { code });
}

// An in-memory bucket that answers like GCS does: 404 for a missing object,
// 412 for a write that asked for "only if absent" and found one.
function createFakeBucket(): GcsBucket & { objects: Map<string, Stored> } {
  const objects = new Map<string, Stored>();

  return {
    file(name) {
      const find = () => {
        const stored = objects.get(name);

        if (!stored) {
          throw gcsError(404);
        }

        return stored;
      };

      return {
        createReadStream: () => Readable.from([find().body]),
        async delete({ ignoreNotFound }) {
          if (!objects.delete(name) && !ignoreNotFound) {
            throw gcsError(404);
          }
        },
        async download() {
          return [find().body];
        },
        async getMetadata() {
          const stored = find();

          return [
            {
              contentType: stored.contentType,
              etag: "etag",
              size: String(stored.body.byteLength),
            },
          ];
        },
        async save(data, options) {
          if (options.preconditionOpts && objects.has(name)) {
            throw gcsError(412);
          }

          objects.set(name, { body: data, contentType: options.contentType });
        },
      };
    },
    name: "signudoc-files",
    objects,
  };
}

test("an object written can be read back whole, streamed and measured", async () => {
  const storage = createGcsStorageService({ bucket: createFakeBucket() });
  const body = new Uint8Array([1, 2, 3, 4]);

  await storage.putObject({
    body,
    contentType: "application/pdf",
    key: "a/b.pdf",
  });

  const whole = await storage.getObject("a/b.pdf");

  assert.deepEqual(whole.body, body);
  assert.equal(whole.contentType, "application/pdf");
  assert.equal(whole.bucketName, "signudoc-files");

  const streamed = await storage.getObjectStream("a/b.pdf");

  assert.equal(streamed.contentLength, 4);
  assert.deepEqual(
    new Uint8Array(await new Response(streamed.stream).arrayBuffer()),
    body,
  );
  assert.deepEqual(await storage.headObject("a/b.pdf"), {
    bucketName: "signudoc-files",
    contentLength: 4,
    contentType: "application/pdf",
    etag: "etag",
    exists: true,
    key: "a/b.pdf",
  });
});

test("a missing object is reported the way the other drivers report it", async () => {
  const storage = createGcsStorageService({ bucket: createFakeBucket() });

  await assert.rejects(
    storage.getObject("nope.pdf"),
    StorageObjectNotFoundError,
  );
  await assert.rejects(
    storage.getObjectStream("nope.pdf"),
    StorageObjectNotFoundError,
  );
  assert.equal((await storage.headObject("nope.pdf")).exists, false);
  await storage.deleteObject("nope.pdf");
});

test("writing a key again replaces it, unless the caller asked to keep what is there", async () => {
  const storage = createGcsStorageService({ bucket: createFakeBucket() });
  const put = (value: number, keepExisting?: boolean) =>
    storage.putObject({
      body: new Uint8Array([value]),
      contentType: "application/pdf",
      key: "k.pdf",
      keepExisting,
    });

  await put(1);
  await put(2, true);
  assert.deepEqual(
    (await storage.getObject("k.pdf")).body,
    new Uint8Array([1]),
  );

  await put(3);
  assert.deepEqual(
    (await storage.getObject("k.pdf")).body,
    new Uint8Array([3]),
  );
});

test("a failed write is a failure, even when the caller asked to keep what is there", async () => {
  const bucket = createFakeBucket();
  const storage = createGcsStorageService({
    bucket: {
      ...bucket,
      file: (name) => ({
        ...bucket.file(name),
        save: async () => {
          throw gcsError(503);
        },
      }),
    },
  });

  await assert.rejects(
    storage.putObject({
      body: new Uint8Array([1]),
      contentType: "application/pdf",
      key: "k.pdf",
      keepExisting: true,
    }),
    /GCS 503/,
  );
});

test("without a bucket the driver says which setting is missing", () => {
  assert.throws(
    () => createGcsStorageService({ env: {} }),
    ServiceConfigurationError,
  );
});

test("GCS_BUCKET picks the gcs driver, and uploads go through the app", () => {
  assert.equal(resolveStorageDriver({ GCS_BUCKET: "files" }), "gcs");
  assert.equal(
    resolveStorageDriver({ GCS_BUCKET: "files", STORAGE_DRIVER: "local" }),
    "local",
  );
  assert.equal(resolveStorageDriver({ STORAGE_DRIVER: "gcs" }), "gcs");
  assert.equal(supportsDirectUploads({ GCS_BUCKET: "files" }), false);
});
