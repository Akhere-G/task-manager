import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../test/api";
import { makeTask, renderWithProviders } from "../test/render";
import type { TrashedTask } from "../features/tasks/types";
import Trash from "./Trash";

const mock = mockApi();

const NOW = new Date("2026-03-11T12:00:00Z");

function trashed(id: number, title: string, purgeAt: string): TrashedTask {
  return {
    ...makeTask({ id, title }),
    deletedAt: "2026-03-10T12:00:00Z",
    purgeAt,
  };
}

function page(tasks: TrashedTask[], totalPages = 1) {
  return { tasks, totalTasks: tasks.length, totalPages, currentPage: 1 };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Trash page", () => {
  it("lists deleted tasks with the days left to restore them", async () => {
    mock
      .onGet("/tasks/trash")
      .reply(
        200,
        page([
          trashed(1, "Old report", "2026-04-09T12:00:00Z"),
          trashed(2, "Last chance", "2026-03-11T20:00:00Z"),
        ]),
      );

    renderWithProviders(<Trash />);

    expect(await screen.findByText("Old report")).toBeInTheDocument();
    expect(screen.getByText(/29 days left/)).toBeInTheDocument();
    expect(screen.getByText(/1 day left/)).toBeInTheDocument();
  });

  it("says so when the trash is empty", async () => {
    mock.onGet("/tasks/trash").reply(200, page([]));

    renderWithProviders(<Trash />);

    expect(await screen.findByText("Trash is empty.")).toBeInTheDocument();
  });

  it("restores a task, then refetches the trash, the lists and the stats", async () => {
    let restored = false;
    mock
      .onGet("/tasks/trash")
      .reply(() => [
        200,
        page(restored ? [] : [trashed(7, "Oops", "2026-04-09T12:00:00Z")]),
      ]);
    mock.onPost("/tasks/7/restore").reply(() => {
      restored = true;
      return [200, trashed(7, "Oops", "2026-04-09T12:00:00Z")];
    });

    renderWithProviders(<Trash />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore task Oops" }),
      {
        advanceTimers: vi.advanceTimersByTime,
      },
    );

    await waitFor(() =>
      expect(screen.getByText("Trash is empty.")).toBeInTheDocument(),
    );
    expect(mock.history.post.map((r) => r.url)).toEqual(["/tasks/7/restore"]);
  });

  it("asks the server for the page in the address", async () => {
    mock.onGet("/tasks/trash").reply(200, page([], 3));

    renderWithProviders(<Trash />, { route: "/trash?page=2" });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(mock.history.get[0].params).toEqual({ page: 2 });
  });

  it("keeps the task listed and shows an error when restoring fails", async () => {
    mock
      .onGet("/tasks/trash")
      .reply(200, page([trashed(3, "Stuck", "2026-04-09T12:00:00Z")]));
    mock.onPost("/tasks/3/restore").reply(500);

    renderWithProviders(<Trash />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Restore task Stuck" }),
      {
        advanceTimers: vi.advanceTimersByTime,
      },
    );

    expect(
      await screen.findByText("Could not restore the task"),
    ).toBeInTheDocument();
    expect(screen.getByText("Stuck")).toBeInTheDocument();
  });
});
