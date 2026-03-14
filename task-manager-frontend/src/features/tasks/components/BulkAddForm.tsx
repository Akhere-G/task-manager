import Papa from "papaparse";
import { useRef, useState, type ChangeEvent } from "react";
import { validateTaskList } from "../../../utils/validators";
import { taskService } from "../../../services/api";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import useInvalidateTaskKeys from "../../../hooks/useInvalidateTaskKeys";

function getDescription(task: Record<string, string>) {
  const rawDescription = task.Description || task.description;
  return rawDescription ? rawDescription.trim() : null;
}
export default function BulkAddForm() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const navigate = useNavigate();

  const invalidateTaskKeys = useInvalidateTaskKeys();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = () => fileInputRef.current?.click();

  const downloadTemplate = (withIsCompleted: boolean = false) => {
    const headers = ["Title", "Category", "Description", "Start At", "End At"];
    const sampleData = [
      "Prepare Report",
      "work",
      "Weekly sync prep",
      "2026-03-01 10:00",
      "2026-03-01 14:00",
    ];

    if (withIsCompleted) {
      headers.push("is_completed, completed_at");
      sampleData.push("true", "2025-07-12 16:30:00");
    }

    const csvContent = [headers, sampleData].map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tasks_template.csv");
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setErrorMessage("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rawTasks = result.data as Record<string, string>[];

        const trueValues = ["1", "true", "True", "TRUE", 1, true];

        const newTasks = rawTasks
          .map((task) => ({
            title: (task.Title || task.title || "").trim(),
            category: (task.Category || task.category || "general")
              .trim()
              .toLowerCase(),
            description: getDescription(task),
            startAt:
              task["Start At"] ||
              task["Start at"] ||
              task["start at"] ||
              task.startAt ||
              task.start_at ||
              "",
            endAt:
              task["End At"] ||
              task["End at"] ||
              task["end at"] ||
              task.endAt ||
              task.end_at ||
              "",
            isCompleted: [
              task["Is Completed"],
              task["Is completed"],
              task["is completed"],
              task.isCompleted,
              task.is_completed,
            ].some((t) => trueValues.includes(t)),
            completedAt:
              task["Completed At"] ||
              task["Completed at"] ||
              task["completed at"] ||
              task.completedAt ||
              task.completed_at ||
              null,
            repeatBy:
              task["Repeat By"] ||
              task["Repeat by"] ||
              task["repeat by"] ||
              task.repeatBy ||
              task.repeat_by ||
              null,
            repeatUntil:
              task["Repeat Until"] ||
              task["Repeat until"] ||
              task["repeat until"] ||
              task.repeatUntil ||
              task.repeat_until ||
              null,
          }))
          .map((task) => ({
            ...task,
            isRepeating: !!task.repeatBy,
          }));

        const { hasErrors, allErrors } = validateTaskList(newTasks);

        if (hasErrors) {
          const taskErrorMessages = allErrors
            .map((err, i) => `Row ${i + 2}: ${Object.values(err).join(" ")}`)
            .filter((m) => !m.endsWith(": "))
            .join("\n");

          setErrorMessage(taskErrorMessages);
          setIsUploading(false);
          return;
        }

        try {
          await taskService.createAll(newTasks);
          invalidateTaskKeys();
          navigate("/");
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            setErrorMessage(
              err.response?.data?.message || "Server rejected the bulk upload.",
            );
          } else {
            setErrorMessage("An unexpected error occurred.");
          }
        } finally {
          setIsUploading(false);
        }
      },
    });
    e.target.value = "";
  };

  return (
    <>
      <div className="flex gap-4 items-start md:items-baseline flex-col md:flex-row">
        <input
          onChange={handleChange}
          className="hidden"
          type="file"
          accept=".csv"
          ref={fileInputRef}
        />
        <button
          className="btn-primary"
          onClick={triggerUpload}
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Upload CSV"}
        </button>
        <button
          type="button"
          onClick={() => downloadTemplate()}
          className="text-sm cursor-pointer text-accent underline underline-offset-4 hover:text-accent/80"
        >
          Download Simple Template
        </button>
        <p>or</p>
        <div className="flex flex-col items-baseline lg:flex-row lg:gap-2 flex-wrap">
          <p>if you&apos;re exporting from another app</p>
          <button
            type="button"
            onClick={() => downloadTemplate(true)}
            className="text-sm cursor-pointer text-accent underline underline-offset-4 hover:text-accent/80"
          >
            download Advanced Template
          </button>
        </div>
      </div>
      {errorMessage && (
        <div className="whitespace-pre-wrap w-full text-failure bg-failure/10 p-3 rounded-md border-l-failure border-l-4 text-sm mt-2">
          <p className="font-bold mb-1">Upload Failed:</p>
          {errorMessage}
        </div>
      )}
    </>
  );
}
