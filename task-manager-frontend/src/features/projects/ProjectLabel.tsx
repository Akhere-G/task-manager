import useProjects from "./hooks/useProjects";
import { INBOX_NAME } from "./types";
import { projectColour, projectPath } from "./utils";

interface ProjectLabelProps {
  projectId: number | null | undefined;
  className?: string;
}

export default function ProjectLabel({
  projectId,
  className = "",
}: ProjectLabelProps) {
  const { data: projects = [] } = useProjects();
  const name = projectPath(projects, projectId) ?? INBOX_NAME;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {projectId != null && (
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: projectColour(projects, projectId) }}
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
