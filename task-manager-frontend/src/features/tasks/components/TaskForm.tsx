import { useEffect, useState } from "react";
import { categories, type CreateTaskInput } from "../../../features/tasks/types";
import FormInput from "../../../components/ui/FormInput";
import axios from "axios";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string }

interface TaskFormProps {
  confirmButtonText?: string;
  submitAction: (task: CreateTaskInput) => Promise<void>;
  close?: () => void;
  initialData?: CreateTaskInput;

}
export default function TaskForm({ 
  submitAction, 
  close, 
  confirmButtonText = "Add Task",
  initialData 
  } : TaskFormProps ) {
  const [formState, setFormState] = useState<CreateTaskInput>({
    title: "",
    category: "",
    description: "",
    dueDate: "",
    estimatedTime: 0
  })

  const [errorMessages, setErrorMessages] = useState<ErrorMesageType>({
    title: "",
    category: "",
    description: "",
    dueDate: "",
    estimatedTime: ""
  })

  const defaultErrorMessages = {
    title: "",
    category: "",
    description: "",
    dueDate: "",
    estimatedTime: ""
  }

  const [isLoading, setIsloading] = useState(false);

  useEffect(() => {
    if (initialData) setFormState(({...initialData, dueDate: new Date(initialData.dueDate).toISOString().substring(0, 10)}))
  }, [initialData])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>){
    const { name, value } = e.target;
    setFormState(prev => ({...prev, [name]: value}))
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault()
    try {
      setIsloading(true)
      await submitAction({...formState, estimatedTime: Number(formState.estimatedTime)})
    } catch (err) {
      console.log(err)
      if (!axios.isAxiosError(err)){
          return
      }

      if (err.status === 400){
        const errors: Partial<ErrorMesageType> = err.response?.data?.errors;
        setErrorMessages(({ ...defaultErrorMessages, ...errors}))
      }
    } finally {
      setIsloading(false)
    }
  }

  const options = [
    { name: "None", value: "" }, 
    ...categories
  ]

  return (
    <form 
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <FormInput 
        label="Title" 
        name="title" 
        value={formState.title} 
        handleChange={handleChange}
        errorMessage={errorMessages.title}
      />
      <FormInput 
        label="Category" 
        name="category" 
        value={formState.category} 
        handleChange={handleChange}
        errorMessage={errorMessages.category}
        options={options}
      />
      <FormInput 
        label="Description" 
        name="description" 
        value={formState.description} 
        handleChange={handleChange}
        errorMessage={errorMessages.description}
      />
      <FormInput 
        label="Due Date" 
        name="dueDate" 
        type="date"
        value={formState.dueDate} 
        handleChange={handleChange}
        errorMessage={errorMessages.dueDate}
      />
      <FormInput 
        label="Estimated Time" 
        name="estimatedTime" 
        type="number"
        value={formState.estimatedTime} 
        handleChange={handleChange}
        errorMessage={errorMessages.estimatedTime}
      />
      <footer className='p-4 flex gap-4 justify-end'>
      {close && (
        <button 
          className="px-4 py-2 rounded-lg font-medium hover:bg-surface-muted transition-colors " 
          type="button"
          onClick={close}
        >
            Cancel
        </button>
      )}
        <button 
          className={`text-text-inverse p-3 rounded-md ${isLoading ? "bg-surface-muted": "bg-brand"}`}
          disabled={isLoading}
        >
            {confirmButtonText}
        </button>
      </footer>

    </form>
  )}