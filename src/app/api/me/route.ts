import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getUser } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ user: null });
  const user = await getUser(uid);
  return NextResponse.json({ user: user ? { id: user.id, username: user.username } : null });
}
