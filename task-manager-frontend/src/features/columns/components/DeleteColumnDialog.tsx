import { useState } from "react";
import { Popup } from "../../../components/ui";
import { useDeleteColumn } from "../hooks/useColumnMutations";
import type { ProjectColumn } from "../types";

interface DeleteColumnDialogProps {
  column: ProjectColumn;
  otherColumns: ProjectColumn[];
  close: () => void;
}

export default function DeleteColumnDialog({
  column,
  otherColumns,
  close,
}: DeleteColumnDialogProps) {
  const [moveToId, setMoveToId] = useState(otherColumns[0]?.id);
  const { mutate: deleteColumn } = useDeleteColumn(column.projectId);

  const confirm = () => {
    if (moveToId === undefined) return;
    deleteColumn({ id: column.id, moveToId }, { onSuccess: close });
  };

  return (
    <Popup
      title={`Delete "${column.name}"`}
      close={close}
      handleConfirm={confirm}
      actionText="Delete column"
    >
      <label className="flex flex-col gap-2 text-text-main">
        Move its tasks to
        <select
          value={moveToId}
          onChange={(event) => setMoveToId(Number(event.target.value))}
          className="rounded-lg border border-slate-300 bg-canvas px-2 py-1 dark:border-slate-700"
        >
          {otherColumns.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
        </select>
      </label>
    </Popup>
  );
}
