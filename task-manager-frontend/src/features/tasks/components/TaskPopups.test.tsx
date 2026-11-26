import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { heldReply, mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import type { Subtask } from "../types";
import TaskCard from "./TaskCard";
import TaskPopups from "./TaskPopups";

const mock = mockApi();

const subtask: Subtask = {
  id: 2,
  parentId: 1,
  position: 0,
  title: "Draft outline",
  description: null,
  priority: 4,
  isCompleted: false,
  completedAt: null,
};

function Search() {
  return <p data-testid="search">{useLocation().search}</p>;
}

describe("task details", () => {
  it("opens the task named in the URL with its subtasks", async () => {
    mock.onGet("tasks/1").reply(200, {
      ...makeTask({ id: 1, title: "Write report", subtaskCount: 1 }),
      subtasks: [subtask],
    });
    mock.onGet("/projects").reply(200, { projects: [] });
    mock.onGet("/labels").reply(200, { labels: [] });

    renderWithProviders(
      <>
        <TaskPopups />
        <Search />
      </>,
      { route: "/?task=1" },
    );

    expect(await screen.findByText("Write report")).toBeInTheDocument();
    expect(
      await screen.findByRole("checkbox", { name: "Draft outline" }),
    ).toBeInTheDocument();
  });

  it("drops the task from the URL when it does not exist", async () => {
    mock.onGet("tasks/9").reply(404, { error: "Not found" });

    renderWithProviders(
      <>
        <TaskPopups />
        <Search />
      </>,
      { route: "/?task=9&sort_by=title" },
    );

    await screen.findByTestId("search");
    await expect
      .poll(() => screen.getByTestId("search").textContent)
      .toBe("?sort_by=title");
  });
});

describe("editing a task", () => {
  it("closes the form at once and reopens it as typed if the save is refused", async () => {
    const held = heldReply(400, { errors: { title: "Title already used" } });
    mock.onPatch("/tasks/1").reply(held.reply);
    mock.onGet("/projects").reply(200, { projects: [] });
    mock.onGet("/labels").reply(200, { labels: [] });
    renderWithProviders(
      <>
        <TaskCard {...makeTask()} />
        <TaskPopups />
      </>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Edit task: Write report" }),
    );
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Quarterly report");
    await userEvent.type(screen.getByLabelText("Project"), "Finance");

    await userEvent.click(screen.getByRole("button", { name: "Edit Task" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    held.release();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue(
      "Quarterly report",
    );
    expect(within(dialog).getByLabelText("Project")).toHaveValue("Finance");
    expect(within(dialog).getByText("Title already used")).toBeInTheDocument();
  });
});
