import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getEmailError } from '@/lib/validation';
import { toast } from '@/lib/toast';
import AuthLayout from '@/components/AuthLayout';
import { BACK_TO_SIGN_IN } from '@/lib/authFlow';

const RequestResetForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const forgotPassword = useMutation({
    mutationFn: (input: { email: string }) =>
      api.post<{ message: string; token?: string; url?: string }>(
        '/api/auth/forgot-password',
        input,
      ),
    onError: (error) => toast.error(error),
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
      <section className="flex flex-col gap-4">
        <h2 className="font-cormorant text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-5xl">
          Request received
        </h2>
        <p className="text-sm text-clay">
          If an account exists for <span className="font-semibold text-espresso">{email}</span>, a
          password reset link has been generated.
        </p>
        {resetUrl && (
          <p className="text-sm text-clay">
            This environment doesn&apos;t send real emails, so here&apos;s the link directly:{' '}
            <a
              href={resetUrl}
              className="break-all font-semibold text-clay underline hover:text-espresso"
            >
              {resetUrl}
            </a>
          </p>
        )}
        <Link
          to="/login"
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-cream shadow-[0_2px_6px_rgb(28_13_6/0.08)] transition-opacity hover:opacity-90"
        >
          Return to Sign In
        </Link>
      </section>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="font-cormorant text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-5xl">
        Reset password
      </h2>
      <p className="text-sm text-clay">
        Enter the email address associated with your account and we&apos;ll send you a link to reset
        your password.
      </p>

      <label htmlFor="reset-email" className="text-sm font-semibold mt-2">
        Email address<span className="ml-0.5">*</span>
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
        className={`w-full min-h-12 rounded-lg border bg-paper px-4 text-sm text-espresso placeholder:text-caramel outline-none focus:ring-2 ${
          emailError ? 'border-error focus:ring-error' : 'border-cream focus:ring-espresso'
        }`}
      />
      {emailError && <p className="text-xs text-error">{emailError}</p>}

      <button
        type="submit"
        disabled={forgotPassword.isPending}
        className="mt-2 min-h-12 w-full rounded-xl bg-espresso px-4 text-[13px] font-medium text-cream shadow-[0_2px_6px_rgb(28_13_6/0.08)] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
      >
        {forgotPassword.isPending ? 'Sending…' : 'Send Reset Link'}
      </button>

      <p className="mt-2 text-center text-sm text-cocoa">
        Return back to sign in{' '}
        <Link
          to="/login"
          className="inline-block -my-3 -mx-2 px-2 py-3 font-semibold text-clay underline hover:text-espresso"
        >
          Sign In
        </Link>
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
    onError: (error) => toast.error(error),
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
      <section className="flex flex-col gap-4">
        <h2 className="font-cormorant text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-5xl">
          Password updated
        </h2>
        <p className="text-sm text-clay">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Link
          to="/login"
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-espresso px-4 text-[13px] font-medium text-cream shadow-[0_2px_6px_rgb(28_13_6/0.08)] transition-opacity hover:opacity-90"
        >
          Return to Sign In
        </Link>
      </section>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="font-cormorant text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-5xl">
        Set a new password
      </h2>
      <p className="text-sm text-clay">Choose a new password for your account.</p>

      <label htmlFor="new-password" className="text-sm font-semibold mt-2">
        New password<span className="ml-0.5">*</span>
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
        className="w-full min-h-12 rounded-lg border border-cream bg-paper px-4 text-sm text-espresso placeholder:text-caramel outline-none focus:ring-2 focus:ring-espresso"
      />

      <label htmlFor="confirm-new-password" className="text-sm font-semibold">
        Confirm new password<span className="ml-0.5">*</span>
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
        className={`w-full min-h-12 rounded-lg border bg-paper px-4 text-sm text-espresso placeholder:text-caramel outline-none focus:ring-2 ${
          mismatchError ? 'border-error focus:ring-error' : 'border-cream focus:ring-espresso'
        }`}
      />
      {mismatchError && <p className="text-xs text-error">{mismatchError}</p>}

      <button
        type="submit"
        disabled={resetPassword.isPending}
        className="mt-2 min-h-12 w-full rounded-xl bg-espresso px-4 text-[13px] font-medium text-cream shadow-[0_2px_6px_rgb(28_13_6/0.08)] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
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
    <AuthLayout back={BACK_TO_SIGN_IN}>
      <article className="w-full max-w-sm">
        {token ? <SetNewPasswordForm token={token} /> : <RequestResetForm />}
      </article>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
