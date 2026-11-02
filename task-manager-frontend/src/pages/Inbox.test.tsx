import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../test/api";
import { makeTask, renderWithProviders } from "../test/render";
import Inbox from "./Inbox";

const mock = mockApi();

describe("Inbox", () => {
  it("asks for the inbox view and shows undated tasks", async () => {
    mock.onGet(/\/tasks\?/).reply(200, {
      tasks: [
        makeTask({ id: 1, title: "Loose end", startAt: null, endAt: null }),
      ],
      totalTasks: 1,
      totalPages: 1,
      currentPage: 1,
    });
    renderWithProviders(<Inbox />);

    expect(await screen.findByText("Loose end")).toBeInTheDocument();
    expect(screen.getByText("No date")).toBeInTheDocument();
    const request = mock.history.get.find((r) => r.url?.startsWith("/tasks?"));
    expect(request?.url).toContain("view=inbox");
  });
});
