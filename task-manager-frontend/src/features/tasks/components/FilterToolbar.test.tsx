import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockApi } from "../../../test/api";
import { renderWithProviders } from "../../../test/render";
import { getDefaultFilters } from "../taskParams";
import FilterToolbar from "./FilterToolbar";

mockApi();

function renderToolbar(changes: Partial<ReturnType<typeof getDefaultFilters>>) {
  const updateFilters = vi.fn();
  const resetFilters = vi.fn();
  renderWithProviders(
    <FilterToolbar
      filters={{ ...getDefaultFilters(), ...changes }}
      updateFilters={updateFilters}
      resetFilters={resetFilters}
      canFilterCompleted
      isOpen={false}
      onToggle={vi.fn()}
    />,
  );
  return { updateFilters, resetFilters };
}

describe("FilterToolbar", () => {
  it("shows no chips or clear button when nothing is filtered", () => {
    renderToolbar({});

    expect(screen.queryByText("Clear all")).toBeNull();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("shows a chip and the count for each active filter", () => {
    renderToolbar({ priority: "1,2", duration: "short_tasks" });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("P1–P2")).toBeInTheDocument();
    expect(screen.getByText("Short")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show filters" }),
    ).toHaveTextContent("2");
  });

});
