import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useTaskContext } from "../../../context/TaskContext";
import { mockApi } from "../../../test/api";
import { makeGhost, makeTask, renderWithProviders } from "../../../test/render";
import TaskCard from "./TaskCard";

const mock = mockApi();

function PopupState() {
  const { popupMode, selectedTask } = useTaskContext();
  return (
    <p data-testid="popup">
      {popupMode}:{selectedTask?.title ?? "none"}
    </p>
  );
}

function renderCard(
  props: Partial<React.ComponentProps<typeof TaskCard>> = {},
) {
  return renderWithProviders(
    <>
      <TaskCard {...makeTask({ title: "Plan trip" })} {...props} />
      <PopupState />
    </>,
  );
}

describe("TaskCard title", () => {
  it("opens the overview popup when the title is clicked", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Open task: Plan trip" }),
    );

    expect(screen.getByTestId("popup")).toHaveTextContent("View:Plan trip");
  });

  it("is plain text when opening is turned off", () => {
    renderCard({ showOpen: false });

    expect(
      screen.queryByRole("button", { name: "Open task: Plan trip" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Plan trip")).toBeInTheDocument();
  });

  it("does not open the overview from the other card buttons", async () => {
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    expect(screen.getByTestId("popup")).toHaveTextContent("Closed:none");
  });

  it("completes a repeating occurrence through its series", async () => {
    mock.onPatch("/tasks/5").reply(200, {});
    renderCard(makeGhost(5, "20260303", { title: "Water plants" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(mock.history.patch[0].url).toBe("/tasks/5");
  });
});
