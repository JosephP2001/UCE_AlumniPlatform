import amqp, { Connection, Channel } from 'amqplib';
import logger from '../logger';

let connection: Connection | null = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL ||
  `amqp://admin:${process.env.RABBITMQ_PASSWORD}@rabbitmq:5672`;

export const connectRabbitMQ = async (retries = 10): Promise<Channel> => {
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      logger.info('RabbitMQ connected');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { err });
      });

      return channel;
    } catch (err) {
      logger.warn(`RabbitMQ not ready, retry ${i + 1}/${retries}`, { err });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not connect to RabbitMQ after retries');
};

export const getChannel = (): Channel => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
};
