import { NextResponse } from "next/server";
import { requireOwnedProject, HttpError } from "@/lib/auth";
import { getVersion } from "@/lib/repo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; vid: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, vid } = await params;
    await requireOwnedProject(id);
    const version = await getVersion(vid);
    if (!version || version.project_id !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json({ version });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
