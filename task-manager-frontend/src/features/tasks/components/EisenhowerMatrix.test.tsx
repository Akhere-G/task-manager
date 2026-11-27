import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { heldReply, mockApi } from "../../../test/api";
import { makeGhost, makeTask, renderWithProviders } from "../../../test/render";
import type { TaskFilters } from "../taskParams";
import type { Task } from "../types";
import EisenhowerMatrix from "./EisenhowerMatrix";

const mock = mockApi();

const filters: TaskFilters = {
  search: "",
  project: "",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "false",
  sortBy: "start_at",
  order: "asc",
  currentDate: "",
};

const tasks = [
  makeTask({ id: 1, title: "Fix outage", priority: 1 }),
  makeTask({ id: 2, title: "Plan roadmap", priority: 2 }),
  makeTask({ id: 3, title: "Answer email", priority: 3 }),
  makeTask({ id: 4, title: "Browse news", priority: 4 }),
];

const PAGE_SIZE = 10;

/** Answers each quadrant's request with its own page of `all`. */
function serveTasks(all: Task[]) {
  mock.onGet(/\/tasks/).reply((config) => {
    const params = new URL(config.url ?? "", "http://api").searchParams;
    const inQuadrant = all.filter(
      (task) => String(task.priority) === params.get("priority"),
    );
    const page = Number(params.get("page"));
    return [
      200,
      {
        tasks: inQuadrant.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        totalTasks: inQuadrant.length,
        totalMinutes: inQuadrant.length * 60,
        totalPages: Math.ceil(inQuadrant.length / PAGE_SIZE),
        currentPage: page,
      },
    ];
  });
}

const quadrant = (name: string) => screen.getByRole("region", { name });

const renderMatrix = () =>
  renderWithProviders(
    <EisenhowerMatrix filters={filters} search="" view="all" />,
  );

async function dragTaskTo(title: string, quadrantName: string) {
  fireEvent.dragStart(await screen.findByText(title));
  fireEvent.drop(quadrant(quadrantName));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EisenhowerMatrix", () => {
  it("places each task in the quadrant matching its priority", async () => {
    serveTasks(tasks);
    renderMatrix();

    expect(
      await within(quadrant("Do first")).findByText("Fix outage"),
    ).toBeVisible();
    expect(
      await within(quadrant("Schedule")).findByText("Plan roadmap"),
    ).toBeVisible();
    expect(
      await within(quadrant("Delegate")).findByText("Answer email"),
    ).toBeVisible();
    expect(
      await within(quadrant("Eliminate")).findByText("Browse news"),
    ).toBeVisible();
  });

  it("asks for ten tasks per quadrant, not the whole list", async () => {
    serveTasks(tasks);
    renderMatrix();

    await waitFor(() => expect(mock.history.get).toHaveLength(4));
    const requests = mock.history.get.map(
      (request) => new URL(request.url ?? "", "http://api").searchParams,
    );
    expect(requests.map((params) => params.get("priority")).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    requests.forEach((params) => expect(params.get("limit")).toBe("10"));
  });

  it("shows how many tasks a quadrant holds and how many are still unloaded", async () => {
    serveTasks(
      Array.from({ length: 12 }, (_, index) =>
        makeTask({ id: index + 1, title: `Task ${index + 1}`, priority: 2 }),
      ),
    );
    renderMatrix();

    const schedule = quadrant("Schedule");
    expect(await within(schedule).findByText("12 tasks · 12h")).toBeVisible();
    expect(
      within(schedule).getByText("Showing 10 of 12 tasks in Schedule"),
    ).toBeVisible();
    expect(within(schedule).getByText("Scroll for 2 more ↓")).toBeVisible();
    expect(within(schedule).queryByText("Task 11")).not.toBeInTheDocument();
  });

  it("loads the next ten when a quadrant is scrolled to its end", async () => {
    const observers: (() => void)[] = [];
    class FakeObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observers.push(() => callback([{ isIntersecting: true }]));
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    serveTasks(
      Array.from({ length: 12 }, (_, index) =>
        makeTask({ id: index + 1, title: `Task ${index + 1}`, priority: 2 }),
      ),
    );
    renderMatrix();
    const schedule = quadrant("Schedule");
    await within(schedule).findByText("Task 10");

    observers.forEach((reveal) => reveal());

    expect(await within(schedule).findByText("Task 12")).toBeVisible();
    expect(
      within(schedule).getByText("Showing 12 of 12 tasks in Schedule"),
    ).toBeVisible();
  });

  it("moves a dropped task to its new quadrant before the server answers", async () => {
    serveTasks(tasks);
    mock.onPatch("/tasks/4").reply(heldReply().reply);
    renderMatrix();

    await dragTaskTo("Browse news", "Do first");

    const target = quadrant("Do first");
    expect(await within(target).findByText("Browse news")).toBeVisible();
    expect(within(target).getByLabelText("Saving")).toBeInTheDocument();
    expect(within(target).getByText("2 tasks · 2h")).toBeVisible();
    expect(
      within(quadrant("Eliminate")).queryByText("Browse news"),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ priority: 1 });
  });

  it("puts a dropped task back and says why when the move fails", async () => {
    serveTasks(tasks);
    const held = heldReply(500, { error: "Database is busy" });
    mock.onPatch("/tasks/4").reply(held.reply);
    renderMatrix();

    await dragTaskTo("Browse news", "Do first");
    expect(
      await within(quadrant("Do first")).findByText("Browse news"),
    ).toBeVisible();
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database is busy",
    );
    expect(
      await within(quadrant("Eliminate")).findByText("Browse news"),
    ).toBeVisible();
    expect(
      within(quadrant("Do first")).queryByText("Browse news"),
    ).not.toBeInTheDocument();
  });

  it("does nothing when a task is dropped on its own quadrant", async () => {
    serveTasks(tasks);
    renderMatrix();

    await dragTaskTo("Browse news", "Eliminate");

    expect(mock.history.patch).toHaveLength(0);
  });

  it("updates the series when a projected occurrence is dropped", async () => {
    serveTasks([makeGhost(9, "20260302", { title: "Stand-up", priority: 4 })]);
    mock.onPatch("/tasks/9").reply(200, {});
    renderMatrix();

    await dragTaskTo("Stand-up", "Schedule");

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ priority: 2 });
  });

  it("does not load a quadrant the priority filter excludes", async () => {
    serveTasks(tasks);
    renderWithProviders(
      <EisenhowerMatrix
        filters={{ ...filters, priority: "1,2" }}
        search=""
        view="all"
      />,
    );

    await waitFor(() => expect(mock.history.get).toHaveLength(2));
  });
});
