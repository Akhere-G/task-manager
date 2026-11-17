import { ButtonGroup, FormInput } from "../../../components/ui";
import useLabels from "../../labels/hooks/useLabels";
import {
  completedTasksOptions,
  isAscOptions,
  priorityFilterOptions,
  sortByOptions,
  taskDurationOptions,
} from "../constants";
import type { TaskFilters } from "../taskParams";

interface FilterPanelProps {
  filters: TaskFilters;
  updateFilters: (name: string, value: string) => void;
  sortable: boolean;
  canFilterCompleted: boolean;
}

export default function FilterPanel({
  filters,
  updateFilters,
  sortable,
  canFilterCompleted,
}: FilterPanelProps) {
  const { data: labels = [] } = useLabels();
  const labelOptions = [
    { name: "All", value: "" },
    ...labels.map((label) => ({ name: label.name, value: String(label.id) })),
  ];
  const choose = (name: string) => (value: string) =>
    updateFilters(name, value);

  return (
    <section
      aria-label="Task filters"
      className="flex flex-col gap-5 rounded-xl bg-surface-muted/40 p-4"
    >
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <ButtonGroup
          label="Priority"
          value={filters.priority}
          options={priorityFilterOptions}
          onChange={choose("priority")}
        />
        <ButtonGroup
          label="Duration"
          value={filters.duration}
          options={taskDurationOptions}
          onChange={choose("duration")}
        />
        {canFilterCompleted && (
          <ButtonGroup
            label="Status"
            value={filters.isCompleted}
            options={completedTasksOptions}
            onChange={choose("isCompleted")}
          />
        )}
        {sortable && (
          <>
            <ButtonGroup
              label="Sort by"
              value={filters.sortBy}
              options={sortByOptions}
              onChange={choose("sortBy")}
            />
            <ButtonGroup
              label="Order"
              value={filters.order}
              options={isAscOptions}
              onChange={choose("order")}
            />
          </>
        )}
      </div>
      <FormInput
        name="label"
        value={filters.label}
        handleChange={(event) => updateFilters("label", event.target.value)}
        label="Label"
        options={labelOptions}
        formClassNames="max-w-60"
      />
    </section>
  );
}
