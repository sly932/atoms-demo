import { db, ensureSchema } from "./db";

export type User = { id: string; username: string; created_at: number };
export type Project = {
  id: string;
  user_id: string;
  title: string;
  html: string;
  published: number;
  created_at: number;
  updated_at: number;
};
export type Message = {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
};
export type Version = {
  id: string;
  project_id: string;
  label: string;
  prompt: string;
  html: string;
  created_at: number;
};

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}
const now = () => Date.now();

// ---- users ----
export async function upsertUser(username: string): Promise<User> {
  await ensureSchema();
  const clean = username.trim().toLowerCase();
  const existing = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [clean],
  });
  if (existing.rows.length) return existing.rows[0] as unknown as User;
  const user: User = { id: id("u"), username: clean, created_at: now() };
  await db.execute({
    sql: "INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)",
    args: [user.id, user.username, user.created_at],
  });
  return user;
}

export async function getUser(userId: string): Promise<User | null> {
  await ensureSchema();
  const r = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
  return (r.rows[0] as unknown as User) ?? null;
}

// ---- projects ----
export async function createProject(userId: string, title: string): Promise<Project> {
  await ensureSchema();
  const t = now();
  const p: Project = {
    id: id("p"),
    user_id: userId,
    title: title.slice(0, 80) || "Untitled app",
    html: "",
    published: 0,
    created_at: t,
    updated_at: t,
  };
  await db.execute({
    sql: "INSERT INTO projects (id, user_id, title, html, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [p.id, p.user_id, p.title, p.html, p.published, p.created_at, p.updated_at],
  });
  return p;
}

export async function listProjects(userId: string): Promise<Project[]> {
  await ensureSchema();
  const r = await db.execute({
    sql: "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC",
    args: [userId],
  });
  return r.rows as unknown as Project[];
}

export async function getProject(projectId: string): Promise<Project | null> {
  await ensureSchema();
  const r = await db.execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [projectId] });
  return (r.rows[0] as unknown as Project) ?? null;
}

export async function updateProjectHtml(projectId: string, html: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE projects SET html = ?, updated_at = ? WHERE id = ?",
    args: [html, now(), projectId],
  });
}

export async function renameProject(projectId: string, title: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE projects SET title = ?, updated_at = ? WHERE id = ?",
    args: [title.slice(0, 80), now(), projectId],
  });
}

export async function setPublished(projectId: string, published: boolean): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE projects SET published = ?, updated_at = ? WHERE id = ?",
    args: [published ? 1 : 0, now(), projectId],
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await ensureSchema();
  await db.batch([
    { sql: "DELETE FROM versions WHERE project_id = ?", args: [projectId] },
    { sql: "DELETE FROM messages WHERE project_id = ?", args: [projectId] },
    { sql: "DELETE FROM projects WHERE id = ?", args: [projectId] },
  ]);
}

// ---- messages ----
export async function addMessage(
  projectId: string,
  role: "user" | "assistant",
  content: string
): Promise<Message> {
  await ensureSchema();
  const m: Message = { id: id("m"), project_id: projectId, role, content, created_at: now() };
  await db.execute({
    sql: "INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [m.id, m.project_id, m.role, m.content, m.created_at],
  });
  return m;
}

export async function listMessages(projectId: string): Promise<Message[]> {
  await ensureSchema();
  const r = await db.execute({
    sql: "SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC, rowid ASC",
    args: [projectId],
  });
  return r.rows as unknown as Message[];
}

// ---- versions ----
export async function addVersion(
  projectId: string,
  label: string,
  prompt: string,
  html: string
): Promise<Version> {
  await ensureSchema();
  const v: Version = {
    id: id("v"),
    project_id: projectId,
    label,
    prompt,
    html,
    created_at: now(),
  };
  await db.execute({
    sql: "INSERT INTO versions (id, project_id, label, prompt, html, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [v.id, v.project_id, v.label, v.prompt, v.html, v.created_at],
  });
  return v;
}

export async function listVersions(projectId: string): Promise<Version[]> {
  await ensureSchema();
  const r = await db.execute({
    sql: "SELECT id, project_id, label, prompt, created_at FROM versions WHERE project_id = ? ORDER BY created_at DESC, rowid DESC",
    args: [projectId],
  });
  return r.rows as unknown as Version[];
}

export async function getVersion(versionId: string): Promise<Version | null> {
  await ensureSchema();
  const r = await db.execute({ sql: "SELECT * FROM versions WHERE id = ?", args: [versionId] });
  return (r.rows[0] as unknown as Version) ?? null;
}

export async function countVersions(projectId: string): Promise<number> {
  await ensureSchema();
  const r = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM versions WHERE project_id = ?",
    args: [projectId],
  });
  return Number((r.rows[0] as unknown as { n: number }).n) || 0;
}
