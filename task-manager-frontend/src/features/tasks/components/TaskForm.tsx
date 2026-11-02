import { useEffect, useState } from "react";
import {
  DEFAULT_PRIORITY,
  type CreateTaskInput,
  type Task,
} from "../../../features/tasks/types";
import FormInput from "../../../components/ui/FormInput";
import axios from "axios";
import { validateTask } from "../schemas";
import { trackEvent } from "../../../services/analytics";
import { addHours, addMilliseconds, format, isValid } from "date-fns";
import { formatForInput } from "../../../utils/formators";
import RecurrencePicker from "./RecurrencePicker";
import { priorityOptions } from "../constants";
import useProjects from "../../projects/hooks/useProjects";
import { projectOptions } from "../../projects/utils";
import LabelPicker from "../../labels/LabelPicker";
import { REPEAT_LIMITS, defaultDays, getBrowserTimeZone } from "../recurrence";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string } & {
  general: string;
};

type FormState = Omit<CreateTaskInput, "startAt" | "endAt"> & {
  startAt: string;
  endAt: string;
};

function toInput(state: FormState, hasDate: boolean): CreateTaskInput {
  if (hasDate) return state;
  return {
    ...state,
    startAt: null,
    endAt: null,
    isRepeating: false,
    repeatBy: null,
    repeatUntil: null,
  };
}

const getDefaultTimes = () => {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() + 1);
  startDate.setMinutes(0);
  startDate.setSeconds(0);

  const endDate = new Date(startDate);
  endDate.setHours(startDate.getHours() + 1);

  const startAt = format(startDate, "yyyy-MM-dd'T'HH:mm");
  const endAt = format(endDate, "yyyy-MM-dd'T'HH:mm");
  return { startAt, endAt };
};

const repeatByOptions = [
  { name: "None", value: "" },
  { name: "Daily", value: "daily" },
  { name: "Weekly", value: "weekly" },
  { name: "Monthly", value: "monthly" },
  { name: "Yearly", value: "yearly" },
];

function recurrenceFor(
  repeatBy: string | null | undefined,
  startAt: string,
  interval?: number | null,
) {
  if (!repeatBy) {
    return { repeatInterval: 1, repeatDays: null, repeatTimezone: null };
  }
  return {
    repeatInterval: Math.min(
      Math.max(interval || 1, 1),
      REPEAT_LIMITS[repeatBy] ?? 1,
    ),
    repeatDays: defaultDays(startAt, repeatBy),
    repeatTimezone: getBrowserTimeZone(),
  };
}

function parseFieldValue(name: string, value: string) {
  if (name === "priority") return Number(value);
  if (name === "projectId") return value === "" ? null : Number(value);
  return value;
}

