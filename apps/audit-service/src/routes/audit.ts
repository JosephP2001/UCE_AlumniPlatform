import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAdmin, AuthRequest } from '@uce-platform/auth-shared';
import { logger } from '../index';

const router = Router();

// GET /audit?limit=50&event_type=job.created
router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200); // hard cap 200
  const eventType = req.query.event_type as string | undefined;

  try {
    let query  = 'SELECT * FROM audit_logs';
    const params: (string | number)[] = [];

    if (eventType) {
      params.push(eventType);
      query += ` WHERE event_type = $${params.length}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);

    logger.info('GET /audit', {
      user: req.user?.username,
      event_type: eventType ?? 'all',
      count: rows.length,
    });

    res.json({ data: rows, count: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('GET /audit failed', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
