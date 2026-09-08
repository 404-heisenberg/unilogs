import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signIn = useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post('/api/auth/signin', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/dashboard');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    signIn.mutate({ email, password });
  };
  const handleOAuthSignIn = (provider: string) => {
    console.log(`Signing in with ${provider}`);
  };
  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <header className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-[#1c0d06] p=8 text-[#f5ebe0] md:min-h-screen md:w-[35%]">
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
          <h2 className="text-3xl font-bold tracking-tight text-center md:text-left md:text-4xl">
            Sign in
          </h2>
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
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#d4a373] bg-white p-3 pr-10 text-slate-900 outline-none focus:ring-2 focus:ring-[#1c0d06]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7a5230] hover:text-[#1c0d06] focus:outline-none cursor-pointer"
            >
              {showPassword ? (
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
          <p className="mt-2 text-sm text-[#4a3525] ">
            Forgot password?{' '}
            <a
              href="/reset-password"
              className="font-semibold text-[#1c0d06] underline hover:text-[#b8860b]"
            >
              Reset
            </a>
          </p>
          {signIn.isError && <p className="text-sm text-red-700">{signIn.error.message}</p>}
          <button
            type="submit"
            disabled={signIn.isPending}
            className="mt-2 w-full rounded-md bg-[#1c0d06] p-3 font-semibold text-[#f5ebe0] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
          >
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-2 text-center text-sm text-[#4a3525]">
            Don't have an account?{' '}
            <a
              href="/signup"
              className="font-semibold text-[#1c0d06] underline hover:text-[#b8860b]"
            >
              Sign up
            </a>
          </p>
          <section className="relative my-4 flex items-center justify-center border-t border-[#d4a373]/50">
            <span className="absolute bg-[#f5ebe0] px-3 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
              OR Sign in with :
            </span>
          </section>
          <section className="flex gap-3"></section>
        </form>
      </section>
    </main>
  );
};
export default LoginPage;
