import express from 'express';
import { logger } from './logger';
import { initDB } from './db';
import usersRouter from './routes/users';

const app = express();
app.use(express.json());

// ── Health check (public, no auth) ─────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'admin-service',
    timestamp: new Date().toISOString(),
  });
});

// Mounted at /users to match nginx: location /api/admin/ proxies to
// http://admin_service/ with no path suffix, so a client request to
// /api/admin/users arrives here as /users.
app.use('/users', usersRouter);

const PORT = Number(process.env.PORT ?? 3009);

async function start(): Promise<void> {
  try {
    await initDB();
    app.listen(PORT, () => {
      logger.info(`admin-service listening on port ${PORT}`);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Failed to start admin-service', { error: message });
    process.exit(1);
  }
}

// Avoid binding the port / touching the DB when this module is
// imported from tests (users.test.ts builds its own express app).
if (require.main === module) {
  start();
}

export default app;
