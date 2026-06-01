import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { jobsRouter } from './routes/jobs.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*', credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'jobs-service', timestamp: new Date().toISOString() });
});

app.use('/jobs', jobsRouter);

app.listen(PORT, () => {
  console.log(`jobs-service running on port ${PORT}`);
});

export default app;