import amqp from 'amqplib';
import logger from '../logger';

let channel: amqp.Channel | null = null;

const RABBITMQ_URL = `amqp://admin:${process.env.RABBITMQ_PASSWORD}@rabbitmq:5672`;

export const connectRabbitMQ = async (retries = 10): Promise<amqp.Channel> => {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      logger.info('RabbitMQ connected');

      connection.on('error', (err: Error) => {
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

export const getChannel = (): amqp.Channel => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
};