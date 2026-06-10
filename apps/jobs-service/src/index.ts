import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import jwt from 'jsonwebtoken';
import { jobsRouter } from './routes/jobs.routes';
import { pgPool, redisClient, connectRedis } from './services/db.service';
import logger from './logger';
import { swaggerSpec } from './swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
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

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later.' },
});

app.use(globalLimiter);
app.use(express.json());

// ── JWT MIDDLEWARE ────────────────────────────────────────
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
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
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ── HEALTH ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  logger.info('Health check called');
  res.json({ status: 'ok', service: 'jobs-service', timestamp: new Date().toISOString() });
});

// ── ROUTES ────────────────────────────────────────────────
// GET /jobs — public, global rate limit only
// POST /jobs — requires JWT + stricter rate limit
app.use('/jobs', (req, res, next) => {
  if (req.method === 'POST') return writeLimiter(req, res, next);
  next();
});

app.use('/jobs', (req, res, next) => {
  if (req.method === 'POST') return requireAuth(req, res, next);
  next();
});

app.use('/jobs', jobsRouter);

// ── DB INIT ───────────────────────────────────────────────
const initDB = async () => {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id           SERIAL PRIMARY KEY,
      title        VARCHAR(255) NOT NULL,
      company      VARCHAR(255) NOT NULL,
      description  TEXT,
      location     VARCHAR(255),
      salary       VARCHAR(100),
      job_type     VARCHAR(50) DEFAULT 'full-time',
      requirements TEXT,
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `);
  await pgPool.query(`
    ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS job_type     VARCHAR(50) DEFAULT 'full-time',
      ADD COLUMN IF NOT EXISTS requirements TEXT
  `);
  logger.info('Database initialized');
};

const start = async () => {
  try {
    await initDB();
    await connectRedis();
    app.listen(PORT, () => {
      logger.info('jobs-service started', { port: PORT, env: process.env.NODE_ENV });
    });
  } catch (error) {
    logger.error('Failed to start jobs-service', { error });
    process.exit(1);
  }
};

start();

export default app;