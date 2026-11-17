import assert from "node:assert/strict";
import { test } from "node:test";

import { auditEventRecordSchema } from "../schemas/envelope.ts";
import {
  getClientIpAddress,
  getClientIpHeaderNames,
  getRequestUserAgent,
} from "./request.ts";

const onVercel = { VERCEL: "1" };
const elsewhere = {};

test("on Vercel, the address Vercel wrote wins over one the visitor could have sent", () => {
  const headers = new Headers({
    "cf-connecting-ip": "198.51.100.9",
    "x-forwarded-for": "198.51.100.7",
    "x-real-ip": "203.0.113.5",
    "x-vercel-forwarded-for": "203.0.113.5",
  });

  assert.equal(getClientIpAddress(headers, onVercel), "203.0.113.5");
  assert.equal(
    getClientIpAddress(
      new Headers({
        "x-forwarded-for": "198.51.100.7",
        "x-real-ip": "203.0.113.5",
      }),
      onVercel,
    ),
    "203.0.113.5",
  );
});

test("off Vercel, Vercel's header means nothing and the proxy headers are used", () => {
  const headers = new Headers({
    "x-forwarded-for": "198.51.100.7, 10.0.0.1",
    "x-vercel-forwarded-for": "203.0.113.5",
  });

  assert.equal(getClientIpAddress(headers, elsewhere), "198.51.100.7");
  assert.equal(
    getClientIpAddress(
      new Headers({ "cf-connecting-ip": "198.51.100.9" }),
      elsewhere,
    ),
    "198.51.100.9",
  );
  assert.equal(
    getClientIpHeaderNames(elsewhere).includes("x-vercel-forwarded-for"),
    false,
  );
});

test("on Cloud Run, the address Google appended is the last one, not a forged first one", () => {
  const onCloudRun = { K_SERVICE: "signudoc" };
  const headers = new Headers({
    "cf-connecting-ip": "198.51.100.9",
    "x-forwarded-for": "192.0.2.1, 203.0.113.5",
    "x-real-ip": "198.51.100.8",
  });

  assert.equal(getClientIpAddress(headers, onCloudRun), "203.0.113.5");
  assert.deepEqual(getClientIpHeaderNames(onCloudRun), ["x-forwarded-for"]);
});

test("behind a Google load balancer, TRUSTED_PROXY_HOPS steps over its address", () => {
  const behindBalancer = { K_SERVICE: "signudoc", TRUSTED_PROXY_HOPS: "1" };
  const headers = new Headers({
    "x-forwarded-for": "192.0.2.1, 203.0.113.5, 35.191.0.1",
  });

  assert.equal(getClientIpAddress(headers, behindBalancer), "203.0.113.5");
  assert.equal(
    getClientIpAddress(new Headers({ "x-forwarded-for": "35.191.0.1" }), {
      ...behindBalancer,
      TRUSTED_PROXY_HOPS: "5",
    }),
    null,
  );
});

test("an empty header is passed over, and no header at all gives no address", () => {
  assert.equal(
    getClientIpAddress(
      new Headers({ "x-forwarded-for": " ", "x-real-ip": "203.0.113.5" }),
      elsewhere,
    ),
    "203.0.113.5",
  );
  assert.equal(getClientIpAddress(new Headers(), onVercel), null);
});

test("a user agent header with no value counts as no user agent", () => {
  assert.equal(getRequestUserAgent(new Headers()), null);
  assert.equal(getRequestUserAgent(new Headers({ "user-agent": "" })), null);
  assert.equal(getRequestUserAgent(new Headers({ "user-agent": "  " })), null);
  assert.equal(
    getRequestUserAgent(new Headers({ "user-agent": " curl/8.5.0 " })),
    "curl/8.5.0",
  );
});

test("the audit schema accepts what an empty user agent header gives", () => {
  const userAgent = getRequestUserAgent(new Headers({ "user-agent": "" }));

  assert.ok(
    auditEventRecordSchema.shape.userAgent.safeParse(userAgent).success,
  );
});
