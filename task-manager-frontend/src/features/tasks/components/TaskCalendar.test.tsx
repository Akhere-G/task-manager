import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../../../services/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import type { Task } from "../types";

type StubProps = {
  events: { id: number | string; title: string; start: Date; end: Date }[];
  onEventDrop: (args: { event: unknown; start: Date; end: Date }) => void;
};

const DAY = 24 * 3600 * 1000;

// jsdom cannot drag, so this stand-in calendar lists each event's start and has a button
// that calls onEventDrop exactly as the real drag-and-drop calendar does.
vi.mock("react-big-calendar/lib/addons/dragAndDrop", () => ({
  default: () =>
    function StubCalendar({ events, onEventDrop }: StubProps) {
      return (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <span data-testid={`start-${event.id}`}>{event.start.toISOString()}</span>
              <button
                onClick={() =>
                  onEventDrop({
                    event,
                    start: new Date(event.start.getTime() + DAY),
                    end: new Date(event.end.getTime() + DAY),
                  })
                }
              >
                Move {String(event.id)} a day later
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
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  mock.restore();
});

function renderCalendar(tasks: Task[]) {
  renderWithProviders(
    <TaskCalendar
      tasks={tasks}
      currentDate={new Date("2026-03-02T00:00:00Z")}
      setCurrentDate={() => {}}
    />,
  );
}

const moveADayLater = (id: number | string) =>
  userEvent.click(screen.getByRole("button", { name: `Move ${id} a day later` }));
const shownStart = (id: number | string) => screen.getByTestId(`start-${id}`).textContent;
const sentBody = () => JSON.parse(mock.history.post[0].data);

describe("rescheduling on the calendar", () => {
  it("moves the event straight away and sends the old and new times", async () => {
    let release!: () => void;
    const saved = new Promise<void>((resolve) => (release = resolve));
    mock.onPost("/tasks/1/reschedule").reply(async () => {
      await saved;
      return [200, {}];
    });
    renderCalendar([makeTask({ id: 1 })]);

    await moveADayLater(1);

    await waitFor(() => expect(shownStart(1)).toBe("2026-03-03T09:00:00.000Z"));
    release();
    expect(sentBody()).toEqual({
      previousStartAt: "2026-03-02 09:00:00",
      previousEndAt: "2026-03-02 10:00:00",
      startAt: "2026-03-03 09:00:00",
      endAt: "2026-03-03 10:00:00",
      isGhost: false,
    });
  });

  it("moves a ghost by rescheduling its series", async () => {
    mock.onPost("/tasks/4/reschedule").reply(200, {});
    const ghost = makeTask({
      id: "ghost_4_20260309" as unknown as number,
      seriesId: 4,
      isGhost: true,
      startAt: "2026-03-09T09:00:00Z",
      endAt: "2026-03-09T10:00:00Z",
    });
    renderCalendar([ghost]);

    await moveADayLater("ghost_4_20260309");

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(sentBody()).toMatchObject({
      previousStartAt: "2026-03-09 09:00:00",
      startAt: "2026-03-10 09:00:00",
      isGhost: true,
    });
  });

  it("treats a saved task without an isGhost flag as a real occurrence", async () => {
    mock.onPost("/tasks/1/reschedule").reply(200, {});
    const fromApi: Partial<Task> = makeTask({ id: 1, isRepeating: true, repeatBy: "weekly" });
    delete fromApi.isGhost;
    renderCalendar([fromApi as Task]);

    await moveADayLater(1);

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(sentBody().isGhost).toBe(false);
  });

  it("puts the event back when the move is rejected", async () => {
    mock.onPost("/tasks/1/reschedule").reply(409, { error: "Already updated." });
    renderCalendar([makeTask({ id: 1 })]);

    await moveADayLater(1);

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    await waitFor(() => expect(shownStart(1)).toBe("2026-03-02T09:00:00.000Z"));
  });
});
