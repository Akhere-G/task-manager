import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "../../../test/api";
import { renderWithProviders } from "../../../test/render";
import FilterPanel from "./FilterPanel";

mockApi();

const filters = {
  search: "",
  project: "",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "all",
  sortBy: "start_at",
  order: "asc",
};

function renderPanel(
  overrides: Partial<Parameters<typeof FilterPanel>[0]> = {},
) {
  const updateFilters = vi.fn();
  renderWithProviders(
    <FilterPanel
      filters={filters}
      updateFilters={updateFilters}
      resetFilters={vi.fn()}
      sortable
      canFilterCompleted
      {...overrides}
    />,
  );
  return updateFilters;
}

describe("FilterPanel", () => {
  it("picks priority, duration, sort and order from button groups", async () => {
    const updateFilters = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "P1–P2" }));
    await userEvent.click(screen.getByRole("button", { name: "Short" }));
    await userEvent.click(screen.getByRole("button", { name: "Title" }));
    await userEvent.click(screen.getByRole("button", { name: "Descending" }));

    expect(updateFilters.mock.calls).toEqual([
      ["priority", "1,2"],
      ["duration", "short_tasks"],
      ["sortBy", "title"],
      ["order", "desc"],
    ]);
  });

  it("hides status when completed tasks are grouped and sorting when not sortable", () => {
    renderPanel({ canFilterCompleted: false, sortable: false });

    expect(screen.queryByRole("group", { name: "Status" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sort by" })).toBeNull();
    expect(screen.getByRole("group", { name: "Priority" })).toBeInTheDocument();
  });
});
