import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../../../test/api";
import { renderWithProviders } from "../../../test/render";
import type { TaskFilters } from "../taskParams";
import GroupActionsMenu from "./GroupActionsMenu";

const mock = mockApi();

const filters: TaskFilters = {
  search: "",
  project: "3",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "",
  sortBy: "start_at",
  order: "asc",
  currentDate: "",
};

const overdue = {
  filters,
  search: "",
  view: "all",
  params: { group: "overdue" },
} as const;

const lastBody = () => JSON.parse(mock.history.post.at(-1)?.data ?? "{}");
const lastUrl = () => mock.history.post.at(-1)?.url;

async function openMenu(name = "Overdue") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  return user;
}

const onResult = vi.fn();

beforeEach(() => onResult.mockClear());

describe("GroupActionsMenu", () => {
  it("completes the whole group by its filter, not by loaded ids", async () => {
    mock
      .onPost("/tasks/bulk-complete")
      .reply(200, { updated: 30, matched: 30 });
    renderWithProviders(
      <GroupActionsMenu
        name="Overdue"
        count={30}
        query={overdue}
        onResult={onResult}
      />,
    );

    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Complete all 30" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(lastUrl()).toBe("/tasks/bulk-complete");
    expect(lastBody().filter).toMatchObject({ group: "overdue", project: "3" });
    expect(lastBody()).not.toHaveProperty("ids");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("hides complete for a group that is already completed", async () => {
    renderWithProviders(
      <GroupActionsMenu
        name="Completed"
        count={2}
        query={overdue}
        onResult={onResult}
        canComplete={false}
      />,
    );

    await openMenu("Completed");

    expect(screen.queryByRole("menuitem", { name: /Complete all/ })).toBeNull();
  });

  it("reschedules the group to a chosen day", async () => {
    mock.onPost("/tasks/bulk-snooze").reply(200, { updated: 3, matched: 3 });
    renderWithProviders(
      <GroupActionsMenu
        name="Overdue"
        count={3}
        query={overdue}
        onResult={onResult}
      />,
    );

    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Tomorrow" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(lastBody()).toMatchObject({
      preset: "tomorrow",
      filter: { group: "overdue" },
    });
    expect(lastBody().zoneName).toBeTruthy();
  });

  it("asks before deleting and can be cancelled", async () => {
    mock.onPost("/tasks/bulk-delete").reply(200, { updated: 3, matched: 3 });
    renderWithProviders(
      <GroupActionsMenu
        name="Overdue"
        count={3}
        query={overdue}
        onResult={onResult}
      />,
    );

    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Delete all 3" }));
    expect(screen.getByText("Delete 3 tasks?")).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: "Cancel" }));
    expect(mock.history.post).toHaveLength(0);

    await user.click(screen.getByRole("menuitem", { name: "Delete all 3" }));
    await user.click(screen.getByRole("menuitem", { name: "Confirm delete" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(lastUrl()).toBe("/tasks/bulk-delete");
  });

  it("changes the priority of a quadrant", async () => {
    mock.onPost("/tasks/bulk-priority").reply(200, { updated: 4, matched: 4 });
    renderWithProviders(
      <GroupActionsMenu
        name="Do first"
        count={4}
        query={{ ...overdue, params: {}, overrides: { priority: "1" } }}
        onResult={onResult}
        priorityChoices={[
          { priority: 2, title: "Schedule" },
          { priority: 3, title: "Delegate" },
        ]}
      />,
    );

    const user = await openMenu("Do first");
    await user.click(screen.getByRole("menuitem", { name: "P3 · Delegate" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(lastUrl()).toBe("/tasks/bulk-priority");
    expect(lastBody()).toMatchObject({
      priority: 3,
      filter: { priority: "1" },
    });
  });

  it("moves a column's tasks to another column or to unassigned", async () => {
    mock.onPost("/tasks/bulk-move").reply(200, { updated: 2, matched: 2 });
    renderWithProviders(
      <GroupActionsMenu
        name="To Do"
        count={2}
        query={{ ...overdue, params: { project: "3", column: "9" } }}
        onResult={onResult}
        columnChoices={[
          { id: null, name: "Unassigned" },
          { id: 12, name: "Done" },
        ]}
      />,
    );

    const user = await openMenu("To Do");
    await user.click(screen.getByRole("menuitem", { name: "Done" }));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(lastBody()).toMatchObject({
      columnId: 12,
      filter: { project: "3", column: "9" },
    });

    await user.click(screen.getByRole("button", { name: "Actions for To Do" }));
    await user.click(screen.getByRole("menuitem", { name: "Unassigned" }));
    await waitFor(() => expect(mock.history.post).toHaveLength(2));
    expect(lastBody().columnId).toBeNull();
  });

  it("reports the counts when only some of the tasks were updated", async () => {
    mock
      .onPost("/tasks/bulk-complete")
      .reply(200, { updated: 500, matched: 500 });
    mock.onPost("/tasks/bulk-delete").reply(200, { updated: 2, matched: 5 });
    renderWithProviders(
      <GroupActionsMenu
        name="Overdue"
        count={5}
        query={overdue}
        onResult={onResult}
      />,
    );

    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Delete all 5" }));
    await user.click(screen.getByRole("menuitem", { name: "Confirm delete" }));

    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0][0]).toEqual({ updated: 2, matched: 5 });
  });
});
