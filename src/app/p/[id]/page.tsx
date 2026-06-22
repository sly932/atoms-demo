import Link from "next/link";
import { getProject } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PublicApp({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project || !project.published || !project.html) {
    return (
      <main className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <p className="text-lg font-medium">This app isn’t available</p>
          <p className="text-muted text-sm mt-1">
            It may be unpublished or the link is wrong.
          </p>
          <Link href="/" className="text-accent mt-3 inline-block">
            Build your own →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-edge shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-accent grid place-items-center font-bold text-white text-xs shrink-0">
            A
          </div>
          <span className="text-sm font-medium truncate">{project.title}</span>
          <span className="text-xs text-muted shrink-0">· made with Atoms</span>
        </div>
        <Link href="/" className="text-xs text-accent shrink-0">
          Build your own →
        </Link>
      </header>
      <iframe
        title={project.title}
        srcDoc={project.html}
        className="flex-1 w-full bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </main>
  );
}
