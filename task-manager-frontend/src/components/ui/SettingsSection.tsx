import type { LucideIcon } from "lucide-react";
import Toggle from "./Toggle";

interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  toggleLabel: string;
  children?: React.ReactNode;
}

export default function SettingsSection({
  icon: Icon,
  title,
  description,
  enabled,
  onEnabledChange,
  toggleLabel,
  children,
}: SettingsSectionProps) {
  return (
    <section className="rounded-xl border border-border-light bg-bg-secondary">
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="text-sm text-text-main">{title}</strong>
          <span className="truncate text-xs text-text-sub">{description}</span>
        </div>
        <Toggle
          checked={enabled}
          onChange={onEnabledChange}
          label={toggleLabel}
        />
      </div>
      {enabled && children && (
        <div className="flex flex-col gap-4 border-t border-border-light p-3">
          {children}
        </div>
      )}
    </section>
  );
}
