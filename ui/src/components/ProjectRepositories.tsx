import { LegacyProjectRepository } from "./LegacyProjectRepository";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectRepository } from "@clayon/shared";
import { projectsApi } from "@/api/projects";
import { queryKeys } from "@/lib/queryKeys";
import { ConnectionSetupFlow } from "@/features/connections/ConnectionSetupFlow";
import { ProjectRepositoryInput, repositoryOptionsKey } from "./ProjectRepositoryInput";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { SaveStatus } from "./SaveStatus";
import { useAutosave } from "@/hooks/useAutosave";

/** Selection is id-based; order or metadata on the drafts is not "unsaved". */
function sameRepositoryIds(a: ProjectRepository[], b: ProjectRepository[]): boolean {
  const ids = (repos: ProjectRepository[]) => repos.map((repo) => repo.id).sort().join(" ");
  return ids(a) === ids(b);
}

export function ProjectRepositories({ project }: { project: Project }) {
  const client = useQueryClient();
  const saved: ProjectRepository[] = project.workspaces.flatMap((workspace) => {
    const id = workspace.metadata?.githubRepositoryId;
    return typeof id === "string" && workspace.repoUrl ? [{ id, fullName: workspace.name, url: workspace.repoUrl, connections: [] }] : [];
  });
  const [draft, setDraft] = useState<ProjectRepository[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const selected = draft ?? saved;
  const autosave = useAutosave({
    value: selected,
    savedValue: saved,
    isEqual: sameRepositoryIds,
    debounceMs: 0,
    save: async (repos) => {
      const updated = await projectsApi.setRepositories(project.id, repos.map((repo) => repo.id));
      for (const ref of new Set([project.id, project.urlKey])) {
        client.setQueriesData({ queryKey: queryKeys.projects.detail(ref) }, updated);
        void client.invalidateQueries({ queryKey: queryKeys.projects.detail(ref) });
      }
      void client.invalidateQueries({ queryKey: queryKeys.projects.all(project.companyId) });
      void client.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
      setDraft(null);
    },
  });
  return <section aria-label="Repositories" className="flex min-w-0 flex-col gap-4 py-4">
    <ProjectRepositoryInput companyId={project.companyId} selected={selected} onChange={(repos) => { setDraft(repos); autosave.reset(); }} onConnect={() => setConnecting(true)} disabled={autosave.status === "saving"} />
    {project.workspaces.filter((workspace) => workspace.repoUrl && !workspace.metadata?.githubRepositoryId).map((workspace) => <LegacyProjectRepository key={workspace.id} workspace={workspace} projectRef={project.urlKey} />)}
    {autosave.status !== "idle" && (
      <div className="flex items-center justify-end border-t border-border pt-4">
        <SaveStatus status={autosave.status} errorMessage={autosave.errorMessage} onRetry={autosave.retry} />
      </div>
    )}
    <Dialog open={connecting} onOpenChange={setConnecting}><DialogContent showCloseButton={false} aria-describedby={undefined} className="max-h-(--sz-calc-18) overflow-y-auto sm:max-w-2xl">
      <DialogTitle className="sr-only">Connect GitHub</DialogTitle>
      <ConnectionSetupFlow host="dialog" serviceSlug="github" forceNewConnection onCancel={() => setConnecting(false)} onComplete={() => {
        void client.invalidateQueries({ queryKey: repositoryOptionsKey(project.companyId) });
        setConnecting(false);
      }} />
    </DialogContent></Dialog>
  </section>;
}
