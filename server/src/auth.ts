import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing with scrypt (salt stored alongside the hash). No external deps.
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function secret() {
  return process.env.JWT_SECRET ?? "change-me-before-production";
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

// Minimal signed JWT (HMAC-SHA256). Sufficient for single-server invite auth.
export function signToken(payload: { sub: string; email: string }, ttlSeconds = 60 * 60 * 24 * 30, nowMs = Date.now()) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(nowMs / 1000), exp: Math.floor(nowMs / 1000) + ttlSeconds }));
  const sig = createHmac("sha256", secret()).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string, nowMs = Date.now()): { sub: string; email: string } | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", secret()).update(`${header}.${body}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      sub: string;
      email: string;
      exp: number;
    };
    if (payload.exp * 1000 < nowMs) return undefined;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return undefined;
  }
}
