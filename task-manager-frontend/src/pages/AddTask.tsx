import { useState } from "react";
import type { CreateTaskInput } from "../features/tasks/types";
import { taskService } from "../services/api";
import { useNavigate } from "react-router-dom";
import axios from "axios";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string }

export default function AddTask() {
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

  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>){
    const { name, value } = e.target;
    setFormState(prev => ({...prev, [name]: value}))
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault()
    try {
      setIsloading(true)
      await taskService.create({...formState, estimatedTime: Number(formState.estimatedTime)})
      navigate("/")
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
    { name: "General", value: "General" }, 
    { name: "House", value: "House" }, 
    { name: "Work", value: "Work" }, 
    { name: "Personal", value: "Personal" }, 
    { name: "Chores", value: "Chores" }, 
  ]

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <header>
        <h1 className="text-3xl font-bold text-text-main transition-colors">Add Task</h1>
        <p className="text-text-sub">Set new goals.</p>
        <form 
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 bg-surface p-4 mt-4 rounded-xl"
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
          <button 
            className={`text-text-inverse p-3 rounded-md ${isLoading ? "bg-surface-muted": "bg-brand"}`}
            disabled={isLoading}
          >
              {isLoading ? "Adding Task..." : "Add Task"}
          </button>

        </form>
      </header>
    </section>
  )
}

interface FormInputprops {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errorMessage: string;
  options?: {name: string; value: string}[]
}

function FormInput({ label, name, type="text", value, handleChange, errorMessage, options}: FormInputprops){

  return (
    <div className="flex flex-col text-text-main">
      <label htmlFor={name}>{label}</label>
      {!options && ( 
        <input
          className="rounded-md px-3 py-2 my-2 outline-accent bg-surface-muted"
          name={name}
          type={type}
          value={value} 
          onChange={handleChange}
        />
      )}
      {options && (
        <select 
          className="rounded-md px-3 py-2 my-2 outline-accent bg-surface-muted"
          name={name}
          value={value}
          onChange={(e) => handleChange(e)}
          >
          {options.map(({name, value}) => <option key={name} value={value}>{name}</option>)}
        </select>
      )}
      {errorMessage && (
        <p 
          className="text-failure bg-failure/10 p-1 pl-4 rounded-sm border-l-failure border-l-4"
        >
          {errorMessage}
        </p>
        )}
    </div>
  )
}