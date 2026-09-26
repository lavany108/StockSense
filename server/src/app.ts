import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

export const createApp = (): Application => {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // Base API Healthcheck
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'StockSense Pro API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
};
