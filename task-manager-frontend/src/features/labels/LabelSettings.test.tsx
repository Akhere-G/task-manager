import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../test/api";
import { renderWithProviders } from "../../test/render";
import LabelSettings from "./LabelSettings";

const mock = mockApi();
const urgent = { id: 1, name: "urgent", colour: "#ef4444" };

describe("LabelSettings", () => {
  it("creates a label with the chosen name", async () => {
    mock.onGet("/labels").reply(200, { labels: [urgent] });
    mock.onPost("/labels").reply(201, { ...urgent, id: 2, name: "later" });
    renderWithProviders(<LabelSettings />);
    await screen.findByRole("button", { name: "Edit urgent" });

    await userEvent.type(screen.getByLabelText("Label name"), "later");
    await userEvent.click(screen.getByRole("button", { name: "Add label" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      name: "later",
    });
  });

  it("shows the server's message when the name is taken", async () => {
    mock.onGet("/labels").reply(200, { labels: [urgent] });
    mock.onPost("/labels").reply(409, {
      errors: { name: "You already have a label with that name." },
    });
    renderWithProviders(<LabelSettings />);
    await screen.findByRole("button", { name: "Edit urgent" });

    await userEvent.type(screen.getByLabelText("Label name"), "urgent");
    await userEvent.click(screen.getByRole("button", { name: "Add label" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You already have a label with that name.",
    );
  });

  it("renames a label", async () => {
    mock.onGet("/labels").reply(200, { labels: [urgent] });
    mock.onPatch("/labels/1").reply(200, { ...urgent, name: "asap" });
    renderWithProviders(<LabelSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Edit urgent" }),
    );
    const [name] = screen.getAllByLabelText("Label name");
    await userEvent.clear(name);
    await userEvent.type(name, "asap");
    await userEvent.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toMatchObject({
      name: "asap",
    });
  });

  it("deletes after confirming", async () => {
    mock.onGet("/labels").reply(200, { labels: [urgent] });
    mock.onDelete("/labels/1").reply(200, {});
    window.confirm = () => true;
    renderWithProviders(<LabelSettings />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete urgent" }),
    );

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });
});
