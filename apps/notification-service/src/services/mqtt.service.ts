import mqtt from 'mqtt';
import logger from '../logger';

const MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

let client: mqtt.MqttClient | null = null;

export const connectMQTT = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    client = mqtt.connect(MQTT_URL, {
      clientId: `notification-service-${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });

    client.on('connect', () => {
      logger.info('MQTT connected', { broker: MQTT_URL });
      resolve();
    });

    client.on('error', (err) => {
      logger.warn('MQTT connection error', { err: err.message });
      reject(err);
    });

    client.on('reconnect', () => {
      logger.info('MQTT reconnecting...');
    });
  });
};

export const publishMQTT = (topic: string, payload: object): void => {
  if (!client?.connected) {
    logger.warn('MQTT not connected — skipping publish', { topic });
    return;
  }
  client.publish(
    topic,
    JSON.stringify(payload),
    { qos: 1, retain: false },
    (err) => {
      if (err) {
        logger.error('MQTT publish error', { topic, err: err.message });
      } else {
        logger.info('MQTT published', { topic, payload });
      }
    }
  );
};