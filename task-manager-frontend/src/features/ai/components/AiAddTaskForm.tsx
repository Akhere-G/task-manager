import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { aiService } from "../../../services/api";
import type { CreateTaskInput } from "../../../features/tasks/types";
import { format } from "date-fns";

interface AiAddTaskFormProps {
  onParsed: (data: CreateTaskInput) => void;
}

export default function AiAddTaskForm({ onParsed }: AiAddTaskFormProps) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleAiSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const parsedTask = await aiService.parseTask(input);
      parsedTask.startAt = format(parsedTask.startAt, "yyyy-MM-dd HH:mm");
      parsedTask.endAt = format(parsedTask.endAt, "yyyy-MM-dd HH:mm");
      onParsed(parsedTask);
      setInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <form onSubmit={handleAiSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Fix the leaking tap in the kitchen tomorrow morning"
          className="w-full p-4 pr-12 rounded-xl border border-slate-300 focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all placeholder:text-text-sub/50"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand text-white rounded-lg hover:bg-brand/50 disabled:hover:bg-brand disabled:opacity-50 "
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Sparkles size={20} />
          )}
        </button>
      </div>
    </form>
  );
}
