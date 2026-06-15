import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './services/db.service';
import { connectRabbitMQ } from './services/rabbitmq.service';
import { startConsumers } from './consumers/notification.consumer';
import { notificationRouter } from './routes/notifications.routes';
import logger from './logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.use('/notifications', notificationRouter);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

const start = async (): Promise<void> => {
  try {
    await initDb();
    const channel = await connectRabbitMQ();
    await startConsumers(channel);
    app.listen(PORT, () => {
      logger.info(`notification-service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start notification-service', { err });
    process.exit(1);
  }
};

start();
