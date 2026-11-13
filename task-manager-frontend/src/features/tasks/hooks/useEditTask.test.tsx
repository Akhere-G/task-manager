import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import { mockApi } from "../../../test/api";
import { makeTask, renderHookWithProviders } from "../../../test/render";
import useEditTask from "./useEditTask";

const mock = mockApi();

describe("useEditTask", () => {
  it("saves the edit without the task's column and then calls onSuccess", async () => {
    mock.onPatch("/tasks/1").reply(200, {});
    const onSuccess = vi.fn();
    const task = makeTask({ id: 1, projectId: 7, columnId: 3 });
    const { result } = renderHookWithProviders(() => ({
      popups: useTaskContext(),
      edit: useEditTask({ onSuccess }),
    }));
    act(() => result.current.popups.openPopup(task, PopupModes.Edit));

    await act(() => result.current.edit({ ...task, projectId: 8 }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const sent = JSON.parse(mock.history.patch[0].data);
    expect(sent).toMatchObject({ projectId: 8 });
    expect(sent).not.toHaveProperty("columnId");
  });
});
