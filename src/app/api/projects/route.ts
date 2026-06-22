import { NextResponse } from "next/server";
import { requireUserId, HttpError } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const uid = await requireUserId();
    const projects = await listProjects(uid);
    return NextResponse.json({ projects });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const uid = await requireUserId();
    const { title } = await req.json().catch(() => ({ title: "" }));
    const project = await createProject(uid, String(title || "Untitled app"));
    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
