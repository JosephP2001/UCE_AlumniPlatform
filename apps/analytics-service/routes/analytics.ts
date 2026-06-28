import { Router, Response } from 'express';
import { pgPool } from '../db/postgres';
import { getMongoDB } from '../db/mongo';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { logger } from '../index';

const router = Router();

// ── GET /analytics/summary ────────────────────────────────────────
router.get('/summary', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [jobs, users, matches, profiles] = await Promise.all([
      pgPool.query('SELECT COUNT(*) AS total FROM jobs'),
      pgPool.query('SELECT COUNT(*) AS total FROM users'),
      pgPool.query('SELECT COUNT(*) AS total FROM matches'),
      getMongoDB().collection('profiles').countDocuments(),
    ]);

    const data = {
      total_jobs:     Number(jobs.rows[0]?.total    ?? 0),
      total_users:    Number(users.rows[0]?.total   ?? 0),
      total_matches:  Number(matches.rows[0]?.total ?? 0),
      total_profiles: profiles,
    };

    logger.info('GET /analytics/summary', { user: req.user?.username });
    res.json({ data });
  } catch (err: unknown) {
    logger.error('GET /analytics/summary failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /analytics/jobs ───────────────────────────────────────────
router.get('/jobs', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [byType, byDay] = await Promise.all([
      pgPool.query(`
        SELECT job_type, COUNT(*) AS total
        FROM jobs
        GROUP BY job_type
        ORDER BY total DESC
      `),
      pgPool.query(`
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM jobs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);

    logger.info('GET /analytics/jobs', { user: req.user?.username });
    res.json({
      data: {
        by_type: byType.rows,
        by_day:  byDay.rows,
      }
    });
  } catch (err: unknown) {
    logger.error('GET /analytics/jobs failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /analytics/matches ────────────────────────────────────────
router.get('/matches', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [stats, byDay] = await Promise.all([
      pgPool.query(`
        SELECT
          COUNT(*)                              AS total_matches,
          ROUND(AVG(score)::numeric, 2)         AS avg_score,
          MAX(score)                            AS max_score,
          MIN(score)                            AS min_score
        FROM matches
      `),
      pgPool.query(`
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM matches
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);

    logger.info('GET /analytics/matches', { user: req.user?.username });
    res.json({
      data: {
        stats:  stats.rows[0],
        by_day: byDay.rows,
      }
    });
  } catch (err: unknown) {
    logger.error('GET /analytics/matches failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /analytics/profiles ───────────────────────────────────────
router.get('/profiles', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const db = getMongoDB();

    const [byCareer, topSkills] = await Promise.all([
      db.collection('profiles').aggregate([
        { $group: { _id: '$career', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $project: { career: '$_id', total: 1, _id: 0 } },
      ]).toArray(),

      db.collection('profiles').aggregate([
        { $project: { skills: { $split: ['$skills', ','] } } },
        { $unwind: '$skills' },
        { $project: { skill: { $trim: { input: '$skills' } } } },
        { $group: { _id: '$skill', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $project: { skill: '$_id', total: 1, _id: 0 } },
      ]).toArray(),
    ]);

    logger.info('GET /analytics/profiles', { user: req.user?.username });
    res.json({
      data: {
        by_career:  byCareer,
        top_skills: topSkills,
      }
    });
  } catch (err: unknown) {
    logger.error('GET /analytics/profiles failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
