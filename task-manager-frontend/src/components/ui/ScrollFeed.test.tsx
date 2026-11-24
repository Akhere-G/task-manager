import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

});
