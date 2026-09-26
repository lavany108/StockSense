import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import warehousesRouter from './routes/warehouses';
import locationsRouter from './routes/locations';
import categoriesRouter from './routes/categories';
import productsRouter from './routes/products';
import partnersRouter from './routes/partners';
import documentsRouter from './routes/documents';
import stockRouter from './routes/stock';
import reordersRouter from './routes/reorders';
import { errorHandler } from './middleware/errorHandler';

export const createApp = (): Application => {
  const app = express();

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // ── Rate limiting on auth routes ──────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { errors: { rateLimit: 'Too many requests, please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ── Healthcheck ───────────────────────────────────────────────────────────
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'StockSense Pro API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authLimiter, authRouter);
  app.use('/api/v1/warehouses', warehousesRouter);
  app.use('/api/v1/locations', locationsRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/partners', partnersRouter);
  app.use('/api/v1/documents', documentsRouter);
  app.use('/api/v1/stock', stockRouter);
  app.use('/api/v1/dashboard', stockRouter);  // GET /api/v1/dashboard/kpis hits stockRouter's /kpis handler
  app.use('/api/v1/reorders', reordersRouter);

  // ── Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
};
