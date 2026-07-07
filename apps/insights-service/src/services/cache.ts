import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

let client: RedisClientType | null = null;

async function getClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on('error', (err) => console.error('[insights-service] Redis error', err));
    await client.connect();
  }
  return client;
}

export async function getCached(key: string): Promise<string | null> {
  const c = await getClient();
  return c.get(key);
}

export async function setCached(key: string, value: string, ttlSeconds: number = config.cacheTtlSeconds): Promise<void> {
  const c = await getClient();
  await c.set(key, value, { EX: ttlSeconds });
}

export async function closeCache(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
