import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeTask, renderWithProviders } from "../test/render";
import Pomodoro from "./Pomodoro";
import { mockApi } from "../test/api";
import { DEFAULT_SETTINGS } from "../features/pomodoro/constants";
import {
  initialSession,
  loadSession,
  saveSession,
  type SessionState,
} from "../features/pomodoro/session";

const mock = mockApi();

function renderPomodoro(taskId = "1") {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<p>Task list</p>} />
      <Route path="/pomodoro/:taskId" element={<Pomodoro />} />
    </Routes>,
    { history: ["/", `/pomodoro/${taskId}`] },
  );
}

const seedSession = (state: Partial<SessionState>) =>
  saveSession(1, { ...initialSession(DEFAULT_SETTINGS), ...state });

const secondsAgo = (seconds: number) => Date.now() - seconds * 1000;

const lastSessionResting = (): Partial<SessionState> => ({
  phase: "rest",
  session: 3,
  completedSessions: 3,
  durationSeconds: 300,
  runningSince: secondsAgo(1),
});

describe("Pomodoro page", () => {
  it("shows the task and a full 25 minute timer", async () => {
    mock.onGet("/tasks/1").reply(
      200,
      makeTask({
        title: "Deep work",
        startAt: "2026-03-02T09:00:00Z",
        endAt: "2026-03-02T11:00:00Z",
      }),
    );
    renderPomodoro();

    expect(await screen.findByText("Deep work")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("120m")).toBeInTheDocument();
    expect(screen.getByText("Session 1 of 5")).toBeInTheDocument();
  });

  it("switches between play and pause", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask());
    renderPomodoro();

    await userEvent.click(
      await screen.findByRole("button", { name: "Play Timer" }),
    );
    expect(
      screen.getByRole("button", { name: "Pause Timer" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Pause Timer" }));
    expect(
      screen.getByRole("button", { name: "Play Timer" }),
    ).toBeInTheDocument();
  });

  it("moves from focus to rest and back to the next session", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask());
    renderPomodoro();

    await userEvent.click(
      await screen.findByRole("button", { name: "Finish early" }),
    );
    expect(screen.getByText("Rest after session 1")).toBeInTheDocument();
    expect(screen.getByText(/^(05:00|04:5\d)$/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "1 of 3 sessions completed" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Skip rest" }));
    expect(screen.getByText("Session 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
  });

  it("offers the next session when a rest runs out", async () => {
    seedSession({
      phase: "rest",
      session: 1,
      completedSessions: 1,
      durationSeconds: 300,
      runningSince: secondsAgo(305),
    });
    mock.onGet("/tasks/1").reply(200, makeTask());
    renderPomodoro();

    expect(await screen.findByText("Rest overtime")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Start session 2" }),
    );
    expect(screen.getByText("Session 2 of 3")).toBeInTheDocument();
  });

  it("offers to complete the task after the last session and completes it on confirm", async () => {
    seedSession(lastSessionResting());
    mock.onGet("/tasks/1").reply(200, makeTask({ title: "Deep work" }));
    mock.onPatch("/tasks/1").reply(200, {});
    renderPomodoro();

    await userEvent.click(
      await screen.findByRole("button", { name: "Finish task" }),
    );
    expect(
      await screen.findByText("Complete task: Deep work?"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Progress: 3 \/ 3 sessions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    const body = JSON.parse(mock.history.patch[0].data);
    expect(body.isCompleted).toBe(true);
    expect(body.completedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(await screen.findByText("Task list")).toBeInTheDocument();
    expect(loadSession(1)).toBeNull();
  });

  it("stays on the page and says so when completing the task fails", async () => {
    seedSession(lastSessionResting());
    mock.onGet("/tasks/1").reply(200, makeTask({ title: "Deep work" }));
    mock.onPatch("/tasks/1").reply(500);
    renderPomodoro();

    await userEvent.click(
      await screen.findByRole("button", { name: "Finish task" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not complete the task",
    );
    expect(screen.queryByText("Task list")).not.toBeInTheDocument();
    expect(loadSession(1)).not.toBeNull();
  });

  it("leaves the task open when the user declines, and allows an extra session", async () => {
    seedSession(lastSessionResting());
    mock.onGet("/tasks/1").reply(200, makeTask({ title: "Deep work" }));
    renderPomodoro();

    await userEvent.click(
      await screen.findByRole("button", { name: "Finish task" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel" }),
    );

    expect(
      screen.queryByText("Complete task: Deep work?"),
    ).not.toBeInTheDocument();
    expect(mock.history.patch).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Start extra session" }),
    );
    expect(screen.getByText("Session 4 of 4")).toBeInTheDocument();
  });

  it("says so when the task does not exist", async () => {
    mock.onGet("/tasks/99").reply(404, { error: "No task with that id" });
    renderPomodoro("99");

    expect(
      await screen.findByText("This task doesn't exist"),
    ).toBeInTheDocument();
  });

  it("reports a load failure that is not a missing task", async () => {
    mock.onGet("/tasks/1").reply(500);
    renderPomodoro();

    expect(
      await screen.findByText("Could not load details"),
    ).toBeInTheDocument();
  });

  it("goes back at once if the task is already completed", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask({ isCompleted: true }));
    renderPomodoro();

    expect(await screen.findByText("Task list")).toBeInTheDocument();
  });
});
