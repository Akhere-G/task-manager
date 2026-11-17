import { useMemo, useState, type ReactNode } from "react";

import { SelectionContext, type TaskSelection } from "./selectionContext";

interface SelectionProviderProps {
  scope: string;
  children: ReactNode;
}

interface Selected {
  scope: string;
  ids: ReadonlySet<number>;
}

const NOTHING: ReadonlySet<number> = new Set();

export function SelectionProvider({ scope, children }: SelectionProviderProps) {
  const [selected, setSelected] = useState<Selected>({
    scope,
    ids: NOTHING,
  });
  const ids = selected.scope === scope ? selected.ids : NOTHING;

  const value = useMemo<TaskSelection>(
    () => ({
      enabled: true,
      ids,
      toggle: (id) => {
        const next = new Set(ids);
        if (!next.delete(id)) next.add(id);
        setSelected({ scope, ids: next });
      },
      clear: () => setSelected({ scope, ids: NOTHING }),
    }),
    [ids, scope],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}
