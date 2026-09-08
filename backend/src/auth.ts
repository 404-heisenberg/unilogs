import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  trustedOrigins: [process.env.CORS_ORIGIN ?? 'http://localhost:5173'],

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  email: {
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      console.log(`Password reset for ${user.email}: ${url}`);
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === 'email-verification') {
          console.log(`Email verification code for ${email}: ${otp} (expires in 5 minutes)`);
        }
      },
    }),
  ],
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
    },
    defaultCookieAttributes: {
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      partitioned: isProduction,
    },
  },
});
