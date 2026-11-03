import { screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import type { Subtask } from "../types";
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
