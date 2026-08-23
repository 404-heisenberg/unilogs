import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

export const auth = betterAuth({
  baseURL: 'http://localhost:3000',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: { enabled: true },
  email: {
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      console.log(`Password reset for ${user.email}: ${url}`);
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
});
