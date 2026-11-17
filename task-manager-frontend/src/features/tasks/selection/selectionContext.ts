import { createContext } from "react";

export interface TaskSelection {
  enabled: boolean;
  ids: ReadonlySet<number>;
  toggle: (id: number) => void;
  clear: () => void;
}

export const noSelection: TaskSelection = {
  enabled: false,
  ids: new Set(),
  toggle: () => {},
  clear: () => {},
};

export const SelectionContext = createContext<TaskSelection>(noSelection);
