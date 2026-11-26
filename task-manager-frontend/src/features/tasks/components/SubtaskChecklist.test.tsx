import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { heldReply, mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import useGetTask from "../hooks/useGetTask";
import type { Subtask } from "../types";
import SubtaskChecklist from "./SubtaskChecklist";

const mock = mockApi();

function subtask(
  id: number,
  title: string,
  isCompleted = false,
  description: string | null = null,
): Subtask {
  return {
    id,
    parentId: 1,
    position: id,
    title,
    description,
    priority: 4,
    isCompleted,
    completedAt: null,
  };
}

function CachedChecklist() {
  const subtasks = useGetTask(1).data?.subtasks ?? [];
  return <SubtaskChecklist parentId={1} subtasks={subtasks} />;
}

function renderCached(...subtasks: Subtask[]) {
  mock
    .onGet("/tasks/1")
    .reply(200, makeTask({ subtasks, subtaskCount: subtasks.length }));
  return renderWithProviders(<CachedChecklist />);
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

  it("ticks a subtask at once, locks it, and unticks it if saving fails", async () => {
    const held = heldReply(500);
    mock.onPatch("/tasks/3").reply(held.reply);
    renderCached(subtask(3, "Review"));
    const checkbox = await screen.findByRole("checkbox", { name: "Review" });

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(checkbox).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reorder subtask Review" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete subtask Review" }),
    ).toBeDisabled();
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save the subtask",
    );
    expect(checkbox).not.toBeChecked();
  });

  it("removes a deleted subtask at once and brings it back if that fails", async () => {
    const held = heldReply(500);
    mock.onDelete("/tasks/3").reply(held.reply);
    renderCached(subtask(3, "Review"));

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete subtask Review" }),
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    held.release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete the subtask",
    );
    expect(
      screen.getByRole("checkbox", { name: "Review" }),
    ).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(1);
  });

  it("reveals a subtask's description in an accordion", async () => {
    renderWithProviders(
      <SubtaskChecklist
        parentId={1}
        subtasks={[subtask(2, "Draft", false, "Outline the intro first")]}
      />,
    );
    const toggle = screen.getByRole("button", {
      name: "Show details for Draft",
    });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("Outline the intro first"),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Outline the intro first")).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(
      screen.queryByText("Outline the intro first"),
    ).not.toBeInTheDocument();
  });

  it("does not offer to expand a subtask without a description", () => {
    renderWithProviders(
      <SubtaskChecklist parentId={1} subtasks={[subtask(2, "Draft")]} />,
    );

    expect(
      screen.queryByRole("button", { name: "Show details for Draft" }),
    ).not.toBeInTheDocument();
  });

  it("gives every subtask a drag handle", () => {
    renderWithProviders(
      <SubtaskChecklist
        parentId={1}
        subtasks={[subtask(2, "Draft"), subtask(3, "Review")]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reorder subtask Draft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reorder subtask Review" }),
    ).toBeInTheDocument();
  });

  it("puts the new order after a keyboard drag", async () => {
    mock.onPut("/tasks/1/subtasks/order").reply(200, { subtasks: [] });
    // jsdom has no layout; give each row a slot so dnd-kit can tell them apart.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const row = this.closest("li");
        const top = row
          ? [...(row.parentElement?.children ?? [])].indexOf(row) * 40
          : 0;
        return new DOMRect(0, top, 300, 40);
      },
    );
    renderWithProviders(
      <SubtaskChecklist
        parentId={1}
        subtasks={[subtask(2, "Draft"), subtask(3, "Review")]}
      />,
    );

    screen.getByRole("button", { name: "Reorder subtask Draft" }).focus();
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard(" ");

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ ids: [3, 2] });
  });
});
