import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../test/api";
import { renderWithProviders } from "../../test/render";
import ProjectSettings from "./ProjectSettings";

const mock = mockApi();
const work = {
  id: 1,
  name: "Work",
  colour: "#6366f1",
  parentId: null,
  position: 0,
};

describe("ProjectSettings", () => {
  it("creates a sub-project under the chosen parent", async () => {
    mock.onGet("/projects").reply(200, { projects: [work] });
    mock
      .onPost("/projects")
      .reply(201, { ...work, id: 2, name: "Reports", parentId: 1 });
    renderWithProviders(<ProjectSettings />);
    await screen.findByRole("button", { name: "Edit Work" });

    await userEvent.type(screen.getByLabelText("Project name"), "Reports");
    await userEvent.selectOptions(screen.getByLabelText("Parent project"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      name: "Reports",
      parentId: 1,
    });
  });

  it("shows the server's message when the name is taken", async () => {
    mock.onGet("/projects").reply(200, { projects: [work] });
    mock.onPost("/projects").reply(409, {
      errors: { name: "You already have a project with that name here." },
    });
    renderWithProviders(<ProjectSettings />);
    await screen.findByRole("button", { name: "Edit Work" });

    await userEvent.type(screen.getByLabelText("Project name"), "Work");
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You already have a project with that name here.",
    );
  });

  it("renames a project", async () => {
    mock.onGet("/projects").reply(200, { projects: [work] });
    mock.onPatch("/projects/1").reply(200, { ...work, name: "Job" });
    renderWithProviders(<ProjectSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Edit Work" }),
    );
    const [name] = screen.getAllByLabelText("Project name");
    await userEvent.clear(name);
    await userEvent.type(name, "Job");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toMatchObject({
      name: "Job",
    });
  });

  it("deletes after confirming", async () => {
    mock.onGet("/projects").reply(200, { projects: [work] });
    mock.onDelete("/projects/1").reply(200, {});
    window.confirm = () => true;
    renderWithProviders(<ProjectSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Work" }),
    );

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });
});
