import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import apiClient from "../../services/api";
import { makeGhost, makeTask, renderWithProviders } from "../../test/render";
import { taskService } from "./api";
import TaskCard from "./components/TaskCard";
import TaskPopups from "./components/TaskPopups";
import { getDefaultFilters } from "./taskParams";
import type { Task } from "./types";
import { heldReply, mockApi } from "../../test/api";

const mock = mockApi();
let play: MockInstance<HTMLMediaElement["play"]>;
let tasksOnServer: Task[];

beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, "play");
  tasksOnServer = [];
  mock.onGet("/tasks").reply(() => [
    200,
    {
      tasks: tasksOnServer,
      totalTasks: tasksOnServer.length,
      totalMinutes: 0,
      totalPages: 1,
      currentPage: 1,
    },
  ]);
  mock.onGet("/stats/dashboard").reply(200, {});
});

const LIST_KEY = [
  "tasks",
  { ...getDefaultFilters(), isCompleted: "", layout: "list" },
];

/** Stands in for the task list and stats screens that sit behind the same cache. */
function CachedScreens() {
  const tasks = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => taskService.getAll(),
  });
  useQuery({
    queryKey: ["stats"],
    queryFn: () => apiClient.get("/stats/dashboard").then((r) => r.data),
  });
  return (
    <ul aria-label="server tasks">
      {tasks.data?.tasks.map((t) => (
        <li key={t.id} data-start={t.startAt}>
          {t.title} {t.isCompleted ? "(done)" : "(open)"}
        </li>
      ))}
    </ul>
  );
}

const gets = (url: string) =>
  mock.history.get.filter((r) => r.url === url).length;
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

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    expect(await screen.findByText("Write report (done)")).toBeInTheDocument();
    expect(patches()).toHaveLength(1);
    const body = JSON.parse(patches()[0].data);
    expect(body.isCompleted).toBe(true);
    expect(body.completedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(gets("/tasks")).toBe(2);
    expect(gets("/stats/dashboard")).toBe(2);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("completes the series, not the ghost id", async () => {
    const ghost = makeGhost(1, "20260303");
    mock.onPatch("/tasks/1").reply(200, {});
    renderCard(ghost);

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0].url).toBe("/tasks/1");
  });

  it("shows it done at once and locks the card until the server answers", async () => {
    const held = heldReply(200);
    mock.onPatch("/tasks/1").reply(held.reply);
    renderCard(makeTask());
    expect(await screen.findByText("Write report (open)")).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Mark task as completed",
    });

    await userEvent.click(button);

    expect(await screen.findByText("Write report (done)")).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
    for (const name of [/Mark task/, /Edit task/, /Delete task/, /Snooze/]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: /Open task/ })).toBeEnabled();
    await userEvent.click(button);
    held.release();

    await waitFor(() => expect(button).toBeEnabled());
    expect(patches()).toHaveLength(1);
  });

  it("puts the task back and says why when the request fails", async () => {
    mock.onPatch("/tasks/1").reply(500, { error: "Database is busy" });
    renderCard(makeTask());
    expect(await screen.findByText("Write report (open)")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database is busy",
    );
    expect(screen.getByText("Write report (open)")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mark task as completed" }),
      ).toBeEnabled(),
    );
  });

  it("keeps the change when a refetch that started earlier answers late", async () => {
    const save = heldReply(200);
    mock.onPatch("/tasks/1").reply(save.reply);
    const task = makeTask();
    const { queryClient } = renderCard(task);
    await screen.findByText("Write report (open)");
    const stale = heldReply(200, {
      tasks: [task],
      totalTasks: 1,
      totalMinutes: 0,
    });
    mock.onGet("/tasks").replyOnce(stale.reply);
    void queryClient.refetchQueries({ queryKey: ["tasks"] });

    const button = screen.getByRole("button", {
      name: "Mark task as completed",
    });
    await userEvent.click(button);
    stale.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByText("Write report (done)")).toBeInTheDocument();
    save.release();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("refetches once when two saves overlap", async () => {
    const first = heldReply(200);
    const second = heldReply(200);
    mock.onPatch("/tasks/1").reply(first.reply);
    mock.onPatch("/tasks/2").reply(second.reply);
    tasksOnServer = [makeTask(), makeTask({ id: 2, title: "Pay rent" })];
    renderWithProviders(
      <>
        <CachedScreens />
        {tasksOnServer.map((task) => (
          <TaskCard key={task.id} {...task} />
        ))}
      </>,
    );
    await screen.findByText("Pay rent (open)");
    const [one, two] = screen.getAllByRole("button", {
      name: "Mark task as completed",
    });

    await userEvent.click(one);
    await userEvent.click(two);
    first.release();
    await waitFor(() => expect(one).toBeEnabled());
    expect(gets("/tasks")).toBe(1);
    expect(screen.getByText("Pay rent (done)")).toBeInTheDocument();
    second.release();

    await waitFor(() => expect(gets("/tasks")).toBe(2));
  });

  it("refetches again for a save that finishes while the last refetch is loading", async () => {
    const slowStats = heldReply(200);
    mock.onPatch("/tasks/1").reply(200, {});
    mock.onPatch("/tasks/2").reply(200, {});
    tasksOnServer = [makeTask(), makeTask({ id: 2, title: "Pay rent" })];
    renderWithProviders(
      <>
        <CachedScreens />
        {tasksOnServer.map((task) => (
          <TaskCard key={task.id} {...task} />
        ))}
      </>,
    );
    await screen.findByText("Pay rent (open)");
    await waitFor(() => expect(gets("/stats/dashboard")).toBe(1));
    mock.resetHandlers();
    mock.onPatch(/tasks/).reply(200, {});
    mock.onGet("/stats/dashboard").reply(slowStats.reply);
    mock.onGet("/tasks").reply(200, {
      tasks: tasksOnServer,
      totalTasks: 2,
      totalMinutes: 0,
    });
    const [one, two] = screen.getAllByRole("button", {
      name: "Mark task as completed",
    });

    await userEvent.click(one);
    await waitFor(() => expect(gets("/tasks")).toBe(2));
    await userEvent.click(two);

    await waitFor(() => expect(gets("/tasks")).toBe(3));
    slowStats.release();
  });

  it("can be tried again after a failure", async () => {
    mock.onPatch("/tasks/1").replyOnce(500).onPatch("/tasks/1").reply(200, {});
    renderCard(makeTask());
    const button = screen.getByRole("button", {
      name: "Mark task as completed",
    });

    await userEvent.click(button);
    await waitFor(() => expect(patches()).toHaveLength(1));
    await userEvent.click(button);

    await waitFor(() => expect(patches()).toHaveLength(2));
  });
});

