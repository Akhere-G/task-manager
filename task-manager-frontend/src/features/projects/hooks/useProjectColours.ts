import { DEFAULT_PROJECT_COLOUR } from "../types";
import useProjects from "./useProjects";

export const OTHER_COLOUR = "#cbd5e1";
export const OTHER_NAME = "Other";

/** Colour for a top-level project name as the stats endpoints report them. */
export default function useProjectColours() {
  const { data: projects = [] } = useProjects();
  return (name: string | undefined) => {
    if (name === OTHER_NAME) return OTHER_COLOUR;
    const root = projects.find((p) => p.parentId === null && p.name === name);
    return root?.colour ?? DEFAULT_PROJECT_COLOUR;
  };
}
