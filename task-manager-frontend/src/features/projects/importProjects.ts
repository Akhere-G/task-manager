import { projectService } from "./api";
import type { Project } from "./types";

export const PATH_SEPARATOR = " / ";

type CreateProject = (input: {
  name: string;
  parentId: number | null;
}) => Promise<Project>;

/**
 * Maps project paths ("Work / Reports") from an import file to project ids,
 * creating the ones that do not exist yet. A blank path is the Inbox.
 */
export async function resolveProjectIds(
  paths: string[],
  existing: Project[],
  create: CreateProject = projectService.create,
): Promise<Map<string, number | null>> {
  const known = [...existing];
  const ids = new Map<string, number | null>();

  for (const path of new Set(paths.map((p) => p.trim()))) {
    if (!path) {
      ids.set(path, null);
      continue;
    }
    let parentId: number | null = null;
    for (const segment of path.split("/").map((s) => s.trim())) {
      let match = known.find(
        (p) =>
          p.parentId === parentId &&
          p.name.toLowerCase() === segment.toLowerCase(),
      );
      if (!match) {
        match = await create({ name: segment, parentId });
        known.push(match);
      }
      parentId = match.id;
    }
    ids.set(path, parentId);
  }
  return ids;
}
