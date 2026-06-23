import { Response } from 'express';
import { pgPool } from '../services/db.service';
import logger from '../logger';
import { AuthRequest } from '../middleware/auth.middleware';

export class ProfileController {

  // GET /profile/:userId — public
  getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    try {
      const result = await pgPool.query(
        'SELECT * FROM profiles WHERE user_id = $1',
        [userId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      logger.info('getProfile success', { userId });
      res.json({ profile: result.rows[0] });
    } catch (error) {
      logger.error('getProfile error', { error, userId });
      res.status(500).json({ error: 'Failed to get profile' });
    }
  };

  // POST /profile — JWT required — create own profile
  createProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { full_name, career, graduation_year, bio, skills, location, linkedin_url } = req.body;

    if (!full_name || !career) {
      res.status(400).json({ error: 'full_name and career are required' });
      return;
    }

    try {
      const existing = await pgPool.query(
        'SELECT id FROM profiles WHERE user_id = $1',
        [userId]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Profile already exists. Use PUT to update.' });
        return;
      }

      const result = await pgPool.query(
        `INSERT INTO profiles
          (user_id, username, full_name, career, graduation_year, bio, skills, location, linkedin_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId,
          req.user?.username,
          full_name,
          career,
          graduation_year ?? null,
          bio ?? null,
          skills ?? null,
          location ?? null,
          linkedin_url ?? null,
        ]
      );

      logger.info('Profile created', { userId, profileId: result.rows[0].id });
      res.status(201).json({ profile: result.rows[0] });
    } catch (error) {
      logger.error('createProfile error', { error, userId });
      res.status(500).json({ error: 'Failed to create profile' });
    }
  };

  // PUT /profile/:userId — JWT required — update own profile only
  updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const requesterId = String(req.user?.id);

    if (requesterId !== userId) {
      res.status(403).json({ error: 'Cannot update another user\'s profile' });
      return;
    }

    const { full_name, career, graduation_year, bio, skills, location, linkedin_url } = req.body;

    try {
      const result = await pgPool.query(
        `UPDATE profiles SET
          full_name       = COALESCE($1, full_name),
          career          = COALESCE($2, career),
          graduation_year = COALESCE($3, graduation_year),
          bio             = COALESCE($4, bio),
          skills          = COALESCE($5, skills),
          location        = COALESCE($6, location),
          linkedin_url    = COALESCE($7, linkedin_url),
          updated_at      = NOW()
         WHERE user_id = $8
         RETURNING *`,
        [full_name, career, graduation_year, bio, skills, location, linkedin_url, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      logger.info('Profile updated', { userId });
      res.json({ profile: result.rows[0] });
    } catch (error) {
      logger.error('updateProfile error', { error, userId });
      res.status(500).json({ error: 'Failed to update profile' });
    }
  };

  // GET /profile — list all profiles (public)
  listProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await pgPool.query(
        'SELECT user_id, username, full_name, career, graduation_year, skills, location FROM profiles ORDER BY created_at DESC LIMIT 50'
      );
      logger.info('listProfiles success', { count: result.rows.length });
      res.json({ profiles: result.rows, total: result.rows.length });
    } catch (error) {
      logger.error('listProfiles error', { error });
      res.status(500).json({ error: 'Failed to list profiles' });
    }
  };
}
