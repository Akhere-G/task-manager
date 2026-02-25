import { Popup } from "../../../components/ui";
import { useTaskContext } from "../../../context/TaskContext";
import type { CreateTaskInput, Task } from "../types";
import TaskForm from "./TaskForm";

interface TaskPopupsProps {
  selectedDeleteTask: Task | null;
  selectedEditTask: Task | null;
  closeDeletePopup: () => void;
  closeEditPopup: () => void;
  handleDelete: (id: number) => void;
  handleEdit: (task: CreateTaskInput) => Promise<void>;
}
function TaskPopups({
  selectedDeleteTask,
  selectedEditTask,
  closeDeletePopup,
  closeEditPopup,
  handleDelete,
  handleEdit,
}: TaskPopupsProps) {
  return (
    <>
      {selectedDeleteTask && (
        <Popup
          title="Delete Task"
          close={closeDeletePopup}
          handleConfirm={() => {
            handleDelete(selectedDeleteTask.id);
            closeDeletePopup();
          }}
          actionText="Delete Task"
        >
          {`Delete task '${selectedDeleteTask.title}'?`}
        </Popup>
      )}
      {selectedEditTask && (
        <Popup
          title={`Edit task '${selectedEditTask.title}'?`}
          close={closeEditPopup}
          showCloseButton={false}
        >
          <TaskForm
            confirmButtonText="Edit Task"
            initialData={selectedEditTask}
            submitAction={handleEdit}
            close={closeEditPopup}
          />
        </Popup>
      )}
    </>
  );
}

export default function TaskPopupsConnected() {
  const {
    selectedDeleteTask,
    selectedEditTask,
    closeDeletePopup,
    closeEditPopup,
    handleDelete,
    handleEdit,
  } = useTaskContext();

  return (
    <TaskPopups
      selectedDeleteTask={selectedDeleteTask}
      selectedEditTask={selectedEditTask}
      closeDeletePopup={closeDeletePopup}
      closeEditPopup={closeEditPopup}
      handleDelete={handleDelete}
      handleEdit={handleEdit}
    />
  );
}
