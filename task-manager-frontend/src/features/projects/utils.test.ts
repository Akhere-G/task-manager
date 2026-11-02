import { describe, expect, it } from "vitest";
import type { Project } from "./types";
import {
  allowedParents,
  projectColour,
  projectOptions,
  projectPath,
  projectTree,
} from "./utils";

const project = (id: number, name: string, parentId: number | null = null): Project => ({
  id,
  name,
  colour: `#00000${id}`,
  parentId,
  position: id,
});

const projects = [
  project(1, "Work"),
  project(2, "Reports", 1),
  project(3, "Weekly", 2),
  project(4, "Home"),
];

describe("project helpers", () => {
  it("orders the tree depth first with indented option names", () => {
    expect(projectTree(projects).map((n) => [n.project.name, n.depth])).toEqual([
      ["Work", 0],
      ["Reports", 1],
      ["Weekly", 2],
      ["Home", 0],
    ]);
    expect(projectOptions(projects).map((o) => o.value)).toEqual(["1", "2", "3", "4"]);
  });

  it("builds the full path and finds the colour", () => {
    expect(projectPath(projects, 3)).toBe("Work / Reports / Weekly");
    expect(projectPath(projects, null)).toBeNull();
    expect(projectColour(projects, 4)).toBe("#000004");
    expect(projectColour(projects, null)).toBe("#64748b");
  });

  it("only offers parents that avoid cycles and the depth limit", () => {
    const names = (id: number | null) =>
      allowedParents(projects, id).map((n) => n.project.name);

    expect(names(null)).toEqual(["Work", "Reports", "Home"]);
    expect(names(1)).toEqual([]);
    expect(names(4)).toEqual(["Work", "Reports"]);
  });
});
