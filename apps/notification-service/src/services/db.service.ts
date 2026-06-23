import { Pool } from 'pg';
import logger from '../logger';

export const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'jobs_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
});

export const initDb = async (): Promise<void> => {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     VARCHAR(50) NOT NULL,
      type        VARCHAR(50) NOT NULL,
      title       VARCHAR(255) NOT NULL,
      message     TEXT NOT NULL,
      read        BOOLEAN DEFAULT FALSE,
      metadata    JSONB DEFAULT '{}',
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  logger.info('notifications table ready');
};
