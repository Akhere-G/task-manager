import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { renderWithProviders } from "../../../test/render";
import QuickCapture from "./QuickCapture";

const mock = mockApi();

describe("QuickCapture", () => {
  it("sends a title-only task and clears the box", async () => {
    mock.onPost("/tasks").reply(201, {});
    renderWithProviders(<QuickCapture />);

    await userEvent.type(screen.getByLabelText("Quick capture"), "  Call mum ");
    await userEvent.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      title: "Call mum",
      projectId: null,
      startAt: null,
      endAt: null,
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Quick capture")).toHaveValue(""),
    );
  });

  it("keeps the text and says so when the server fails", async () => {
    mock.onPost("/tasks").reply(500);
    renderWithProviders(<QuickCapture />);

    await userEvent.type(screen.getByLabelText("Quick capture"), "Call mum");
    await userEvent.click(screen.getByRole("button", { name: "Capture" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add");
    expect(screen.getByLabelText("Quick capture")).toHaveValue("Call mum");
  });

  it("will not capture a blank title", () => {
    renderWithProviders(<QuickCapture />);

    expect(screen.getByRole("button", { name: "Capture" })).toBeDisabled();
  });
});
