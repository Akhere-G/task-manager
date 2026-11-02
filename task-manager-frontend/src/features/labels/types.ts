export interface Label {
  id: number;
  name: string;
  colour: string;
}

export type LabelInput = Pick<Label, "name"> & Partial<Pick<Label, "colour">>;

export const MAX_LABELS_PER_TASK = 10;
export const DEFAULT_LABEL_COLOUR = "#64748b";
