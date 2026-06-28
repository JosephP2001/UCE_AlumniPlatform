import express from 'express';
import winston from 'winston';
import { pool, initDB } from './db';
import auditRouter from './routes/audit';
import { startKafkaConsumer } from './consumers/kafkaConsumer';

const app = express();
const PORT = process.env.PORT ?? 3006;

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'audit-service' },
  transports: [new winston.transports.Console()],
});

app.use(express.json());

app.get('/health', (_req, res) => {
  logger.info('Health check called');
  res.json({
    status: 'ok',
    service: 'audit-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/audit', auditRouter);

async function main() {
  await initDB();
  await startKafkaConsumer();

  app.listen(PORT, () => {
    logger.info('audit-service started', { port: PORT, env: process.env.NODE_ENV });
  });
}

main().catch((err) => {
  logger.error('Fatal error starting audit-service', { error: err.message });
  process.exit(1);
});
