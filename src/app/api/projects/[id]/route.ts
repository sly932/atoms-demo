import { NextResponse } from "next/server";
import { requireOwnedProject, HttpError } from "@/lib/auth";
import {
  listMessages,
  listVersions,
  deleteProject,
  renameProject,
  setPublished,
  getProject,
} from "@/lib/repo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { project } = await requireOwnedProject(id);
    const [messages, versions] = await Promise.all([listMessages(id), listVersions(id)]);
    return NextResponse.json({ project, messages, versions });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireOwnedProject(id);
    const body = await req.json().catch(() => ({}));
    if (typeof body.title === "string") await renameProject(id, body.title);
    if (typeof body.published === "boolean") await setPublished(id, body.published);
    const project = await getProject(id);
    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireOwnedProject(id);
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
