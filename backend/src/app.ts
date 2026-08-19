import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(express.json());

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
