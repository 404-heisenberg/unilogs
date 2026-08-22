import { Router } from 'express';
import { auth } from '../auth.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    res.status(201).json(result);
  } catch {
    res.status(400).json({ error: 'Signup failed' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await auth.api.signInEmail({
      body: { email, password },
    });

    res.status(201).json(result);
  } catch {
    res.status(400).json({ error: 'Signin failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({
      where: { email: verification.identifier },
    });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credential',
      },
    });

    if (!account) {
      return res.status(400).json({ error: 'Account not found' });
    }

    await prisma.account.update({
      where: {
        id: account.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    await prisma.verification.delete({
      where: { id: verification.id },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: 'Password reset failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    const token = crypto.randomBytes(32).toString('hex');

    try {
      await prisma.verification.create({
        data: {
          id: crypto.randomBytes(16).toString('hex'),
          identifier: email,
          value: token,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
    } catch {
      console.log(`Verification table not found, using token: ${token}`);
    }
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
    console.log(`Password reset for ${email}: ${resetUrl}`);

    res.json({ message: 'Reset link sent if account exists', token: token, url: resetUrl });
  } catch {
    res.status(400).json({ error: 'Failed to send reset link' });
  }
});

export default router;
