import { MongoClient, Db } from 'mongodb';
import { logger } from '../index';

let db: Db;

export function getMongoDB(): Db {
  if (!db) throw new Error('MongoDB not initialized');
  return db;
}

export async function initMongo(): Promise<void> {
  const uri = process.env.MONGO_URI ?? 'mongodb://mongodb:27017';
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGO_DB ?? 'profiles_db');
  logger.info('MongoDB connection verified');
}
