import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeTask, renderWithProviders } from "../test/render";
import Pomodoro from "./Pomodoro";
import { mockApi } from "../test/api";

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

const finishEarly = () => screen.getByRole("button", { name: "Finished early" });

describe("Pomodoro page", () => {
  it("shows the task and a full 25 minute timer", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask({ title: "Deep work", startAt: "2026-03-02T09:00:00Z", endAt: "2026-03-02T11:00:00Z" }));
    renderPomodoro();

    expect(await screen.findByText("Deep work")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("120m")).toBeInTheDocument();
  });

  it("switches between play and pause", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask());
    renderPomodoro();

    await userEvent.click(await screen.findByRole("button", { name: "Play Timer" }));
    expect(screen.getByRole("button", { name: "Pause Timer" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Pause Timer" }));
    expect(screen.getByRole("button", { name: "Play Timer" })).toBeInTheDocument();
  });

  it("counts the timer down while it is playing", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask());
    renderPomodoro();
    await userEvent.click(await screen.findByRole("button", { name: "Play Timer" }));

    await waitFor(() => expect(screen.queryByText("25:00")).not.toBeInTheDocument(), { timeout: 4000 });

    expect(screen.getByText(/^24:5\d$/)).toBeInTheDocument();
  });

  it("offers to complete the task after a session and completes it on confirm", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask({ title: "Deep work" }));
    mock.onPatch("/tasks/1").reply(200, {});
    renderPomodoro();
    await screen.findByText("Deep work");

    await userEvent.click(finishEarly());
    expect(await screen.findByText("Complete task: Deep work?")).toBeInTheDocument();
    expect(screen.getByText(/Progress: 1 \/ 3 sessions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    const body = JSON.parse(mock.history.patch[0].data);
    expect(body.isCompleted).toBe(true);
    expect(body.completedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(await screen.findByText("Task list")).toBeInTheDocument();
  });

  it("leaves the task open when the user declines", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask({ title: "Deep work" }));
    renderPomodoro();
    await screen.findByText("Deep work");

    await userEvent.click(finishEarly());
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Complete task: Deep work?")).not.toBeInTheDocument();
    expect(mock.history.patch).toHaveLength(0);
    expect(screen.getByText("Deep work")).toBeInTheDocument();
  });

  it("completes the series task, not a copy, for a repeating task", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask({ isRepeating: true, repeatBy: "daily" }));
    mock.onPatch("/tasks/1").reply(200, {});
    renderPomodoro();
    await screen.findByText("Write report");

    await userEvent.click(finishEarly());
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data).expectedStartAt).toBe("2026-03-02 09:00:00");
  });

  it("says so when the task does not exist", async () => {
    mock.onGet("/tasks/99").reply(404, { error: "No task with that id" });
    renderPomodoro("99");

    expect(await screen.findByText("This task doesn't exist")).toBeInTheDocument();
  });

  it("reports a load failure that is not a missing task", async () => {
    mock.onGet("/tasks/1").reply(500);
    renderPomodoro();

    expect(await screen.findByText("Could not load details")).toBeInTheDocument();
  });

  it("goes back at once if the task is already completed", async () => {
    mock.onGet("/tasks/1").reply(200, makeTask({ isCompleted: true }));
    renderPomodoro();

    expect(await screen.findByText("Task list")).toBeInTheDocument();
  });
});
