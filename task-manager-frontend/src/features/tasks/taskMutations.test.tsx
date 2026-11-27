import { useQuery } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
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
import {
  makeGhost,
  makeTask,
  renderHookWithProviders,
  renderWithProviders,
} from "../../test/render";
import { taskService } from "./api";
import TaskCard from "./components/TaskCard";
import TaskPopups from "./components/TaskPopups";
import useDeleteSubtask from "./hooks/useDeleteSubtask";
import useMoveTask from "./hooks/useMoveTask";
import useReorderSubtasks from "./hooks/useReorderSubtasks";
import useReplaceSubtasks from "./hooks/useReplaceSubtasks";
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
      totalPages: 1,
      currentPage: 1,
    },
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

  it("ticks it at once and locks the card until the server answers", async () => {
    const held = heldReply();
    mock.onPatch("/tasks/1").reply(held.reply);
    renderCard(makeTask());

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    expect(
      screen.getByRole("button", { name: "Mark task as pending" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete task: Write report" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Saving")).toBeInTheDocument();

    held.release();
    await waitFor(() =>
      expect(screen.queryByLabelText("Saving")).not.toBeInTheDocument(),
    );
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

  it("ignores a second click while the first request is still running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mock.onPatch("/tasks/1").reply(async () => {
      await gate;
      return [200, {}];
    });
    renderCard(makeTask());
    const button = screen.getByRole("button", {
      name: "Mark task as completed",
    });

    await userEvent.click(button);
    await userEvent.click(button);
    release();

    await waitFor(() => expect(gets("/tasks")).toBe(2));
    expect(patches()).toHaveLength(1);
  });

  it("takes the tick back and says why when the request fails", async () => {
    const held = heldReply(500, { error: "Database is busy" });
    mock.onPatch("/tasks/1").reply(held.reply);
    renderCard(makeTask());

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );
    expect(
      screen.getByRole("button", { name: "Mark task as pending" }),
    ).toBeInTheDocument();
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not complete the task",
    );
    expect(
      screen.getByRole("button", { name: "Mark task as completed" }),
    ).toBeEnabled();
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

describe("snoozing a task", () => {
  const posts = () =>
    mock.history.post.filter((r) => r.url?.includes("/snooze"));
  const openMenu = () =>
    userEvent.click(
      screen.getByRole("button", { name: "Snooze task: Write report" }),
    );

  it("posts the chosen preset with the viewer's zone, locking the card", async () => {
    const held = heldReply();
    mock.onPost("/tasks/1/snooze").reply(held.reply);
    renderCard(makeTask());

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Tomorrow" }));

    expect(screen.getByLabelText("Saving")).toBeInTheDocument();
    held.release();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0].data)).toMatchObject({
      preset: "tomorrow",
      zoneName: expect.any(String),
    });
    await waitFor(() => expect(gets("/tasks")).toBe(2));
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

describe("deleting a task", () => {
  it("hides it at once and brings it back with the reason if that fails", async () => {
    const held = heldReply(500, { error: "Database is busy" });
    mock.onDelete("/tasks/1").reply(held.reply);
    renderWithProviders(
      <>
        <TaskCard {...makeTask()} />
        <TaskPopups />
      </>,
    );
    const open = () =>
      screen.queryByRole("button", { name: "Open task: Write report" });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete task: Write report" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete Task" }));

    expect(open()).not.toBeInTheDocument();
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database is busy",
    );
    expect(open()).toBeInTheDocument();
  });
});

describe("stats after a task write", () => {
  const move = {
    id: 1,
    move: { afterId: null, beforeId: null },
    reordered: [],
    queryKey: ["tasks", "category"],
  };

  it.each([
    {
      write: "deleting a subtask",
      useRun: () => {
        const remove = useDeleteSubtask();
        return () => remove(2);
      },
    },
    {
      write: "reordering tasks",
      useRun: () => {
        const { mutate } = useMoveTask();
        return () => mutate(move);
      },
    },
    {
      write: "reordering subtasks",
      useRun: () => {
        const { mutate } = useReorderSubtasks(1);
        return () => mutate([]);
      },
    },
    {
      write: "replacing subtasks",
      useRun: () => {
        const { mutate } = useReplaceSubtasks(1);
        return () => mutate([]);
      },
    },
  ])("are cleared by $write", async ({ useRun }) => {
    mock.onAny().reply(200, {});
    const { result, queryClient } = renderHookWithProviders(useRun);
    queryClient.setQueryData(["stats"], {});

    act(() => result.current());

    await waitFor(() =>
      expect(queryClient.getQueryState(["stats"])?.isInvalidated).toBe(true),
    );
  });
});
