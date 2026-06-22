import { cookies } from "next/headers";
import { createHmac } from "crypto";

const COOKIE = "atoms_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

// Signed cookie value: "<userId>.<hmac>" — tamper-evident without a session store.
function sign(userId: string): string {
  const sig = createHmac("sha256", secret()).update(userId).digest("base64url");
  return `${userId}.${sig}`;
}

function verify(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const userId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(userId).digest("base64url");
  return sig === expected ? userId : null;
}

export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return verify(jar.get(COOKIE)?.value);
}
