import { useState } from "react";
import {
  DEFAULT_PRIORITY,
  type CreateTaskInput,
  type Priority,
  type Task,
} from "../../../features/tasks/types";
import { Bell, CalendarDays, Repeat } from "lucide-react";
import { FormInput, SettingsSection } from "../../../components/ui";
import { formErrorsFrom, type FormErrors } from "../formErrors";
import { validateTask } from "../schemas";
import { trackEvent } from "../../../services/analytics";
import { addHours, addMilliseconds, format, isValid } from "date-fns";
import { formatForInput } from "../../../utils/formators";
import PriorityPicker from "./PriorityPicker";
import ScheduleFields from "./ScheduleFields";
import RepeatFields from "./RepeatFields";
import ProjectCombobox from "../../projects/ProjectCombobox";
import LabelPicker from "../../labels/LabelPicker";
import ReminderPicker from "./ReminderPicker";
import { beforeReminder, reminderLabel } from "../reminders";
import { REPEAT_LIMITS, defaultDays, getBrowserTimeZone } from "../recurrence";

type ErrorMesageType = { [P in keyof CreateTaskInput]: string } & {
  general: string;
};

const NO_ERRORS: ErrorMesageType = {
  title: "",
  projectId: "",
  projectName: "",
  labelIds: "",
  labelNames: "",
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
  columnId: "",
  reminders: "",
};

const touchedFields = (isTouched: boolean) => ({
  title: isTouched,
  projectId: isTouched,
  description: isTouched,
  startAt: isTouched,
  endAt: isTouched,
  repeatBy: isTouched,
  repeatUntil: isTouched,
});

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

