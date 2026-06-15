import { Request, Response } from 'express';
import { pgPool } from '../services/db.service';
import logger from '../logger';

export class NotificationController {

  // GET /notifications/:userId
  getByUser = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    try {
      const result = await pgPool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );
      res.json({ notifications: result.rows });
    } catch (err) {
      logger.error('getByUser error', { err });
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  };

  // PUT /notifications/:id/read
  markRead = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      await pgPool.query(
        `UPDATE notifications SET read = TRUE WHERE id = $1`,
        [id]
      );
      res.json({ success: true });
    } catch (err) {
      logger.error('markRead error', { err });
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  };

  // GET /health
  health = (_req: Request, res: Response): void => {
    res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
  };
}
