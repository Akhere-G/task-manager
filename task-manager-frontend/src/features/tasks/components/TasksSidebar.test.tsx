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
  const onSelectInbox = vi.fn();
  renderWithProviders(
    <TasksSidebar
      view="all"
      project={project}
      onSelectInbox={onSelectInbox}
      onSelectProject={onSelectProject}
    />,
  );
  return { onSelectProject, onSelectInbox };
}

describe("TasksSidebar", () => {
  it("lists the inbox and All projects first, then the projects with sub-projects indented", async () => {
    setup();

    const nav = await screen.findByRole("navigation", { name: "Projects" });
    await within(nav).findByRole("button", { name: "Work" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Inbox", "All projects", "Work", "Reports"]);
  });

  it("marks the selected project and reports a choice", async () => {
    const { onSelectProject } = setup("1");

    const work = await screen.findByRole("button", { name: "Work" });
    expect(work).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "All projects" }));
    expect(onSelectProject).toHaveBeenCalledWith("");
  });

  it("opens as a closable drawer and closes after a choice", async () => {
    const { onSelectInbox } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(
      screen.getByRole("dialog", { name: "Projects" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Inbox" }));

    expect(onSelectInbox).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no Views section", () => {
    setup();

    expect(screen.queryByRole("navigation", { name: "Task views" })).toBeNull();
    expect(screen.queryByText("Views")).toBeNull();
  });

  it("closes from the close button", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Projects" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Close sidebar" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
