import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  host: process.env.PG_HOST ?? 'postgres',
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? 'jobs_db',
  user: process.env.PG_USER ?? 'postgres',
  password: process.env.PG_PASSWORD,
});

/**
 * admin-service does NOT own the `users` table — it's shared across the
 * platform (jobs-service, analytics-service, matching-service all read
 * from it in `jobs_db`). We only ADD the columns this service needs,
 * idempotently, instead of creating/owning the table ourselves.
 *
 * IMPORTANT: verify these column names/defaults against the actual
 * `users` table schema (owned by auth-service) before relying on this
 * in QA/PROD — this assumes a `users` table already exists with at
 * least an `id` primary key.
 */
export async function initDB(): Promise<void> {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  `);

  logger.info('DB initialized — users.role / users.is_active columns verified');
}
