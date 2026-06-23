import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { jobsRouter } from './routes/jobs.routes';
import { pgPool, redisClient, connectRedis } from './services/db.service';
import logger from './logger';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*', credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  logger.info('Health check called');
  res.json({ status: 'ok', service: 'jobs-service', timestamp: new Date().toISOString() });
});

app.use('/jobs', jobsRouter);

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

  // Non-destructive migrations: add columns if upgrading from older schema
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
