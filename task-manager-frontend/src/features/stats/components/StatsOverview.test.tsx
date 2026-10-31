import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import StatsOverview from "./StatsOverview";
import { mockApi } from "../../../test/api";

const mock = mockApi();

const days = (counts: number[]) =>
  counts.map((tasks, i) => ({ date: `2026-03-${String(i + 1).padStart(2, "0")}`, tasks }));

function stats(overrides = {}) {
  return {
    backlogHealth: [
      { status: "Completed", count: 3 },
      { status: "Pending", count: 4 },
      { status: "Overdue", count: 1 },
    ],
    timeSpent: [
      { category: "work", timeSpent: 150 },
      { category: "home", timeSpent: 100 },
    ],
    productivity: days([0, 2, 0, 1, 1, 3, 0, 2, 1, 4]),
    categoryVolume: [
      { category: "life-admin", pending: 2, overdue: 3, completed: 0, total: 5 },
      { category: "work", pending: 4, overdue: 0, completed: 3, total: 7 },
    ],
    ...overrides,
  };
}

function card(title: string) {
  return within(screen.getByRole("heading", { name: title }).parentElement as HTMLElement);
}

describe("StatsOverview", () => {
  it("summarises the dashboard data", async () => {
    mock.onGet("/stats/dashboard").reply(200, stats());
    renderWithProviders(<StatsOverview />);

    await screen.findByText("38");

    expect(card("Completion Rate").getByText("38")).toBeInTheDocument(); // 3 of 8
    expect(card("Total Invested").getByText("4")).toBeInTheDocument(); // 250 min
    expect(card("Daily Streak").getByText("3")).toBeInTheDocument(); // the last three days all > 0
    expect(card("Velocity").getByText("1.7")).toBeInTheDocument(); // 12 tasks in the last 7 days
    expect(card("Top Focus").getByText("Life admin")).toBeInTheDocument();
  });

  it("shows zeros for a user with no tasks yet", async () => {
    mock.onGet("/stats/dashboard").reply(
      200,
      stats({ backlogHealth: [], timeSpent: [], productivity: days([0, 0, 0]), categoryVolume: [] }),
    );
    renderWithProviders(<StatsOverview />);

    await screen.findByText("None");

    expect(card("Completion Rate").getByText("0")).toBeInTheDocument();
    expect(card("Daily Streak").getByText("0")).toBeInTheDocument();
    expect(card("Velocity").getByText("0.0")).toBeInTheDocument();
  });

  it("ends the streak at the first quiet day", async () => {
    mock.onGet("/stats/dashboard").reply(200, stats({ productivity: days([5, 5, 0, 1, 1]) }));
    renderWithProviders(<StatsOverview />);

    await screen.findByText("38");

    expect(card("Daily Streak").getByText("2")).toBeInTheDocument();
  });

  it("explains a failure to load", async () => {
    mock.onGet("/stats/dashboard").reply(500);
    renderWithProviders(<StatsOverview />);

    expect(await screen.findByText("Could not load data")).toBeInTheDocument();
  });
});
