import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockApi } from "../test/api";
import { makeTask, renderWithProviders } from "../test/render";
import DecomposeTask from "./DecomposeTask";

const mock = mockApi();

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

describe("DecomposeTask", () => {
  it("saves the suggested steps as subtasks and opens the parent", async () => {
    mock.onGet("tasks/1").reply(200, makeTask({ id: 1, title: "Plan trip" }));
    mock.onGet("/projects").reply(200, { projects: [] });
    mock.onGet("/labels").reply(200, { labels: [] });
    mock.onPost("ai/decompose").reply(200, {
      tasks: [
        { title: "Book flights", description: "Compare fares", priority: 2 },
        { title: "Pack", description: "", priority: 4 },
      ],
    });
    mock.onPost("/tasks/1/subtasks").reply(201, { subtasks: [] });
    renderWithProviders(
      <Routes>
        <Route path="/breakdown/:taskId" element={<DecomposeTask />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      { route: "/breakdown/1" },
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Break down tasks into subtasks",
      }),
    );
    await screen.findByText("Book flights");
    await userEvent.click(
      screen.getByRole("button", { name: "Save all subtasks" }),
    );

    await waitFor(() => expect(mock.history.post).toHaveLength(2));
    expect(JSON.parse(mock.history.post[1].data)).toEqual({
      subtasks: [
        { title: "Book flights", description: "Compare fares", priority: 2 },
        { title: "Pack", description: "", priority: 4 },
      ],
    });
    expect(await screen.findByTestId("where")).toHaveTextContent("/?task=1");
  });

  it("tells the breakdown which subtasks already exist", async () => {
    const existing = {
      id: 9,
      parentId: 1,
      position: 0,
      title: "Pack",
      description: null,
      priority: 4 as const,
      isCompleted: false,
      completedAt: null,
    };
    mock
      .onGet("tasks/1")
      .reply(
        200,
        makeTask({ id: 1, title: "Plan trip", subtasks: [existing] }),
      );
    mock.onGet("/projects").reply(200, { projects: [] });
    mock.onGet("/labels").reply(200, { labels: [] });
    mock
      .onPost("ai/decompose")
      .reply(200, { tasks: [{ title: "Book flights" }] });
    renderWithProviders(
      <Routes>
        <Route path="/breakdown/:taskId" element={<DecomposeTask />} />
      </Routes>,
      { route: "/breakdown/1" },
    );

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Break down tasks into subtasks",
      }),
    );

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data).existingSubtasks).toEqual([
      "Pack",
    ]);
  });
});
