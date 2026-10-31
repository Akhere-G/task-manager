import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import apiClient from "../../services/api";
import { makeGhost, makeTask, renderWithProviders } from "../../test/render";
import { taskService } from "./api";
import TaskCard from "./components/TaskCard";
import type { Task } from "./types";
import { mockApi } from "../../test/api";

const mock = mockApi();
let tasksOnServer: Task[];

beforeEach(() => {
  tasksOnServer = [];
  mock.onGet("/tasks").reply(() => [
    200,
    { tasks: tasksOnServer, totalTasks: tasksOnServer.length, totalPages: 1, currentPage: 1 },
  ]);
  mock.onGet("/stats/dashboard").reply(200, {});
});

/** Stands in for the task list and stats screens that sit behind the same cache. */
function CachedScreens() {
  const tasks = useQuery({
    queryKey: ["tasks", { page: 1 }],
    queryFn: () => taskService.getAll(),
  });
  useQuery({
    queryKey: ["stats"],
    queryFn: () => apiClient.get("/stats/dashboard").then((r) => r.data),
  });
  return (
    <ul aria-label="server tasks">
      {tasks.data?.tasks.map((t) => (
        <li key={t.id}>
          {t.title} {t.isCompleted ? "(done)" : "(open)"}
        </li>
      ))}
    </ul>
  );
}

const gets = (url: string) => mock.history.get.filter((r) => r.url === url).length;
const patches = () => mock.history.patch;

function renderCard(task: Task) {
  tasksOnServer = [task];
  return renderWithProviders(
    <>
      <CachedScreens />
      <TaskCard {...task} />
    </>,
  );
}

describe("completing a task", () => {
  it("sends the completion, then refetches tasks and stats so every screen agrees", async () => {
    const task = makeTask();
    mock.onPatch("/tasks/1").reply(() => {
      tasksOnServer = [{ ...task, isCompleted: true }];
      return [200, tasksOnServer[0]];
    });
    renderCard(task);
    expect(await screen.findByText("Write report (open)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mark task as completed" }));

    expect(await screen.findByText("Write report (done)")).toBeInTheDocument();
    expect(patches()).toHaveLength(1);
    const body = JSON.parse(patches()[0].data);
    expect(body.isCompleted).toBe(true);
    expect(body.completedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(gets("/tasks")).toBe(2);
    expect(gets("/stats/dashboard")).toBe(2);
  });

  it("tells the server which occurrence it saw when completing a repeating task", async () => {
    const task = makeTask({ isRepeating: true, repeatBy: "daily" });
    mock.onPatch("/tasks/1").reply(200, task);
    renderCard(task);

    await userEvent.click(screen.getByRole("button", { name: "Mark task as completed" }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0].data).expectedStartAt).toBe("2026-03-02 09:00:00");
  });

  it("completes the series, not the ghost id, and sends no stale-occurrence check", async () => {
    const ghost = makeGhost(1, "20260303");
    mock.onPatch("/tasks/1").reply(200, {});
    renderCard(ghost);

    await userEvent.click(screen.getByRole("button", { name: "Mark task as completed" }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].url).toBe("/tasks/1");
    expect(JSON.parse(patches()[0].data)).not.toHaveProperty("expectedStartAt");
  });

  it("ignores a second click while the first request is still running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mock.onPatch("/tasks/1").reply(async () => {
      await gate;
      return [200, {}];
    });
    renderCard(makeTask());
    const button = screen.getByRole("button", { name: "Mark task as completed" });

    await userEvent.click(button);
    await userEvent.click(button);
    release();

    await waitFor(() => expect(gets("/tasks")).toBe(2));
    expect(patches()).toHaveLength(1);
  });

  it("leaves the task open and keeps the page usable when the request fails", async () => {
    mock.onPatch("/tasks/1").reply(500, { error: "boom" });
    renderCard(makeTask());
    expect(await screen.findByText("Write report (open)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mark task as completed" }));

    await waitFor(() => expect(gets("/tasks")).toBe(2));
    expect(screen.getByText("Write report (open)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark task as completed" })).toBeEnabled();
  });

  it("can be tried again after a failure", async () => {
    mock.onPatch("/tasks/1").replyOnce(500).onPatch("/tasks/1").reply(200, {});
    renderCard(makeTask());
    const button = screen.getByRole("button", { name: "Mark task as completed" });

    await userEvent.click(button);
    await waitFor(() => expect(patches()).toHaveLength(1));
    await userEvent.click(button);

    await waitFor(() => expect(patches()).toHaveLength(2));
  });
});

describe("skipping a recurring task", () => {
  it("asks the server to move the task to its next occurrence", async () => {
    mock.onPatch("/tasks/1").reply(200, {});
    renderCard(makeTask({ isRepeating: true, repeatBy: "weekly" }));

    await userEvent.click(screen.getByRole("button", { name: "Skip task: Write report" }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(JSON.parse(patches()[0].data)).toEqual({ skipOccurrence: true });
    await waitFor(() => expect(gets("/tasks")).toBe(2));
  });

  it("offers no skip button for a one-off task", () => {
    renderCard(makeTask());
    expect(screen.queryByRole("button", { name: /Skip task/ })).not.toBeInTheDocument();
  });

  // Known bug: skip uses the ghost's own id, which the API cannot find. Expect the
  // series id ("/tasks/1") here once the skip is sent to the series.
  it("sends a ghost card's skip to the ghost id", async () => {
    mock.onPatch(/\/tasks\/.*/).reply(404, {});
    renderCard(makeGhost(1, "20260303"));

    await userEvent.click(screen.getByRole("button", { name: /Skip task/ }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].url).toBe("/tasks/ghost_1_20260303");
  });
});

describe("card actions", () => {
  it("hides start and skip once a task is completed", () => {
    renderCard(makeTask({ isCompleted: true, isRepeating: true, repeatBy: "daily" }));

    expect(screen.getByRole("button", { name: "Mark task as pending" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start task/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skip task/ })).not.toBeInTheDocument();
  });

  it("reopens a completed task with a null completion time", async () => {
    mock.onPatch("/tasks/1").reply(200, {});
    renderCard(makeTask({ isCompleted: true, completedAt: "2026-03-02T09:30:00Z" }));

    await userEvent.click(screen.getByRole("button", { name: "Mark task as pending" }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    const body = JSON.parse(patches()[0].data);
    expect(body.isCompleted).toBe(false);
    expect(body.completedAt).toBeNull();
  });
});