interface TaskFormProps {
  confirmButtonText?: string;
  submitAction: (task: CreateTaskInput) => Promise<void>;
  close?: () => void;
  initialData?: Partial<Task>;
}
export default function TaskForm({
  submitAction,
  close,
  confirmButtonText = "Add Task",
  initialData,
}: TaskFormProps) {
  const [hasDate, setHasDate] = useState(true);
  const [formState, setFormState] = useState<FormState>({
    title: "",
    projectId: null,
    labelIds: [],
    priority: DEFAULT_PRIORITY,
    description: "",
    ...getDefaultTimes(),
    isRepeating: false,
    repeatBy: null,
    repeatUntil: null,
    repeatInterval: 1,
    repeatDays: null,
    repeatTimezone: null,
  });

  const [errorMessages, setErrorMessages] = useState<ErrorMesageType>({
    title: "",
    projectId: "",
    labelIds: "",
    priority: "",
    description: "",
    startAt: "",
    endAt: "",
    general: "",
    isRepeating: "",
    repeatBy: "",
    repeatUntil: "",
    repeatInterval: "",
    repeatDays: "",
    repeatTimezone: "",
  });

  const [touched, setTouched] = useState({
    title: false,
    projectId: false,
    description: false,
    startAt: false,
    endAt: false,
    repeatBy: false,
    repeatUntil: false,
  });

  const defaultErrorMessages = {
    title: "",
    projectId: "",
    labelIds: "",
    priority: "",
    description: "",
    startAt: "",
    endAt: "",
    estimatedTime: "",
    general: "",
    isRepeating: "",
    repeatBy: "",
    repeatUntil: "",
    repeatInterval: "",
    repeatDays: "",
    repeatTimezone: "",
  };

  const [isLoading, setIsloading] = useState(false);

  useEffect(() => {
    if (initialData?.startAt === null) setHasDate(false);
    if (initialData)
      setFormState((prev) => {
        try {
          let startAt;

          if (initialData.startAt) {
            startAt = formatForInput(initialData.startAt);
          } else {
            startAt = prev.startAt;
          }

          let endAt;
          if (initialData.endAt) {
            endAt = formatForInput(initialData.endAt);
          } else if (initialData.startAt) {
            endAt = formatForInput(addHours(startAt, 1));
          } else {
            endAt = prev.endAt;
          }

          const merged = { ...prev, ...initialData, startAt, endAt };
          if (merged.repeatBy) {
            // Series created before intervals/days existed carry neither.
            merged.repeatInterval = merged.repeatInterval || 1;
            merged.repeatTimezone =
              merged.repeatTimezone ?? getBrowserTimeZone();
            if (merged.repeatBy !== "daily" && !merged.repeatDays?.length) {
              merged.repeatDays = defaultDays(startAt, merged.repeatBy);
            }
          }
          return merged;
        } catch (err) {
          console.error(err);
          return prev;
        }
      });
  }, [initialData]);

  const validateForm = (data: FormState, withDate = hasDate) => {
    setErrorMessages({
      ...defaultErrorMessages,
      ...validateTask(toInput(data, withDate)),
    });
  };

  function handleHasDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHasDate(e.target.checked);
    validateForm(formState, e.target.checked);
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = e.target;
    const newFormState = {
      ...formState,
      [name]: parseFieldValue(name, value),
    };
    if (name === "repeatBy") {
      Object.assign(
        newFormState,
        recurrenceFor(value, formState.startAt, formState.repeatInterval),
      );
    }
    setFormState(newFormState);
    validateForm(newFormState);
  }

  function handleRecurrenceChange(
    changes: Pick<CreateTaskInput, "repeatInterval" | "repeatDays">,
  ) {
    const newFormState = { ...formState, ...changes };
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
      ...(checked
        ? {
            repeatTimezone: formState.repeatTimezone ?? getBrowserTimeZone(),
          }
        : recurrenceFor(null, formState.startAt)),
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
    let newEndDate = formState.endAt;

    if (newStartDate && formState.startAt && isValid(startDate)) {
      const duration = endDate.getTime() - startDate.getTime();
      if (duration > 0)
        newEndDate = formatForInput(
          addMilliseconds(new Date(newStartDate), duration),
        );
    }

    const daysWereDefault =
      JSON.stringify(formState.repeatDays) ===
      JSON.stringify(defaultDays(formState.startAt, formState.repeatBy));
    const newFormState = {
      ...formState,
      startAt: newStartDate,
      endAt: newEndDate,
      repeatDays:
        formState.repeatBy && daysWereDefault
          ? defaultDays(newStartDate, formState.repeatBy)
          : formState.repeatDays,
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
      projectId: true,
      description: true,
      startAt: true,
      endAt: true,
      repeatBy: true,
      repeatUntil: true,
    });

    const errors = {
      ...defaultErrorMessages,
      ...validateTask(toInput(formState, hasDate)),
    };
    setErrorMessages(errors);
    const invalidFields = Object.entries(errors)
      .filter(([k, v]) => v !== "" && k !== "general")
      .map(([k]) => k);
    if (invalidFields.length > 0) {
      trackEvent("task_form_validation_failed", { fields: invalidFields });
      return;
    }

    try {
      setIsloading(true);

      const formattedData = {
        ...toInput(formState, hasDate),
        repeatUntil: formState.repeatUntil || null,
      };

      if (initialData?.isGhost) {
        // don't edit the original task dates when editing ghost tasks
        formattedData.startAt = "";
        formattedData.endAt = "";
      }

      await submitAction(formattedData);
    } catch (err) {
      console.error(err);
      if (!axios.isAxiosError(err)) {
        return;
      }
      if (err.status === 400) {
        const errors: Partial<ErrorMesageType> = err.response?.data?.errors;
        setErrorMessages({ ...defaultErrorMessages, ...errors });
      } else {
        setErrorMessages({ ...errors, general: "Could not send data" });
      }
    } finally {
      setIsloading(false);
    }
  }

  const { data: projects = [] } = useProjects();
  const options = [{ name: "Inbox", value: "" }, ...projectOptions(projects)];

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
        label="Project"
        name="projectId"
        value={formState.projectId === null ? "" : String(formState.projectId)}
        handleChange={handleChange}
        errorMessage={errorMessages.projectId}
        options={options}
        touched={touched.projectId}
        handleBlur={handleBlur}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-text-main">Labels</span>
        <LabelPicker
          value={formState.labelIds ?? []}
          onChange={(labelIds) => {
            const next = { ...formState, labelIds };
            setFormState(next);
            validateForm(next);
          }}
        />
        {errorMessages.labelIds && (
          <p className="text-sm text-failure">{errorMessages.labelIds}</p>
        )}
      </div>
      <FormInput
        label="Priority"
        name="priority"
        value={String(formState.priority ?? DEFAULT_PRIORITY)}
        handleChange={handleChange}
        errorMessage={errorMessages.priority}
        options={priorityOptions}
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
      {!initialData?.isGhost && (
        <label className="flex gap-2 items-baseline text-text-main">
          <input
            name="hasDate"
            type="checkbox"
            checked={hasDate}
            onChange={handleHasDateChange}
          />
          Has a date
        </label>
      )}
      {!initialData?.isGhost && hasDate && (
        <>
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
        </>
      )}
      {hasDate && (
        <label className="flex gap-2 items-baseline">
          <input
            name="isRepeating"
            type="checkbox"
            checked={formState.isRepeating || false}
            onChange={handleCheck}
          />
          Repeating?
        </label>
      )}
      {hasDate && Boolean(formState.isRepeating) && (
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
          {formState.repeatBy && (
            <RecurrencePicker
              repeatBy={formState.repeatBy}
              interval={formState.repeatInterval ?? 1}
              days={formState.repeatDays ?? null}
              intervalError={errorMessages.repeatInterval}
              daysError={errorMessages.repeatDays}
              onIntervalChange={(repeatInterval) =>
                handleRecurrenceChange({
                  repeatInterval,
                  repeatDays: formState.repeatDays,
                })
              }
              onDaysChange={(repeatDays) =>
                handleRecurrenceChange({
                  repeatInterval: formState.repeatInterval,
                  repeatDays,
                })
              }
            />
          )}
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
