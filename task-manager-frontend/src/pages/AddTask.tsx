import type { CreateTaskInput } from "../features/tasks/types";
import { taskService } from "../services/api";
import { useNavigate } from "react-router-dom";
import TaskForm from "../features/tasks/components/TaskForm";
import useInvalidateTaskKeys from "../hooks/useInvalidateTaskKeys";
import { BulkAddForm } from "../features/tasks/components";

export default function AddTask() {
  const navigate = useNavigate();
  const invalidateTaskKeys = useInvalidateTaskKeys();
  async function handleCreate(newTask: CreateTaskInput) {
    await taskService.create(newTask);
    invalidateTaskKeys();
    navigate("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-6 min-h-full card">
        <header>
          <h1 className="text-3xl font-bold text-text-main transition-colors">
            Add Task
          </h1>
          <p className="text-text-sub">Set new goals.</p>
        </header>
        <TaskForm submitAction={handleCreate} />
      </section>
      <section className="card flex flex-col items-start gap-4">
        <header>
          <h1 className="text-3xl font-bold tex-text-main">Bulk Add</h1>
          <p className="text-text-sub">
            Upload a CVS file to create multiple tasks at once
          </p>
        </header>
        <BulkAddForm />
      </section>
    </div>
  );
}
