import { createClient, type Client } from "@libsql/client";

// A single libSQL client reused across hot reloads / serverless invocations.
// Local dev: DATABASE_URL=file:./data/atoms.db  (no account, fully offline)
// Production: DATABASE_URL=libsql://<db>.turso.io + DATABASE_AUTH_TOKEN
declare global {
  // eslint-disable-next-line no-var
  var __atoms_db__: Client | undefined;
  // eslint-disable-next-line no-var
  var __atoms_db_ready__: Promise<void> | undefined;
}

function makeClient(): Client {
  const url = process.env.DATABASE_URL || "file:./data/atoms.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
  return createClient({ url, authToken });
}

export const db: Client = global.__atoms_db__ ?? makeClient();
if (process.env.NODE_ENV !== "production") global.__atoms_db__ = db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  html        TEXT NOT NULL DEFAULT '',
  published   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  label       TEXT NOT NULL,
  prompt      TEXT NOT NULL DEFAULT '',
  html        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_versions_project ON versions(project_id);
`;

// Run once per process. Idempotent (CREATE IF NOT EXISTS) so safe everywhere.
export async function ensureSchema(): Promise<void> {
  if (!global.__atoms_db_ready__) {
    global.__atoms_db_ready__ = (async () => {
      const stmts = SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);
      for (const sql of stmts) await db.execute(sql);
    })();
  }
  return global.__atoms_db_ready__;
}
