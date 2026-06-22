# Atoms Demo — describe an app, watch it build

An agent-driven app builder in the spirit of [Atoms](https://atoms.dev/). You
describe a web app in plain language; an LLM agent writes a complete, runnable
single-file web app; it renders **live in a sandboxed preview**; and you keep
iterating in a chat. Every turn is persisted, every version is restorable, and
any app can be published to a public, shareable run link.

> Built for the DeepWisdom / ROOT "Atoms Demo" home test. See
> [`说明文档.md`](./说明文档.md) for the Chinese write-up (实现思路 / 取舍 / 完成度 / 扩展优先级).

---

## What it does

- **Agent-driven generation** — natural-language prompt → a full `<!DOCTYPE html>`
  app (inline HTML/CSS/JS), streamed token-by-token from DeepSeek (via SiliconFlow,
  OpenAI-compatible API).
- **Real interaction, not a mockup** — the generated app runs for real inside a
  sandboxed `<iframe>`; you can click, type, and use it immediately.
- **Iterative editing** — follow-up messages ("make it dark", "add a reset
  button") send the current code + your request back to the agent, which returns
  the full updated app.
- **Data persistence** — users, projects, chat messages and every generated
  version are stored in libSQL/SQLite (local file in dev, Turso in prod).
- **Version history** — every generation is a restorable version (`v1, v2, …`).
- **Publish & share** — one click publishes an app to `/(p)/{id}`, a public,
  read-only run link anyone can open.

## Core flow (covers init / register / main loop + an extension)

```
sign in (handle)  →  describe app  →  agent generates & streams  →  live preview
        │                                      │
        │                                      ├─ iterate in chat (multi-turn edit)
        │                                      ├─ restore any past version
        └─ projects persisted per user         └─ publish → public share link
```

---

## Tech stack & key choices

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router, TS)** | One codebase for UI + API routes; first-class on Vercel (the task's suggested target). |
| LLM | **DeepSeek-V4-Pro via SiliconFlow** | OpenAI-compatible `/chat/completions` with streaming; configurable by env. |
| Persistence | **libSQL / Turso** | SQLite semantics (matches the task's SQLite hint) **and** works on Vercel's ephemeral serverless FS. A `file:` URL runs fully offline in dev; Turso is the hosted prod backend. |
| Preview isolation | **sandboxed `<iframe srcDoc>`** | The generated app runs in the browser with no server execution — safe and instant. |
| Auth | **signed-cookie session, handle-only** | Minimal init/register flow appropriate for a demo; HMAC-signed, httpOnly, tamper-evident, no session store. |

Generation is **resilient**: if no API key is set or the upstream call fails, the
server falls back to a deterministic, genuinely interactive (localStorage-backed)
template app so the end-to-end flow always works.

---

## Project structure

```
src/
  app/
    page.tsx                     landing: sign-in + new app + project list
    build/[id]/page.tsx          builder: chat · streaming preview · versions · publish
    p/[id]/page.tsx              public read-only run view for a published app
    api/
      auth/login · logout        handle-based session
      me                         current user
      projects · projects/[id]   list / create / get / rename / publish / delete
      generate                   streaming agent generation (the core)
      projects/[id]/restore      restore a version
      projects/[id]/versions/[vid]
  lib/
    db.ts        libSQL client + idempotent schema
    repo.ts      typed data-access layer (users/projects/messages/versions)
    llm.ts       agent core: streaming generation + prompt + offline fallback
    session.ts   HMAC-signed cookie sessions
    auth.ts      requireUserId / requireOwnedProject guards
scripts/
  test-llm.mjs   verify your SiliconFlow key + model id
```

---

## Run locally

```bash
cp .env.example .env.local        # then fill in SILICONFLOW_API_KEY
npm install
npm run dev                       # http://localhost:3000
```

Defaults in `.env.example` use a local SQLite file (`file:./data/atoms.db`), so
the app runs with **no database account**. Add your `SILICONFLOW_API_KEY` to get
real generation; without it you still get the offline fallback app.

Verify the model connection on its own:

```bash
npm run test:llm
# → ✓ Success. Model replied: OK, SiliconFlow is reachable.
```

## Deploy to Vercel + Turso

1. **Database (Turso):**
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth signup
   turso db create atoms-demo
   turso db show atoms-demo --url            # → DATABASE_URL  (libsql://…)
   turso db tokens create atoms-demo         # → DATABASE_AUTH_TOKEN
   ```
2. **Vercel:** import the GitHub repo, then set env vars:
   `SILICONFLOW_API_KEY`, `SILICONFLOW_BASE_URL`, `SILICONFLOW_MODEL`,
   `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`.
3. Deploy. Tables are created automatically on first request (idempotent
   `CREATE TABLE IF NOT EXISTS`).

---

## Environment variables

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `SILICONFLOW_API_KEY` | for real gen | — | Without it, the offline fallback is used. |
| `SILICONFLOW_BASE_URL` | no | `https://api.siliconflow.cn/v1` | OpenAI-compatible base (no trailing `/chat/completions`). |
| `SILICONFLOW_MODEL` | no | `deepseek-ai/DeepSeek-V4-Pro` | Any chat model on SiliconFlow. |
| `DATABASE_URL` | no | `file:./data/atoms.db` | `libsql://…` in prod. |
| `DATABASE_AUTH_TOKEN` | prod | — | Turso token. |
| `SESSION_SECRET` | prod | dev fallback | Long random string. |

---

## Verification status

- `tsc --noEmit` — **0 errors** across the project (types, imports, JSX).
- Data layer — unit-checked end to end (schema, CRUD, stable ordering, delete).
- LLM helpers — unit-checked (`extractHtml`, `looksLikeHtml`, `fallbackApp`).

---

## Known trade-offs (intentional for a 6–8h demo)

- The preview iframe uses `allow-scripts allow-same-origin` so generated apps can
  use `localStorage`. A production build would render previews on a separate
  sandbox origin to fully isolate user-generated code.
- Auth is handle-only (no password) — a demo workspace, not real account security.
- Generation returns the whole HTML file each turn (no diffing) — simple and
  robust; a token-cost optimization is listed in the extension plan.
