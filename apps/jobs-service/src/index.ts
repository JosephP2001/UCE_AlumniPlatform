import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { jobsRouter } from './routes/jobs.routes';
import { pgPool, redisClient, connectRedis } from './services/db.service';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*', credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'jobs-service', timestamp: new Date().toISOString() });
});

app.use('/jobs', jobsRouter);

const initDB = async () => {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      company VARCHAR(255) NOT NULL,
      description TEXT,
      location VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Database initialized');
};

const start = async () => {
  await initDB();
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`jobs-service running on port ${PORT}`);
  });
};

start().catch(console.error);

export default app;