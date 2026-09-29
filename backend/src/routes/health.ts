import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});
