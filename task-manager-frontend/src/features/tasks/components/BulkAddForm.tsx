import Papa from "papaparse";
import { useRef, useState, type ChangeEvent } from "react";
import { validateTaskList } from "../schemas";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import useCreateAllTasks from "../hooks/useCreateAllTasks";
import { trackEvent } from "../../../services/analytics";
import { parseTaskRows } from "../csvImport";
import { downloadTemplate } from "../csvTemplates";
import useProjects from "../../projects/hooks/useProjects";
import { resolveProjectIds } from "../../projects/importProjects";
import { useQueryClient } from "@tanstack/react-query";

export default function BulkAddForm() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: createAllTasks } = useCreateAllTasks();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = () => fileInputRef.current?.click();

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
        const newTasks = parseTaskRows(result.data as Record<string, string>[]);

        const allErrors = validateTaskList(newTasks);
        const hasErrors = allErrors.some((err) => Object.keys(err).length > 0);

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
          const projectIds = await resolveProjectIds(
            newTasks.map((task) => task.projectName),
            projects,
          );
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          await createAllTasks(
            newTasks.map(({ projectName, ...task }) => ({
              ...task,
              projectId: projectIds.get(projectName) ?? null,
            })),
          );
          trackEvent("tasks_imported_csv", { row_count: newTasks.length });
          trackEvent("task_created", { source: "csv", count: newTasks.length });
          navigate(-1);
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
          aria-label="Upload CSV"
          className="btn-primary"
          onClick={triggerUpload}
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Upload CSV"}
        </button>
        <button
          aria-label="Download simple template"
          type="button"
          onClick={() => downloadTemplate("simple")}
          className="text-sm cursor-pointer text-accent underline underline-offset-4 hover:text-accent/80"
        >
          Download Simple Template
        </button>
        <p>or</p>
        <div className="flex flex-col items-baseline lg:flex-row lg:gap-2 flex-wrap">
          <p>if you&apos;re exporting from another app</p>
          <button
            aria-label="Download Advanced template"
            type="button"
            onClick={() => downloadTemplate("advanced")}
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
