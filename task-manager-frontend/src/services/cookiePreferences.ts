export const COOKIE_PREFERENCES_KEY = "taskflow_cookie_preferences";

export type CookiePreferences = {
  analytics: boolean;
  version: 1;
};

export function getCookiePreferences(): CookiePreferences | null {
  try {
    const stored = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!stored) return null;

    const preferences: unknown = JSON.parse(stored);
    if (
      typeof preferences === "object" &&
      preferences !== null &&
      "analytics" in preferences &&
      typeof preferences.analytics === "boolean" &&
      "version" in preferences &&
      preferences.version === 1
    ) {
      return { analytics: preferences.analytics, version: 1 };
    }
  } catch (error) {
    console.error("Could not read cookie preferences", error);
  }

  return null;
}

export function saveCookiePreferences(preferences: CookiePreferences) {
  try {
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Could not save cookie preferences", error);
  }
}
