import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { taskService } from "../services/api";
import type { CreateTaskInput } from "../features/tasks/types";
import TaskForm from "../features/tasks/components/TaskForm";
import { AiAddTaskForm } from "../features/ai/components";
import { BulkAddForm } from "../features/tasks/components";
import useInvalidateTaskKeys from "../hooks/useInvalidateTaskKeys";
import { format } from "date-fns";

export default function AddTask() {
  const navigate = useNavigate();
  const invalidateTaskKeys = useInvalidateTaskKeys();
  const [aiSuggestion, setAiSuggestion] = useState<CreateTaskInput>();

  async function handleCreate(newTask: CreateTaskInput) {
    const formattedTask = {
      ...newTask,
      startAt: format(newTask.startAt, "yyyy-MM-dd HH:mm"),
      endAt: format(newTask.endAt, "yyyy-MM-dd HH:mm"),
    };
    await taskService.create(formattedTask);
    invalidateTaskKeys();
    navigate("/");
  }

  const { state } = useLocation();

  const startAt = state?.currentDate ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col  gap-4 border-2">
        <header>
          <h1 className="text-3xl font-bold text-text-main flex items-center gap-2">
            <Sparkles className="text-brand" size={28} /> Magic Populate
          </h1>
          <p className="text-text-sub">
            Describe your task and we&apos;ll fill out the form for you.
          </p>
        </header>
        <AiAddTaskForm onParsed={setAiSuggestion} />
      </section>

      <section className="flex flex-col gap-6 min-h-full card">
        <header>
          <h1 className="text-3xl font-bold text-text-main transition-colors">
            {aiSuggestion ? "Review AI Task" : "Add Task"}
          </h1>
          <p className="text-text-sub">
            {aiSuggestion
              ? "Adjust the suggestions below."
              : "Set new goals manually."}
          </p>
        </header>
        <TaskForm
          key={aiSuggestion ? JSON.stringify(aiSuggestion) : "manual"}
          submitAction={handleCreate}
          initialData={startAt ? { ...aiSuggestion, startAt } : aiSuggestion}
        />
      </section>

      <section className="card flex flex-col items-start gap-4">
        <header>
          <h1 className="text-3xl font-bold text-text-main">Bulk Add</h1>
          <p className="text-text-sub">
            Upload a CSV file to create multiple tasks at once.
          </p>
        </header>
        <BulkAddForm />
      </section>
    </div>
  );
}
