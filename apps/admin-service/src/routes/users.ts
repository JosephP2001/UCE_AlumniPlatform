import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Columns returned to the admin UI — deliberately excludes any
// password/credential fields that may exist on the shared `users` table.
const SAFE_COLUMNS = 'id, username, email, role, is_active, created_at';

// ── GET /users?limit=50&offset=0 ───────────────────────────────────
router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200); // hard cap 200
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    logger.info('GET /users', { user: req.user?.username, count: rows.length });
    res.json({ data: rows, count: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('GET /users failed', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /users/:id ──────────────────────────────────────────────────
// Body: { role?: string, is_active?: boolean }
// Only the fields provided are updated (partial update).
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role, is_active } = req.body ?? {};

  if (role === undefined && is_active === undefined) {
    res.status(400).json({ error: 'Provide at least one of: role, is_active' });
    return;
  }

  const setClauses: string[] = [];
  const params: (string | boolean | number)[] = [];

  if (role !== undefined) {
    params.push(role);
    setClauses.push(`role = $${params.length}`);
  }
  if (is_active !== undefined) {
    params.push(is_active);
    setClauses.push(`is_active = $${params.length}`);
  }

  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING ${SAFE_COLUMNS}`,
      params
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info('PUT /users/:id', { user: req.user?.username, target_id: id, changes: { role, is_active } });
    res.json({ data: rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('PUT /users/:id failed', { error: message, target_id: id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /users/:id ────────────────────────────────────────────────
// Soft delete: sets is_active = false rather than removing the row.
// This avoids breaking foreign keys from jobs/matches/profiles that
// likely reference user_id. Change to a real DELETE FROM if the team
// decides hard deletion is required instead.
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_active = false WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info('DELETE /users/:id (soft)', { user: req.user?.username, target_id: id });
    res.json({ data: rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('DELETE /users/:id failed', { error: message, target_id: id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
