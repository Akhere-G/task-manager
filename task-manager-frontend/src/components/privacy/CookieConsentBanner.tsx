import { Link } from "react-router-dom";
import { useCookieConsent } from "../../context/CookieConsentContext";

export default function CookieConsentBanner() {
  const { acceptAll, hasChosen, openPreferences } = useCookieConsent();

  if (hasChosen) return null;

  return (
    <aside
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-90 mx-auto max-w-4xl rounded-xl border border-slate-200 bg-surface p-4 shadow-2xl dark:border-slate-700 md:flex md:items-center md:justify-between md:gap-6"
    >
      <p className="text-sm text-text-sub">
        We use required storage to run TaskFlow and optional PostHog cookies to
        understand how the product is used. Until you accept analytics cookies,
        PostHog uses cookieless tracking without storing a browser identifier. See
        our{" "}
        <Link className="text-link hover:text-link-hover underline" to="/privacy">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 flex shrink-0 flex-col gap-2 sm:flex-row md:mt-0">
        <button type="button" className="btn-primary" onClick={acceptAll}>
          Accept cookies
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={openPreferences}
        >
          Choose options
        </button>
      </div>
    </aside>
  );
}
