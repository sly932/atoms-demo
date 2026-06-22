import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/repo";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username } = await req.json().catch(() => ({ username: "" }));
  const name = String(username || "").trim();
  if (name.length < 2 || name.length > 24 || !/^[a-zA-Z0-9_\-\.]+$/.test(name)) {
    return NextResponse.json(
      { error: "Username must be 2–24 chars: letters, numbers, _ - ." },
      { status: 400 }
    );
  }
  const user = await upsertUser(name);
  await setSession(user.id);
  return NextResponse.json({ user: { id: user.id, username: user.username } });
}
