import { useState } from "react";
import Popup from "../ui/Popup";
import Toggle from "../ui/Toggle";
import type { CookiePreferences } from "../../services/cookiePreferences";

type CookiePreferencesModalProps = {
  initialPreferences: CookiePreferences;
  onClose: () => void;
  onSave: (preferences: CookiePreferences) => void;
};

export default function CookiePreferencesModal({
  initialPreferences,
  onClose,
  onSave,
}: CookiePreferencesModalProps) {
  const [analytics, setAnalytics] = useState(initialPreferences.analytics);

  return (
    <Popup
      title="Cookie preferences"
      close={onClose}
      handleConfirm={() => onSave({ analytics, version: 1 })}
      actionText="Save preferences"
      actionButtonVariant="primary"
    >
      <p className="text-text-sub mb-6">
        Choose whether TaskFlow may store analytics cookies. You can change this
        choice at any time from Settings.
      </p>

      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-text-main">Required</h2>
              <p className="text-sm text-text-sub mt-1">
                Keeps you signed in securely and remembers your cookie choice.
                These cannot be disabled.
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-success">
              Always on
            </span>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-text-main">Analytics cookies</h2>
              <p className="text-sm text-text-sub mt-1">
                Allows PostHog to remember a browser and connect usage across
                visits. When off, we use cookieless analytics without storing a
                browser identifier.
              </p>
            </div>
            <Toggle
              checked={analytics}
              onChange={setAnalytics}
              label="Analytics cookies"
            />
          </div>
        </section>
      </div>
    </Popup>
  );
}
