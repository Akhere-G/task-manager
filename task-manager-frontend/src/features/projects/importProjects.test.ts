import { describe, expect, it, vi } from "vitest";
import { resolveProjectIds } from "./importProjects";
import type { Project } from "./types";

const existing: Project[] = [
  { id: 1, name: "Work", colour: "#6366f1", parentId: null, position: 0 },
];

function fakeCreate() {
  let nextId = 10;
  return vi.fn(async (input: { name: string; parentId: number | null }) => ({
    id: nextId++,
    colour: "#64748b",
    position: 0,
    ...input,
  }));
}

describe("resolveProjectIds", () => {
  it("reuses projects by name ignoring case and sends blank to the Inbox", async () => {
    const create = fakeCreate();

    const ids = await resolveProjectIds(["work", ""], existing, create);

    expect(ids.get("work")).toBe(1);
    expect(ids.get("")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates missing projects once, including nested paths", async () => {
    const create = fakeCreate();

    const ids = await resolveProjectIds(
      ["Health", "Health", "Work / Reports"],
      existing,
      create,
    );

    expect(create.mock.calls.map(([input]) => input)).toEqual([
      { name: "Health", parentId: null },
      { name: "Reports", parentId: 1 },
    ]);
    expect(ids.get("Health")).toBe(10);
    expect(ids.get("Work / Reports")).toBe(11);
  });
});
