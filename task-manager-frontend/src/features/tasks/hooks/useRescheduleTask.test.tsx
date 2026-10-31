import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeQueryClient, makeTask, renderHookWithProviders } from "../../../test/render";
import useRescheduleTask from "./useRescheduleTask";
import { mockApi } from "../../../test/api";

const mock = mockApi();

function renderReschedule() {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(["tasks", "calendar"], []);
  return renderHookWithProviders(() => useRescheduleTask(), { queryClient });
}

const MOVE = {
  previousStartAt: "2026-03-09T09:00:00Z",
  previousEndAt: "2026-03-09T10:00:00Z",
  startAt: "2026-03-10T10:00:00+01:00",
  endAt: "2026-03-10T11:00:00+01:00",
  isGhost: true,
};

describe("useRescheduleTask", () => {
  it("posts every time as a UTC string to the series' reschedule endpoint", async () => {
    mock.onPost("/tasks/3/reschedule").reply(200, makeTask({ id: 3 }));
    const { result } = renderReschedule();

    await result.current.mutateAsync({ id: 3, rescheduleData: MOVE });

    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      previousStartAt: "2026-03-09 09:00:00",
      previousEndAt: "2026-03-09 10:00:00",
      startAt: "2026-03-10 09:00:00",
      endAt: "2026-03-10 10:00:00",
      isGhost: true,
    });
  });

  it("refetches tasks after a move, even when it fails", async () => {
    mock.onPost("/tasks/3/reschedule").reply(409, { error: "Already updated." });
    const { result, queryClient } = renderReschedule();

    await expect(
      result.current.mutateAsync({ id: 3, rescheduleData: MOVE }),
    ).rejects.toBeDefined();

    await waitFor(() =>
      expect(queryClient.getQueryState(["tasks", "calendar"])?.isInvalidated).toBe(true),
    );
  });
});
