import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sparkles, Plus, Loader2, Move } from "lucide-react";
import TaskCard from "../features/tasks/components/TaskCard";
import type { CreateTaskInput, Task } from "../features/tasks/types";
import useGetTask from "../features/tasks/hooks/useGetTask";
import axios from "axios";
import type { TaskError } from "../utils/validators";
import { ErrorState, LoadingState, Popup } from "../components/ui";
import { TaskForm } from "../features/tasks/components";
import { PopupModes, useTaskContext } from "../context/TaskContext";
import useCreateAllTasks from "../features/tasks/hooks/useCreateAllTasks";
import { aiService } from "../features/ai/api";
import { getErrorType, trackEvent } from "../services/analytics";

export default function DecomposeTask() {
  const [idCount, setIdCount] = useState(0);
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: createAllTasks } = useCreateAllTasks();

  const {
    data: parentTask,
    isLoading: loadingParent,
    isError: isGetParentError,
  } = useGetTask(Number(taskId));

  const [stagedTasks, setStagedTasks] = useState<Task[]>([]);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAddErrors, setBulkAddErrors] = useState("");
  const [decomposeError, setDecomposeErrors] = useState("");

  const { selectedTask, closePopup, popupMode } = useTaskContext();

  async function handleDecompose() {
    if (!parentTask) return;
    setIsDecomposing(true);
    trackEvent("ai_task_breakdown_requested");
    try {
      const { tasks } = await aiService.decomposeTask(parentTask);
      trackEvent("ai_task_breakdown_succeeded", { subtask_count: tasks.length });
      const formattedTasks: Task[] = tasks.map((task, id) => ({
        ...task,
        id,
        isCompleted: false,
        createdAt: "",
        completedAt: null,
        seriesId: id,
        isGhost: false,
      }));
      setStagedTasks(formattedTasks);
      setIdCount(formattedTasks.length);
      setDecomposeErrors("");
    } catch (err) {
      console.error("Failed to decompose task", err);
      trackEvent("ai_task_breakdown_failed", { error_type: getErrorType(err) });

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const limitMessage =
          status === 429 || status === 503 ? err.response?.data?.error : null;
        setDecomposeErrors(
          limitMessage || "Something went wrong. Please try again.",
        );
      }
    } finally {
      setIsDecomposing(false);
    }
  }

  const handleDeleteStaged = (id: number) => {
    setStagedTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const handleEdit = async (updatedTask: CreateTaskInput) => {
    const id = selectedTask?.id;
    const updated = stagedTasks.map((task) =>
      task.id === id ? { ...task, ...updatedTask } : task,
    );

    setStagedTasks(updated);
    closePopup();
  };

  const handleAdd = () => {
    if (parentTask)
      setStagedTasks((prev) => [
        ...prev,
        {
          title: `Task #${prev.length + 1}`,
          category: parentTask.category,
          description: "",
          startAt: parentTask.startAt,
          endAt: parentTask.endAt,
          estimatedTime: 30,
          id: idCount + 1,
          createdAt: "",
          isCompleted: false,
          completedAt: null,
          isGhost: false,
          seriesId: idCount + 1,
        },
      ]);
    setIdCount((prev) => prev + 1);
  };

  const handleClear = () => setStagedTasks([]);

  async function handleConfirmAll() {
    if (stagedTasks.length === 0) return;
    setIsSubmitting(true);
    try {
      await createAllTasks(stagedTasks);
      trackEvent("ai_task_breakdown_applied", {
        subtask_count: stagedTasks.length,
      });
      trackEvent("task_created", {
        source: "breakdown",
        count: stagedTasks.length,
      });
      navigate(-1);
    } catch (err) {
      console.error("Bulk creation failed", err);

      if (axios.isAxiosError(err) && err.response?.data.errors) {
        const allErrors = err.response?.data.errors as Partial<TaskError>[];
        const taskErrorMessages = allErrors
          .map((err, i) => `Task ${i + 1}: ${Object.values(err).join(", ")}`)
          .filter((m) => !m.endsWith(": "))
          .join("\n");
        setBulkAddErrors(taskErrorMessages);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasStaged = stagedTasks.length > 0;

  if (loadingParent) return <LoadingState />;

  if (isGetParentError)
    return <ErrorState error="Sorry, this task doesn't exist..." />;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 min-h-full card">
        <header>
          <h1 className="text-3xl font-bold text-text-main transition-colors">
            Breakdown task
          </h1>
          <p className="text-text-sub">
            Turn one large goal into manageable steps.
          </p>
        </header>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-sub">
          Source Task
        </h2>
        <div className="opacity-80 pointer-events-none grayscale-[0.2]">
          {parentTask && (
            <TaskCard
              {...parentTask}
              showSetIsComplete={false}
              showDelete={false}
              showEdit={false}
              showPomodoro={false}
              showDecompose={false}
              showSkip={false}
              fullDescription
            />
          )}
        </div>
      </section>

      <section className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-surface">
        {!hasStaged ? (
          <div className="text-center space-y-4 flex flex-col items-center">
            <div className="p-4 bg-brand/10 rounded-full">
              <Sparkles className="text-brand" size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Break this task down</h3>
              <p className="text-text-sub text-sm">
                Let AI identify smaller, actionable steps.
              </p>
            </div>
            <button
              aria-label="Break down tasks into subtasks"
              onClick={handleDecompose}
              disabled={isDecomposing}
              className="btn-primary flex items-center gap-2"
            >
              {isDecomposing ? (
                <>
                  <Loader2 className="animate-spin" /> Analysing...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate Sub-tasks
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full flex justify-between items-center">
            <p className="text-text-sub italic text-sm">
              AI suggests these {stagedTasks.length} steps:
            </p>
            <button
              aria-label="Regenerate sub tasks"
              onClick={handleDecompose}
              className="text-brand text-sm font-semibold hover:underline flex items-center gap-1"
            >
              <Sparkles size={14} /> Regenerate
            </button>
          </div>
        )}

        {decomposeError && (
          <div className="w-full mt-4 text-failure bg-failure/10 p-2 pl-4 rounded-md border-l-4 border-failure text-sm">
            {decomposeError}
          </div>
        )}
      </section>

      {bulkAddErrors && (
        <div className="whitespace-pre-wrap w-full text-failure bg-failure/10 p-3 rounded-md border-l-failure border-l-4 text-sm mt-2">
          <p className="font-bold mb-1">Upload Failed:</p>
          {bulkAddErrors}
        </div>
      )}
      {parentTask && stagedTasks.length > 0 && (
        <TaskList
          stagedTasks={stagedTasks}
          setStagedTasks={setStagedTasks}
          handleDeleteStaged={handleDeleteStaged}
        />
      )}
      <AddTaskFooter
        handleAdd={handleAdd}
        handleClear={handleClear}
        handleConfirmAll={handleConfirmAll}
        isSubmitting={isSubmitting}
        length={stagedTasks.length}
      />
      {popupMode === PopupModes.Edit && selectedTask && (
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
      )}
    </div>
  );
}

interface TaskListProps {
  stagedTasks: Task[];
  setStagedTasks: (tasks: Task[]) => void;
  handleDeleteStaged: (id: number) => void;
}

function TaskList({
  stagedTasks,
  setStagedTasks,
  handleDeleteStaged,
}: TaskListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stagedTasks.map((task, i) => (
        <div
          className="relative"
          key={task.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("task", i.toString());
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const j = Number(e.dataTransfer.getData("task"));
            const tasks = [...stagedTasks];

            const temp = tasks[i];
            tasks[i] = tasks[j];
            tasks[j] = temp;
            setStagedTasks(tasks);
          }}
        >
          <TaskCard
            {...task}
            titleIcon={<Move width={20} height={20} />}
            showSetIsComplete={false}
            showPomodoro={false}
            showDecompose={false}
            showSkip={false}
            onDelete={(task) => handleDeleteStaged(task.id)}
          />
        </div>
      ))}
    </div>
  );
}
interface AddTaskFooterProps {
  handleAdd: () => void;
  handleClear: () => void;
  handleConfirmAll: () => void;
  isSubmitting: boolean;
  length: number;
}
function AddTaskFooter({
  handleAdd,
  handleClear,
  handleConfirmAll,
  isSubmitting,
  length,
}: AddTaskFooterProps) {
  const isDisabled = isSubmitting || length === 0;
  return (
    <footer className="sticky bottom-6 flex justify-end gap-4 bg-surface/80 backdrop-blur-md p-4 rounded-xl border shadow-lg">
      <button
        aria-label="Add new task"
        className={`${isSubmitting ? "btn-secondary-disabled" : "btn-secondary"} flex items-center gap-2`}
        onClick={handleAdd}
        disabled={isSubmitting}
      >
        <Plus size={18} /> Add task
      </button>
      <button
        aria-label="Clear all tasks"
        onClick={handleClear}
        className={isDisabled ? "btn-secondary-disabled" : "btn-secondary"}
        disabled={isSubmitting}
      >
        Clear All
      </button>
      <button
        aria-label="Save all tasks"
        onClick={handleConfirmAll}
        className={`btn-primary flex items-center gap-2 ${isDisabled ? "btn-primary-disabled" : ""}`}
        disabled={isDisabled}
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Plus size={18} />
        )}
        Save {length} Tasks
      </button>
    </footer>
  );
}
