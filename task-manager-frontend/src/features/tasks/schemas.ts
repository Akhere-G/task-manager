import { z } from "zod";
import { categories, type Task } from "./types";
import { REPEAT_LIMITS, isValidRepeatDay } from "./recurrence";
import { toFieldErrors } from "../../utils/zodErrors";

export type TaskError = { [P in keyof Task]: string };

const CATEGORY_KEYS = categories.map((c) => c.value);
const REPEAT_FREQUENCIES = Object.keys(REPEAT_LIMITS);

const isDate = (value: string) => !isNaN(Date.parse(value));

const dateField = (label: string) =>
  z
    .string({ error: `${label} is mandatory.` })
    .min(1, `${label} is mandatory.`)
    .refine(isDate, `Invalid date format for ${label}.`);

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
    startAt: dateField("Start At"),
    endAt: dateField("End At"),
    category: z
      .string({ error: "Category is mandatory." })
      .trim()
      .min(1, "Category is mandatory.")
      .max(50, "Category name is too long.")
      .refine(
        (cat) => CATEGORY_KEYS.includes(cat),
        `Invalid category. Must be one of: ${CATEGORY_KEYS.join(", ")}.`,
      ),
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

    if (isDate(data.startAt ?? "") && isDate(data.endAt ?? "")) {
      if (Date.parse(data.endAt) <= Date.parse(data.startAt)) {
        issue("endAt", "End At must be after start at.");
      }
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
