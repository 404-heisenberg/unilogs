// src/pages/LandingPage.tsx
import { Link } from 'react-router-dom';

// Figma "Landing": an open notebook page. Ruled paper with a double margin
// rule, a Lora masthead, handwritten (Caveat) asides and three dated
// "journal entries" instead of feature cards.

const PRIMARY =
  'inline-flex min-h-12 items-center justify-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-paper transition-opacity hover:opacity-90';
const SECONDARY =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-caramel px-4 text-[13px] font-medium text-cocoa transition-colors hover:bg-gold-light/30';

const ENTRIES = [
  {
    day: '1 Sep',
    title: 'Your projects, your way',
    body: "Split your work into projects like coursework, gym, or reading, and keep each one's entries where they belong.",
  },
  {
    day: '2 Sep',
    title: 'Three seconds, not three excuses',
    body: "If logging takes a minute, you won't do it. So here, it doesn't.",
  },
  {
    day: '3 Sep',
    title: 'Everywhere you are',
    body: 'One account, every device. Log in on your phone or your laptop and pick up right where you left off.',
  },
];

// Figma: "Sat · 12 Sep" and "12 September" (en-GB would give "Sept").
function todayLabel() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const monthLong = now.toLocaleDateString('en-US', { month: 'long' });
  return {
    short: `${weekday} · ${now.getDate()} ${month}`,
    long: `${now.getDate()} ${monthLong}`,
  };
}

export default function LandingPage() {
  const today = todayLabel();

  return (
    <main className="paper-ruled min-h-screen text-espresso">
      {/* One 1440px frame, as in Figma: 72px sides, the wordmark sits in the
          margin with the double rule (x 91 / 95) running behind it, and the
          content starts at x 137. */}
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 md:px-[72px]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[91px] hidden w-px bg-clay/35 md:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[95px] hidden w-px bg-clay/35 md:block"
        />
        {/* Masthead */}
        <header className="relative flex flex-col gap-3 pt-5 md:flex-row md:items-center md:justify-between md:pt-[22px]">
          <div className="flex items-baseline justify-between gap-2.5 md:justify-start">
            <span className="font-lora text-[26px] font-bold tracking-[-0.03em] md:text-[30px]">
              UniLogs
            </span>
            <span className="hidden text-[11px] tracking-[0.14em] text-clay uppercase md:inline">
              Open logbook
            </span>
            <span className="text-xs font-medium text-cocoa md:hidden">{today.short}</span>
          </div>
          <div className="flex items-center justify-end gap-5">
            <span className="hidden text-[13px] font-medium text-cocoa md:inline">
              {today.short}
            </span>
            <nav className="flex items-center gap-2">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center rounded-xl px-4 text-[13px] font-medium text-cocoa hover:bg-gold-light/30"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex min-h-11 items-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-paper hover:opacity-90"
              >
                Get started
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero entry */}
        <section className="relative pt-6 md:pt-[43px] md:pr-20 md:pl-[65px]">
          <div className="absolute top-[43px] right-20 hidden text-right md:block">
            <p className="text-[11px] font-semibold tracking-[0.13em] text-clay uppercase">
              Entry 001
            </p>
            <span className="mt-2 ml-auto block h-0.5 w-[52px] bg-gold" aria-hidden />
            <p className="mt-2 font-script text-lg text-cocoa">{today.long}</p>
          </div>
          <div className="flex max-w-[870px] flex-col gap-[18px]">
            <p className="font-script text-xl text-clay md:text-[23px]">
              Every hour has a story. Start telling yours.
            </p>
            <h1 className="font-lora text-[38px] leading-[1.05] font-semibold tracking-[-0.03em] md:max-w-[620px] md:text-[54px] md:leading-[54px]">
              The logbook that <span className="text-gold">finally follows you everywhere</span>
            </h1>
            <p className="max-w-[700px] text-[15px] leading-[1.55] text-cocoa md:text-[17px]">
              Paper forgets you the moment you close it. UniLogs is on your phone and your laptop,
              wherever the work actually happens.
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link to="/signup" className={PRIMARY}>
                Start logging for free
              </Link>
              <Link to="/login" className={SECONDARY}>
                I have an account
              </Link>
            </div>
          </div>
        </section>

        {/* Journal entries */}
        <section
          aria-label="Why UniLogs"
          className="relative mt-10 grid gap-6 md:mt-[80px] md:grid-cols-3 md:gap-[26px] md:pr-2 md:pl-16"
        >
          {ENTRIES.map((entry, index) => (
            <article
              key={entry.day}
              className={`flex flex-col gap-1.5 py-3 md:px-3 ${
                index < ENTRIES.length - 1 ? 'md:border-r md:border-line-strong/60' : ''
              }`}
            >
              <p className="text-[13px] font-medium text-clay">{entry.day}</p>
              <h2 className="font-lora text-[17px] text-espresso">{entry.title}</h2>
              <p className="text-xs text-cocoa">{entry.body}</p>
            </article>
          ))}
        </section>

        {/* Closing note */}
        <section className="relative mt-12 flex flex-col gap-4 md:mt-[104px] md:flex-row md:items-start md:justify-between md:pr-2 md:pl-16">
          <div className="flex flex-col gap-0.5">
            <p className="font-script text-xl leading-[1.2] text-clay md:text-[27px]">
              The paper book failed because it wasn&apos;t there.
            </p>
            <p className="font-lora text-2xl font-semibold italic md:text-[28px]">
              This one always is.
            </p>
          </div>
          <Link to="/signup" className={`${PRIMARY} self-start`}>
            Create your logbook
          </Link>
        </section>

        <footer className="mt-auto pt-16 pb-8 text-[11px] tracking-[0.02em] text-clay md:pl-16">
          © 2026 UniLogs, built by Code of Duty
        </footer>
      </div>
    </main>
  );
}
