import { TaskCard } from ".";
import { Popup } from "../../../components/ui";
import {
  PopupModes,
  useTaskContext,
  type PopupMode,
} from "../../../context/TaskContext";
import useDeleteTask from "../hooks/useDeleteTask";
import type { CreateTaskInput, Task } from "../types";
import TaskForm from "./TaskForm";

interface TaskPopupsProps {
  handleDelete: (id: number) => void;
  handleEdit: (task: CreateTaskInput) => Promise<void>;
  selectedTask: Task | null;
  popupMode: PopupMode;
  closePopup: () => void;
  openPopup: (task: Task, mode: PopupMode) => void;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>;
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
          {`Delete task '${selectedTask.title}'?`}
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
          <TaskCard
            {...selectedTask}
            onDelete={(task) => {
              openPopup(task, PopupModes.Delete);
            }}
            onEdit={(task) => {
              openPopup(task, PopupModes.Edit);
            }}
            setIsCompleted={(task, isCompleted) => {
              setIsCompleted(task, isCompleted);
              closePopup();
            }}
          />
        </Popup>
      );
  }
}

export default function TaskPopupsConnected() {
  const { mutate: handleDelete } = useDeleteTask();
  const {
    handleEdit,
    popupMode,
    closePopup,
    selectedTask,
    openPopup,
    setIsCompleted,
  } = useTaskContext();

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
