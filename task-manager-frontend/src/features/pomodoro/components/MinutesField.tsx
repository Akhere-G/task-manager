import { useState } from "react";
import FormInput from "../../../components/ui/FormInput";

interface MinutesFieldProps {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (minutes: number) => void;
}

export function MinutesField({
  name,
  label,
  value,
  min,
  max,
  onCommit,
}: MinutesFieldProps) {
  // Edits stay a draft until blur so typing "50" is not clamped at "5".
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft.trim() !== "") onCommit(Number(draft));
    setDraft(null);
  };

  return (
    <FormInput
      name={name}
      label={`${label} (${min}-${max} min)`}
      type="number"
      value={draft ?? value}
      handleChange={(e) => setDraft(e.target.value)}
      handleBlur={commit}
    />
  );
}
