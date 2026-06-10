import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // stricter for write operations
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later.' },
});

app.use(globalLimiter);
app.use(express.json());

// ── SWAGGER ───────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ── HEALTH ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  logger.info('Health check called');
  res.json({ status: 'ok', service: 'jobs-service', timestamp: new Date().toISOString() });
});

// POST /jobs has stricter rate limit
app.use('/jobs', (req, res, next) => {
  if (req.method === 'POST') return writeLimiter(req, res, next);
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
