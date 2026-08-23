import React, { useState } from 'react';

export const ResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <header className="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-[#1c0d06] p-8 text-[#f5ebe0] md:min-h-screen md:w-[35%]">
        <span className="absolute left-3 right-3 top-6 border-t-2 border-[#d4af37] md:left-4 md:right-4 md:top-8" />
        <span className="absolute left-3 right-3 bottom-6 border-b-2 border-[#d4af37] md:left-4 md:right-4 md:bottom-8" />
        <span className="absolute top-3 bottom-3 left-6 border-l-2 border-[#d4af37] md:top-4 md:bottom-4 md:left-8" />
        <span className="absolute top-3 bottom-3 right-6 border-r-2 border-[#d4af37] md:top-4 md:bottom-4 md:right-8" />

        <article className="z-10 flex flex-col items-center justify-center p-4 text-center max-w-xs">
          <img src="/logo.svg" alt="Company Logo" className="h-14 w-auto mb-4 md:h-20" />
          <p className="text-base font-medium tracking-wide text-[#e6c687] md:text-xl">
            Time wasted, never regained!
          </p>
        </article>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center bg-[#f5ebe0] p-6 text-[#1c0d06] md:w-[65%] md:p-12">
        <article className="w-full max-w-sm">
          {!isSubmitted ? (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <h2 className="text-3xl font-bold tracking-tight text-center md:text-left md:text-4xl">
                Reset password
              </h2>
              <p className="text-sm text-[#7a5230]">
                Enter the email address associated with your account and we&apos;ll send you a link
                to reset your password.
              </p>

              <label htmlFor="reset-email" className="text-sm font-semibold mt-2">
                Email address<span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-md border border-[#d4a373] bg-white p-3 text-slate-900 outline-none focus:ring-2 focus:ring-[#1c0d06]"
              />

              <button
                type="submit"
                className="mt-2 w-full rounded-md bg-[#1c0d06] p-3 font-semibold text-[#f5ebe0] transition-opacity hover:opacity-90 cursor-pointer"
              >
                Send Reset Link
              </button>

              <p className="mt-2 text-center text-sm text-[#4a3525]">
                Return back to sign in{' '}
                <a
                  href="/login"
                  className="font-semibold text-[#1c0d06] underline hover:text-[#b8860b]"
                >
                  Sign In
                </a>
              </p>
            </form>
          ) : (
            <section className="flex flex-col gap-4 text-center md:text-left">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Check your email</h2>
              <p className="text-sm text-[#7a5230]">
                We sent a password reset link to{' '}
                <span className="font-semibold text-[#1c0d06]">{email}</span>.
              </p>
              <a
                href="/login"
                className="mt-4 block w-full rounded-md bg-[#1c0d06] p-3 text-center font-semibold text-[#f5ebe0] transition-opacity hover:opacity-90"
              >
                Return to Sign In
              </a>
            </section>
          )}
        </article>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
