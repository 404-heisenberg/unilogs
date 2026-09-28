import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BackLink } from '@/lib/authFlow';

// Figma's auth screens: a dark journal "inside cover" and a ruled notebook
// page holding the form. The Sign in frames (also used for reset / verify)
// are Cormorant Garamond with a horizontal gold rule; the Sign up frames are
// Lora with a vertical gold rule and a cream wordmark. `back` adds a back
// link at the top of the page (not in Figma); each page picks where it goes
// from how the user arrived, see lib/authFlow.
export default function AuthLayout({
  children,
  variant = 'cormorant',
  back,
}: {
  children: ReactNode;
  variant?: 'cormorant' | 'lora';
  back?: BackLink;
}) {
  const signUp = variant === 'lora';

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <header className="relative overflow-hidden bg-espresso md:min-h-screen md:w-[35%]">
        {/* Cover sheen and spine shadow. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 via-transparent to-black/20"
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 hidden md:block ${
            signUp
              ? 'left-0 w-[22px] bg-espresso/70'
              : 'right-0 w-[18px] bg-linear-to-r from-transparent to-black/20'
          }`}
        />
        {back && (
          // Figma's Button/Secondary shape (outline, 12px radius, 48px,
          // DM Sans Medium 13) in the cover's gold, at the top of the cover
          // and left-aligned with the "UL / UniLogs" inscription (88px on
          // desktop; on mobile it sits above the inscription at its inset).
          <Link
            to={back.to}
            className={`relative z-10 mt-4 inline-flex h-12 items-center gap-2 rounded-xl border border-gold/50 px-4 font-sans text-[13px] font-medium text-gold transition-colors hover:border-gold hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold md:absolute md:top-6 md:left-[88px] md:m-0 ${
              signUp ? 'ml-5' : 'ml-6'
            }`}
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            {back.label}
          </Link>
        )}
        {signUp ? <SignUpCover /> : <SignInCover />}
      </header>
      <section className="paper-ruled relative flex flex-1 flex-col md:items-center md:justify-center">
        {signUp ? (
          // Binding shadow along the paper's left edge.
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-3.5 bg-espresso/8 md:block"
          />
        ) : (
          // Paper margin line.
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[18px] w-px bg-clay/15 md:left-[94px]"
          />
        )}
        <div
          className={`relative flex w-full flex-col items-stretch md:items-center md:p-12 ${
            signUp ? 'px-4 pt-3.5 pb-8' : 'px-6 pt-6 pb-8'
          }`}
        >
          {children}
        </div>
      </section>
    </main>
  );
}

function SignInCover() {
  return (
    <div className="relative flex font-cormorant text-gold md:h-full md:items-center md:px-[88px]">
      {/* Mobile: compact inscription. */}
      <div className="flex w-full flex-col px-6 pt-6 pb-8 md:hidden">
        <span aria-hidden className="block h-px w-full bg-gold" />
        <div className="mt-3 flex items-baseline justify-between">
          <p className="flex items-baseline gap-4 font-semibold">
            <span className="text-[34px] leading-none tracking-[-0.06em]">UL</span>
            <span className="text-[23px]">UniLogs</span>
          </p>
          <p className="text-xs text-gold/60 italic">Vol. 1</p>
        </div>
        <p className="mt-3 text-base italic">Time wasted, never regained!</p>
      </div>
      {/* Desktop: centred inscription. */}
      <div className="hidden w-full max-w-[328px] flex-col gap-6 md:flex">
        <span aria-hidden className="block h-px w-full bg-gold" />
        <div className="flex flex-col gap-1 font-semibold">
          <p className="text-[62px] leading-none tracking-[-0.06em]">UL</p>
          <p className="text-[32px] tracking-[0.02em]">UniLogs</p>
        </div>
        <p className="text-[23px] leading-[30px] italic">Time wasted, never regained!</p>
        <p className="text-sm tracking-[0.12em] text-gold/60 italic">Vol. 1</p>
      </div>
    </div>
  );
}

function SignUpCover() {
  return (
    <div className="relative font-lora text-gold md:flex md:h-full md:items-center">
      {/* Mobile: identity row, tagline, gold rule underneath. */}
      <div className="flex flex-col px-5 pt-[18px] pb-4 md:hidden">
        <div className="flex items-baseline justify-between">
          <p className="flex items-baseline gap-3">
            <span className="text-[26px] leading-none font-bold">UL</span>
            <span className="text-[22px] font-semibold text-cream">UniLogs</span>
          </p>
          <p className="text-[10px]">Vol. 1</p>
        </div>
        <p className="mt-4 text-[15px] italic">Time wasted, never regained!</p>
        <span aria-hidden className="mt-4 block h-px w-full bg-gold" />
      </div>
      {/* Desktop: a 520px column behind a vertical gold rule. */}
      <div className="relative ml-[52px] hidden h-[520px] border-l border-gold pl-[35px] md:flex md:flex-col md:justify-between">
        <div>
          <p className="text-[58px] leading-none font-bold">UL</p>
          <p className="mt-2 text-[32px] font-semibold text-cream">UniLogs</p>
        </div>
        <p className="text-[28px] leading-[38px] italic">
          Time wasted,
          <br />
          never regained!
        </p>
        <p className="text-xs tracking-[0.12em]">Vol. 1</p>
      </div>
    </div>
  );
}
