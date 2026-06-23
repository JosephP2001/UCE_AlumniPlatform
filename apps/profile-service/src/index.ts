import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { profileRouter } from './routes/profile.routes';
import { pgPool } from './services/db.service';
import logger from './logger';
import { swaggerSpec } from './swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
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

// ── SWAGGER ───────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req: Request, res: Response) => res.json(swaggerSpec));

// ── HEALTH ────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  logger.info('Health check called');
  res.json({
    status: 'ok',
    service: 'profile-service',
    timestamp: new Date().toISOString(),
  });
});

// ── ROUTES ────────────────────────────────────────────────
app.use('/profile', profileRouter);

// ── DB INIT ───────────────────────────────────────────────
const initDB = async () => {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id              SERIAL PRIMARY KEY,
      user_id         BIGINT UNIQUE NOT NULL,
      username        VARCHAR(255),
      full_name       VARCHAR(255) NOT NULL,
      career          VARCHAR(255) NOT NULL,
      graduation_year INTEGER,
      bio             TEXT,
      skills          TEXT,
      location        VARCHAR(255),
      linkedin_url    VARCHAR(500),
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  logger.info('Database initialized — profiles table ready');
};

const start = async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      logger.info('profile-service started', { port: PORT, env: process.env.NODE_ENV });
    });
  } catch (error) {
    logger.error('Failed to start profile-service', { error });
    process.exit(1);
  }
};

start();

export default app;
