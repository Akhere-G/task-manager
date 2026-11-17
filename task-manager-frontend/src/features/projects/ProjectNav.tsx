import useProjects from "./hooks/useProjects";
import { projectTree } from "./utils";

interface ProjectNavProps {
  /** The selected project id as a string, or "" for all projects. */
  selected: string;
  isInboxSelected: boolean;
  onSelect: (projectId: string) => void;
  onSelectInbox: () => void;
}

const itemClass = (selected: boolean) =>
  `flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${
    selected
      ? "bg-brand text-white"
      : "bg-surface text-text-main hover:bg-brand/20"
  }`;

export default function ProjectNav({
  selected,
  isInboxSelected,
  onSelect,
  onSelectInbox,
}: ProjectNavProps) {
  const { data: projects = [] } = useProjects();

  return (
    <nav aria-label="Projects" className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={isInboxSelected}
        onClick={onSelectInbox}
        className={itemClass(isInboxSelected)}
      >
        Inbox
      </button>
      <button
        type="button"
        aria-pressed={!isInboxSelected && selected === ""}
        onClick={() => onSelect("")}
        className={itemClass(!isInboxSelected && selected === "")}
      >
        All projects
      </button>
      {projectTree(projects).map(({ project, depth }) => {
        const id = String(project.id);
        return (
          <button
            key={project.id}
            type="button"
            aria-pressed={!isInboxSelected && selected === id}
            onClick={() => onSelect(id)}
            style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
            className={itemClass(!isInboxSelected && selected === id)}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.colour }}
            />
            <span className="truncate">{project.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
