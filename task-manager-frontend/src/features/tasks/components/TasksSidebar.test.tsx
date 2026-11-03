import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "../../../test/api";
import { renderWithProviders } from "../../../test/render";
import TasksSidebar from "./TasksSidebar";

const mock = mockApi();
const projects = [
  { id: 1, name: "Work", colour: "#2563eb", parentId: null, position: 0 },
  { id: 2, name: "Reports", colour: "#16a34a", parentId: 1, position: 0 },
];

function setup(project = "") {
  mock.onGet("/projects").reply(200, { projects });
  const onSelectProject = vi.fn();
  const onSelectView = vi.fn();
  renderWithProviders(
    <TasksSidebar
      view="all"
      project={project}
      onSelectView={onSelectView}
      onSelectProject={onSelectProject}
    />,
  );
  return { onSelectProject, onSelectView };
}

describe("TasksSidebar", () => {
  it("lists All projects first, then the projects with sub-projects indented", async () => {
    setup();

    const nav = await screen.findByRole("navigation", { name: "Projects" });
    await within(nav).findByRole("button", { name: "Work" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All projects", "Work", "Reports"]);
  });

  it("marks the selected project and reports a choice", async () => {
    const { onSelectProject } = setup("1");

    const work = await screen.findByRole("button", { name: "Work" });
    expect(work).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "All projects" }));
    expect(onSelectProject).toHaveBeenCalledWith("");
  });

  it("opens as a closable drawer and closes after a choice", async () => {
    const { onSelectView } = setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Views and projects" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Views and projects" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Inbox/ }));

    expect(onSelectView).toHaveBeenCalledWith("inbox");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the close button", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Views and projects" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Close sidebar" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
