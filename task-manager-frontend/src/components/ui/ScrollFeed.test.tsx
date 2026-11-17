import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CategoryFooter from "./CategoryFooter";
import ScrollFeed from "./ScrollFeed";

const feed = {
  isLoading: false,
  isEmpty: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: () => {},
  emptyMessage: <p>Nothing here</p>,
};

describe("ScrollFeed", () => {
  it("shows the empty message only when empty and not loading", () => {
    const { rerender } = render(
      <ScrollFeed {...feed} isEmpty>
        rows
      </ScrollFeed>,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();

    rerender(
      <ScrollFeed {...feed} isEmpty isLoading>
        rows
      </ScrollFeed>,
    );
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a spinner while fetching the next page", () => {
    render(
      <ScrollFeed {...feed} hasNextPage isFetchingNextPage>
        rows
      </ScrollFeed>,
    );
    expect(screen.getByLabelText("Loading more tasks")).toBeInTheDocument();
  });
});

describe("CategoryFooter", () => {
  it("counts what is left to scroll", () => {
    render(<CategoryFooter shown={10} total={25} label="tasks" />);
    expect(screen.getByText("Showing 10 of 25 tasks")).toBeInTheDocument();
    expect(screen.getByText("Scroll for 15 more ↓")).toBeInTheDocument();
  });

  it("hides the scroll hint once everything is shown", () => {
    render(<CategoryFooter shown={3} total={3} />);
    expect(screen.queryByText(/Scroll for/)).not.toBeInTheDocument();
  });
});
