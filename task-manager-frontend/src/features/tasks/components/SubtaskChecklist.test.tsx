import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { renderWithProviders } from "../../../test/render";
import type { Subtask } from "../types";
import SubtaskChecklist from "./SubtaskChecklist";

const mock = mockApi();

function subtask(id: number, title: string, isCompleted = false): Subtask {
  return {
    id,
    parentId: 1,
    position: id,
    title,
    description: null,
    priority: 4,
    isCompleted,
    completedAt: null,
  };
}

describe("SubtaskChecklist", () => {
  it("shows the progress through the subtasks", () => {
    renderWithProviders(
      <SubtaskChecklist
        parentId={1}
        subtasks={[subtask(2, "Draft", true), subtask(3, "Review")]}
      />,
    );

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByRole("checkbox", { name: "Draft" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Review" })).not.toBeChecked();
  });

  it("completes a subtask through the task endpoint", async () => {
    mock.onPatch("/tasks/3").reply(200, {});
    renderWithProviders(
      <SubtaskChecklist parentId={1} subtasks={[subtask(3, "Review")]} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Review" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toMatchObject({
      isCompleted: true,
    });
  });

  it("adds a subtask under the parent", async () => {
    mock.onPost("/tasks/1/subtasks").reply(201, { subtasks: [] });
    renderWithProviders(<SubtaskChecklist parentId={1} subtasks={[]} />);

    await userEvent.type(screen.getByLabelText("New subtask"), " Write tests ");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      subtasks: [{ title: "Write tests" }],
    });
    await waitFor(() =>
      expect(screen.getByLabelText("New subtask")).toHaveValue(""),
    );
  });

  it("deletes a subtask", async () => {
    mock.onDelete("/tasks/3").reply(200, {});
    renderWithProviders(
      <SubtaskChecklist parentId={1} subtasks={[subtask(3, "Review")]} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete subtask Review" }),
    );

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });
});
