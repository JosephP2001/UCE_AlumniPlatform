import amqp from 'amqplib';
import CircuitBreaker from 'opossum';
import logger from '../logger';

let channel: amqp.Channel | null = null;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  `amqp://admin:${process.env.RABBITMQ_PASSWORD}@rabbitmq:5672`;

// ── Core connection function (wrapped by circuit breaker) ──
const connectToRabbitMQ = async (): Promise<amqp.Channel> => {
  const connection = await amqp.connect(RABBITMQ_URL);
  const ch = await connection.createChannel();

  connection.on('error', (err: Error) => {
    logger.error('RabbitMQ connection error', { err: err.message });
    channel = null;
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    channel = null;
  });

  return ch;
};

// ── Circuit Breaker configuration ─────────────────────────
const breaker = new CircuitBreaker(connectToRabbitMQ, {
  timeout: 5000,          // consider failed if takes > 5s
  errorThresholdPercentage: 50,  // open circuit if 50% of requests fail
  resetTimeout: 15000,    // try again after 15s in open state
  volumeThreshold: 3,     // minimum requests before opening circuit
});

// ── Circuit Breaker event logging ──────────────────────────
breaker.on('open', () =>
  logger.error('Circuit breaker OPEN — RabbitMQ unreachable, requests blocked')
);
breaker.on('halfOpen', () =>
  logger.warn('Circuit breaker HALF-OPEN — testing RabbitMQ connection')
);
breaker.on('close', () =>
  logger.info('Circuit breaker CLOSED — RabbitMQ connection restored')
);
breaker.on('fallback', () =>
  logger.warn('Circuit breaker FALLBACK — using fallback response')
);
breaker.on('timeout', () =>
  logger.warn('Circuit breaker TIMEOUT — RabbitMQ took too long')
);

// ── Fallback: return null channel, service keeps running ───
breaker.fallback(() => null);

// ── Public API ─────────────────────────────────────────────
export const connectRabbitMQ = async (retries = 10): Promise<amqp.Channel> => {
  for (let i = 0; i < retries; i++) {
    try {
      const ch = await breaker.fire() as amqp.Channel | null;
      if (!ch) {
        logger.warn(`RabbitMQ circuit open, retry ${i + 1}/${retries}`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      channel = ch;
      logger.info('RabbitMQ connected');
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

export const getBreakerStatus = (): string => {
  if (breaker.opened) return 'open';
  if (breaker.halfOpen) return 'half-open';
  return 'closed';
};