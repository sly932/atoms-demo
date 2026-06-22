import { NextResponse } from "next/server";
import { requireOwnedProject, HttpError } from "@/lib/auth";
import { getVersion, updateProjectHtml, addMessage, addVersion, countVersions } from "@/lib/repo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireOwnedProject(id);
    const { versionId } = await req.json().catch(() => ({ versionId: "" }));
    const version = await getVersion(String(versionId));
    if (!version || version.project_id !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    await updateProjectHtml(id, version.html);
    const n = await countVersions(id);
    await addVersion(id, `v${n + 1}`, `restore of ${version.label}`, version.html);
    await addMessage(id, "assistant", `Restored ${version.label}.`);
    return NextResponse.json({ ok: true, html: version.html });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
