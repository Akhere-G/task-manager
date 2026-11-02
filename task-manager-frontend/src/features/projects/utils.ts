import { DEFAULT_PROJECT_COLOUR, MAX_PROJECT_DEPTH, type Project } from "./types";

export interface ProjectNode {
  project: Project;
  depth: number;
  path: string;
}

export function projectTree(projects: Project[]): ProjectNode[] {
  const children = new Map<number | null, Project[]>();
  const ids = new Set(projects.map((p) => p.id));
  for (const project of projects) {
    const parent =
      project.parentId !== null && ids.has(project.parentId)
        ? project.parentId
        : null;
    children.set(parent, [...(children.get(parent) ?? []), project]);
  }

  const nodes: ProjectNode[] = [];
  const visit = (parent: number | null, depth: number, prefix: string) => {
    for (const project of children.get(parent) ?? []) {
      const path = prefix ? `${prefix} / ${project.name}` : project.name;
      nodes.push({ project, depth, path });
      visit(project.id, depth + 1, path);
    }
  };
  visit(null, 0, "");
  return nodes;
}

export function projectOptions(projects: Project[]) {
  return projectTree(projects).map(({ project, depth }) => ({
    name: `${"  ".repeat(depth)}${project.name}`,
    value: String(project.id),
  }));
}

export function projectPath(
  projects: Project[],
  projectId: number | null | undefined,
): string | null {
  if (projectId == null) return null;
  return projectTree(projects).find((n) => n.project.id === projectId)?.path ?? null;
}

export function projectColour(
  projects: Project[],
  projectId: number | null | undefined,
): string {
  return (
    projects.find((p) => p.id === projectId)?.colour ?? DEFAULT_PROJECT_COLOUR
  );
}

export function subtreeHeight(projects: Project[], projectId: number): number {
  const kids = projects.filter((p) => p.parentId === projectId);
  return 1 + Math.max(0, ...kids.map((k) => subtreeHeight(projects, k.id)));
}

export function descendantIds(projects: Project[], projectId: number): number[] {
  const kids = projects.filter((p) => p.parentId === projectId);
  return kids.flatMap((k) => [k.id, ...descendantIds(projects, k.id)]);
}

/** Projects a project may be moved under without a cycle or exceeding the depth limit. */
export function allowedParents(projects: Project[], projectId: number | null) {
  const nodes = projectTree(projects);
  if (projectId === null) {
    return nodes.filter((n) => n.depth + 1 < MAX_PROJECT_DEPTH);
  }
  const blocked = new Set([projectId, ...descendantIds(projects, projectId)]);
  const height = subtreeHeight(projects, projectId);
  return nodes.filter(
    (n) => !blocked.has(n.project.id) && n.depth + 1 + height <= MAX_PROJECT_DEPTH,
  );
}
