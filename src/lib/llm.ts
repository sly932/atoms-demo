// Agent core: drives app generation through an OpenAI-compatible chat endpoint
// (SiliconFlow / DeepSeek). Streams a single self-contained HTML document that
// we render live in a sandboxed iframe. Falls back to a deterministic template
// when no API key is configured or the upstream call fails, so the end-to-end
// flow stays demoable offline.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function hasLLM(): boolean {
  return Boolean(process.env.SILICONFLOW_API_KEY);
}

const SYSTEM_PROMPT = `You are Atoms, an AI engineer that turns a plain-language idea into a working single-file web app.

Output rules — follow EXACTLY:
- Reply with ONE complete HTML document and NOTHING else. No explanations, no markdown, no code fences.
- Start with <!DOCTYPE html> and end with </html>.
- Everything (HTML, CSS, JS) goes inline in that one file. No build step.
- The app MUST be genuinely interactive (buttons, inputs, state changes) — never a static mockup.
- Persist the app's own user data with localStorage so it survives a reload.
- You MAY load Tailwind via <script src="https://cdn.tailwindcss.com"></script> and Google Fonts. No other external deps.
- Make it look polished and modern: thoughtful spacing, a clear visual hierarchy, a cohesive color theme.
- Be responsive and keep it accessible (labels, contrast, keyboard friendly).

When the user asks for a change, return the FULL updated HTML document (not a diff).`;

function buildMessages(opts: {
  history: ChatTurn[];
  userMessage: string;
  currentHtml: string;
}) {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  for (const t of opts.history) messages.push({ role: t.role, content: t.content });
  if (opts.currentHtml.trim()) {
    messages.push({
      role: "user",
      content:
        "Here is the current version of the app you previously generated. Apply my next request to it and return the full updated HTML document:\n\n" +
        opts.currentHtml,
    });
  }
  messages.push({ role: "user", content: opts.userMessage });
  return messages;
}

// Streams raw text deltas from the model. Throws on any failure so the caller
// can switch to the deterministic fallback.
export async function* generateApp(opts: {
  history: ChatTurn[];
  userMessage: string;
  currentHtml: string;
}): AsyncGenerator<string> {
  const base = (process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const model = process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V4-Pro";
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) throw new Error("no-api-key");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.4,
      max_tokens: 8192,
      messages: buildMessages(opts),
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`upstream ${res.status}: ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }
}

// Pull a clean HTML document out of whatever the model returned.
export function extractHtml(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/<!doctype html>|<html[\s>]/i);
  if (start > 0) s = s.slice(start);
  return s.trim();
}

export function looksLikeHtml(s: string): boolean {
  return /<\/html>/i.test(s) || /<!doctype html>/i.test(s);
}

// Deterministic offline fallback: a real, interactive, localStorage-backed app
// so the pipeline is demoable without network access to the model.
export function fallbackApp(prompt: string): string {
  const title = prompt.replace(/[<>]/g, "").slice(0, 60) || "My Atoms app";
  const safe = title.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safe}</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-800">
  <div class="max-w-xl mx-auto p-6">
    <header class="mb-6">
      <p class="text-xs uppercase tracking-widest text-indigo-500 font-semibold">Atoms · offline preview</p>
      <h1 class="text-2xl font-bold mt-1">${safe}</h1>
      <p class="text-sm text-slate-500 mt-1">Generated locally without the model (no API key set). It is fully interactive and saves to your browser.</p>
    </header>
    <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <form id="f" class="flex gap-2">
        <input id="i" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Add an item…" />
        <button class="bg-indigo-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-indigo-700">Add</button>
      </form>
      <ul id="list" class="mt-4 space-y-2"></ul>
      <p id="empty" class="text-sm text-slate-400 mt-4">Nothing yet — add your first item.</p>
    </section>
  </div>
<script>
  const KEY = "atoms_fallback_items";
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  let items = JSON.parse(localStorage.getItem(KEY) || "[]");
  function save(){ localStorage.setItem(KEY, JSON.stringify(items)); }
  function render(){
    list.innerHTML = "";
    empty.style.display = items.length ? "none" : "block";
    items.forEach((t, idx) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2";
      const span = document.createElement("span"); span.textContent = t;
      const del = document.createElement("button");
      del.textContent = "Remove"; del.className = "text-xs text-rose-500 hover:underline";
      del.onclick = () => { items.splice(idx,1); save(); render(); };
      li.append(span, del); list.append(li);
    });
  }
  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = document.getElementById("i").value.trim();
    if(!v) return; items.push(v); document.getElementById("i").value=""; save(); render();
  });
  render();
</script>
</body>
</html>`;
}
