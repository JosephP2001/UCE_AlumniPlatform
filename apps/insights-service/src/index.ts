import express from 'express';
import { config } from './config';
import { insightsRouter } from './routes/insights';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'insights-service' });
});

app.use('/api/insights', insightsRouter);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[insights-service] escuchando en puerto ${config.port}`);
  });
}
