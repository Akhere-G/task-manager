import { Loader2 } from "lucide-react";

export default function SavingSpinner({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Loader2
      aria-label="Saving"
      size={14}
      className={`shrink-0 animate-spin ${className}`}
    />
  );
}
