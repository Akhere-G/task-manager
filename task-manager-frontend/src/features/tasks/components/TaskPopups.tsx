import TaskDetails from "./TaskDetails";
import { Popup } from "../../../components/ui";
import {
  PopupModes,
  useTaskContext,
  type PopupMode,
} from "../../../context/TaskContext";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import useDeleteTask from "../hooks/useDeleteTask";
import useGetTask from "../hooks/useGetTask";
import useEditTask from "../hooks/useEditTask";
import useSetIsCompleted from "../hooks/useSetIsCompleted";
import type { CreateTaskInput, Task } from "../types";
import TaskForm from "./TaskForm";

interface TaskPopupsProps {
  handleDelete: (id: number) => void;
  handleEdit: (task: CreateTaskInput) => Promise<void>;
  selectedTask: Task | null;
  popupMode: PopupMode;
  closePopup: () => void;
  openPopup: (task: Task, mode: PopupMode) => void;
  setIsCompleted: (
    id: number,
    isCompleted: boolean,
    task?: Task,
  ) => Promise<void>;
}
function TaskPopups({
  handleDelete,
  handleEdit,
  selectedTask,
  popupMode,
  closePopup,
  openPopup,
  setIsCompleted,
}: TaskPopupsProps) {
  if (!selectedTask) return <></>;

  switch (popupMode) {
    case PopupModes.Closed:
      return <></>;
    case PopupModes.Delete:
      return (
        <Popup
          title="Delete Task"
          close={closePopup}
          handleConfirm={() => {
            handleDelete(selectedTask.id);
            closePopup();
          }}
          actionText="Delete Task"
        >
          {`Delete task '${selectedTask.title}'? You can restore it from Trash for 30 days.`}
        </Popup>
      );
    case PopupModes.Edit:
      return (
        <Popup
          title={`Edit task '${selectedTask.title}'?`}
          close={closePopup}
          showCloseButton={false}
        >
          <TaskForm
            confirmButtonText="Edit Task"
            initialData={selectedTask}
            submitAction={handleEdit}
            close={closePopup}
          />
        </Popup>
      );
    case PopupModes.View:
      return (
        <Popup title="" close={closePopup} showCloseButton={false} sleek>
          <TaskDetails
            task={selectedTask}
            onDelete={(task) => {
              openPopup(task, PopupModes.Delete);
            }}
            onEdit={(task) => {
              openPopup(task, PopupModes.Edit);
            }}
            setIsCompleted={(id, isCompleted, task) => {
              setIsCompleted(id, isCompleted, task);
              closePopup();
            }}
          />
        </Popup>
      );
  }
}

function useOpenTaskFromUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { popupMode, openPopup } = useTaskContext();
  const taskId = Number(searchParams.get("task")) || 0;
  const isClosed = popupMode === PopupModes.Closed;
  const { data, isError } = useGetTask(taskId, taskId > 0 && isClosed);
  // The URL clears a render after the popup closes; remembering the handled id
  // stops that lag from reopening the task that was just closed.
  const handledId = useRef(0);

  useEffect(() => {
    if (!taskId || !isClosed) handledId.current = taskId;
  }, [taskId, isClosed]);

  useEffect(() => {
    if (data && isClosed && handledId.current !== data.id) {
      handledId.current = data.id;
      openPopup(data, PopupModes.View);
    }
  }, [data, isClosed, openPopup]);

  useEffect(() => {
    if (!isError) return;
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [isError, searchParams, setSearchParams]);
}

export default function TaskPopupsConnected() {
  const { mutate: handleDelete } = useDeleteTask();
  const { popupMode, closePopup, selectedTask, openPopup } = useTaskContext();
  useOpenTaskFromUrl();
  const handleEdit = useEditTask({ onSuccess: closePopup });

  const setIsCompleted = useSetIsCompleted();

  return (
    <TaskPopups
      handleDelete={handleDelete}
      handleEdit={handleEdit}
      popupMode={popupMode}
      closePopup={closePopup}
      selectedTask={selectedTask}
      openPopup={openPopup}
      setIsCompleted={setIsCompleted}
    />
  );
}
