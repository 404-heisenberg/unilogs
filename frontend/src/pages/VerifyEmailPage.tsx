import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';

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
    <AuthLayout>
      <form className="flex w-full flex-col gap-4 md:max-w-[400px]" onSubmit={handleSubmit}>
        <h2 className="font-cormorant text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-5xl">
          Verify your email
        </h2>
        <p className="text-sm text-clay">
          Enter the 6-digit code we sent to your email address. It expires in 5 minutes.
        </p>

        <label htmlFor="verify-email" className="text-sm font-semibold mt-2">
          Email address<span className="ml-0.5">*</span>
        </label>
        <input
          id="verify-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
          className="w-full min-h-12 rounded-lg border border-cream bg-paper px-4 text-sm placeholder:text-caramel text-espresso placeholder:text-caramel outline-none focus:ring-2 focus:ring-espresso"
        />

        <label htmlFor="otp" className="text-sm font-semibold">
          Verification code<span className="ml-0.5">*</span>
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
          className="w-full min-h-12 rounded-lg border border-cream bg-paper px-4 text-sm placeholder:text-caramel tracking-[0.5em] text-center text-espresso outline-none focus:ring-2 focus:ring-espresso"
        />

        {verify.isError && <p className="text-sm text-error">{verify.error.message}</p>}

        <button
          type="submit"
          disabled={verify.isPending || !email || otp.length !== 6}
          className="mt-2 min-h-12 w-full rounded-xl bg-espresso px-4 text-[13px] font-medium text-cream shadow-[0_2px_6px_rgb(28_13_6/0.08)] transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
        >
          {verify.isPending ? 'Verifying…' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={() => resend.mutate({ email })}
          disabled={resend.isPending || !email}
          className="w-full rounded-md border border-caramel p-3 font-semibold text-espresso transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
        >
          {resend.isPending ? 'Resending…' : 'Resend code'}
        </button>
        {resend.isSuccess && <p className="text-sm text-emerald-800">A new code has been sent.</p>}
        {resend.isError && <p className="text-sm text-error">{resend.error.message}</p>}

        <p className="mt-2 text-center text-sm text-cocoa">
          Return back to sign in{' '}
          <a
            href="/login"
            className="inline-block -my-3 -mx-2 px-2 py-3 font-semibold text-clay underline hover:text-espresso"
          >
            Sign In
          </a>
        </p>
      </form>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
