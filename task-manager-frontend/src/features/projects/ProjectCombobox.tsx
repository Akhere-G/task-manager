import { useEffect, useId, useState } from "react";
import useProjects from "./hooks/useProjects";
import { projectTree } from "./utils";

export interface ProjectChoice {
  projectId: number | null;
  projectName: string;
}

interface ProjectComboboxProps {
  projectId: number | null;
  onChange: (choice: ProjectChoice) => void;
  error?: string;
}

const PATH_SEPARATOR = "/";

export default function ProjectCombobox({
  projectId,
  onChange,
  error,
}: ProjectComboboxProps) {
  const { data: projects = [] } = useProjects();
  const nodes = projectTree(projects);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const typed = text.trim();
  const findByPath = (path: string) =>
    nodes.find((n) => n.path.toLowerCase() === path.toLowerCase());
  const exact = typed ? findByPath(typed) : undefined;
  const matches = nodes.filter((n) =>
    n.path.toLowerCase().includes(typed.toLowerCase()),
  );
  const canCreate = typed !== "" && !exact;
  const optionCount = matches.length + (canCreate ? 1 : 0);

  // Show the chosen project's path when it is set from outside (editing).
  useEffect(() => {
    if (projectId === null) return;
    const node = nodes.find((n) => n.project.id === projectId);
    if (node && findByPath(text.trim())?.project.id !== projectId) {
      setText(node.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projects]);

  function change(value: string) {
    setText(value);
    setOpen(true);
    setActive(0);
    const trimmed = value.trim();
    const node = trimmed ? findByPath(trimmed) : undefined;
    onChange({
      projectId: node?.project.id ?? null,
      projectName: node || !trimmed ? "" : trimmed,
    });
  }

  function choose(index: number) {
    const node = matches[index];
    if (node) {
      setText(node.path);
      onChange({ projectId: node.project.id, projectName: "" });
    }
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + optionCount) % Math.max(optionCount, 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  const hint =
    canCreate && typed.includes(PATH_SEPARATOR)
      ? `Creates each missing level of "${typed}"`
      : null;

  return (
    <div className="group relative flex flex-col text-text-main">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label
          htmlFor={`${listId}-input`}
          className="text-sm font-bold group-focus-within:text-accent"
        >
          Project
        </label>
        <span className="text-xs text-text-sub">Optional</span>
      </div>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && optionCount > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search or create a project"
        value={text}
        onChange={(e) => change(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-xl border border-border-light bg-bg-secondary p-3 text-text-main transition-all placeholder:text-text-sub/50 focus:border-brand focus:outline-none"
      />
      {open && optionCount > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border-light bg-surface p-1 shadow-md"
        >
          {matches.map((node, index) => (
            <li
              key={node.project.id}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(index);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
                index === active ? "bg-brand/10" : ""
              }`}
            >
              {node.path}
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              onMouseEnter={() => setActive(matches.length)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
                active === matches.length ? "bg-brand/10" : ""
              }`}
            >
              Create “{typed}”
            </li>
          )}
        </ul>
      )}
      {hint && <p className="mt-1 text-xs text-text-sub">{hint}</p>}
      {error && (
        <p className="mt-2 rounded-md border-l-4 border-l-failure bg-failure/10 p-1 pl-4 text-failure">
          {error}
        </p>
      )}
    </div>
  );
}
