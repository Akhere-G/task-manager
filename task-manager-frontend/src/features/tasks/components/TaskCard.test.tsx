import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useTaskContext } from "../../../context/TaskContext";
import { mockApi } from "../../../test/api";
import { makeGhost, makeTask, renderWithProviders } from "../../../test/render";
import TaskCard from "./TaskCard";

mockApi();

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

  it("opens a repeating occurrence through its series", async () => {
    const ghost = makeGhost(5, "20260303", { title: "Water plants" });
    renderWithProviders(
      <>
        <TaskCard {...ghost} />
        <PopupState />
      </>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Open task: Water plants" }),
    );

    expect(screen.getByTestId("popup")).toHaveTextContent("View:Water plants");
  });
});
