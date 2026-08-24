// src/pages/LandingPage.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f5ebe0] text-[#1c0d06]">
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d4a373]/40 bg-[#f5ebe0]/90 px-6 py-4 backdrop-blur-sm md:px-12">
        <span className="text-lg font-bold tracking-tight">UniLogs</span>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" className="text-[#1c0d06] hover:bg-[#e6c687]/30">
              Sign in
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-24 pb-24 text-center md:pt-32 md:pb-32">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#b8860b]">
          Every hour has a story. Start telling yours.
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          The logbook that
          <span className="block text-[#b8860b]">finally follows you everywhere</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[#4a3525]">
          Paper forgets you the moment you close it. UniLogs is on your phone and your laptop,
          wherever the work actually happens.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup">
            <Button className="w-full bg-[#1c0d06] px-8 py-6 text-base text-[#f5ebe0] hover:opacity-90 sm:w-auto">
              Start logging for free
            </Button>
          </Link>
          <Link to="/login">
            <Button
              variant="outline"
              className="w-full border-[#1c0d06] px-8 py-6 text-base text-[#1c0d06] hover:bg-[#e6c687]/30 sm:w-auto"
            >
              I have an account
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#d4a373]/40 bg-white/50 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            Built for how you actually work
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<PencilIcon />}
              title="Your projects, your way"
              description="Split your work into projects like coursework, gym, or reading, and keep each one's entries where they belong."
            />
            <FeatureCard
              icon={<BoltIcon />}
              title="Three seconds, not three excuses"
              description="If logging takes a minute, you won't do it. So here, it doesn't."
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Everywhere you are"
              description="One account, every device. Log in on your phone or your laptop and pick up right where you left off."
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 py-20 text-center md:py-24">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          The paper book failed because it wasn't there.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[#4a3525]">This one always is.</p>
        <Link to="/signup">
          <Button className="mt-7 bg-[#1c0d06] px-8 py-6 text-base text-[#f5ebe0] hover:opacity-90">
            Create your logbook
          </Button>
        </Link>
      </section>

      <footer className="border-t border-[#d4a373]/40 px-6 py-6 text-center text-sm text-[#7a5230]">
        © 2026 UniLogs, built by Code of Duty
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#d4a373]/40 bg-[#f5ebe0] p-6 text-left">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1c0d06] text-[#e6c687]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[#4a3525]">{description}</p>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}
