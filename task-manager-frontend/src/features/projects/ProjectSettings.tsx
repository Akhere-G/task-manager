import { useState } from "react";
import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";
import FormInput from "../../components/ui/FormInput";
import {
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "./hooks/useProjectMutations";
import useProjects from "./hooks/useProjects";
import { DEFAULT_PROJECT_COLOUR, type Project } from "./types";
import { allowedParents, projectTree } from "./utils";
import { trackEvent } from "../../services/analytics";

interface Draft {
  name: string;
  colour: string;
  parentId: string;
}

const emptyDraft: Draft = {
  name: "",
  colour: DEFAULT_PROJECT_COLOUR,
  parentId: "",
};

function errorText(err: unknown) {
  if (axios.isAxiosError(err)) {
    const errors = err.response?.data?.errors;
    if (errors) return String(Object.values(errors)[0]);
    return err.response?.data?.error ?? "Could not save the project.";
  }
  return "Could not save the project.";
}

interface ProjectEditorProps {
  projects: Project[];
  editing: Project | null;
  onDone: () => void;
}

function ProjectEditor({ projects, editing, onDone }: ProjectEditorProps) {
  const [draft, setDraft] = useState<Draft>(
    editing
      ? {
          name: editing.name,
          colour: editing.colour,
          parentId: editing.parentId === null ? "" : String(editing.parentId),
        }
      : emptyDraft,
  );
  const [error, setError] = useState("");
  const { mutateAsync: create } = useCreateProject();
  const { mutateAsync: update } = useUpdateProject();

  const parents = allowedParents(projects, editing?.id ?? null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => setDraft((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      name: draft.name.trim(),
      colour: draft.colour,
      parentId: draft.parentId === "" ? null : Number(draft.parentId),
    };
    try {
      if (editing) {
        await update({ id: editing.id, input });
      } else {
        await create(input);
        trackEvent("project_created", { nested: input.parentId !== null });
      }
      setError("");
      setDraft(emptyDraft);
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-end">
        <FormInput
          label="Project name"
          name="name"
          value={draft.name}
          handleChange={handleChange}
          formClassNames="grow"
        />
        <FormInput
          label="Parent project"
          name="parentId"
          value={draft.parentId}
          handleChange={handleChange}
          options={[
            { name: "None", value: "" },
            ...parents.map(({ project, depth }) => ({
              name: `${"  ".repeat(depth)}${project.name}`,
              value: String(project.id),
            })),
          ]}
        />
        <label className="flex flex-col text-sm font-bold text-text-main gap-2">
          Colour
          <input
            aria-label="Project colour"
            type="color"
            name="colour"
            value={draft.colour}
            onChange={handleChange}
            className="h-12 w-14 rounded-xl border border-border-light bg-bg-secondary"
          />
        </label>
      </div>
      <div className="flex gap-3 justify-end">
        {editing && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={!draft.name.trim()}
        >
          {editing ? "Save project" : "Add project"}
        </button>
      </div>
    </form>
  );
}

export default function ProjectSettings() {
  const { data: projects = [] } = useProjects();
  const { mutate: remove } = useDeleteProject();
  const [editingId, setEditingId] = useState<number | null>(null);
  const nodes = projectTree(projects);

  function handleDelete(project: Project) {
    const ok = window.confirm(
      `Delete "${project.name}"? Its tasks move to your Inbox and its sub-projects move up a level.`,
    );
    if (ok) remove(project.id);
  }

  return (
    <div className="flex flex-col gap-4">
      {nodes.length === 0 ? (
        <p className="text-text-sub">
          You have no projects yet. Tasks without a project live in your Inbox.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {nodes.map(({ project, depth }) => (
            <li key={project.id} style={{ paddingLeft: `${depth * 20}px` }}>
              {editingId === project.id ? (
                <ProjectEditor
                  projects={projects}
                  editing={project}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3 justify-between">
                  <span className="flex items-center gap-2 text-text-main">
                    <span
                      aria-hidden
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: project.colour }}
                    />
                    {project.name}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${project.name}`}
                      className="p-1 text-text-sub hover:text-brand cursor-pointer"
                      onClick={() => setEditingId(project.id)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${project.name}`}
                      className="p-1 text-text-sub hover:text-failure cursor-pointer"
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ProjectEditor projects={projects} editing={null} onDone={() => {}} />
    </div>
  );
}
