import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <article className="card mx-auto max-w-4xl p-5 md:p-8">
      <header className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-700">
        <h1 className="text-4xl font-bold text-text-main">Terms of Use</h1>
        <p className="mt-2 text-sm text-text-sub">
          Last updated: 15 November 2026
        </p>
      </header>

      <div className="grid gap-8 text-text-sub leading-relaxed">
        <LegalSection title="Using TaskFlow">
          <p>
            TaskFlow is a task-planning and productivity service. You must use it
            lawfully, provide accurate account information and keep your login
            credentials secure. You are responsible for activity performed using
            your account.
          </p>
        </LegalSection>

        <LegalSection title="Your content">
          <p>
            You retain ownership of the tasks and other content you add. You give
            us permission to host and process that content only as needed to
            provide, secure and improve TaskFlow and the features you choose to
            use.
          </p>
        </LegalSection>

        <LegalSection title="AI-assisted features">
          <p>
            AI suggestions may be incomplete or inaccurate and should be reviewed
            before you rely on them. When you choose an AI feature, relevant task
            details may be sent to the configured AI providers to produce the
            requested result.
          </p>
        </LegalSection>

        <LegalSection title="Availability and changes">
          <p>
            We may maintain, change or discontinue parts of TaskFlow. We aim to
            keep the service available, but do not guarantee uninterrupted or
            error-free operation. To the extent permitted by law, TaskFlow is
            provided without implied warranties and we are not liable for
            indirect or consequential loss.
          </p>
        </LegalSection>

        <LegalSection title="Privacy and cookies">
          <p>
            Our <Link className="text-link underline" to="/privacy">Privacy Policy</Link>{" "}
            explains how we process information, use required authentication
            cookies and run PostHog in cookieless mode unless you consent to
            analytics cookies. Analytics-cookie consent is optional and can be
            changed at any time.
          </p>
        </LegalSection>

        <LegalSection title="Ending use">
          <p>
            You may stop using TaskFlow at any time. We may restrict access where
            reasonably necessary to protect users, secure the service, comply
            with law or respond to a material breach of these terms.
          </p>
        </LegalSection>

        <LegalSection title="Contact us">
          <p>
            Questions about these terms can be sent through the{" "}
            <Link className="text-link underline" to="/contact">contact page</Link>.
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
