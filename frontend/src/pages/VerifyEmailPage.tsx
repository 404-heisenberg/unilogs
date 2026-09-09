import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const verify = useMutation({
    mutationFn: (input: { email: string; otp: string }) =>
      api.post<{ status: boolean; token: string | null }>(
        '/api/auth/email-otp/verify-email',
        input,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/dashboard');
    },
  });

  const resend = useMutation({
    mutationFn: (input: { email: string }) =>
      api.post<{ success: boolean }>('/api/auth/email-otp/send-verification-otp', {
        ...input,
        type: 'email-verification',
      }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || otp.length !== 6) return;
    verify.mutate({ email, otp });
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
        <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={handleSubmit}>
          <h2 className="text-3xl font-bold tracking-tight text-center md:text-left md:text-4xl">
            Verify your email
          </h2>
          <p className="text-sm text-[#7a5230]">
            Enter the 6-digit code we sent to your email address. It expires in 5 minutes.
          </p>

          <label htmlFor="verify-email" className="text-sm font-semibold mt-2">
            Email address<span className="text-red-600 ml-0.5">*</span>
          </label>
          <input
            id="verify-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            className="w-full rounded-md border border-[#d4a373] bg-white p-3 text-slate-900 outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />

          <label htmlFor="otp" className="text-sm font-semibold">
            Verification code<span className="text-red-600 ml-0.5">*</span>
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            required
            className="w-full rounded-md border border-[#d4a373] bg-white p-3 tracking-[0.5em] text-center text-slate-900 outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />

          {verify.isError && <p className="text-sm text-red-700">{verify.error.message}</p>}

          <button
            type="submit"
            disabled={verify.isPending || !email || otp.length !== 6}
            className="mt-2 w-full rounded-md bg-[#1c0d06] p-3 font-semibold text-[#f5ebe0] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
          >
            {verify.isPending ? 'Verifying…' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => resend.mutate({ email })}
            disabled={resend.isPending || !email}
            className="w-full rounded-md border border-[#d4a373] p-3 font-semibold text-[#1c0d06] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
          >
            {resend.isPending ? 'Resending…' : 'Resend code'}
          </button>
          {resend.isSuccess && (
            <p className="text-sm text-emerald-800">A new code has been sent.</p>
          )}
          {resend.isError && <p className="text-sm text-red-700">{resend.error.message}</p>}

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
      </section>
    </main>
  );
};

export default VerifyEmailPage;
