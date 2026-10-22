import { Link } from 'react-router-dom';

const sections = [
  { id: 'acceptance', label: 'Accepting these terms' },
  { id: 'account', label: 'Your account' },
  { id: 'content', label: 'Your content' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'sharing', label: 'Shared reports' },
  { id: 'calendar', label: 'Google Calendar integration' },
  { id: 'availability', label: 'Availability and changes' },
  { id: 'liability', label: 'Disclaimers and liability' },
  { id: 'termination', label: 'Ending your use' },
  { id: 'contact', label: 'Contact us' },
];

export default function TermsOfServicePage() {
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
            Terms of service
          </p>

          <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-end">
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Your logbook.
                <br />
                <span className="font-normal text-[#a36d43]">Fair rules for using it.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-[#725b49] md:text-lg md:leading-8">
                These Terms of Service set out the rules for using UniLogs, our digital logbook
                application, and what you can expect from us in return.
              </p>
            </div>

            <div className="border-l-2 border-[#c69a72] py-1 pl-5">
              <p className="text-xs uppercase tracking-[0.15em] text-[#96775e]">Last updated</p>
              <p className="mt-2 text-sm font-medium">22 October 2026</p>
              <p className="mt-2 text-sm leading-6 text-[#725b49]">
                Please read these terms before creating an account or using UniLogs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Terms content */}
      <section className="border-t border-[#e9dfd2] bg-[#f7f0e6] px-6 py-12 md:px-10 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[240px_minmax(0,1fr)] md:gap-16">
          {/* Contents */}
          <aside className="md:sticky md:top-8 md:self-start">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#96775e]">
              On this page
            </p>

            <nav aria-label="Terms of service contents">
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

          {/* Main terms */}
          <article className="min-w-0 rounded-xl border border-[#e9dfd2] bg-[#fffcf7] px-6 py-8 md:px-10 md:py-10">
            <p className="mb-8 text-sm leading-7 text-[#725b49]">
              UniLogs is a digital logbook application built by Team Code of Duty as a student
              project at the University of the Witwatersrand. In these terms, “we” and “our” refer
              to the UniLogs project team, and “you” refers to a person using the application.
            </p>

            <section id="acceptance" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">01. Accepting these terms</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                By creating an account or using UniLogs, you agree to these terms and to our{' '}
                <Link
                  to="/privacy"
                  className="text-[#a36d43] underline underline-offset-4 hover:text-[#2a190f]"
                >
                  Privacy Policy
                </Link>
                , which explains how your information is handled. If you do not agree, please do not
                use the application.
              </p>
            </section>

            <section id="account" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">02. Your account</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#725b49]">
                <li>Provide accurate information when you sign up and keep it up to date.</li>
                <li>
                  Keep your password secure and do not share your account. You are responsible for
                  activity that takes place under it.
                </li>
                <li>Let us know promptly if you believe someone else has accessed your account.</li>
              </ul>
            </section>

            <section id="content" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">03. Your content</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                The projects, logbook entries, and other material you add to UniLogs remain yours.
                You allow us to store, process, and display that content only as needed to run the
                features you use.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                You are responsible for what you record, including making sure you have the right to
                add it and that it follows any rules set by your university or course. Keep your own
                copies of anything you cannot afford to lose.
              </p>
            </section>

            <section id="acceptable-use" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">04. Acceptable use</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                When using UniLogs, you agree not to:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#725b49]">
                <li>Break the law or infringe anyone else&apos;s rights.</li>
                <li>Upload content that is unlawful, abusive, or harmful.</li>
                <li>
                  Try to access accounts or data that are not yours, or probe, disrupt, or overload
                  the application.
                </li>
                <li>Use automated tools to scrape or misuse the service.</li>
              </ul>
            </section>

            <section id="sharing" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">05. Shared reports</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                UniLogs lets you create a link to a report of your logbook. Anyone who has that link
                can view the report without signing in. Only share links with people you trust, and
                revoke a link when it is no longer needed.
              </p>
            </section>

            <section id="calendar" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">06. Google Calendar integration</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                Connecting Google Calendar is optional. When you connect it, your use of
                Google&apos;s services is also governed by Google&apos;s own terms. You can
                disconnect the integration at any time.
              </p>
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm text-[#a36d43] underline underline-offset-4 hover:text-[#2a190f]"
              >
                Read Google&apos;s Terms of Service
              </a>
            </section>

            <section id="availability" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">07. Availability and changes</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                UniLogs is provided as a student project. We aim to keep it running smoothly, but we
                cannot promise that it will always be available, error free, or kept online
                indefinitely. Features may change or be removed over time.
              </p>
            </section>

            <section id="liability" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">08. Disclaimers and liability</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                UniLogs is provided “as is”, without warranties of any kind. To the extent permitted
                by law, the UniLogs team is not liable for any loss of data, marks, or other damage
                arising from your use of, or inability to use, the application.
              </p>
            </section>

            <section id="termination" className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">09. Ending your use</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                You may stop using UniLogs at any time and ask us to delete your account. We may
                suspend or close an account that breaks these terms or puts the application or other
                users at risk.
              </p>
            </section>

            <section className="scroll-mt-8 border-t border-[#e9dfd2] py-7">
              <h2 className="text-xl font-semibold">Changes to these terms</h2>
              <p className="mt-4 text-sm leading-7 text-[#725b49]">
                We may update these terms when UniLogs changes. The latest revision date will be
                displayed at the top of this page. Continuing to use UniLogs after an update means
                you accept the revised terms.
              </p>
            </section>

            <section id="contact" className="scroll-mt-8 border-t border-[#e9dfd2] pt-7">
              <div className="rounded-lg bg-[#f7f0e6] p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a36d43]">
                  Questions
                </p>
                <h2 className="mt-2 text-xl font-semibold">10. Contact us</h2>
                <p className="mt-3 text-sm leading-7 text-[#725b49]">
                  For questions about these terms, contact the UniLogs project team:
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
          <span>Terms of Service</span>
        </div>
      </footer>
    </main>
  );
}
