import { useEffect, useRef } from "react";
import { alertPhaseDue } from "./alerts";

interface PhaseAlertsOptions {
  isDue: boolean;
  clock: string;
  phaseLabel: string;
  dueMessage: string;
}

export function usePhaseAlerts({
  isDue,
  clock,
  phaseLabel,
  dueMessage,
}: PhaseAlertsOptions) {
  // Seeded with the initial value so reloading into overtime does not chime again.
  const wasDue = useRef(isDue);

  useEffect(() => {
    if (isDue && !wasDue.current)
      alertPhaseDue(`${phaseLabel} done`, dueMessage).catch(console.error);
    wasDue.current = isDue;
  }, [isDue, phaseLabel, dueMessage]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${clock} ${phaseLabel}`;
    return () => {
      document.title = previousTitle;
    };
  }, [clock, phaseLabel]);
}
