import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { makeGhost, makeTask, renderWithProviders } from "../../../test/render";
import EisenhowerMatrix from "./EisenhowerMatrix";

const mock = mockApi();

const tasks = [
  makeTask({ id: 1, title: "Fix outage", priority: 1 }),
  makeTask({ id: 2, title: "Plan roadmap", priority: 2 }),
  makeTask({ id: 3, title: "Answer email", priority: 3 }),
  makeTask({ id: 4, title: "Browse news", priority: 4 }),
];

const quadrant = (name: string) => screen.getByRole("region", { name });

function dragTaskTo(title: string, quadrantName: string) {
  fireEvent.dragStart(screen.getByText(title));
  fireEvent.drop(quadrant(quadrantName));
}

describe("EisenhowerMatrix", () => {
  it("places each task in the quadrant matching its priority", () => {
    renderWithProviders(<EisenhowerMatrix tasks={tasks} />);

    expect(within(quadrant("Do first")).getByText("Fix outage")).toBeVisible();
    expect(within(quadrant("Schedule")).getByText("Plan roadmap")).toBeVisible();
    expect(within(quadrant("Delegate")).getByText("Answer email")).toBeVisible();
    expect(within(quadrant("Eliminate")).getByText("Browse news")).toBeVisible();
  });

  it("changes a task's priority when it is dropped on another quadrant", async () => {
    mock.onPatch("/tasks/4").reply(200, {});
    renderWithProviders(<EisenhowerMatrix tasks={tasks} />);

    dragTaskTo("Browse news", "Do first");

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ priority: 1 });
  });

  it("does nothing when a task is dropped on its own quadrant", () => {
    renderWithProviders(<EisenhowerMatrix tasks={tasks} />);

    dragTaskTo("Browse news", "Eliminate");

    expect(mock.history.patch).toHaveLength(0);
  });

  it("updates the series when a projected occurrence is dropped", async () => {
    mock.onPatch("/tasks/9").reply(200, {});
    const ghost = makeGhost(9, "20260302", { title: "Stand-up", priority: 4 });
    renderWithProviders(<EisenhowerMatrix tasks={[ghost]} />);

    dragTaskTo("Stand-up", "Schedule");

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ priority: 2 });
  });
});
