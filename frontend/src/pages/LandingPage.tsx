// src/pages/LandingPage.tsx
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { QUERY_KEYS, loadSummary } from '@/lib/dashboard';

// Figma "Landing": an open notebook page. Ruled paper with a double margin
// rule, a Lora masthead with the datestamp + streak, handwritten (Caveat)
// asides and three dated "journal entries" instead of feature cards.

const PRIMARY =
  'inline-flex min-h-10 items-center justify-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-paper transition-opacity hover:opacity-90 md:min-h-12';
const SECONDARY =
  'inline-flex min-h-10 items-center justify-center rounded-xl border border-caramel px-4 text-[13px] font-medium text-cocoa transition-colors hover:bg-gold-light/30 md:min-h-12';

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

// The masthead's streak, for a signed-in visitor (same query as the
// dashboard). Signed-out visitors have no streak, so it's left out.
function useStreak(): number | null {
  const session = useSession();
  const signedIn = !!session.data?.user;
  const summary = useQuery({
    queryKey: QUERY_KEYS.summary,
    queryFn: loadSummary,
    enabled: signedIn,
  });
  return signedIn && summary.data && summary.data.streak > 0 ? summary.data.streak : null;
}

function MastheadDetails({ date, streak }: { date: string; streak: number | null }) {
  return (
    <span className="flex items-center gap-3 text-[9px] font-medium text-cocoa md:gap-5 md:text-[13px]">
      <span>{date}</span>
      {streak !== null && (
        <span className="inline-flex items-center gap-1 md:gap-1.5">
          <Flame className="size-2.5 md:size-3.5" strokeWidth={2} aria-hidden />
          {streak}-day streak
        </span>
      )}
    </span>
  );
}

export default function LandingPage() {
  const today = todayLabel();
  const streak = useStreak();

  return (
    <main className="paper-ruled min-h-screen text-espresso">
      {/* One frame per Figma breakpoint. Desktop (1440): 72px sides, the
          double margin rule at x 91 / 95 runs behind the wordmark, content
          at x 137. Mobile (390): rule at x 35 / 39, content at x 47. */}
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 md:px-[72px]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[35px] w-px bg-clay/40 md:left-[91px] md:bg-clay/35"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[39px] w-px bg-clay/15 md:left-[95px] md:bg-clay/35"
        />

        {/* Masthead */}
        <header className="relative flex flex-col gap-1 pt-3.5 md:flex-row md:items-center md:justify-between md:gap-3 md:pt-[22px]">
          <div className="flex items-center justify-between gap-2.5 pl-[31px] md:justify-start md:pl-0">
            <span className="font-lora text-2xl font-bold tracking-[-0.03em] md:text-[30px]">
              UniLogs
            </span>
            <span className="hidden text-[11px] tracking-[0.14em] text-clay uppercase md:inline">
              Open logbook
            </span>
            <span className="md:hidden">
              <MastheadDetails date={today.short} streak={streak} />
            </span>
          </div>
          <div className="flex items-center justify-end gap-5">
            <span className="hidden md:inline">
              <MastheadDetails date={today.short} streak={streak} />
            </span>
            <nav className="flex items-center gap-2">
              <Link
                to="/login"
                className="inline-flex min-h-9 items-center rounded-xl px-3.5 text-[13px] font-medium text-cocoa hover:bg-gold-light/30 md:min-h-11 md:px-4"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex min-h-9 items-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-paper hover:opacity-90 md:min-h-11"
              >
                Get started
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero entry */}
        <section className="relative pt-2 pl-[31px] md:pt-[43px] md:pr-20 md:pl-[65px]">
          <div className="absolute top-[43px] right-20 hidden text-right md:block">
            <p className="text-[11px] font-semibold tracking-[0.13em] text-clay uppercase">
              Entry 001
            </p>
            <span className="mt-2 ml-auto block h-0.5 w-[52px] bg-gold" aria-hidden />
            <p className="mt-2 font-script text-lg text-cocoa">{today.long}</p>
          </div>
          <div className="flex max-w-[870px] flex-col gap-2.5 md:gap-[18px]">
            <p className="font-script text-base text-clay md:text-[23px]">
              Every hour has a story. Start telling yours.
            </p>
            <h1 className="font-lora text-[31px] leading-[1.1] font-semibold tracking-[-0.03em] md:max-w-[620px] md:text-[54px] md:leading-[54px]">
              The logbook that <span className="text-gold">finally follows you everywhere</span>
            </h1>
            <p className="max-w-[700px] text-xs leading-[1.5] text-cocoa md:text-[17px] md:leading-[1.55]">
              Paper forgets you the moment you close it. UniLogs is on your phone and your laptop,
              wherever the work actually happens.
            </p>
            <div className="mt-1 flex flex-wrap gap-2 md:mt-0 md:gap-2.5">
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
          className="relative mt-4 grid pl-[31px] md:mt-[80px] md:grid-cols-3 md:gap-[26px] md:pr-2 md:pl-16"
        >
          {ENTRIES.map((entry, index) => (
            <article
              key={entry.day}
              className={`flex flex-col gap-1.5 p-3 ${
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
        <section className="relative mt-4 flex flex-col gap-3 pl-[31px] md:mt-[104px] md:flex-row md:items-start md:justify-between md:gap-4 md:pr-2 md:pl-16">
          <div className="flex flex-col gap-0.5">
            <p className="font-script text-lg leading-[1.2] text-clay md:text-[27px]">
              The paper book failed because it wasn&apos;t there.
            </p>
            <p className="font-lora text-xl font-semibold italic md:text-[28px]">
              This one always is.
            </p>
          </div>
          <Link to="/signup" className={`${PRIMARY} self-start`}>
            Create your logbook
          </Link>
        </section>

        <footer className="relative mt-auto flex flex-wrap items-center justify-between gap-3 pt-10 pb-6 pl-[31px] text-[9.5px] tracking-[0.02em] text-clay md:pt-16 md:pb-8 md:pl-16 md:text-[11px]">
          <span>© 2026 UniLogs, built by Code of Duty</span>
          <Link to="/privacy" className="underline underline-offset-2 hover:text-espresso">
            Privacy Policy
          </Link>
        </footer>
      </div>
    </main>
  );
}
