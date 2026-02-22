import { useEffect, useState } from "react";
import { categories, type CreateTaskInput } from "../../../features/tasks/types";
import FormInput from "../../../components/ui/FormInput";
import axios from "axios";
import { formatDate } from "../utils";
import { validateTask, type TaskData } from "../../../utils/validators";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string;  } & { general: string}

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
    estimatedTime: "",
    general: ""
  })

  const [touched, setTouched] = useState({
    title: false,
    category: false,
    description: false,
    dueDate: false,
    estimatedTime: false,
  }) 

  const defaultErrorMessages = {
    title: "",
    category: "",
    description: "",
    dueDate: "",
    estimatedTime: "",
    general: ""
  }

  const [isLoading, setIsloading] = useState(false);

  useEffect(() => {
    if (initialData) setFormState(({...initialData, dueDate: formatDate(initialData.dueDate)}))
  }, [initialData])

  const validateForm = (data: TaskData) => {
        setErrorMessages({...defaultErrorMessages, ...validateTask(data, !!initialData) })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>){
    const { name, value } = e.target;
    const newFormState = ({...formState, [name]: value})
    setFormState(newFormState)
    validateForm(newFormState)
  }

  function handleBlur(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>){
    const { name } = e.target;
    setTouched(prev => ({...prev, [name]: true}))
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault()
    setTouched({
      title: true,
      category: true,
      description: true,
      dueDate: true,
      estimatedTime: true,
    })

    if (Object.entries(errorMessages).some(([k, v]) => v !== "" && k !== "general")) return 

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
      } else {
        setErrorMessages({...errorMessages, general: "Could not send data"})
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
      {errorMessages.general && (
        <p 
          className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
        >
          {errorMessages.general}
        </p>
        )}
      <FormInput 
        label="Title" 
        name="title" 
        value={formState.title} 
        handleChange={handleChange}
        errorMessage={errorMessages.title}
        touched={touched.title}
        handleBlur={handleBlur}
      />
      <FormInput 
        label="Category" 
        name="category" 
        value={formState.category} 
        handleChange={handleChange}
        errorMessage={errorMessages.category}
        options={options}
        touched={touched.category}
        handleBlur={handleBlur}
      />
      <FormInput 
        label="Description" 
        name="description" 
        value={formState.description} 
        handleChange={handleChange}
        errorMessage={errorMessages.description}
        touched={touched.description}
        handleBlur={handleBlur}
        textarea
      />
      <FormInput 
        label="Due Date" 
        name="dueDate" 
        type="date"
        value={formState.dueDate} 
        handleChange={handleChange}
        errorMessage={errorMessages.dueDate}
        touched={touched.dueDate}
        handleBlur={handleBlur}
      />
      <FormInput 
        label="Estimated Time" 
        name="estimatedTime" 
        type="number"
        value={formState.estimatedTime} 
        handleChange={handleChange}
        errorMessage={errorMessages.estimatedTime}
        touched={touched.estimatedTime}
        handleBlur={handleBlur}
      />
      <footer className='flex gap-4 justify-end'>
      {close && (
        <button 
          className={isLoading ? "btn-secondary-disabled": "btn-secondary"}
          type="button"
          onClick={close}
          disabled={isLoading}
        >
            Cancel
        </button>
      )}
        <button 
          className={isLoading ? "btn-primary-disabled": "btn-primary"}
          disabled={isLoading}
        >
            {confirmButtonText}
        </button>
      </footer>

    </form>
  )}