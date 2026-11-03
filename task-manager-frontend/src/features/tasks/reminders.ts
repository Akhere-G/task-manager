import { getBrowserTimeZone } from "./recurrence";
import type { Reminder } from "./types";

export const START_OF_DAY = "09:00";

export const beforeReminder = (minutes: number): Reminder => ({
  kind: "before",
  minutesBefore: minutes,
  daysBefore: null,
  timeOfDay: null,
  zoneName: null,
});

export const clockReminder = (timeOfDay: string): Reminder => ({
  kind: "clock",
  minutesBefore: null,
  daysBefore: 0,
  timeOfDay,
  zoneName: getBrowserTimeZone() ?? "UTC",
});

export const REMINDER_PRESETS: { label: string; reminder: () => Reminder }[] = [
  { label: "1 hour before", reminder: () => beforeReminder(60) },
  { label: "30 minutes before", reminder: () => beforeReminder(30) },
  { label: "Start of day", reminder: () => clockReminder(START_OF_DAY) },
];

/** Stored times come back as HH:MM:SS; the form works in HH:MM. */
const shortTime = (time: string | null) => (time ?? "").slice(0, 5);

export const reminderKey = (reminder: Reminder): string =>
  reminder.kind === "before"
    ? `before:${reminder.minutesBefore}`
    : `clock:${reminder.daysBefore}:${shortTime(reminder.timeOfDay)}`;

export const reminderLabel = (reminder: Reminder): string => {
  if (reminder.kind === "clock") {
    return `At ${shortTime(reminder.timeOfDay)}`;
  }
  const minutes = reminder.minutesBefore ?? 0;
  if (minutes % 60 === 0 && minutes > 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before`;
  }
  return `${minutes} minutes before`;
};
