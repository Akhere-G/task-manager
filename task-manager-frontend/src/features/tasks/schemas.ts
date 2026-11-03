import { z } from "zod";
import type { Task } from "./types";
import { MAX_LABELS_PER_TASK } from "../labels/types";
import { REPEAT_LIMITS, isValidRepeatDay } from "./recurrence";
import { toFieldErrors } from "../../utils/zodErrors";

export type TaskError = { [P in keyof Task]: string };

const REPEAT_FREQUENCIES = Object.keys(REPEAT_LIMITS);

const isDate = (value: string) => !isNaN(Date.parse(value));

const hasValue = (value: string | null | undefined) =>
  value !== null && value !== undefined && value.trim() !== "";

const dateField = (label: string) =>
  z
    .string()
    .nullish()
    .refine(
      (v) => !hasValue(v) || isDate(v as string),
      `Invalid date format for ${label}.`,
    );

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const taskSchema = z
  .object({
    title: z
      .string({ error: "Title is mandatory." })
      .trim()
      .min(1, "Title is mandatory.")
      .max(255, "Title must be under 255 characters."),
    description: z.string().nullish(),
    priority: z
      .number()
      .int()
      .min(1, "Priority must be between 1 and 4.")
      .max(4, "Priority must be between 1 and 4.")
      .optional(),
    startAt: dateField("Start At"),
    endAt: dateField("End At"),
    projectId: z
      .number({ error: "Choose one of your projects." })
      .int("Choose one of your projects.")
      .nullish(),
    labelIds: z
      .array(z.number().int(), { error: "Choose your own labels." })
      .max(
        MAX_LABELS_PER_TASK,
        `A task can have up to ${MAX_LABELS_PER_TASK} labels.`,
      )
      .optional(),
    reminders: z
      .array(
        z.object({
          kind: z.enum(["before", "clock"]),
          minutesBefore: z.number().int().min(0).nullish(),
          daysBefore: z.number().int().min(0).nullish(),
          timeOfDay: z.string().nullish(),
          zoneName: z.string().nullish(),
        }),
      )
      .optional(),
    repeatUntil: z
      .string()
      .nullish()
      .refine((v) => !v?.trim() || isDate(v), "Invalid timestamp."),
    isRepeating: z.boolean().nullish(),
    repeatBy: z
      .string()
      .nullish()
      .refine(
        (v) => !v || REPEAT_FREQUENCIES.includes(v),
        "Repeat must only be daily, weekly, monthly or yearly.",
      ),
    repeatInterval: z.number().nullish(),
    repeatDays: z.array(z.union([z.number(), z.string()])).nullish(),
    repeatTimezone: z
      .string()
      .nullish()
      .refine(
        (v) => !v || isValidTimeZone(v),
        "Repeat time zone is not a valid time zone.",
      ),
  })
  .superRefine((data, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    const { startAt, endAt } = data;
    const hasStart = hasValue(startAt);
    const hasEnd = hasValue(endAt);
    if (hasStart && !hasEnd) issue("endAt", "End At is mandatory.");
    if (hasEnd && !hasStart) issue("startAt", "Start At is mandatory.");
    if (startAt && endAt && isDate(startAt) && isDate(endAt)) {
      if (Date.parse(endAt) <= Date.parse(startAt)) {
        issue("endAt", "End At must be after start at.");
      }
    }
    if ((data.isRepeating || data.repeatBy) && !hasStart && !hasEnd) {
      issue("startAt", "Repeating tasks need a start and an end time.");
    }

    if (data.isRepeating && !data.repeatBy) {
      issue("repeatBy", "Repeat By is required for repeating tasks.");
    }

    const repeatBy = data.repeatBy;
    if (!repeatBy || !(repeatBy in REPEAT_LIMITS)) return;

    const limit = REPEAT_LIMITS[repeatBy];
    const interval = data.repeatInterval ?? 1;
    if (!Number.isInteger(interval) || interval < 1 || interval > limit) {
      issue(
        "repeatInterval",
        `Repeat interval must be between 1 and ${limit}.`,
      );
    }

    const days = data.repeatDays;
    if (repeatBy !== "daily" && !days?.length) {
      issue("repeatDays", "Choose at least one day.");
    } else if (
      days?.length &&
      (repeatBy === "daily" ||
        !days.every((d) => isValidRepeatDay(repeatBy, d)))
    ) {
      issue(
        "repeatDays",
        "Repeat days must be weekdays (Mon-Sun), days of the month (1-31) or MM-DD dates.",
      );
    }
  });

export const taskListSchema = z.array(taskSchema);

export const validateTask = (data: unknown) =>
  toFieldErrors(taskSchema.safeParse(data));

/** One field-error map per task, in input order. */
export const validateTaskList = (tasks: unknown[]) =>
  tasks.map((task) => validateTask(task));
