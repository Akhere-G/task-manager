import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import type { TaskFilters } from "../taskParams";
import GroupedTaskList from "./GroupedTaskList";

const mock = mockApi();

const filters: TaskFilters = {
  search: "",
  project: "",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "",
  sortBy: "start_at",
  order: "asc",
  currentDate: "",
};

const query = { filters, search: "", view: "all" } as const;

const pageOf = (titles: string[], totalTasks = titles.length) => ({
  tasks: titles.map((title, index) => makeTask({ id: index + 1, title })),
  totalTasks,
  totalMinutes: totalTasks * 30,
  totalPages: Math.ceil(totalTasks / 10),
  currentPage: 1,
});

const groupRequests = () =>
  mock.history.get.map((request) =>
    new URL(request.url ?? "", "http://api").searchParams.get("group"),
  );

function serveGroups(groups: Record<string, ReturnType<typeof pageOf>>) {
  mock.onGet(/\/tasks/).reply((config) => {
    const group = new URL(config.url ?? "", "http://api").searchParams.get(
      "group",
    );
    return [200, groups[group ?? ""] ?? pageOf([])];
  });
}

describe("GroupedTaskList", () => {
  it("asks for ten tasks of every group on its own", async () => {
    serveGroups({});

    renderWithProviders(<GroupedTaskList query={query} sortable={false} />);

    await waitFor(() => expect(mock.history.get).toHaveLength(5));
    expect(groupRequests().sort()).toEqual(
      ["completed", "overdue", "today", "undated", "upcoming"].sort(),
    );
    const limits = mock.history.get.map((request) =>
      new URL(request.url ?? "", "http://api").searchParams.get("limit"),
    );
    expect(new Set(limits)).toEqual(new Set(["10"]));
  });

  it("shows only the groups that have tasks, with the full count", async () => {
    serveGroups({
      overdue: pageOf(["Late"], 30),
      completed: pageOf(["Done"]),
    });

    renderWithProviders(<GroupedTaskList query={query} sortable={false} />);

    const overdue = await screen.findByRole("region", { name: "Overdue" });
    expect(
      within(overdue).getByRole("button", { name: "Overdue, 30 tasks" }),
    ).toBeVisible();
    expect(
      within(overdue).getByText("Showing 1 of 30 in Overdue"),
    ).toBeVisible();
    expect(
      within(overdue).getByRole("button", { name: "Actions for Overdue" }),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Completed" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Upcoming" })).toBeNull();
  });

  it("collapses a group", async () => {
    serveGroups({ today: pageOf(["Standup"]) });
    renderWithProviders(<GroupedTaskList query={query} sortable={false} />);

    await screen.findByRole("button", { name: "Open task: Standup" });
    await userEvent.click(
      screen.getByRole("button", { name: "Today, 1 tasks" }),
    );

    expect(
      screen.queryByRole("button", { name: "Open task: Standup" }),
    ).toBeNull();
  });

  it("lists completed tasks newest first", async () => {
    serveGroups({ completed: pageOf(["Done"]) });

    renderWithProviders(<GroupedTaskList query={query} sortable={false} />);

    await screen.findByRole("region", { name: "Completed" });
    const completed = mock.history.get.find(
      (request) =>
        new URL(request.url ?? "", "http://api").searchParams.get("group") ===
        "completed",
    );
    const params = new URL(completed?.url ?? "", "http://api").searchParams;
    expect(params.get("order")).toBe("desc");
    expect(params.has("is_completed")).toBe(false);
  });
});
