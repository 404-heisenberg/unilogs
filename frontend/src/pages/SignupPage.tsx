import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showMismatchError, setShowMismatchError] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signIn = useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post('/api/auth/signin', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/dashboard');
    },
  });

  const signUp = useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      api.post('/api/auth/signup', input),
    onSuccess: (_result, variables) => {
      signIn.mutate({ email: variables.email, password: variables.password });
    },
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setShowValidationError(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowValidationError(false);
      }, 3500);
      return;
    }

    if (!confirmPassword || confirmPassword !== password) {
      setShowMismatchError(true);
      return;
    }

    signUp.mutate({ name, email, password });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleOAuthSignUp = (provider: string) => {
    console.log(`Signing up with ${provider}`);
  };

  const shouldShowRequirements = isPasswordFocused || showValidationError;

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <header className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-[#1c0d06] p-8 text-[#f5ebe0] md:min-h-screen md:w-[35%]">
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
        <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={handleSubmit}>
          {/* Scaled-Up Header */}
          <h2 className="text-3xl font-bold tracking-tight text-center md:text-left md:text-4xl">
            Create an account
          </h2>

          <label htmlFor="name" className="text-sm font-semibold">
            Name<span className="text-red-600 ml-0.5">*</span>
          </label>
          <input
            id="name"
            type="text"
            placeholder="John Doe"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-[#d4a373] bg-white p-3 text-slate-900 outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />

          <label htmlFor="email" className="text-sm font-semibold">
            Email<span className="text-red-600 ml-0.5">*</span>
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-[#d4a373] bg-white p-3 text-slate-900 outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />

          <label htmlFor="password" className="text-sm font-semibold">
            Password<span className="text-red-600 ml-0.5">*</span>
          </label>
          <article className="relative w-full">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setShowValidationError(false);
                setShowMismatchError(false);
              }}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              placeholder="••••••••"
              required
              className={`w-full rounded-md border bg-white p-3 pr-10 text-slate-900 outline-none focus:ring-2 ${
                showValidationError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-[#d4a373] focus:ring-[#1c0d06]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7a5230] hover:text-[#1c0d06] focus:outline-none cursor-pointer"
            >
              {showPassword ? (
                /* Eye Off Icon */
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.04 10.04 0 012.122-.063c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.225-4.225L3 3"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </article>

          <label htmlFor="confirm-password" className="text-sm font-semibold">
            Confirm Password<span className="text-red-600 ml-0.5">*</span>
          </label>
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setShowMismatchError(false);
            }}
            className={`w-full rounded-md border bg-white p-3 pr-10 text-slate-900 outline-none focus:ring-2 ${
              showMismatchError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-[#d4a373] focus:ring-[#1c0d06]'
            }`}
          />
          {showMismatchError && <p className="text-xs text-red-700">Passwords do not match.</p>}

          {shouldShowRequirements && (
            <section className="mt-1 flex flex-col gap-1 text-xs transition-all">
              <p
                className={`flex items-center gap-1.5 transition-colors ${hasMinLength ? 'font-medium text-emerald-800' : 'text-red-700'}`}
              >
                <span className="inline-block w-3.5 font-bold">{hasMinLength ? '✓' : '•'}</span>
                At least 8 characters
              </p>
              <p
                className={`flex items-center gap-1.5 transition-colors ${hasUppercase ? 'font-medium text-emerald-800' : 'text-red-700'}`}
              >
                <span className="inline-block w-3.5 font-bold">{hasUppercase ? '✓' : '•'}</span>
                At least one uppercase letter (A-Z)
              </p>
              <p
                className={`flex items-center gap-1.5 transition-colors ${hasNumber ? 'font-medium text-emerald-800' : 'text-red-700'}`}
              >
                <span className="inline-block w-3.5 font-bold">{hasNumber ? '✓' : '•'}</span>
                At least one number (0-9)
              </p>
              <p
                className={`flex items-center gap-1.5 transition-colors ${hasSpecialChar ? 'font-medium text-emerald-800' : 'text-red-700'}`}
              >
                <span className="inline-block w-3.5 font-bold">{hasSpecialChar ? '✓' : '•'}</span>
                At least one special character (!@#$%^&*)
              </p>
            </section>
          )}

          {/* Terms & Privacy Disclaimer Checkbox */}
          <div className="flex items-start gap-2.5 mt-1">
            <input
              id="disclaimer"
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#d4a373] text-[#1c0d06] accent-[#1c0d06] focus:ring-2 focus:ring-[#1c0d06] cursor-pointer"
            />
            <label
              htmlFor="disclaimer"
              className="text-xs text-[#4a3525] cursor-pointer leading-tight"
            >
              I agree to the{' '}
              <a
                href="/terms"
                className="font-semibold text-[#1c0d06] underline hover:text-[#b8860b]"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                className="font-semibold text-[#1c0d06] underline hover:text-[#b8860b]"
              >
                Privacy Policy
              </a>
              <span className="text-red-600 ml-0.5">*</span>
            </label>
          </div>

          {(signUp.isError || signIn.isError) && (
            <p className="text-sm text-red-700">{(signUp.error ?? signIn.error)?.message}</p>
          )}
          <button
            type="submit"
            disabled={signUp.isPending || signIn.isPending}
            className="mt-2 w-full rounded-md bg-[#1c0d06] p-3 font-semibold text-[#f5ebe0] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
          >
            {signUp.isPending || signIn.isPending ? 'Creating account…' : 'Sign Up'}
          </button>

          {/* Account Login Link */}
          <p className="mt-2 text-center text-sm text-[#4a3525]">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-semibold text-[#1c0d06] underline hover:text-[#b8860b]"
            >
              Sign In
            </a>
          </p>

          {/* OAuth Separator */}
          <section className="relative my-4 flex items-center justify-center border-t border-[#d4a373]/50">
            <span className="absolute bg-[#f5ebe0] px-3 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
              OR Sign up with :
            </span>
          </section>

          {/* OAuth Provider Buttons */}
          <section className="flex gap-3">
            <button
              type="button"
              onClick={() => handleOAuthSignUp('Google')}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[#d4a373] bg-white p-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignUp('GitHub')}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[#d4a373] bg-white p-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <svg className="h-4 w-4 fill-current text-slate-900" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </button>
          </section>
        </form>
      </section>
    </main>
  );
};

export default SignupPage;
