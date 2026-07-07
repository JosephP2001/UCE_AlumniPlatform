import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3010),
  redisUrl: requireEnv('REDIS_URL', 'redis://localhost:6379'),
  analyticsServiceUrl: requireEnv('ANALYTICS_SERVICE_URL', 'http://analytics-service:3007'),
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 3600),
  jwtSecret: requireEnv('JWT_SECRET'),
};
