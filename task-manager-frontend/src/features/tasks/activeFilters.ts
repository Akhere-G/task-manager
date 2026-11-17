import type { Label } from "../labels/types";
import {
  completedTasksOptions,
  priorityFilterOptions,
  taskDurationOptions,
} from "./constants";
import { getDefaultFilters, type TaskFilters } from "./taskParams";

type FilterName = "priority" | "duration" | "label" | "isCompleted";

export interface ActiveFilter {
  name: FilterName;
  title: string;
  valueName: string;
  defaultValue: string;
}

interface Option {
  name: string;
  value: string;
}

function nameOf(options: Option[], value: string) {
  const match = options.find((option) => option.value === value);
  return match ? match.name : value;
}

export function findActiveFilters(
  filters: TaskFilters,
  labels: Pick<Label, "id" | "name">[],
  canFilterCompleted: boolean,
): ActiveFilter[] {
  const defaults = getDefaultFilters();
  const labelOptions = labels.map((label) => ({
    name: label.name,
    value: String(label.id),
  }));
  const candidates: (ActiveFilter & { isApplicable: boolean })[] = [
    {
      name: "isCompleted",
      title: "Status",
      valueName: nameOf(completedTasksOptions, filters.isCompleted),
      defaultValue: defaults.isCompleted,
      isApplicable: canFilterCompleted,
    },
    {
      name: "priority",
      title: "Priority",
      valueName: nameOf(priorityFilterOptions, filters.priority),
      defaultValue: defaults.priority,
      isApplicable: true,
    },
    {
      name: "duration",
      title: "Duration",
      valueName: nameOf(taskDurationOptions, filters.duration),
      defaultValue: defaults.duration,
      isApplicable: true,
    },
    {
      name: "label",
      title: "Label",
      valueName: nameOf(labelOptions, filters.label),
      defaultValue: defaults.label,
      isApplicable: true,
    },
  ];

  const active: ActiveFilter[] = [];
  for (const { isApplicable, ...filter } of candidates) {
    if (isApplicable && filters[filter.name] !== filter.defaultValue) {
      active.push(filter);
    }
  }
  return active;
}
