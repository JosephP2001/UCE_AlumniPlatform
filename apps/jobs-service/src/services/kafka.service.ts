import { Kafka, Producer, Partitioners } from 'kafkajs';
import logger from '../logger';

let producer: Producer | null = null;

const kafka = new Kafka({
  clientId: 'jobs-service',
  brokers: [(process.env.KAFKA_BROKER || 'kafka:9092')],
});

export const connectKafka = async (retries = 10): Promise<void> => {
  producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });

  for (let i = 0; i < retries; i++) {
    try {
      await producer.connect();
      logger.info('Kafka producer connected');
      return;
    } catch (err) {
      logger.warn(`Kafka not ready, retry ${i + 1}/${retries}`, { err });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  logger.warn('Kafka unavailable — service will run without event publishing');
};

export const publishJobCreated = async (payload: {
  jobId: number;
  title: string;
  company: string;
  userId?: string;
}): Promise<void> => {
  if (!producer) {
    logger.warn('Kafka producer not initialized — skipping event');
    return;
  }
  try {
    await producer.send({
      topic: 'job.created',
      messages: [{ value: JSON.stringify(payload) }],
    });
    logger.info('job.created event published', { payload });
  } catch (err) {
    logger.error('Failed to publish job.created', { err });
  }
};
