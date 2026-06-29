import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { pool } from '../db';
import { logger } from '../index';

const TOPIC = 'job.created';

let consumer: Consumer;

export async function startKafkaConsumer(): Promise<void> {
  const kafka = new Kafka({
    clientId: 'audit-service',
    brokers: (process.env.KAFKA_BROKERS ?? 'kafka:9092').split(','),
  });

  consumer = kafka.consumer({ groupId: 'audit-service-group' });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  logger.info('Kafka consumer connected', { topic: TOPIC });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      const raw = message.value?.toString();
      if (!raw) return;

      try {
        const payload = JSON.parse(raw);

        await pool.query(
          `INSERT INTO audit_logs (event_type, payload, user_id)
           VALUES ($1, $2, $3)`,
          [topic, payload, payload.user_id ?? null]
        );

        logger.info('Audit log inserted', {
          event_type: topic,
          partition,
          offset: message.offset,
          user_id: payload.user_id ?? null,
        });
      } catch (err: unknown) {
        const message_ = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to process Kafka message', {
          topic,
          error: message_,
          raw,
        });
      }
    },
  });
}

export async function stopKafkaConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}
