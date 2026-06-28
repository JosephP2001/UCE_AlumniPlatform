import { Pool } from 'pg';
import { logger } from './index';

export const pool = new Pool({
  host: process.env.PG_HOST ?? 'postgres',
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? 'jobs_db',
  user: process.env.PG_USER ?? 'postgres',
  password: process.env.PG_PASSWORD,
});

export async function initDB(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(100) NOT NULL,
      payload   JSONB       NOT NULL DEFAULT '{}',
      user_id   VARCHAR(100),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp  ON audit_logs(timestamp DESC);
  `);

  logger.info('DB initialized — audit_logs table ready');
}