const defaultFormState = (): FormState => ({
  title: "",
  projectId: null,
  labelIds: [],
  reminders: [beforeReminder(30)],
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

function initialFormState(initialData?: Partial<Task>): FormState {
  const base = defaultFormState();
  if (!initialData) return base;
  try {
    const startAt = initialData.startAt
      ? formatForInput(initialData.startAt)
      : base.startAt;

    let endAt = base.endAt;
    if (initialData.endAt) {
      endAt = formatForInput(initialData.endAt);
    } else if (initialData.startAt) {
      endAt = formatForInput(addHours(startAt, 1));
    }

    const merged = { ...base, ...initialData, startAt, endAt };
    if (merged.repeatBy) {
      // Series created before intervals/days existed carry neither.
      merged.repeatInterval = merged.repeatInterval || 1;
      merged.repeatTimezone = merged.repeatTimezone ?? getBrowserTimeZone();
      if (merged.repeatBy !== "daily" && !merged.repeatDays?.length) {
        merged.repeatDays = defaultDays(startAt, merged.repeatBy);
      }
    }
    return merged;
  } catch (err) {
    console.error(err);
    return base;
  }
}

const DEFAULT_REPEAT_BY = "weekly";

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
  return value;
}

interface TaskFormProps {
  confirmButtonText?: string;
  submitAction: (task: CreateTaskInput) => Promise<void>;
  close?: () => void;
  initialData?: Partial<Task>;
  initialErrors?: FormErrors;
}
export default function TaskForm({
  submitAction,
  close,
  confirmButtonText = "Add Task",
  initialData,
  initialErrors,
}: TaskFormProps) {
  const [hasDate, setHasDate] = useState(initialData?.startAt !== null);
  // Stays open while the last reminder is removed so the picker doesn't vanish.
  const [remindersOpen, setRemindersOpen] = useState(
    initialData ? (initialData.reminders?.length ?? 0) > 0 : true,
  );
  const [formState, setFormState] = useState(() =>
    initialFormState(initialData),
  );

  const [errorMessages, setErrorMessages] = useState<ErrorMesageType>(() => ({
    ...NO_ERRORS,
    ...initialErrors,
  }));

  const [touched, setTouched] = useState(() =>
    touchedFields(Boolean(initialErrors)),
  );

  const [isLoading, setIsloading] = useState(false);

  const validateForm = (data: FormState, withDate = hasDate) => {
    setErrorMessages({
      ...NO_ERRORS,
      ...validateTask(toInput(data, withDate)),
    });
  };

  function handleHasDateChange(checked: boolean) {
    setHasDate(checked);
    validateForm(formState, checked);
  }

  function updateFormState(changes: Partial<FormState>) {
    const next = { ...formState, ...changes };
    setFormState(next);
    validateForm(next);
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

  function handleRepeatingChange(checked: boolean) {
    const repeatBy = checked ? formState.repeatBy || DEFAULT_REPEAT_BY : null;
    updateFormState({
      isRepeating: checked,
      repeatBy,
      repeatUntil: checked ? formState.repeatUntil : null,
      ...(checked
        ? {
            repeatTimezone: formState.repeatTimezone ?? getBrowserTimeZone(),
            ...(formState.repeatBy
              ? {}
              : recurrenceFor(repeatBy, formState.startAt, 1)),
          }
        : recurrenceFor(null, formState.startAt)),
    });
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
    setTouched(touchedFields(true));

    const errors = {
      ...NO_ERRORS,
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
      setErrorMessages({ ...NO_ERRORS, ...formErrorsFrom(err) });
    } finally {
      setIsloading(false);
    }
  }

  const isSeriesOccurrence = Boolean(initialData?.isGhost);
  const reminders = formState.reminders ?? [];
  const remindersEnabled = remindersOpen || reminders.length > 0;

  function handleRemindersToggle(enabled: boolean) {
    setRemindersOpen(enabled);
    updateFormState({
      reminders: enabled && !reminders.length ? [beforeReminder(30)] : [],
    });
  }

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
        label="Description"
        optional
        name="description"
        value={formState.description ?? ""}
        handleChange={handleChange}
        errorMessage={errorMessages.description}
        touched={touched.description}
        handleBlur={handleBlur}
        textarea
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ProjectCombobox
          projectId={formState.projectId}
          projectName={formState.projectName}
          onChange={({ projectId, projectName }) =>
            updateFormState({ projectId, projectName })
          }
          error={errorMessages.projectId || errorMessages.projectName}
        />
        <PriorityPicker
          value={formState.priority ?? DEFAULT_PRIORITY}
          onChange={(priority) =>
            updateFormState({ priority: priority as Priority })
          }
          error={errorMessages.priority}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-text-main">Labels</span>
          <span className="text-xs text-text-sub">Optional</span>
        </div>
        <LabelPicker
          value={formState.labelIds ?? []}
          onChange={(labelIds) => updateFormState({ labelIds })}
          newNames={formState.labelNames ?? []}
          onNewNamesChange={(labelNames) => updateFormState({ labelNames })}
        />
        {errorMessages.labelNames && (
          <p className="text-sm text-failure">{errorMessages.labelNames}</p>
        )}
        {errorMessages.labelIds && (
          <p className="text-sm text-failure">{errorMessages.labelIds}</p>
        )}
      </div>
      {!isSeriesOccurrence && (
        <SettingsSection
          icon={CalendarDays}
          title="Schedule"
          description={
            hasDate ? "When this task starts and ends" : "No dates set"
          }
          enabled={hasDate}
          onEnabledChange={handleHasDateChange}
          toggleLabel="Add dates"
        >
          <ScheduleFields
            startAt={formState.startAt}
            endAt={formState.endAt}
            startError={errorMessages.startAt}
            endError={errorMessages.endAt}
            startTouched={touched.startAt}
            endTouched={touched.endAt}
            onStartChange={handleChangeStartAt}
            onEndChange={handleChange}
            onBlur={handleBlur}
          />
        </SettingsSection>
      )}
      {hasDate && (
        <SettingsSection
          icon={Bell}
          title="Reminders"
          description={
            reminders.length
              ? reminders.map(reminderLabel).join(", ")
              : "No reminders"
          }
          enabled={remindersEnabled}
          onEnabledChange={handleRemindersToggle}
          toggleLabel="Add reminders"
        >
          <ReminderPicker
            value={reminders}
            onChange={(next) => updateFormState({ reminders: next })}
          />
        </SettingsSection>
      )}
      {hasDate && (
        <SettingsSection
          icon={Repeat}
          title="Repeat"
          description={
            formState.isRepeating
              ? `Repeats ${formState.repeatBy ?? DEFAULT_REPEAT_BY}`
              : "This task does not repeat"
          }
          enabled={Boolean(formState.isRepeating)}
          onEnabledChange={handleRepeatingChange}
          toggleLabel="Repeat task"
        >
          <RepeatFields
            repeatBy={formState.repeatBy || DEFAULT_REPEAT_BY}
            repeatUntil={formState.repeatUntil || ""}
            interval={formState.repeatInterval ?? 1}
            days={formState.repeatDays ?? null}
            errors={errorMessages}
            touched={touched}
            onChange={handleChange}
            onBlur={handleBlur}
            onIntervalChange={(repeatInterval) =>
              updateFormState({ repeatInterval })
            }
            onDaysChange={(repeatDays) => updateFormState({ repeatDays })}
          />
        </SettingsSection>
      )}
      <footer className="flex justify-end gap-4 border-t border-border-light pt-4">
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
