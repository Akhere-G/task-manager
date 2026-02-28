import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sparkles, Plus, Loader2, Move } from "lucide-react";
import { aiService, taskService } from "../services/api";
import useInvalidateTaskKeys from "../hooks/useInvalidateTaskKeys";
import TaskCard from "../features/tasks/components/TaskCard";
import type { CreateTaskInput } from "../features/tasks/types";
import useGetTask from "../features/tasks/hooks/useGetTask";
import axios from "axios";
import type { TaskError } from "../utils/validators";
import { ErrorState, LoadingState, Popup } from "../components/ui";
import { TaskForm } from "../features/tasks/components";
import { useTaskContext } from "../context/TaskContext";

export default function DecomposeTask() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const invalidateTaskKeys = useInvalidateTaskKeys();

  const {
    data: parentTask,
    isLoading: loadingParent,
    isError: isGetParentError,
  } = useGetTask(Number(taskId));

  const [stagedTasks, setStagedTasks] = useState<CreateTaskInput[]>([]);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAddErrors, setBulkAddErrors] = useState("");
  const [decomposeError, setDecomposeErrors] = useState("");

  const { selectedEditTask, closeEditPopup } = useTaskContext();

  async function handleDecompose() {
    if (!parentTask) return;
    setIsDecomposing(true);
    try {
      const { tasks } = await aiService.decomposeTask(parentTask);
      setStagedTasks(tasks);
      setDecomposeErrors("");
    } catch (err) {
      console.error("Failed to decompose task", err);

      if (axios.isAxiosError(err)) {
        setDecomposeErrors("Something went wrong. Please try again.");
      }
    } finally {
      setIsDecomposing(false);
    }
  }

  const handleDeleteStaged = (index: number) => {
    setStagedTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = async (updatedTask: CreateTaskInput) => {
    const id = selectedEditTask?.id;
    const updated = stagedTasks.map((task, i) =>
      i === id ? updatedTask : task,
    );
    setStagedTasks(updated);
    closeEditPopup();
  };

  async function handleConfirmAll() {
    setIsSubmitting(true);
    try {
      await taskService.createAll(stagedTasks);
      invalidateTaskKeys();
      navigate("/");
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
    <div className="max-w-5xl mx-auto p-6 space-y-8">
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
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stagedTasks.map((task, index) => (
              <div
                className="relative"
                key={task.title}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("task", index.toString());
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = Number(e.dataTransfer.getData("task"));
                  const tasks = [...stagedTasks];

                  const temp = tasks[index];
                  tasks[index] = tasks[id];
                  tasks[id] = temp;
                  setStagedTasks(tasks);
                }}
              >
                <TaskCard
                  {...task}
                  titleIcon={<Move width={20} height={20} />}
                  id={index}
                  showSetIsComplete={false}
                  showPomodoro={false}
                  showDecompose={false}
                  onDelete={(task) => handleDeleteStaged(task.id)}
                  isCompleted={false}
                  createdAt=""
                  completedAt={null}
                />
              </div>
            ))}
          </div>

          <footer className="sticky bottom-6 flex justify-end gap-4 bg-surface/80 backdrop-blur-md p-4 rounded-xl border shadow-lg">
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() =>
                setStagedTasks((prev) => [
                  ...prev,
                  {
                    title: `Task #${prev.length + 1}`,
                    category: parentTask.category,
                    description: "",
                    dueDate: parentTask.dueDate,
                    estimatedTime: 30,
                  },
                ])
              }
            >
              <Plus size={18} /> Add new Task
            </button>
            <button
              onClick={() => setStagedTasks([])}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Clear All
            </button>
            <button
              onClick={handleConfirmAll}
              className="btn-primary flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              Confirm and Add {stagedTasks.length} Tasks
            </button>
          </footer>
        </section>
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
    </div>
  );
}
