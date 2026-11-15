import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentProvider } from "../../context/CookieConsentContext";
import {
  COOKIE_PREFERENCES_KEY,
  getCookiePreferences,
} from "../../services/cookiePreferences";
import { renderWithProviders } from "../../test/render";
import CookieConsentBanner from "./CookieConsentBanner";

const analytics = vi.hoisted(() => ({
  setAnalyticsCookieConsent: vi.fn(),
}));

vi.mock("../../services/analytics", () => ({
  setAnalyticsCookieConsent: analytics.setAnalyticsCookieConsent,
}));

function renderBanner() {
  return renderWithProviders(
    <CookieConsentProvider>
      <CookieConsentBanner />
    </CookieConsentProvider>,
  );
}

function storedPreferences() {
  return getCookiePreferences();
}

describe("cookie consent", () => {
  beforeEach(() => analytics.setAnalyticsCookieConsent.mockClear());

  it("accepts analytics cookies and remembers the choice", async () => {
    renderBanner();

    await userEvent.click(
      screen.getByRole("button", { name: "Accept cookies" }),
    );

    expect(storedPreferences()).toEqual({ analytics: true, version: 1 });
    expect(analytics.setAnalyticsCookieConsent).toHaveBeenCalledWith(true);
    expect(
      screen.queryByRole("button", { name: "Accept cookies" }),
    ).not.toBeInTheDocument();
  });

  it("saves an analytics-off choice from the preferences modal", async () => {
    renderBanner();

    await userEvent.click(
      screen.getByRole("button", { name: "Choose options" }),
    );
    expect(
      screen.getByRole("switch", { name: "Analytics cookies" }),
    ).not.toBeChecked();
    await userEvent.click(
      screen.getByRole("button", { name: "Save preferences" }),
    );

    expect(storedPreferences()).toEqual({ analytics: false, version: 1 });
    expect(analytics.setAnalyticsCookieConsent).toHaveBeenCalledWith(false);
  });

  it("does not show the banner after a choice has been saved", () => {
    localStorage.setItem(
      COOKIE_PREFERENCES_KEY,
      JSON.stringify({ analytics: false, version: 1 }),
    );

    renderBanner();

    expect(
      screen.queryByRole("button", { name: "Accept cookies" }),
    ).not.toBeInTheDocument();
  });
});
