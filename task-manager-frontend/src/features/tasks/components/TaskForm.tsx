import { useEffect, useState } from "react";
import {
  categories,
  type CreateTaskInput,
} from "../../../features/tasks/types";
import FormInput from "../../../components/ui/FormInput";
import axios from "axios";
import { validateTask, type TaskData } from "../../../utils/validators";
import { format, set } from "date-fns";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string } & {
  general: string;
};

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
  initialData,
}: TaskFormProps) {
  const [formState, setFormState] = useState<CreateTaskInput>({
    title: "",
    category: "",
    description: "",
    startAt: format(
      set(new Date(), {
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      }),
      "yyyy-MM-dd HH:mm",
    ),
    endAt: format(
      set(new Date(), {
        hours: 23,
        minutes: 59,
        seconds: 0,
        milliseconds: 0,
      }),
      "yyyy-MM-dd HH:mm",
    ),
  });

  const [errorMessages, setErrorMessages] = useState<ErrorMesageType>({
    title: "",
    category: "",
    description: "",
    startAt: "",
    endAt: "",
    general: "",
  });

  const [touched, setTouched] = useState({
    title: false,
    category: false,
    description: false,
    startAt: false,
    endAt: false,
  });

  const defaultErrorMessages = {
    title: "",
    category: "",
    description: "",
    startAt: "",
    endAt: "",
    estimatedTime: "",
    general: "",
  };

  const [isLoading, setIsloading] = useState(false);

  useEffect(() => {
    if (initialData)
      setFormState({
        ...initialData,
        startAt: format(initialData.startAt, "yyyy-MM-dd HH:mm"),
        endAt: format(initialData.endAt, "yyyy-MM-dd HH:mm"),
      });
  }, [initialData]);

  const validateForm = (data: TaskData) => {
    setErrorMessages({
      ...defaultErrorMessages,
      ...validateTask(data, !!initialData),
    });
  };

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = e.target;
    const newFormState = { ...formState, [name]: value };
    setFormState(newFormState);
    validateForm(newFormState);
  }

  function handleBlur(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({
      title: true,
      category: true,
      description: true,
      startAt: true,
      endAt: true,
    });

    if (
      Object.entries(errorMessages).some(
        ([k, v]) => v !== "" && k !== "general",
      )
    )
      return;

    try {
      setIsloading(true);
      await submitAction({
        ...formState,
      });
    } catch (err) {
      console.error(err);
      if (!axios.isAxiosError(err)) {
        return;
      }
      if (err.status === 400) {
        const errors: Partial<ErrorMesageType> = err.response?.data?.errors;
        setErrorMessages({ ...defaultErrorMessages, ...errors });
      } else {
        setErrorMessages({ ...errorMessages, general: "Could not send data" });
      }
    } finally {
      setIsloading(false);
    }
  }

  const options = [{ name: "None", value: "" }, ...categories];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errorMessages.general && (
        <p className="mt-4 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
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
        value={formState.description ?? ""}
        handleChange={handleChange}
        errorMessage={errorMessages.description}
        touched={touched.description}
        handleBlur={handleBlur}
        textarea
      />
      <FormInput
        label="Start At"
        name="startAt"
        type="datetime-local"
        value={formState.startAt}
        handleChange={handleChange}
        errorMessage={errorMessages.startAt}
        touched={touched.startAt}
        handleBlur={handleBlur}
      />
      <FormInput
        label="End At"
        name="endAt"
        type="datetime-local"
        value={formState.endAt}
        handleChange={handleChange}
        errorMessage={errorMessages.endAt}
        touched={touched.endAt}
        handleBlur={handleBlur}
      />
      <footer className="flex gap-4 justify-end">
        {close && (
          <button
            className={isLoading ? "btn-secondary-disabled" : "btn-secondary"}
            type="button"
            onClick={close}
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
        <button
          className={isLoading ? "btn-primary-disabled" : "btn-primary"}
          disabled={isLoading}
        >
          {confirmButtonText}
        </button>
      </footer>
    </form>
  );
}
