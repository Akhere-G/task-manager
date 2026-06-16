import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { CreateTaskInput } from "../features/tasks/types";
import TaskForm from "../features/tasks/components/TaskForm";
import { AiAddTaskForm } from "../features/ai/components";
import { BulkAddForm } from "../features/tasks/components";
import useInvalidateTaskKeys from "../hooks/useInvalidateTaskKeys";
import { format, setHours } from "date-fns";
import useCreateTask from "../features/tasks/hooks/useCreateTask";

export default function AddTask() {
  const navigate = useNavigate();
  const invalidateTaskKeys = useInvalidateTaskKeys();
  const [aiSuggestion, setAiSuggestion] = useState<CreateTaskInput>();
  const { mutateAsync: createTask } = useCreateTask();

  async function handleCreate(newTask: CreateTaskInput) {
    const formattedTask = {
      ...newTask,
      startAt: format(newTask.startAt, "yyyy-MM-dd HH:mm"),
      endAt: format(newTask.endAt, "yyyy-MM-dd HH:mm"),
    };
    await createTask(formattedTask);
    invalidateTaskKeys();
    navigate(-1);
  }

  const { state } = useLocation();

  let startAt;
  let endAt;
  if (state?.currentDate) {
    startAt = new Date(state?.currentDate);
    startAt = setHours(startAt, new Date().getHours() + 1);
  } else if (state?.startAt) {
    startAt = new Date(state?.startAt);
  } else {
    startAt = null;
  }

  if (state?.endAt) {
    endAt = new Date(state?.endAt);
  } else {
    endAt = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4">
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
          initialData={{
            ...aiSuggestion,
            startAt: startAt
              ? format(startAt, "yyyy-MM-dd'T'HH:mm")
              : undefined,
            endAt: endAt ? format(endAt, "yyyy-MM-dd'T'HH:mm") : undefined,
          }}
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
