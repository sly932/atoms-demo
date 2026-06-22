"use client";

import { useEffect, useRef, useState, useCallback, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Project = { id: string; title: string; html: string; published: number };
type Message = { id: string; role: "user" | "assistant"; content: string; created_at: number };
type Version = { id: string; label: string; prompt: string; created_at: number };

function cleanHtml(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) out = out.replace(/^```(?:html)?\s*/i, "").replace(/```$/i, "").trim();
  return out;
}

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center text-muted">Loading…</main>}>
      <Builder params={params} />
    </Suspense>
  );
}

function Builder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const initialPrompt = search.get("prompt") || "";

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [html, setHtml] = useState("");
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState("");
  const startedRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const refetch = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`);
    if (r.status === 401) {
      router.push("/");
      return null;
    }
    if (!r.ok) {
      setNotFound(true);
      return null;
    }
    const data = await r.json();
    setProject(data.project);
    setMessages(data.messages);
    setVersions(data.versions);
    if (data.project.html) setHtml(data.project.html);
    return data;
  }, [id, router]);

  const generate = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || generating) return;
      setInput("");
      setGenerating(true);
      setMessages((m) => [
        ...m,
        { id: `tmp_${Date.now()}`, role: "user", content: text, created_at: Date.now() },
      ]);
      setTab("preview");
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: id, message: text }),
        });
        if (!res.ok || !res.body) {
          flash("Generation failed");
          setGenerating(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setHtml(cleanHtml(acc));
        }
      } catch {
        flash("Network error during generation");
      } finally {
        setGenerating(false);
        await refetch();
      }
    },
    [id, generating, refetch]
  );

  useEffect(() => {
    (async () => {
      const data = await refetch();
      if (data && initialPrompt && data.messages.length === 0 && !startedRef.current) {
        startedRef.current = true;
        generate(initialPrompt);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generating]);

  async function togglePublish() {
    if (!project) return;
    const next = !project.published;
    const r = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (r.ok) {
      setProject((p) => (p ? { ...p, published: next ? 1 : 0 } : p));
      flash(next ? "Published — anyone with the link can run it" : "Unpublished");
    }
  }

  async function restore(versionId: string) {
    const r = await fetch(`/api/projects/${id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (r.ok) {
      const data = await r.json();
      setHtml(data.html);
      await refetch();
      flash("Version restored");
    }
  }

  function copyShare() {
    const url = `${window.location.origin}/p/${id}`;
    navigator.clipboard?.writeText(url);
    flash("Share link copied");
  }

  if (notFound) {
    return (
      <main className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <p className="text-lg font-medium">Project not found</p>
          <button onClick={() => router.push("/")} className="text-accent mt-3">
            ← Back home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-edge shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/")} className="text-muted hover:text-white shrink-0">
            ←
          </button>
          <div className="w-6 h-6 rounded-md bg-accent grid place-items-center font-bold text-white text-sm shrink-0">
            A
          </div>
          <span className="font-medium truncate">{project?.title || "Loading…"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm shrink-0">
          {project?.published ? (
            <button onClick={copyShare} className="text-accent2 border border-accent2/40 rounded-lg px-3 py-1.5 hover:bg-accent2/10">
              Copy share link
            </button>
          ) : null}
          <button
            onClick={togglePublish}
            disabled={!html}
            className="border border-edge rounded-lg px-3 py-1.5 hover:border-accent disabled:opacity-40"
          >
            {project?.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left: chat */}
        <div className="w-[380px] shrink-0 border-r border-edge flex flex-col min-h-0">
          <div ref={chatRef} className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
            {messages.length === 0 && !generating && (
              <p className="text-muted text-sm">
                Describe what to build or change. Each turn produces a new running version.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-6 bg-accent/15 border border-accent/30 rounded-xl px-3 py-2 text-sm"
                    : "mr-6 bg-panel border border-edge rounded-xl px-3 py-2 text-sm text-muted"
                }
              >
                {m.content}
              </div>
            ))}
            {generating && (
              <div className="mr-6 bg-panel border border-edge rounded-xl px-3 py-2 text-sm text-muted">
                <span className="animate-pulse-soft">Agent is building the app…</span>
              </div>
            )}
          </div>

          {versions.length > 0 && (
            <div className="border-t border-edge p-3">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-2">
                Version history
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scroll-thin">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    title={v.prompt}
                    onClick={() => restore(v.id)}
                    className="text-xs border border-edge rounded-md px-2 py-1 hover:border-accent text-muted hover:text-white"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-edge p-3 shrink-0">
            <div className="bg-panel border border-edge rounded-xl p-2 focus-within:border-accent">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate(input);
                }}
                rows={2}
                placeholder={messages.length ? "Describe a change…" : "Describe your app…"}
                disabled={generating}
                className="w-full bg-transparent resize-none px-2 py-1 text-sm focus:outline-none placeholder:text-muted disabled:opacity-50"
              />
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] text-muted">⌘/Ctrl + Enter</span>
                <button
                  onClick={() => generate(input)}
                  disabled={generating || !input.trim()}
                  className="bg-accent hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-1.5"
                >
                  {generating ? "Building…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: preview / code */}
        <div className="flex-1 flex flex-col min-h-0 bg-ink">
          <div className="flex items-center justify-between px-3 py-2 border-b border-edge shrink-0">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("preview")}
                className={`text-sm px-3 py-1 rounded-md ${tab === "preview" ? "bg-panel text-white" : "text-muted"}`}
              >
                Preview
              </button>
              <button
                onClick={() => setTab("code")}
                className={`text-sm px-3 py-1 rounded-md ${tab === "code" ? "bg-panel text-white" : "text-muted"}`}
              >
                Code
              </button>
            </div>
            <div className="flex gap-3 text-sm text-muted">
              {html && (
                <button onClick={() => { navigator.clipboard?.writeText(html); flash("Code copied"); }} className="hover:text-white">
                  Copy code
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {!html ? (
              <div className="h-full grid place-items-center text-muted text-sm">
                {generating ? <span className="animate-pulse-soft">Generating…</span> : "Your app preview will appear here."}
              </div>
            ) : tab === "preview" ? (
              <iframe
                title="preview"
                srcDoc={html}
                className="w-full h-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : (
              <pre className="h-full overflow-auto scroll-thin text-xs p-4 text-muted font-mono whitespace-pre-wrap">
                {html}
              </pre>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-panel border border-edge rounded-lg px-4 py-2 text-sm">
          {toast}
        </div>
      )}
    </main>
  );
}
