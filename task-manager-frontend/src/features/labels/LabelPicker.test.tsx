import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "../../test/api";
import { renderWithProviders } from "../../test/render";
import LabelChips from "./LabelChips";
import LabelPicker from "./LabelPicker";

const mock = mockApi();
const labels = [
  { id: 1, name: "urgent", colour: "#ef4444" },
  { id: 2, name: "later", colour: "#22c55e" },
];

describe("LabelPicker", () => {
  it("adds and removes labels from the chosen set", async () => {
    mock.onGet("/labels").reply(200, { labels });
    const onChange = vi.fn();
    renderWithProviders(<LabelPicker value={[1]} onChange={onChange} />);

    await userEvent.click(await screen.findByRole("button", { name: "later" }));
    expect(onChange).toHaveBeenLastCalledWith([1, 2]);

    await userEvent.click(screen.getByRole("button", { name: "urgent" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("marks the chosen labels as pressed", async () => {
    mock.onGet("/labels").reply(200, { labels });
    renderWithProviders(<LabelPicker value={[2]} onChange={() => {}} />);

    expect(
      await screen.findByRole("button", { name: "later" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "urgent" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("points to Settings when there are no labels", async () => {
    mock.onGet("/labels").reply(200, { labels: [] });
    renderWithProviders(<LabelPicker value={[]} onChange={() => {}} />);

    expect(await screen.findByText(/No labels yet/)).toBeInTheDocument();
  });
});

describe("LabelChips", () => {
  it("shows only the task's labels", async () => {
    mock.onGet("/labels").reply(200, { labels });
    renderWithProviders(<LabelChips labelIds={[2]} />);

    expect(await screen.findByText("later")).toBeInTheDocument();
    expect(screen.queryByText("urgent")).not.toBeInTheDocument();
  });
});
