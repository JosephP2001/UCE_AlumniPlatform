import { Pool } from 'pg';
import { logger } from '../index';

export const pgPool = new Pool({
  host:     process.env.PG_HOST     ?? 'postgres',
  port:     Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? 'jobs_db',
  user:     process.env.PG_USER     ?? 'postgres',
  password: process.env.PG_PASSWORD,
});

export async function initPG(): Promise<void> {
  await pgPool.query('SELECT 1');
  logger.info('PostgreSQL connection verified');
}
