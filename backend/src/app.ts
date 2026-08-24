import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import authRoutes from './routes/auth.js';
import entriesRoutes from './routes/entries.js';
import projectRouter from './routes/projects.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRouter);
  app.all('/api/auth/*splat', toNodeHandler(auth));

  app.use('/api/entries', entriesRoutes);
  app.use('/api/health', healthRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'UniLogs API',
      version: '0.1.0',
      health: '/api/health',
    });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
