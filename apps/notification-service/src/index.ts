import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import jwt from 'jsonwebtoken';
import { initDb } from './services/db.service';
import { connectRabbitMQ } from './services/rabbitmq.service';
import { connectMQTT } from './services/mqtt.service';
import { startConsumers } from './consumers/notification.consumer';
import { notificationRouter } from './routes/notifications.routes';
import { swaggerSpec } from './swagger';
import logger from './logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── RATE LIMITING ─────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(globalLimiter);
app.use(express.json());

// ── JWT MIDDLEWARE ────────────────────────────────────────
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ── SWAGGER ───────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));

// ── HEALTH ────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  logger.info('Health check called');
  res.json({
    status: 'ok',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
  });
});

// ── ROUTES ────────────────────────────────────────────────
app.use('/notifications', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'PUT') {
    return requireAuth(req, res, next);
  }
  next();
});

app.use('/notifications', notificationRouter);

// ── START ─────────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await initDb();
    const channel = await connectRabbitMQ();
    await startConsumers(channel);

    // MQTT — non-blocking, service starts even if broker is down
    connectMQTT().catch((err) =>
      logger.warn('MQTT broker not ready on startup — will retry automatically', {
        err: err.message,
      })
    );

    app.listen(PORT, () => {
      logger.info('notification-service started', {
        port: PORT,
        env: process.env.NODE_ENV,
      });
    });
  } catch (err) {
    logger.error('Failed to start notification-service', { err });
    process.exit(1);
  }
};

start();

export default app;