import { requireOwnedProject, HttpError } from "@/lib/auth";
import {
  addMessage,
  listMessages,
  addVersion,
  updateProjectHtml,
  renameProject,
  countVersions,
} from "@/lib/repo";
import { generateApp, fallbackApp, extractHtml, looksLikeHtml, type ChatTurn } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let projectId = "";
  let message = "";
  try {
    const body = await req.json();
    projectId = String(body.projectId || "");
    message = String(body.message || "").trim();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
  if (!message) return new Response(JSON.stringify({ error: "Empty message" }), { status: 400 });

  let project;
  try {
    ({ project } = await requireOwnedProject(projectId));
  } catch (e) {
    if (e instanceof HttpError)
      return new Response(JSON.stringify({ error: e.message }), { status: e.status });
    throw e;
  }

  const currentHtml = project.html || "";
  const prior = await listMessages(projectId);
  const history: ChatTurn[] = prior
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  await addMessage(projectId, "user", message);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = "";
      let usedFallback = false;
      try {
        for await (const delta of generateApp({ history, userMessage: message, currentHtml })) {
          accumulated += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch {
        usedFallback = true;
      }

      let html = extractHtml(accumulated);
      if (usedFallback || !looksLikeHtml(html)) {
        // No key / upstream error / unusable output → deterministic offline app.
        html = fallbackApp(message);
        if (usedFallback) {
          // We streamed nothing useful; deliver the fallback to the live preview.
          controller.enqueue(encoder.encode(html));
        }
      }

      try {
        const n = await countVersions(projectId);
        await addVersion(projectId, `v${n + 1}`, message, html);
        await updateProjectHtml(projectId, html);
        await addMessage(
          projectId,
          "assistant",
          usedFallback
            ? "Generated an offline preview app (no model key configured)."
            : "Updated the app based on your request."
        );
        if (currentHtml === "" && project.title === "Untitled app") {
          await renameProject(projectId, message.slice(0, 60));
        }
      } catch {
        // persistence best-effort; preview already delivered
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
