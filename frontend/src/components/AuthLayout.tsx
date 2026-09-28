import type { ReactNode } from 'react';

// Figma's auth screens: a dark journal "inside cover" on the left and a
// ruled notebook page holding the form. Login-style pages use Cormorant
// Garamond; the sign-up frame uses Lora, so `variant` picks the face.
export default function AuthLayout({
  children,
  variant = 'cormorant',
}: {
  children: ReactNode;
  variant?: 'cormorant' | 'lora';
}) {
  const serif = variant === 'lora' ? 'font-lora' : 'font-cormorant';

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <header className="relative flex min-h-[220px] items-center overflow-hidden bg-espresso px-8 py-10 md:min-h-screen md:w-[35%] md:px-[88px]">
        {/* Cover sheen and spine shadow. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 via-transparent to-black/20"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[18px] bg-linear-to-r from-transparent to-black/20 md:block"
        />
        <div className={`relative flex w-full max-w-[328px] flex-col gap-4 md:gap-6 ${serif}`}>
          <span aria-hidden className="block h-px w-full bg-gold" />
          <div className="flex flex-col gap-1">
            <p className="text-[44px] leading-none font-semibold tracking-[-0.06em] text-gold md:text-[62px]">
              UL
            </p>
            <p
              className={`text-2xl font-semibold tracking-[0.02em] md:text-[32px] ${
                variant === 'lora' ? 'text-cream' : 'text-gold'
              }`}
            >
              UniLogs
            </p>
          </div>
          <p className="text-lg text-gold italic md:text-[23px] md:leading-[30px]">
            Time wasted, never regained!
          </p>
          <p className="hidden text-sm tracking-[0.12em] text-gold/60 italic md:block">Vol. 1</p>
        </div>
      </header>
      <section className="paper-ruled flex flex-1 flex-col items-center justify-center p-6 text-espresso md:p-12">
        {children}
      </section>
    </main>
  );
}
