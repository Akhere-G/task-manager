import { createContext, useContext, useState } from "react";
import CookiePreferencesModal from "../components/privacy/CookiePreferencesModal";
import {
  getCookiePreferences,
  saveCookiePreferences,
  type CookiePreferences,
} from "../services/cookiePreferences";
import { setAnalyticsCookieConsent } from "../services/analytics";

type CookieConsentContextValue = {
  hasChosen: boolean;
  openPreferences: () => void;
  preferences: CookiePreferences;
  acceptAll: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
);

const DEFAULT_PREFERENCES: CookiePreferences = {
  analytics: false,
  version: 1,
};

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const storedPreferences = getCookiePreferences();
  const [preferences, setPreferences] = useState(
    storedPreferences ?? DEFAULT_PREFERENCES,
  );
  const [hasChosen, setHasChosen] = useState(storedPreferences !== null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const updatePreferences = (nextPreferences: CookiePreferences) => {
    saveCookiePreferences(nextPreferences);
    setAnalyticsCookieConsent(nextPreferences.analytics);
    setPreferences(nextPreferences);
    setHasChosen(true);
    setIsModalOpen(false);
  };

  const acceptAll = () =>
    updatePreferences({ ...DEFAULT_PREFERENCES, analytics: true });

  return (
    <CookieConsentContext.Provider
      value={{
        acceptAll,
        hasChosen,
        openPreferences: () => setIsModalOpen(true),
        preferences,
      }}
    >
      {children}
      {isModalOpen && (
        <CookiePreferencesModal
          initialPreferences={preferences}
          onClose={() => setIsModalOpen(false)}
          onSave={updatePreferences}
        />
      )}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error(
      "useCookieConsent must be used within a CookieConsentProvider",
    );
  }
  return context;
}
