import express from 'express';
import winston from 'winston';
import { initPG } from './db/postgres';
import { initMongo } from './db/mongo';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = process.env.PORT ?? 3007;

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'analytics-service' },
  transports: [new winston.transports.Console()],
});

app.use(express.json());

app.get('/health', (_req, res) => {
  logger.info('Health check called');
  res.json({
    status: 'ok',
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/analytics', analyticsRouter);

async function main() {
  await initPG();
  await initMongo();

  app.listen(PORT, () => {
    logger.info('analytics-service started', { port: PORT, env: process.env.NODE_ENV });
  });
}

main().catch((err) => {
  logger.error('Fatal error starting analytics-service', { error: err.message });
  process.exit(1);
});
