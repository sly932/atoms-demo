import { getSessionUserId } from "./session";
import { getProject, type Project } from "./repo";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Returns the signed-in user id or throws a 401-bearing HttpError.
export async function requireUserId(): Promise<string> {
  const uid = await getSessionUserId();
  if (!uid) throw new HttpError(401, "Not signed in");
  return uid;
}

// Loads a project and asserts the signed-in user owns it.
export async function requireOwnedProject(projectId: string): Promise<{ userId: string; project: Project }> {
  const userId = await requireUserId();
  const project = await getProject(projectId);
  if (!project) throw new HttpError(404, "Project not found");
  if (project.user_id !== userId) throw new HttpError(403, "Forbidden");
  return { userId, project };
}
