import type { CreateTaskInput } from "../features/tasks/types";
import { taskService } from "../services/api";
import { useNavigate } from "react-router-dom";
import TaskForm from "../features/tasks/components/TaskForm";
import useInvalidateTaskKeys from "../hooks/useInvalidateTaskKeys";


export default function AddTask() {
  const navigate = useNavigate();
  const invalidateTaskKeys = useInvalidateTaskKeys()
  async function handleCreate(newTask: CreateTaskInput) {
    await taskService.create(newTask);
    invalidateTaskKeys()
    navigate("/")
  }

  return (
    <section className="flex flex-col gap-6 min-h-full card">
      <header>
        <h1 className="text-3xl font-bold text-text-main transition-colors">Add Task</h1>
        <p className="text-text-sub">Set new goals.</p>
      </header>
        <TaskForm submitAction={handleCreate}/>
    </section>
  )}