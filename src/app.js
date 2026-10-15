import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import { catalogRouter, tripsRouter } from './routes/catalog.js';
import bookingRoutes from './routes/bookings.js';
import { HttpError } from './utils.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(config.corsOrigins.length ? { origin: config.corsOrigins } : {}));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api', catalogRouter);
  app.use('/api/trips', tripsRouter);
  app.use('/api/bookings', bookingRoutes);

  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Body request bukan JSON yang valid.' } });
    }
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: status >= 500 ? 'Terjadi kesalahan pada server.' : err.message,
      },
    });
  });

  return app;
}
