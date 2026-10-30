import { useState } from "react";
import {
  MONTH_NAMES,
  REPEAT_LIMITS,
  REPEAT_UNITS,
  WEEKDAY_NAMES,
  describeTimes,
  pad,
  sortDays,
  type RepeatDay,
} from "../recurrence";

interface RecurrencePickerProps {
  repeatBy: string;
  interval: number;
  days: RepeatDay[] | null;
  intervalError?: string;
  daysError?: string;
  onIntervalChange: (interval: number) => void;
  onDaysChange: (days: RepeatDay[]) => void;
}

const dayButtonClass = (selected: boolean) =>
  `rounded-md border px-2 py-1 text-sm transition-colors cursor-pointer ${
    selected
      ? "bg-brand text-text-inverse border-brand"
      : "bg-bg-secondary text-text-main border-border-light hover:border-brand"
  }`;

const inputClass =
  "p-2 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main transition-all";

const errorClass =
  "mt-2 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4";

export default function RecurrencePicker({
  repeatBy,
  interval,
  days,
  intervalError,
  daysError,
  onIntervalChange,
  onDaysChange,
}: RecurrencePickerProps) {
  const [yearlyMonth, setYearlyMonth] = useState(1);
  const [yearlyDay, setYearlyDay] = useState(1);
  const unit = REPEAT_UNITS[repeatBy];
  if (!unit) return null;

  const selected = days ?? [];

  function toggleDay(day: RepeatDay) {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day];
    onDaysChange(sortDays(repeatBy, next));
  }

  function addYearlyDate() {
    const value = `${pad(yearlyMonth)}-${pad(yearlyDay)}`;
    if (!selected.includes(value)) {
      onDaysChange(sortDays(repeatBy, [...selected, value]));
    }
  }

  const yearlyMaxDay = new Date(2024, yearlyMonth, 0).getDate();

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border-light p-3">
      <legend className="px-1 text-sm font-bold text-text-main">
        Repeat pattern
      </legend>

      <div className="flex items-center gap-2 text-sm text-text-main">
        <label htmlFor="repeatInterval">Every</label>
        <input
          id="repeatInterval"
          name="repeatInterval"
          type="number"
          min={1}
          max={REPEAT_LIMITS[repeatBy]}
          value={interval || ""}
          onChange={(e) => onIntervalChange(Number(e.target.value) || 0)}
          className={`${inputClass} w-20`}
        />
        <span>{interval === 1 ? unit : `${unit}s`}</span>
      </div>
      {intervalError && <p className={errorClass}>{intervalError}</p>}

      {repeatBy === "weekly" && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Weekdays"
        >
          {WEEKDAY_NAMES.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-pressed={selected.includes(index)}
              onClick={() => toggleDay(index)}
              className={dayButtonClass(selected.includes(index))}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {repeatBy === "monthly" && (
        <div
          className="grid grid-cols-7 gap-1"
          role="group"
          aria-label="Days of the month"
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={selected.includes(day)}
              onClick={() => toggleDay(day)}
              className={dayButtonClass(selected.includes(day))}
            >
              {day}
            </button>
          ))}
        </div>
      )}

      {repeatBy === "yearly" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Month"
              value={yearlyMonth}
              onChange={(e) => {
                const month = Number(e.target.value);
                setYearlyMonth(month);
                setYearlyDay((day) =>
                  Math.min(day, new Date(2024, month, 0).getDate()),
                );
              }}
              className={inputClass}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <input
              aria-label="Day"
              type="number"
              min={1}
              max={yearlyMaxDay}
              value={yearlyDay}
              onChange={(e) =>
                setYearlyDay(
                  Math.min(
                    Math.max(Number(e.target.value) || 1, 1),
                    yearlyMaxDay,
                  ),
                )
              }
              className={`${inputClass} w-20`}
            />
            <button
              type="button"
              onClick={addYearlyDate}
              className="btn-secondary"
            >
              Add date
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {selected.map((value) => {
              const [month, day] = String(value).split("-").map(Number);
              return (
                <li key={value}>
                  <button
                    type="button"
                    aria-label={`Remove ${day} ${MONTH_NAMES[month - 1]}`}
                    onClick={() => toggleDay(value)}
                    className={dayButtonClass(true)}
                  >
                    {day} {MONTH_NAMES[month - 1]} ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {daysError && <p className={errorClass}>{daysError}</p>}

      <p className="text-xs text-text-sub">
        {repeatBy === "daily"
          ? interval > 1
            ? `Every ${interval} days`
            : "Every day"
          : selected.length > 0
            ? describeTimes(repeatBy, interval, selected.length)
            : "Choose at least one day"}
      </p>
    </fieldset>
  );
}
