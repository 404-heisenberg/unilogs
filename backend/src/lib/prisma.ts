import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// The one database client for the whole API. Every route, service and Better
// Auth share it, so the process holds a single connection pool. Before this,
// each route file created its own client and pool (up to 10 connections
// each), which under load could exhaust Neon's connection limit.
//
// DATABASE_POOL_MAX raises the pool size if a deployment needs it; pg's
// default of 10 is plenty for the free tier.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  }),
});
