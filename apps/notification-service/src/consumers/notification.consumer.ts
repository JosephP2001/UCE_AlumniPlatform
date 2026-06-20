import { Channel } from 'amqplib';
import { pgPool } from '../services/db.service';
import { publishMQTT } from '../services/mqtt.service';
import logger from '../logger';

const QUEUES = {
  JOB_CREATED: 'job.created',
  USER_REGISTERED: 'user.registered',
  PROFILE_UPDATED: 'profile.updated',
};

// MQTT topics
const MQTT_TOPICS = {
  JOB_CREATED:      'uce/notifications/job_created',
  USER_REGISTERED:  'uce/notifications/user_registered',
  PROFILE_UPDATED:  'uce/notifications/profile_updated',
  NEW_MATCH:        'uce/notifications/new_match',
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

interface NewMatchEvent {
  jobId: number;
  userId: string;
  username: string;
  title: string;
  company: string;
  score: number;
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

      // Publish to MQTT — non-blocking
      publishMQTT(MQTT_TOPICS.JOB_CREATED, {
        jobId: event.jobId,
        title: event.title,
        company: event.company,
        timestamp: new Date().toISOString(),
      });

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

      publishMQTT(MQTT_TOPICS.USER_REGISTERED, {
        userId: event.userId,
        username: event.username,
        timestamp: new Date().toISOString(),
      });

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

      publishMQTT(MQTT_TOPICS.PROFILE_UPDATED, {
        userId: event.userId,
        username: event.username,
        timestamp: new Date().toISOString(),
      });

      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing profile.updated', { err });
      channel.nack(msg, false, false);
    }
  });

  // ── new_match queue (desde matching-service vía RabbitMQ) ──
  await channel.assertQueue('new_match', { durable: true });
  channel.consume('new_match', async (msg) => {
    if (!msg) return;
    try {
      const event: NewMatchEvent = JSON.parse(msg.content.toString());
      logger.info('new_match event received', { event });

      await saveNotification(
        event.userId,
        'new_match',
        'New job match found!',
        `You matched with "${event.title}" at ${event.company} (score: ${(event.score * 100).toFixed(0)}%)`,
        { jobId: event.jobId, score: event.score }
      );

      publishMQTT(MQTT_TOPICS.NEW_MATCH, {
        userId: event.userId,
        username: event.username,
        jobId: event.jobId,
        title: event.title,
        company: event.company,
        score: event.score,
        timestamp: new Date().toISOString(),
      });

      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing new_match', { err });
      channel.nack(msg, false, false);
    }
  });

  logger.info('All consumers started', {
    queues: [...Object.values(QUEUES), 'new_match'],
    mqtt_topics: Object.values(MQTT_TOPICS),
  });
};