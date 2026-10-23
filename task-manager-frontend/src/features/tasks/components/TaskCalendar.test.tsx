import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../../../services/api";
import { makeTask, renderWithProviders } from "../../../test/render";

type StubProps = {
  events: { id: number | string; title: string; start: Date; end: Date; resource: unknown }[];
  onEventDrop: (args: { event: unknown; start: Date; end: Date }) => void;
};

// jsdom cannot drag. The stand-in lists each event's start time and exposes a "move" button
// that calls the same onEventDrop the real drag-and-drop calendar calls.
vi.mock("react-big-calendar/lib/addons/dragAndDrop", () => ({
  default: () =>
    function StubCalendar({ events, onEventDrop }: StubProps) {
      return (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <span data-testid={`start-${event.title}`}>{event.start.toISOString()}</span>
              <button
                onClick={() =>
                  onEventDrop({
                    event,
                    start: new Date(event.start.getTime() + 24 * 3600 * 1000),
                    end: new Date(event.end.getTime() + 24 * 3600 * 1000),
                  })
                }
              >
                Move {event.title} a day later
              </button>
            </li>
          ))}
        </ul>
      );
    },
}));

const { default: TaskCalendar } = await import("./TaskCalendar");

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet(/\/tasks.*/).reply(200, { tasks: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  mock.restore();
});

function renderCalendar(tasks = [makeTask()]) {
  return renderWithProviders(
    <TaskCalendar tasks={tasks} currentDate={new Date("2026-03-02T00:00:00Z")} setCurrentDate={() => {}} />,
  );
}

const start = () => screen.getByTestId("start-Write report").textContent;

describe("rescheduling on the calendar", () => {
  it("moves the event straight away, then saves the new times", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mock.onPatch("/tasks/1").reply(async () => {
      await gate;
      return [200, {}];
    });
    renderCalendar();

    await userEvent.click(screen.getByRole("button", { name: "Move Write report a day later" }));

    await waitFor(() => expect(start()).toBe("2026-03-03T09:00:00.000Z"));
    expect(mock.history.patch).toHaveLength(1);
    release();
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({
      startAt: "2026-03-03 09:00:00",
      endAt: "2026-03-03 10:00:00",
    });
  });

  it("puts the event back where it was when the save fails", async () => {
    mock.onPatch("/tasks/1").networkError();
    renderCalendar();
    expect(start()).toBe("2026-03-02T09:00:00.000Z");

    await userEvent.click(screen.getByRole("button", { name: "Move Write report a day later" }));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    await waitFor(() => expect(start()).toBe("2026-03-02T09:00:00.000Z"));
  });

  it("does not move a ghost occurrence", async () => {
    const ghost = makeTask({ id: "ghost_1_20260303" as unknown as number, isGhost: true, seriesId: 1 });
    renderCalendar([ghost]);

    await userEvent.click(screen.getByRole("button", { name: "Move Write report a day later" }));

    expect(start()).toBe("2026-03-02T09:00:00.000Z");
    expect(mock.history.patch).toHaveLength(0);
  });
});
