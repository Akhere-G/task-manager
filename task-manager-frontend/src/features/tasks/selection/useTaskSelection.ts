import { useContext } from "react";

import { SelectionContext } from "./selectionContext";

export function useTaskSelection() {
  return useContext(SelectionContext);
}
