import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import authRoutes from './routes/auth.js';
import entriesRoutes from './routes/entries.js';
import projectRouter from './routes/projects.js';
import fieldDefinitionsRoutes from './routes/field-definitions.js';
import statsRoutes from './routes/stats.js';
import { apiReference } from '@scalar/express-api-reference';
import { openapiSpec } from './openapi.js';

export function createApp() {
  const app = express();

  // 1. Sanitize CORS Origin (strips trailing slashes)
  const rawOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const allowedOrigin = rawOrigin.replace(/\/$/, '');

  app.use(
    cors({
      origin: allowedOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    }),
  );

  // 2. Body Parser
  app.use(express.json());

  // 3. Custom Authentication Routes (Mount under /api/auth for test suite compatibility)
  app.use('/api/auth', authRoutes);

  // 4. Better-Auth Handler (Fallback for native Better-Auth endpoints)
  app.all('/api/auth/*splat', toNodeHandler(auth));

  // 5. Application Feature Routers
  app.use('/api/projects', projectRouter);
  app.use('/api/field-definitions', fieldDefinitionsRoutes);
  app.use('/api/entries', entriesRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/health', healthRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'UniLogs API',
      version: '0.1.0',
      health: '/api/health',
    });
  });

  app.get('/openapi.json', (_req, res) => {
    res.json(openapiSpec);
  });

  app.use(
    '/api/docs',
    apiReference({
      url: '/openapi.json',
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
