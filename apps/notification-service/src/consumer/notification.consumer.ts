import { Channel } from 'amqplib';
import { pgPool } from '../services/db.service';
import logger from '../logger';

const QUEUES = {
  JOB_CREATED: 'job.created',
  USER_REGISTERED: 'user.registered',
  PROFILE_UPDATED: 'profile.updated',
};

interface JobCreatedEvent {
  jobId: number;
  title: string;
  company: string;
  userId?: string;
}

interface UserRegisteredEvent {
  userId: string;
  username: string;
}

interface ProfileUpdatedEvent {
  userId: string;
  username: string;
}

const saveNotification = async (
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: object = {}
): Promise<void> => {
  await pgPool.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, JSON.stringify(metadata)]
  );
};

export const startConsumers = async (channel: Channel): Promise<void> => {
  // ── job.created queue ──────────────────────────────────
  await channel.assertQueue(QUEUES.JOB_CREATED, { durable: true });
  channel.consume(QUEUES.JOB_CREATED, async (msg) => {
    if (!msg) return;
    try {
      const event: JobCreatedEvent = JSON.parse(msg.content.toString());
      logger.info('job.created event received', { event });

      await saveNotification(
        event.userId || 'system',
        'job_created',
        'New job posted',
        `${event.company} posted: ${event.title}`,
        { jobId: event.jobId }
      );

      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing job.created', { err });
      channel.nack(msg, false, false);
    }
  });

  // ── user.registered queue ──────────────────────────────
  await channel.assertQueue(QUEUES.USER_REGISTERED, { durable: true });
  channel.consume(QUEUES.USER_REGISTERED, async (msg) => {
    if (!msg) return;
    try {
      const event: UserRegisteredEvent = JSON.parse(msg.content.toString());
      logger.info('user.registered event received', { event });

      await saveNotification(
        event.userId,
        'welcome',
        'Welcome to UCE Alumni Platform',
        `Hi ${event.username}! Your account is ready.`,
        {}
      );

      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing user.registered', { err });
      channel.nack(msg, false, false);
    }
  });

  // ── profile.updated queue ──────────────────────────────
  await channel.assertQueue(QUEUES.PROFILE_UPDATED, { durable: true });
  channel.consume(QUEUES.PROFILE_UPDATED, async (msg) => {
    if (!msg) return;
    try {
      const event: ProfileUpdatedEvent = JSON.parse(msg.content.toString());
      logger.info('profile.updated event received', { event });

      await saveNotification(
        event.userId,
        'profile_updated',
        'Profile updated',
        `Your profile has been updated successfully.`,
        {}
      );

      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing profile.updated', { err });
      channel.nack(msg, false, false);
    }
  });

  logger.info('All consumers started', { queues: Object.values(QUEUES) });
};
