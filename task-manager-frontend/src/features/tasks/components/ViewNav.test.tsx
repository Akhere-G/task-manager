import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ViewNav from "./ViewNav";

const counts = {
  inbox: 2,
  today: 5,
  upcoming: 0,
  overdue: 1,
  week: 7,
  month: 9,
};

describe("ViewNav", () => {
  it("shows each view with its count and marks the current one", () => {
    render(<ViewNav view="today" counts={counts} onSelect={() => {}} />);

    expect(screen.getByRole("button", { name: /today/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /overdue/i })).toHaveTextContent(
      "1",
    );
  });

  it("reports the view that was pressed", async () => {
    const onSelect = vi.fn();
    render(<ViewNav view="all" counts={counts} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /this week/i }));

    expect(onSelect).toHaveBeenCalledWith("week");
  });
});
