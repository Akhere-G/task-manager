import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockApi } from "../test/api";
import { makeQueryClient, makeTask, renderWithProviders } from "../test/render";
import type { Subtask } from "../features/tasks/types";
import DecomposeTask from "./DecomposeTask";

const mock = mockApi();

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function subtask(
  id: number,
  title: string,
  description: string | null,
): Subtask {
  return {
    id,
    parentId: 1,
    position: id,
    title,
    description,
    priority: 4,
    isCompleted: false,
    completedAt: null,
  };
}

function mockParent(subtasks: Subtask[] = []) {
  mock
    .onGet("tasks/1")
    .reply(200, makeTask({ id: 1, title: "Plan trip", subtasks }));
  mock.onGet("/projects").reply(200, { projects: [] });
  mock.onGet("/labels").reply(200, { labels: [] });
}

function renderPage(queryClient = makeQueryClient()) {
  return renderWithProviders(
    <Routes>
      <Route path="/breakdown/:taskId" element={<DecomposeTask />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { route: "/breakdown/1", queryClient },
  );
}

describe("DecomposeTask", () => {
  it("starts empty for a task without subtasks", async () => {
    mockParent();
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "Break down tasks into subtasks",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Save all subtasks" }),
    ).toBeDisabled();
  });

  it("prefills the steps with the existing subtasks", async () => {
    mockParent([
      subtask(9, "Pack", "Light bag"),
      subtask(10, "Book flights", null),
    ]);
    renderPage();

    expect(await screen.findByText("Pack")).toBeInTheDocument();
    expect(screen.getByText("Book flights")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save all subtasks" }),
    ).toHaveTextContent("Save 2 Subtasks");
  });

  it("cannot decompose until the task has finished loading", async () => {
    let finishLoading: () => void = () => {};
    const loaded = new Promise<void>((resolve) => {
      finishLoading = resolve;
    });
    const queryClient = makeQueryClient();
    queryClient.setQueryData(
      ["tasks", { id: 1 }],
      makeTask({ id: 1, title: "Plan trip", subtasks: [] }),
    );
    mock.onGet("tasks/1").reply(async () => {
      await loaded;
      return [200, makeTask({ id: 1, title: "Plan trip", subtasks: [] })];
    });
    mock.onGet("/projects").reply(200, { projects: [] });
    mock.onGet("/labels").reply(200, { labels: [] });
    renderPage(queryClient);

    const button = await screen.findByRole("button", {
      name: "Break down tasks into subtasks",
    });
    expect(button).toBeDisabled();

    finishLoading();

    await waitFor(() => expect(button).toBeEnabled());
  });

  it("sends the existing subtasks to the AI and swaps the steps for its answer", async () => {
    mockParent([
      subtask(9, "Pack", "Light bag"),
      subtask(10, "Old step", null),
    ]);
    mock.onPost("ai/decompose").reply(200, {
      tasks: [
        { title: "Pack", description: "Light bag" },
        { title: "Book flights" },
      ],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Regenerate sub tasks" }),
    );

    await screen.findByText("Book flights");
    expect(screen.queryByText("Old step")).not.toBeInTheDocument();
    expect(JSON.parse(mock.history.post[0].data).existingSubtasks).toEqual([
      { title: "Pack", description: "Light bag" },
      { title: "Old step", description: null },
    ]);
  });

  it("replaces the saved subtasks with the steps and opens the parent", async () => {
    mockParent([subtask(9, "Old step", null)]);
    mock.onPost("ai/decompose").reply(200, {
      tasks: [
        { title: "Book flights", description: "Compare fares", priority: 2 },
        { title: "Pack", description: "", priority: 4 },
      ],
    });
    mock.onPut("/tasks/1/subtasks").reply(200, { subtasks: [] });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Regenerate sub tasks" }),
    );
    await screen.findByText("Book flights");
    await userEvent.click(
      screen.getByRole("button", { name: "Save all subtasks" }),
    );

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(
      mock.history.post.filter((r) => r.url === "/tasks/1/subtasks"),
    ).toEqual([]);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({
      subtasks: [
        { title: "Book flights", description: "Compare fares", priority: 2 },
        { title: "Pack", description: "", priority: 4 },
      ],
    });
    expect(await screen.findByTestId("where")).toHaveTextContent("/?task=1");
  });
});
