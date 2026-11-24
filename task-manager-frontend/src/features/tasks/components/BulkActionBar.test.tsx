import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockApi } from "../../../test/api";
import { makeGhost, makeTask, renderWithProviders } from "../../../test/render";
import { SelectionProvider } from "../selection/SelectionProvider";
import { BulkActionBar } from "./BulkActionBar";
import { SelectBox } from "./SelectBox";

const api = mockApi();

const tasks = [
  makeTask({ id: 1, title: "One" }),
  makeTask({ id: 2, title: "Two" }),
];

function renderBar(scope = "list") {
  return renderWithProviders(
    <SelectionProvider scope={scope}>
      {tasks.map((task) => (
        <SelectBox key={task.id} task={task} />
      ))}
      <SelectBox task={makeGhost(9, "20260302")} />
      <BulkActionBar />
    </SelectionProvider>,
  );
}

async function selectBoth() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("checkbox", { name: "Select task: One" }));
  await user.click(screen.getByRole("checkbox", { name: "Select task: Two" }));
  return user;
}

describe("BulkActionBar", () => {
  it("is hidden until a task is selected and ghosts cannot be selected", async () => {
    renderBar();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);

    await selectBoth();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("completes the selected tasks and clears the selection", async () => {
    api.onPost("/tasks/bulk-complete").reply(200, { updated: 2, matched: 2 });
    renderBar();
    const user = await selectBoth();

    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() =>
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument(),
    );
    expect(JSON.parse(api.history.post[0].data)).toEqual({ ids: [1, 2] });
  });

  it("asks before deleting", async () => {
    api.onPost("/tasks/bulk-delete").reply(200, { updated: 2, matched: 2 });
    renderBar();
    const user = await selectBoth();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(api.history.post).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => expect(api.history.post).toHaveLength(1));
    expect(JSON.parse(api.history.post[0].data)).toEqual({ ids: [1, 2] });

    await waitFor(() =>
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Select task: One" }),
    );
    expect(
      screen.queryByRole("button", { name: /confirm delete/i }),
    ).not.toBeInTheDocument();
  });

  it("confirms when every selected task was updated", async () => {
    api.onPost("/tasks/bulk-complete").reply(200, { updated: 2, matched: 2 });
    renderBar();
    const user = await selectBoth();

    await user.click(screen.getByRole("button", { name: /complete/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Updated 2 tasks",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns with the counts when only some tasks were updated", async () => {
    api.onPost("/tasks/bulk-complete").reply(200, { updated: 1, matched: 2 });
    renderBar();
    const user = await selectBoth();

    await user.click(screen.getByRole("button", { name: /complete/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Updated 1 of 2 tasks",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses the result message", async () => {
    api.onPost("/tasks/bulk-complete").reply(200, { updated: 1, matched: 2 });
    renderBar();
    const user = await selectBoth();
    await user.click(screen.getByRole("button", { name: /complete/i }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the selection with Escape", async () => {
    renderBar();
    const user = await selectBoth();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("drops the selection when the scope changes", async () => {
    const { rerender } = renderBar("list");
    await selectBoth();
    rerender(
      <SelectionProvider scope="matrix">
        <BulkActionBar />
      </SelectionProvider>,
    );
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });
});
