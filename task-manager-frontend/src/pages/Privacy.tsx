import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <article className="card mx-auto max-w-4xl p-5 md:p-8">
      <header className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-700">
        <h1 className="text-4xl font-bold text-text-main">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-sub">
          Last updated: 15 November 2026
        </p>
      </header>

      <div className="grid gap-8 text-text-sub leading-relaxed">
        <LegalSection title="Information we use">
          <p>
            TaskFlow processes the account details and task information you
            provide so it can deliver the service. When you contact us, we also
            process the information in your message so we can respond.
          </p>
        </LegalSection>

        <LegalSection title="Required storage">
          <p>
            We use secure, HTTP-only authentication cookies to keep signed-in
            users authenticated. We also save your cookie preferences in your
            browser&apos;s local storage so we do not ask on every visit. This
            storage is required to provide the choices you request and cannot be
            disabled through the cookie controls.
          </p>
        </LegalSection>

        <LegalSection title="Product analytics and PostHog">
          <p>
            We use PostHog, hosted in the EU, to understand which TaskFlow
            features are used and to improve the product. We send named product
            events such as page views, task creation and feature use. We do not
            send task titles, descriptions, search text, email addresses or
            names. Signed-in users may be identified using their internal user
            ID only; demo users are not identified. Autocapture and session
            recording are disabled.
          </p>
          <p>
            Before you allow analytics cookies, or whenever you turn them off,
            PostHog operates in cookieless mode. It does not store an analytics
            identifier in cookies, local storage or session storage. PostHog
            processes the IP address, user agent and hostname to create a
            privacy-preserving identifier that changes daily, then removes the
            source IP from the analytics event.
          </p>
          <p>
            If you allow analytics cookies, PostHog stores identifiers in a
            cookie and local storage so activity can be connected across visits.
            You can withdraw consent at any time from Settings or the Cookie
            settings link in the footer. Withdrawing consent removes PostHog&apos;s
            browser persistence and returns analytics to cookieless mode.
          </p>
        </LegalSection>

        <LegalSection title="Sharing and retention">
          <p>
            We use service providers only where needed to operate TaskFlow,
            including hosting, authentication, AI features you choose to use and
            PostHog analytics. Those providers process information on our behalf
            under their own security and retention controls. We retain account
            and task data while your account is active and as reasonably needed
            to operate, secure and meet legal obligations for the service.
          </p>
        </LegalSection>

        <LegalSection title="Your choices and rights">
          <p>
            You can change analytics-cookie consent at any time, export task data
            from Settings, and contact us to ask about access, correction or
            deletion of your personal information. Rights vary by location.
          </p>
        </LegalSection>

        <LegalSection title="Contact us">
          <p>
            Use the <Link className="text-link underline" to="/contact">contact page</Link>{" "}
            for privacy questions or requests.
          </p>
        </LegalSection>
      </div>
    </article>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-2xl font-bold text-text-main">{title}</h2>
      {children}
    </section>
  );
}