describe("deleting a task", () => {
  it("removes it at once and brings it back if that fails", async () => {
    const held = heldReply(500, { error: "Database is busy" });
    mock.onDelete("/tasks/1").reply(held.reply);
    const task = makeTask();
    tasksOnServer = [task];
    renderWithProviders(
      <>
        <CachedScreens />
        <TaskCard {...task} />
        <TaskPopups />
      </>,
    );
    await screen.findByText("Write report (open)");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete task: Write report" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete Task" }));

    expect(screen.queryByText("Write report (open)")).not.toBeInTheDocument();
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database is busy",
    );
    expect(screen.getByText("Write report (open)")).toBeInTheDocument();
  });
});

describe("snoozing a task", () => {
  const posts = () =>
    mock.history.post.filter((r) => r.url?.includes("/snooze"));
  const openMenu = () =>
    userEvent.click(
      screen.getByRole("button", { name: "Snooze task: Write report" }),
    );

  it("posts the chosen preset with the viewer's zone", async () => {
    mock.onPost("/tasks/1/snooze").reply(200, {});
    renderCard(makeTask());

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Tomorrow" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0].data)).toMatchObject({
      preset: "tomorrow",
      zoneName: expect.any(String),
    });
    await waitFor(() => expect(gets("/tasks")).toBe(2));
  });

  it("moves it to the new day at once and back if the server refuses", async () => {
    const held = heldReply(400, { error: "Task has no next occurrence" });
    mock.onPost("/tasks/1/snooze").reply(held.reply);
    const task = makeTask();
    renderCard(task);
    const row = await screen.findByRole("listitem");

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Tomorrow" }));

    const tomorrow = addDays(new Date(), 1).toDateString();
    expect(new Date(row.dataset.start ?? "").toDateString()).toBe(tomorrow);
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task has no next occurrence",
    );
    expect(row).toHaveAttribute("data-start", task.startAt);
  });

  it("offers the next occurrence only for a repeating task", async () => {
    const { unmount } = renderCard(makeTask());
    await openMenu();
    expect(
      screen.queryByRole("menuitem", { name: "Next occurrence" }),
    ).not.toBeInTheDocument();
    unmount();

    renderCard(makeTask({ isRepeating: true, repeatBy: "weekly" }));
    await openMenu();
    expect(
      screen.getByRole("menuitem", { name: "Next occurrence" }),
    ).toBeInTheDocument();
  });

  it("snoozes a ghost card through its series", async () => {
    mock.onPost("/tasks/1/snooze").reply(200, {});
    renderCard(makeGhost(1, "20260303"));

    await userEvent.click(screen.getByRole("button", { name: /Snooze task/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Next week" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0].data)).toMatchObject({
      preset: "next_week",
      isGhost: true,
      previousStartAt: expect.any(String),
    });
  });
});

describe("card actions", () => {
  it("hides start and snooze once a task is completed", () => {
    renderCard(
      makeTask({ isCompleted: true, isRepeating: true, repeatBy: "daily" }),
    );

    expect(
      screen.getByRole("button", { name: "Mark task as pending" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Start task/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Snooze task/ }),
    ).not.toBeInTheDocument();
  });

  it("reopens a completed task with a null completion time", async () => {
    mock.onPatch("/tasks/1").reply(200, {});
    renderCard(
      makeTask({ isCompleted: true, completedAt: "2026-03-02T09:30:00Z" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as pending" }),
    );

    await waitFor(() => expect(patches()).toHaveLength(1));
    const body = JSON.parse(patches()[0].data);
    expect(body.isCompleted).toBe(false);
    expect(body.completedAt).toBeNull();
  });
});
