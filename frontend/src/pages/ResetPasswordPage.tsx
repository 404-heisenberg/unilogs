import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getEmailError } from '@/lib/validation';

const RequestResetForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const forgotPassword = useMutation({
    mutationFn: (input: { email: string }) =>
      api.post<{ message: string; token?: string; url?: string }>(
        '/api/auth/forgot-password',
        input,
      ),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const error = getEmailError(email);
    setEmailError(error);
    if (error) return;
    forgotPassword.mutate({ email });
  };

  if (forgotPassword.isSuccess) {
    const resetUrl = forgotPassword.data.url;
    return (
      <section className="flex flex-col gap-4 text-center md:text-left">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Request received</h2>
        <p className="text-sm text-clay">
          If an account exists for <span className="font-semibold text-espresso">{email}</span>, a
          password reset link has been generated.
        </p>
        {resetUrl && (
          <p className="text-sm text-clay">
            This environment doesn&apos;t send real emails, so here&apos;s the link directly:{' '}
            <a
              href={resetUrl}
              className="break-all font-semibold text-espresso underline hover:text-gold"
            >
              {resetUrl}
            </a>
          </p>
        )}
        <a
          href="/login"
          className="mt-4 block w-full rounded-md bg-espresso p-3 text-center font-semibold text-cream transition-opacity hover:opacity-90"
        >
          Return to Sign In
        </a>
      </section>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="text-3xl font-bold tracking-tight text-center md:text-left md:text-4xl">
        Reset password
      </h2>
      <p className="text-sm text-clay">
        Enter the email address associated with your account and we&apos;ll send you a link to reset
        your password.
      </p>

      <label htmlFor="reset-email" className="text-sm font-semibold mt-2">
        Email address<span className="text-error ml-0.5">*</span>
      </label>
      <input
        id="reset-email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError(null);
        }}
        onBlur={() => setEmailError(getEmailError(email))}
        placeholder="name@example.com"
        required
        className={`w-full rounded-md border bg-white p-3 text-slate-900 outline-none focus:ring-2 ${
          emailError ? 'border-error focus:ring-error' : 'border-caramel focus:ring-espresso'
        }`}
      />
      {emailError && <p className="text-xs text-error">{emailError}</p>}

      {forgotPassword.isError && (
        <p className="text-sm text-error">{forgotPassword.error.message}</p>
      )}

      <button
        type="submit"
        disabled={forgotPassword.isPending}
        className="mt-2 w-full rounded-md bg-espresso p-3 font-semibold text-cream transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
      >
        {forgotPassword.isPending ? 'Sending…' : 'Send Reset Link'}
      </button>

      <p className="mt-2 text-center text-sm text-cocoa">
        Return back to sign in{' '}
        <a
          href="/login"
          className="inline-block -my-3 -mx-2 px-2 py-3 font-semibold text-espresso underline hover:text-gold"
        >
          Sign In
        </a>
      </p>
    </form>
  );
};

const SetNewPasswordForm: React.FC<{ token: string }> = ({ token }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  const resetPassword = useMutation({
    mutationFn: (input: { token: string; newPassword: string }) =>
      api.post<{ message: string }>('/api/auth/reset-password', input),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatchError('Passwords do not match.');
      return;
    }
    setMismatchError(null);
    resetPassword.mutate({ token, newPassword });
  };

  if (resetPassword.isSuccess) {
    return (
      <section className="flex flex-col gap-4 text-center md:text-left">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Password updated</h2>
        <p className="text-sm text-clay">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <a
          href="/login"
          className="mt-4 block w-full rounded-md bg-espresso p-3 text-center font-semibold text-cream transition-opacity hover:opacity-90"
        >
          Return to Sign In
        </a>
      </section>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="text-3xl font-bold tracking-tight text-center md:text-left md:text-4xl">
        Set a new password
      </h2>
      <p className="text-sm text-clay">Choose a new password for your account.</p>

      <label htmlFor="new-password" className="text-sm font-semibold mt-2">
        New password<span className="text-error ml-0.5">*</span>
      </label>
      <input
        id="new-password"
        type="password"
        placeholder="••••••••"
        required
        value={newPassword}
        onChange={(e) => {
          setNewPassword(e.target.value);
          setMismatchError(null);
        }}
        className="w-full rounded-md border border-caramel bg-white p-3 text-slate-900 outline-none focus:ring-2 focus:ring-espresso"
      />

      <label htmlFor="confirm-new-password" className="text-sm font-semibold">
        Confirm new password<span className="text-error ml-0.5">*</span>
      </label>
      <input
        id="confirm-new-password"
        type="password"
        placeholder="••••••••"
        required
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          setMismatchError(null);
        }}
        className={`w-full rounded-md border bg-white p-3 text-slate-900 outline-none focus:ring-2 ${
          mismatchError ? 'border-error focus:ring-error' : 'border-caramel focus:ring-espresso'
        }`}
      />
      {mismatchError && <p className="text-xs text-error">{mismatchError}</p>}

      {resetPassword.isError && <p className="text-sm text-error">{resetPassword.error.message}</p>}

      <button
        type="submit"
        disabled={resetPassword.isPending}
        className="mt-2 w-full rounded-md bg-espresso p-3 font-semibold text-cream transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
      >
        {resetPassword.isPending ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <header className="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-espresso p-8 text-cream md:min-h-screen md:w-[35%]">
        <span className="absolute left-3 right-3 top-6 border-t-2 border-gold md:left-4 md:right-4 md:top-8" />
        <span className="absolute left-3 right-3 bottom-6 border-b-2 border-gold md:left-4 md:right-4 md:bottom-8" />
        <span className="absolute top-3 bottom-3 left-6 border-l-2 border-gold md:top-4 md:bottom-4 md:left-8" />
        <span className="absolute top-3 bottom-3 right-6 border-r-2 border-gold md:top-4 md:bottom-4 md:right-8" />

        <article className="z-10 flex flex-col items-center justify-center p-4 text-center max-w-xs">
          <img src="/logo.svg" alt="Company Logo" className="h-14 w-auto mb-4 md:h-20" />
          <p className="text-base font-medium tracking-wide text-gold-light md:text-xl">
            Time wasted, never regained!
          </p>
        </article>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center bg-cream p-6 text-espresso md:w-[65%] md:p-12">
        <article className="w-full max-w-sm">
          {token ? <SetNewPasswordForm token={token} /> : <RequestResetForm />}
        </article>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
