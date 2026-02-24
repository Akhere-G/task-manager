import Papa from "papaparse"
import { useRef, useState, type ChangeEvent } from "react";
import { validateTaskList } from "../../../utils/validators";
import { taskService } from "../../../services/api";
import axios from "axios";

export default function BulkAddForm() {
  const [errorMessage, setErrorMessage] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const triggerUpload = () => ref.current?.click()

  const downloadTemplate = () => {
    const headers = ["Title", "Category", "Description", "Due Date", "Estimated Time"];
    const sampleData = ["Prepare Report", "work", "Weekly sync prep", "2026-03-01", "60"];
    const csvContent = [headers, sampleData].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tasks_template.csv");
    link.click();
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0];
    
    Papa.parse(file, { 
      header: true, 
      skipEmptyLines: true,
      complete: function(result){
        setIsUploading(true)
        const rawTasks  = result.data as Record<string, string>[];

        const newTasks = rawTasks.map(task => ({
          title: task.Title || task.title || "",
          category: task.Category|| task.category || "",
          description: task.Description || task.description || "",
          dueDate: task["Due Date"] || task["Due date"] || task.dueDate || task.due_date || "",
          estimatedTime: Number(task["Estimated Time"] || task["Estimated time"] || task.estimatedTime || task.estimated_time || ""),
        }))

        const { hasErrors, allErrors } = validateTaskList(newTasks)

        if (hasErrors){
          const taskErrorMessages = allErrors
            .map((err, i) => `Task #${i + 1}: ${Object.values(err).join(" ")}`)
            .join("\n")

          setErrorMessage(taskErrorMessages)
          setIsUploading(false)
          return;
        }
        setErrorMessage("")
        console.log(newTasks)

        taskService.createAll(newTasks)
        .then()
        .catch((err: unknown) => {
          if (!axios.isAxiosError(err)) return

          if (err.status === 400) return 

          setErrorMessage("Could not bulk add")
        }).finally(() => setIsUploading(false))


    }})
    e.target.value = ""
  }

  return (
    <>
    <div className="flex gap-4 items-baseline">
      <input
        onChange={handleChange}
        className="hidden" 
        type="file" 
        ref={ref} 
      />
      
      <button 
        className="btn-primary" 
        onClick={triggerUpload}
        disabled={isUploading}
      >
        { isUploading ? "Uploading..." : "Upload File" }
      </button>
      <p className="p-2">Download template 
        <span className="p-2 text-accent cursor-pointer underline" onClick={downloadTemplate}>here</span>
      </p>
      </div>
      {errorMessage && (
        <p 
          className="whitespace-pre-wrap w-full text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
        >
          {errorMessage}
        </p>
      )}  
    </>

  )
}
