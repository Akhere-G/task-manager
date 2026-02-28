import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft, Plus, Loader2 } from "lucide-react";
import { aiService, taskService } from "../services/api";
import useInvalidateTaskKeys from "../hooks/useInvalidateTaskKeys";
import TaskCard from "../features/tasks/components/TaskCard";
import type { CreateTaskInput } from "../features/tasks/types";
import useGetTask from "../features/tasks/hooks/useGetTask";
import axios from "axios";
import type { TaskError } from "../utils/validators";

export default function DecomposeTask() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const invalidateTaskKeys = useInvalidateTaskKeys();

  const { data: parentTask, isLoading: loadingParent } = useGetTask(
    Number(taskId),
  );

  const [stagedTasks, setStagedTasks] = useState<CreateTaskInput[]>([]);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkAddErrors, setBulkAddErrors] = useState("");
  const [decomposeError, setDecomposeErrors] = useState("");

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
        setDecomposeErrors("Sorry... Somehting went wrong! Try again?");
      }
    } finally {
      setIsDecomposing(false);
    }
  }

  const handleDeleteStaged = (index: number) => {
    setStagedTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditStaged = (index: number) => {
    const newTitle = prompt("Enter new title:", stagedTasks[index].title);
    if (newTitle) {
      const updated = [...stagedTasks];
      updated[index] = { ...updated[index], title: newTitle };
      setStagedTasks(updated);
    }
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

  if (loadingParent)
    return (
      <div className="p-10 text-center text-text-sub">
        Loading task context...
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-text-sub hover:text-brand transition-colors"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <h1 className="text-3xl font-bold text-text-main">
          Task Decomposition
        </h1>
        <div className="w-20" />
      </header>

      {/* 1. Original Task Context */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-sub">
          Source Task
        </h2>
        <div className="pointer-events-none">
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

      {/* 2. Decompose Trigger */}
      <section className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-surface">
        {stagedTasks.length === 0 ? (
          <div className="text-center space-y-4 flex flex-col items-center">
            <div className="p-4 bg-brand/10 rounded-full">
              <Sparkles className="text-brand" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Break this task down</h3>
              <p className="text-text-sub">
                Let AI identify smaller, actionable steps.
              </p>
            </div>
            <button
              onClick={handleDecompose}
              disabled={isDecomposing}
              className="btn-primary flex items-center gap-2"
            >
              {isDecomposing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {isDecomposing ? "Analysing..." : "Generate Sub-tasks"}
            </button>
            {decomposeError && (
              <p className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
                {decomposeError}
              </p>
            )}
          </div>
        ) : (
          <div className="w-full flex justify-between items-center">
            <p className="text-text-sub italic">
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
      </section>

      {/* 3 & 4. List and Editing */}
      {bulkAddErrors && (
        <div className="whitespace-pre-wrap w-full text-failure bg-failure/10 p-3 rounded-md border-l-failure border-l-4 text-sm mt-2">
          <p className="font-bold mb-1">Upload Failed:</p>
          {bulkAddErrors}
        </div>
      )}
      {stagedTasks.length > 0 && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stagedTasks.map((task, index) => (
              <div key={index} className="relative group">
                <TaskCard
                  {...{ ...task, id: index }}
                  showSetIsComplete={false}
                  showPomodoro={false}
                  showDecompose={false}
                  isCompleted={false}
                  onDelete={(task) => handleDeleteStaged(task.id)}
                  onEdit={(task) => handleEditStaged(task.id)}
                  createdAt=""
                  completedAt={null}
                />
              </div>
            ))}
          </div>

          <footer className="sticky bottom-6 flex justify-end gap-4 bg-surface/80 backdrop-blur-md p-4 rounded-xl border shadow-lg">
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
    </div>
  );
}
