type IpEnv = Record<string, string | undefined>;

function firstAddress(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

/**
 * On Cloud Run, Google's front end appends the address it saw to
 * x-forwarded-for, after anything the visitor sent, so the first entry can
 * be forged and the last one cannot. A Google Cloud load balancer in front
 * of the service adds its own address after that: set TRUSTED_PROXY_HOPS=1
 * to step over it.
 * https://cloud.google.com/run/docs/reference/container-contract#request-headers
 */
function cloudRunAddress(value: string | null, env: IpEnv): string | null {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "0", 10);

  return entries[entries.length - 1 - (hops > 0 ? hops : 0)] ?? null;
}

/**
 * The headers that carry the visitor's address, most trustworthy first.
 *
 * On Vercel, x-vercel-forwarded-for and x-real-ip are written by Vercel
 * itself and cannot be set by the visitor, so they come first.
 * https://vercel.com/docs/headers/request-headers
 *
 * Anywhere else those two names mean nothing special and anyone could send
 * them, so the usual proxy headers are used instead.
 */
export function getClientIpHeaderNames(env: IpEnv = process.env): string[] {
  if (env.K_SERVICE) {
    return ["x-forwarded-for"];
  }

  return env.VERCEL === "1"
    ? ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]
    : ["x-forwarded-for", "cf-connecting-ip", "x-real-ip"];
}

export function getClientIpAddress(
  headers: Headers,
  env: IpEnv = process.env,
): string | null {
  for (const name of getClientIpHeaderNames(env)) {
    const address = env.K_SERVICE
      ? cloudRunAddress(headers.get(name), env)
      : firstAddress(headers.get(name));

    if (address) {
      return address;
    }
  }

  return null;
}

export function getRequestUserAgent(headers: Headers): string | null {
  // A header sent with no value reads as "", which the audit schema
  // rejects; it counts as no user agent at all.
  return headers.get("user-agent")?.trim() || null;
}

/** Who made a request, as the audit trail records it. */
export type RequestClient = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getRequestClient(
  headers: Headers | null | undefined,
  env: IpEnv = process.env,
): { ipAddress: string | null; userAgent: string | null } {
  if (!headers) {
    return { ipAddress: null, userAgent: null };
  }

  return {
    ipAddress: getClientIpAddress(headers, env),
    userAgent: getRequestUserAgent(headers),
  };
}

export function getRequestPathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}
