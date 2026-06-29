import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import messagingRoutes from './routes/messaging.routes';
import { initWebSocketServer } from './websocket/websocket';

const app = express();
const PORT = process.env.PORT ?? 3008;

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'messaging-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/', messagingRoutes);

const server = createServer(app);

// WebSocket server mounted on the same HTTP server, path /ws
// Nginx proxies /api/messaging/ws -> /ws on this container
initWebSocketServer(server);

async function main() {
  const mongoUri = process.env.MONGO_URI ?? 'mongodb://mongodb:27017';
  const mongoDb  = process.env.MONGO_DB  ?? 'messaging_db';

  await mongoose.connect(mongoUri, { dbName: mongoDb });
  console.log('[messaging-service] MongoDB connection verified');

  server.listen(PORT, () => {
    console.log(`[messaging-service] started on port ${PORT} (env: ${process.env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[messaging-service] Fatal error starting service', err);
  process.exit(1);
});
