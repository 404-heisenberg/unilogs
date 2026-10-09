import { Link } from 'react-router-dom';

const sections = [
  { id: 'information', label: 'Information we collect' },
  { id: 'use', label: 'How we use information' },
  { id: 'calendar', label: 'Google Calendar integration' },
  { id: 'sharing', label: 'Storage and sharing' },
  { id: 'retention', label: 'Retention and deletion' },
  { id: 'rights', label: 'Your privacy rights' },
  { id: 'security', label: 'Security' },
  { id: 'contact', label: 'Contact us' },
];

export default function PrivacyPolicyPage() {
  const supportEmails = ['ozukomabongo955@gmail.com', 'mokoatledikeledi4@gmail.com'];

  return (
    <main className="min-h-screen bg-[#fffcf7] text-[#2a190f]">
      {/* Header */}
      <header className="border-b border-[#e9dfd2]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10">
          <Link to="/" className="text-xl font-bold tracking-tight text-[#2a190f]">
            UniLogs<span className="text-[#a36d43]">.</span>
          </Link>

          <Link to="/" className="text-sm text-[#79583f] transition hover:text-[#2a190f]">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Introduction */}
      <section className="px-6 pb-12 pt-14 md:px-10 md:pb-16 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#a36d43]">
            Privacy &amp; data protection
          </p>

          <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-end">
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Your work matters.
                <br />
                <span className="font-normal text-[#a36d43]">So does your privacy.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-[#725b49] md:text-lg md:leading-8">
                This Privacy Policy explains how UniLogs collects, uses, stores, and protects
                information when you use our digital logbook application, including when you connect
                your Google Calendar.
              </p>
            </div>

            <div className="border-l-2 border-[#c69a72] py-1 pl-5">
              <p className="text-xs uppercase tracking-[0.15em] text-[#96775e]">Last updated</p>
              <p className="mt-2 text-sm font-medium">9 October 2026</p>
              <p className="mt-2 text-sm leading-6 text-[#725b49]">
                Please read this policy to understand how your information is handled when using
                UniLogs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Policy content */}
      <section className="border-t border-[#e9dfd2] bg-[#f7f0e6] px-6 py-12 md:px-10 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[240px_minmax(0,1fr)] md:gap-16">
          {/* Contents */}
          <aside className="md:sticky md:top-8 md:self-start">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#96775e]">
              On this page
            </p>

            <nav aria-label="Privacy policy contents">
              <ul className="space-y-1">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-3 rounded-md px-3 py-2.5 text-sm text-[#725b49] transition hover:bg-[#eee2d3] hover:text-[#2a190f]"
                    >
                      <span className="text-[#b18a67]">{String(index + 1).padStart(2, '0')}</span>
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main policy */}
          <article className="min-w-0 rounded-xl border border-[#e9dfd2] bg-[#fffcf7] px-6 py-8 md:px-10 md:py-10">
            <p className="mb-8 text-sm leading-7 text-[#725b49]">
              UniLogs is a digital logbook application designed to help users manage projects,
              record logbook entries, and organise related academic activities. In this policy, “we”
              and “our” refer to the UniLogs project team, and “you” refers to a person using the
              application.
            </p>

            <section id="information" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">01. Information we collect</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                The information processed by UniLogs depends on how you use the application. It may
                include:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#725b49]">
                <li>
                  <strong className="text-[#2a190f]">Account information:</strong> details used to
                  create, authenticate, and manage your account.
                </li>
                <li>
                  <strong className="text-[#2a190f]">Project and logbook data:</strong> project
                  details, logbook entries, field values, and other information you submit through
                  UniLogs.
                </li>
                <li>
                  <strong className="text-[#2a190f]">Calendar information:</strong> information made
                  available through Google Calendar when you choose to connect your account.
                </li>
                <li>
                  <strong className="text-[#2a190f]">Technical information:</strong> information
                  processed as necessary to authenticate users, maintain application functionality,
                  protect security, and troubleshoot errors.
                </li>
              </ul>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We do not intend for you to submit sensitive personal information unless a feature
                specifically requires it.
              </p>
            </section>

            <section id="use" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">02. How we use information</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We use information, as applicable, to:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#725b49]">
                <li>Provide and maintain UniLogs features.</li>
                <li>Display and manage your projects and logbook entries.</li>
                <li>Provide calendar-related features you choose to use.</li>
                <li>Authenticate accounts and help protect the application.</li>
                <li>Investigate errors and improve reliability.</li>
                <li>Respond to support requests and meet applicable legal obligations.</li>
              </ul>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We do not sell your personal information.
              </p>
            </section>

            <section id="calendar" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">03. Google Calendar integration</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                If you choose to connect Google Calendar, Google asks you to authorise UniLogs to
                access the calendar information covered by the permissions displayed during consent.
                UniLogs requests read-only calendar access to support its calendar-related features.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                This permission does not allow UniLogs to create, edit, or delete your Google
                Calendar events. Calendar information accessed through the integration is used to
                provide the features you request, not for advertising.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                Google processes information in accordance with its own privacy policy. You can
                revoke UniLogs' access through your Google Account's third-party connections
                settings. You can also disconnect the integration through UniLogs settings where
                that feature is available.
              </p>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm text-[#a36d43] underline underline-offset-4 hover:text-[#2a190f]"
              >
                Read Google's Privacy Policy
              </a>
            </section>

            <section id="sharing" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">04. Storage and sharing</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                UniLogs relies on technical service providers to operate the application, which may
                include services for hosting, databases, authentication, and integrations.
                Information may be processed by these providers only as necessary for the services
                they support.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We do not sell personal information. Information may also be disclosed when required
                by law, necessary to address security issues, or needed to protect the rights and
                safety of users and the project.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                Information may be processed or stored in locations outside your country, depending
                on the infrastructure providers used by the application.
              </p>
            </section>

            <section id="retention" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">05. Retention and deletion</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                Information is retained for as long as reasonably necessary to provide the
                application, maintain its security, resolve disputes, and meet applicable legal
                requirements. Actual retention periods depend on the type of information and how it
                is used.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                You may request access to, correction of, or deletion of your personal information
                by contacting the UniLogs team. Some information may need to be retained where
                required by law or for legitimate security purposes. Disconnecting Google Calendar
                revokes future access once the revocation takes effect, but does not necessarily
                delete information already stored by UniLogs.
              </p>
            </section>

            <section id="rights" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">06. Your privacy rights</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                Depending on applicable law, you may have the right to request access to your
                personal information, ask for inaccurate information to be corrected, request
                deletion, or object to certain processing. If you are in South Africa, rights under
                the Protection of Personal Information Act (POPIA) may apply.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                To make a request, contact the UniLogs team using the contact details provided
                below. We may need to verify your identity before responding.
              </p>
            </section>

            <section id="security" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">07. Security</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We use technical and organisational measures intended to protect information against
                unauthorised access, loss, misuse, or alteration. However, no online service or
                method of electronic storage can be guaranteed to be completely secure.
              </p>
            </section>

            <section className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">Changes to this policy</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We may update this policy when UniLogs or its data practices change. The latest
                revision date will be displayed at the top of this page. We encourage users to
                review the policy periodically.
              </p>
            </section>

            <section id="contact" className="scroll-mt-8 border-t border-[#e9dfd2] pt-7">
              <div className="rounded-lg bg-[#f7f0e6] p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a36d43]">
                  Questions or requests
                </p>
                <h2 className="mt-2 text-xl font-semibold">08. Contact us</h2>
                <p className="mt-3 text-sm leading-7 text-[#725b49]">
                  For questions about this policy, your personal information, or a data access or
                  deletion request, contact the UniLogs project team:
                </p>
                <div className="mt-4 space-y-2 text-sm font-medium text-[#2a190f]">
                  {supportEmails.map((email) => (
                    <p key={email} className="break-words">
                      <a
                        href={`mailto:${email}`}
                        className="underline underline-offset-4 hover:text-[#a36d43]"
                      >
                        {email}
                      </a>
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-[#96775e]">
                  For privacy requests, use “UniLogs Privacy Request” as the email subject.
                </p>
              </div>
            </section>

            <div className="mt-10 border-t border-[#e9dfd2] pt-6">
              <Link
                to="/"
                className="text-sm font-medium text-[#a36d43] underline underline-offset-4 transition hover:text-[#2a190f]"
              >
                ← Return to UniLogs
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e9dfd2] px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-[#96775e]">
          <span>© 2026 UniLogs · Code of Duty</span>
          <span>Privacy Policy</span>
        </div>
      </footer>
    </main>
  );
}
