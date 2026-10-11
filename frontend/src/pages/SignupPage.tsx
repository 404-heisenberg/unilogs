import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getGoogleOAuthErrorMessage } from '@/lib/oauthErrors';
import { getEmailError } from '@/lib/validation';
import { toast } from '@/lib/toast';
import AuthLayout from '@/components/AuthLayout';
import { BACK_TO_HOME, BACK_TO_SIGN_IN, useCameFrom } from '@/lib/authFlow';

export const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showMismatchError, setShowMismatchError] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthErrorMessage = getGoogleOAuthErrorMessage(searchParams.get('error'));
  const cameFrom = useCameFrom();

  useEffect(() => {
    if (oauthErrorMessage) toast.error(oauthErrorMessage);
  }, [oauthErrorMessage]);

  const signUp = useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      api.post('/api/auth/signup', input),
    onSuccess: (_result, variables) => {
      navigate(`/verify-email?email=${encodeURIComponent(variables.email)}`, {
        state: { from: 'signup' },
      });
    },
    onError: (error) => toast.error(error),
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const emailValidationError = getEmailError(email);
    setEmailError(emailValidationError);
    if (emailValidationError) return;

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

  const googleSignUp = useMutation({
    mutationFn: () => api.post<{ url: string }>('/api/auth/social/google', { from: 'signup' }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => toast.error(error),
  });

  const shouldShowRequirements = isPasswordFocused || showValidationError;

  return (
    <AuthLayout variant="lora" back={cameFrom === 'login' ? BACK_TO_SIGN_IN : BACK_TO_HOME}>
      {/* Figma "Sign Up — Desktop" (521:686): a 14px stack holding a 12px
          field group, each field a 72px block (label, 6px, 48px input), the
          password rules 8px under the password field. */}
      <form
        className="flex w-full flex-col gap-2 md:max-w-[400px] md:gap-3.5"
        onSubmit={handleSubmit}
      >
        <h2 className="font-lora text-3xl leading-[34px] font-semibold md:text-[34px] md:leading-[42px] md:tracking-[-0.7px]">
          Create an account
        </h2>

        {/* Mobile (521:784) packs tighter: 6px between fields, 4px to the rules. */}
        <div className="flex flex-col gap-1.5 md:gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-[13px] leading-[18px] font-medium">
              Name *
            </label>
            <input
              id="name"
              type="text"
              placeholder="John Doe"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-12 rounded-lg border bg-paper px-4 text-[15px] text-espresso placeholder:text-caramel outline-none focus:ring-2 border-cream focus:ring-espresso"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] leading-[18px] font-medium">
              Email *
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              onBlur={() => setEmailError(getEmailError(email))}
              className={`w-full min-h-12 rounded-lg border bg-paper px-4 text-[15px] text-espresso placeholder:text-caramel outline-none focus:ring-2 ${
                emailError ? 'border-error focus:ring-error' : 'border-cream focus:ring-espresso'
              }`}
            />
            {emailError && <p className="text-xs text-error">{emailError}</p>}
          </div>

          <div className="flex flex-col gap-1 md:gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] leading-[18px] font-medium">
                Password *
              </label>
              <div className="relative w-full">
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
                  className={`w-full min-h-12 rounded-lg border bg-paper px-4 text-[15px] text-espresso placeholder:text-caramel outline-none focus:ring-2 pr-12 ${
                    showValidationError
                      ? 'border-error focus:ring-error'
                      : 'border-cream focus:ring-espresso'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center text-cocoa hover:text-espresso focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Eye className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {shouldShowRequirements && (
              <ul className="flex flex-col gap-px text-xs md:gap-[3px]">
                {[
                  [hasMinLength, 'At least 8 characters'],
                  [hasUppercase, 'At least one uppercase letter (A-Z)'],
                  [hasNumber, 'At least one number (0-9)'],
                  [hasSpecialChar, 'At least one special character (!@#$%^&*)'],
                ].map(([met, rule]) => (
                  <li key={rule as string} className="flex items-center gap-[7px]">
                    <span
                      className={`w-3 font-bold ${met ? 'text-success' : 'text-error'}`}
                      aria-hidden
                    >
                      {met ? '✓' : '•'}
                    </span>
                    <span
                      className={`leading-[14px] md:leading-4 ${met ? 'text-[#66564b]' : 'text-error'}`}
                    >
                      {rule}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-password" className="text-[13px] leading-[18px] font-medium">
              Confirm Password *
            </label>
            <div className="relative w-full">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setShowMismatchError(false);
                }}
                className={`w-full min-h-12 rounded-lg border bg-paper px-4 text-[15px] text-espresso placeholder:text-caramel outline-none focus:ring-2 pr-12 ${
                  showMismatchError
                    ? 'border-error focus:ring-error'
                    : 'border-cream focus:ring-espresso'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'}
                className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center text-cocoa hover:text-espresso focus:outline-none"
              >
                {showConfirm ? (
                  <EyeOff className="size-[18px]" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Eye className="size-[18px]" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            </div>
            {showMismatchError && <p className="text-xs text-error">Passwords do not match.</p>}
          </div>
        </div>

        {/* Terms consent: a 24px target around Figma's 18px box. The two
            documents stay linked (not in Figma). */}
        <div className="flex min-h-10 items-center gap-2.5 md:min-h-8">
          <span className="flex size-8 shrink-0 items-center justify-center md:size-6">
            <input
              id="disclaimer"
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="size-[18px] cursor-pointer rounded-[3px] border-[1.5px] border-clay accent-espresso focus:ring-2 focus:ring-espresso"
            />
          </span>
          <label
            htmlFor="disclaimer"
            className="cursor-pointer text-xs leading-[18px] text-[#66564b]"
          >
            I agree to the{' '}
            <a href="/terms" className="-my-4 inline-block py-4 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="-my-4 inline-block py-4 hover:underline">
              Privacy Policy
            </a>
          </label>
        </div>

        <button
          type="submit"
          disabled={signUp.isPending}
          className="min-h-12 w-full rounded-xl bg-espresso px-4 text-[13px] font-medium text-cream shadow-[0_2px_6px_rgb(28_13_6/0.08)] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
        >
          {signUp.isPending ? 'Creating account…' : 'Sign Up'}
        </button>

        {/* Account Login Link */}
        <p className="text-center text-sm leading-5 text-[#66564b]">
          Already have an account?{' '}
          <Link
            to="/login"
            state={{ from: 'signup' }}
            className="inline-block -my-3 py-3 font-semibold text-clay hover:underline"
          >
            Sign In
          </Link>
        </p>

        {/* OAuth Separator */}
        <section className="flex justify-center">
          <span className="text-xs tracking-[0.4px] text-[#8b796d]">OR Sign up with :</span>
        </section>

        {/* OAuth Provider Buttons */}
        <section className="flex gap-3">
          <button
            type="button"
            onClick={() => googleSignUp.mutate()}
            disabled={googleSignUp.isPending}
            className="flex flex-1 items-center justify-center gap-2 min-h-12 rounded-xl border-[1.5px] border-clay bg-transparent px-4 text-[13px] font-medium text-cocoa transition-colors hover:bg-gold-light/20 cursor-pointer disabled:opacity-60"
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
            {googleSignUp.isPending ? 'Connecting…' : 'Google'}
          </button>
        </section>
      </form>
    </AuthLayout>
  );
};

export default SignupPage;
