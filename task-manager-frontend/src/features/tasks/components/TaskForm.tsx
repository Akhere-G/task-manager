import { useEffect, useState } from "react";
import {
  categories,
  type CreateTaskInput,
} from "../../../features/tasks/types";
import FormInput from "../../../components/ui/FormInput";
import axios from "axios";
import { validateTask, type TaskData } from "../../../utils/validators";
import { addHours, addMilliseconds, format } from "date-fns";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string } & {
  general: string;
};

const getDefaultTimes = () => {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() + 1);
  startDate.setMinutes(0);
  startDate.setSeconds(0);

  const endDate = new Date(startDate);
  endDate.setHours(startDate.getHours() + 1);

  const startAt = format(startDate, "yyyy-MM-dd HH:mm");
  const endAt = format(endDate, "yyyy-MM-dd HH:mm");
  return { startAt, endAt };
};

const repeatByOptions = [
  { name: "None", value: "" },
  { name: "Daily", value: "daily" },
  { name: "Weekly", value: "weekly" },
  { name: "Monthly", value: "monthly" },
  { name: "Yearly", value: "yearly" },
];

interface TaskFormProps {
  confirmButtonText?: string;
  submitAction: (task: CreateTaskInput) => Promise<void>;
  close?: () => void;
  initialData?: Partial<CreateTaskInput>;
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
    ...getDefaultTimes(),
    isRepeating: false,
    repeatBy: null,
    repeatUntil: null,
  });

  const [errorMessages, setErrorMessages] = useState<ErrorMesageType>({
    title: "",
    category: "",
    description: "",
    startAt: "",
    endAt: "",
    general: "",
    isRepeating: "",
    repeatBy: "",
    repeatUntil: "",
  });

  const [touched, setTouched] = useState({
    title: false,
    category: false,
    description: false,
    startAt: false,
    endAt: false,
    repeatBy: false,
    repeatUntil: false,
  });

  const defaultErrorMessages = {
    title: "",
    category: "",
    description: "",
    startAt: "",
    endAt: "",
    estimatedTime: "",
    general: "",
    isRepeating: "",
    repeatBy: "",
    repeatUntil: "",
  };

  const [isLoading, setIsloading] = useState(false);

  useEffect(() => {
    if (initialData)
      setFormState((prev) => {
        let startAt;
        if (initialData.startAt) {
          startAt = format(initialData.startAt, "yyyy-MM-dd HH:mm");
        } else {
          startAt = prev.startAt;
        }

        let endAt;
        if (initialData.endAt) {
          endAt = format(initialData.endAt, "yyyy-MM-dd HH:mm");
        } else if (initialData.startAt) {
          endAt = format(addHours(startAt, 1), "yyyy-MM-dd HH:mm");
        } else {
          endAt = prev.endAt;
        }

        return { ...prev, ...initialData, startAt, endAt };
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

  function handleCheck({
    target: { name, checked },
  }: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) {
    const newFormState = {
      ...formState,
      [name]: checked,
      repeatBy: checked ? formState.repeatBy : null,
      repeatUntil: checked ? formState.repeatUntil : null,
    };
    setFormState(newFormState);
    validateForm(newFormState);
  }

  function handleChangeStartAt(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { value: newStartDate } = e.target;
    const startDate = new Date(formState.startAt);
    const endDate = new Date(formState.endAt);
    let newEndDate = new Date(formState.endAt);

    if (newStartDate && formState.startAt) {
      const duration = endDate.getTime() - startDate.getTime();
      if (duration > 0)
        newEndDate = addMilliseconds(new Date(newStartDate), duration);
    }

    const newFormState = {
      ...formState,
      startAt: newStartDate,
      endAt: format(newEndDate, "yyyy-MM-dd HH:mm"),
    };
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
      repeatBy: true,
      repeatUntil: true,
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
        repeatUntil: formState.repeatUntil || null,
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
        handleChange={handleChangeStartAt}
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
      <div className="flex gap-2 items-baseline">
        <input
          name="isRepeating"
          type="checkbox"
          checked={formState.isRepeating || false}
          onChange={handleCheck}
        />
        <p>Repeating?</p>
      </div>
      {Boolean(formState.isRepeating) && (
        <>
          <FormInput
            name="repeatBy"
            label="Repeat By"
            value={formState.repeatBy || ""}
            handleChange={handleChange}
            errorMessage={errorMessages.repeatBy}
            touched={touched.repeatBy}
            options={repeatByOptions}
          />
          <FormInput
            name="repeatUntil"
            label="Repeat Until"
            value={formState.repeatUntil || ""}
            handleChange={handleChange}
            handleBlur={handleBlur}
            errorMessage={errorMessages.repeatUntil}
            touched={touched.repeatUntil}
            type="date"
          />
        </>
      )}
      <footer className="flex gap-4 justify-end">
        {close && (
          <button
            aria-label="cancel"
            className={isLoading ? "btn-secondary-disabled" : "btn-secondary"}
            type="button"
            onClick={close}
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
        <button
          aria-label={confirmButtonText}
          className={isLoading ? "btn-primary-disabled" : "btn-primary"}
          disabled={isLoading}
        >
          {confirmButtonText}
        </button>
      </footer>
    </form>
  );
}
