"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; username: string };
type Project = { id: string; title: string; updated_at: number; published: number };

const EXAMPLES = [
  "A pomodoro focus timer with a task list and a daily streak counter",
  "A tip calculator that splits the bill across people",
  "A markdown note-taking app with live preview and local saving",
  "A retro snake game with a high-score board",
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [prompt, setPrompt] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    const r = await fetch("/api/projects");
    if (r.ok) setProjects((await r.json()).projects || []);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/me");
      const data = await r.json();
      setUser(data.user);
      if (data.user) await loadProjects();
      setLoading(false);
    })();
  }, [loadProjects]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) return setError(data.error || "Sign in failed");
    setUser(data.user);
    await loadProjects();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setProjects([]);
  }

  async function create(initial: string) {
    const text = initial.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: text }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) return setError(data.error || "Could not create project");
    router.push(`/build/${data.project.id}?prompt=${encodeURIComponent(text)}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center text-muted">
        <div className="animate-pulse-soft">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-edge">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent grid place-items-center font-bold text-white">A</div>
          <span className="font-semibold tracking-tight">Atoms</span>
          <span className="text-xs text-muted ml-1 hidden sm:inline">· agent-driven app builder</span>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">@{user.username}</span>
            <button onClick={signOut} className="text-muted hover:text-white">
              Sign out
            </button>
          </div>
        )}
      </header>

      {!user ? (
        <section className="max-w-md mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Build a web app by describing it.</h1>
          <p className="text-muted mt-3">
            Pick a handle to start. No password — this is a demo workspace that remembers your projects.
          </p>
          <form onSubmit={signIn} className="mt-8 flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your handle (e.g. sly)"
              className="flex-1 bg-panel border border-edge rounded-lg px-4 py-3 focus:outline-none focus:border-accent"
            />
            <button
              disabled={busy}
              className="bg-accent hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg px-5"
            >
              Enter
            </button>
          </form>
          {error && <p className="text-rose-400 text-sm mt-3">{error}</p>}
        </section>
      ) : (
        <section className="max-w-3xl mx-auto px-6 py-14">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
            What do you want to build?
          </h1>
          <p className="text-muted mt-3 text-center">
            Describe an app in plain language. The agent writes it and runs it live.
          </p>

          <div className="mt-8 bg-panel border border-edge rounded-2xl p-3 focus-within:border-accent">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") create(prompt);
              }}
              rows={3}
              placeholder="e.g. A habit tracker with a weekly grid I can tick off and a progress bar…"
              className="w-full bg-transparent resize-none px-3 py-2 focus:outline-none placeholder:text-muted"
            />
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-muted">⌘/Ctrl + Enter to build</span>
              <button
                onClick={() => create(prompt)}
                disabled={busy || !prompt.trim()}
                className="bg-accent hover:opacity-90 disabled:opacity-40 text-white font-medium rounded-lg px-5 py-2"
              >
                {busy ? "Creating…" : "Build it →"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="text-xs text-muted border border-edge rounded-full px-3 py-1.5 hover:border-accent hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>

          {error && <p className="text-rose-400 text-sm mt-4 text-center">{error}</p>}

          {projects.length > 0 && (
            <div className="mt-14">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-widest mb-3">
                Your projects
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/build/${p.id}`)}
                    className="text-left bg-panel border border-edge rounded-xl p-4 hover:border-accent transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate pr-2">{p.title}</span>
                      {p.published ? (
                        <span className="text-[10px] text-accent2 border border-accent2/40 rounded-full px-2 py-0.5">
                          live
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(p.updated_at).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
