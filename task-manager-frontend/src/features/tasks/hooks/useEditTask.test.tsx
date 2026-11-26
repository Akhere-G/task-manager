import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import { heldReply, mockApi } from "../../../test/api";
import { makeTask, renderHookWithProviders } from "../../../test/render";
import useEditTask from "./useEditTask";

const mock = mockApi();
const task = makeTask({ id: 1, projectId: 7, columnId: 3 });

function openEditor(status: number) {
  const held = heldReply(status);
  mock.onPatch("/tasks/1").reply(held.reply);
  const { result } = renderHookWithProviders(() => ({
    popups: useTaskContext(),
    edit: useEditTask(),
  }));
  act(() => result.current.popups.openPopup(task, PopupModes.Edit));
  let saving = Promise.resolve();
  act(() => {
    saving = result.current.edit({ ...task, projectId: 8 });
  });
  const settle = async () => {
    held.release();
    await act(() => saving);
  };
  return { result, settle };
}

describe("useEditTask", () => {
  it("closes at once and saves the edit without the task's column", async () => {
    const { result, settle } = openEditor(200);

    expect(result.current.popups.popupMode).toBe(PopupModes.Closed);
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    const sent = JSON.parse(mock.history.patch[0].data);
    expect(sent).toMatchObject({ projectId: 8 });
    expect(sent).not.toHaveProperty("columnId");
    await settle();
    expect(result.current.popups.popupMode).toBe(PopupModes.Closed);
  });

  it("leaves a popup opened since alone when saving fails", async () => {
    const { result, settle } = openEditor(500);
    act(() =>
      result.current.popups.openPopup(makeTask({ id: 2 }), PopupModes.View),
    );

    await settle();

    expect(result.current.popups.popupMode).toBe(PopupModes.View);
    expect(result.current.popups.selectedTask?.id).toBe(2);
  });
});
