import { Pool } from 'pg';
import logger from '../logger';

export const pgPool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB       || 'profiles_db',
  user:     process.env.POSTGRES_USER     || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pgPool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error', { error: err.message });
});
