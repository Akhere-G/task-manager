import {
  addDays,
  addMonths,
  format,
  nextMonday,
  nextTuesday,
  startOfMonth,
} from "date-fns";
import Papa from "papaparse";

export type TemplateKind = "simple" | "advanced";

const BASE_HEADERS = [
  "Title",
  "Project",
  "Priority",
  "Description",
  "Start At",
  "End At",
  "Repeat By",
  "Repeat Interval",
  "Repeat Days",
  "Repeat Until",
];
const ADVANCED_HEADERS = ["Is Completed", "Completed At"];

type Example = Record<string, string>;

const stamp = (day: Date, time: string) =>
  `${format(day, "yyyy-MM-dd")} ${time}`;
const monthDay = (day: Date) => format(day, "MM-dd");

function repeating(
  title: string,
  start: Date,
  repeatBy: string,
  interval: number,
  days = "",
  extra: Example = {},
): Example {
  return {
    Title: title,
    "Start At": stamp(start, "09:00"),
    "End At": stamp(start, "09:30"),
    "Repeat By": repeatBy,
    "Repeat Interval": String(interval),
    "Repeat Days": days,
    ...extra,
  };
}

function simpleExamples(today: Date): Example[] {
  const tomorrow = addDays(today, 1);
  const firstOfNextMonth = startOfMonth(addMonths(today, 1));
  return [
    {
      Title: "Dentist appointment",
      Description: "One-off task with a date",
      "Start At": stamp(tomorrow, "14:00"),
      "End At": stamp(tomorrow, "15:00"),
    },
    { Title: "Buy a birthday gift", Description: "No date, goes to the inbox" },
    repeating("Take vitamins (every day)", tomorrow, "daily", 1),
    repeating("Water plants (every other day)", tomorrow, "daily", 2),
    repeating(
      "Team sync (weekly)",
      nextMonday(today),
      "weekly",
      1,
      "Mon;Wed;Fri",
    ),
    repeating(
      "Payroll (every other week)",
      nextTuesday(today),
      "weekly",
      2,
      "Tue",
    ),
    repeating("Pay rent (monthly)", firstOfNextMonth, "monthly", 1, "1"),
    repeating(
      "Renew passport (yearly)",
      tomorrow,
      "yearly",
      1,
      monthDay(tomorrow),
    ),
  ];
}

function advancedExamples(today: Date): Example[] {
  const tomorrow = addDays(today, 1);
  const lastWeek = addDays(today, -7);
  return [
    ...simpleExamples(today),
    repeating(
      "Stand-up (weekdays)",
      nextMonday(today),
      "weekly",
      1,
      "Mon;Tue;Wed;Thu;Fri",
    ),
    repeating(
      "Invoices (1st and 15th)",
      startOfMonth(addMonths(today, 1)),
      "monthly",
      1,
      "1;15",
      { "Repeat Until": format(addMonths(today, 12), "yyyy-MM-dd") },
    ),
    {
      Title: "Quarterly report",
      Project: "Work / Reports",
      Priority: "1",
      Description: "Sub-project and top priority",
      "Start At": stamp(tomorrow, "10:00"),
      "End At": stamp(tomorrow, "12:00"),
    },
    {
      Title: "Book flights",
      Project: "Travel",
      Priority: "2",
      "Is Completed": "true",
      "Start At": stamp(lastWeek, "18:00"),
      "End At": stamp(lastWeek, "18:30"),
      "Completed At": stamp(lastWeek, "18:25"),
    },
  ];
}

export function templateCsv(kind: TemplateKind, today = new Date()): string {
  const headers =
    kind === "advanced" ? [...BASE_HEADERS, ...ADVANCED_HEADERS] : BASE_HEADERS;
  const examples =
    kind === "advanced" ? advancedExamples(today) : simpleExamples(today);
  const rows = examples.map((example) =>
    headers.map((header) => example[header] ?? ""),
  );
  return Papa.unparse({ fields: headers, data: rows });
}

export function downloadTemplate(kind: TemplateKind) {
  const blob = new Blob(["﻿", templateCsv(kind)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `tasks_template_${kind}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
