import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE_NAME = "gid";

// The gid cookie is the whole identity, so it must never leave the server:
// anyone holding someone's gid could act as them. Clients get this one-way
// id instead, which is stable per person (so it can drive a colour and a
// "this is you" check) but can't be turned back into the cookie.
export function publicId(gid: string): string {
  return createHash("sha256").update(`garden-public-id:${gid}`).digest("hex").slice(0, 8);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

// No accounts: a random id stamped into a long-lived cookie on first visit
// is the whole of "a person" for this app, matching the brief's "distinguish
// between users" requirement without any login.
export function getOrSetIdentity(req: IncomingMessage, res: ServerResponse): string {
  const existing = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (existing) return existing;

  const id = randomUUID();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
  );
  return id;
}
