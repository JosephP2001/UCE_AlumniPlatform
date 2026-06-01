import { Request, Response } from 'express';
import { pgPool, redisClient } from '../services/db.service';

const CACHE_TTL = 60; // seconds

export class JobsController {

  // COMMAND SIDE — write to PostgreSQL
  createJob = async (req: Request, res: Response): Promise<void> => {
    const { title, description, company, location, salary } = req.body;

    if (!title || !company) {
      res.status(400).json({ error: 'title and company are required' });
      return;
    }

    try {
      const result = await pgPool.query(
        `INSERT INTO jobs (title, description, company, location, salary, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [title, description, company, location, salary]
      );

      // Invalidate cache on write
      await redisClient.del('jobs:all');

      res.status(201).json({ job: result.rows[0] });
    } catch (error) {
      console.error('createJob error:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  };

  // QUERY SIDE — Redis cache first, fallback to PostgreSQL
  getJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      // Cache hit
      const cached = await redisClient.get('jobs:all');
      if (cached) {
        res.json({ jobs: JSON.parse(cached), source: 'cache' });
        return;
      }

      // Cache miss — query PostgreSQL
      const result = await pgPool.query(
        'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50'
      );

      // Store in Redis cache
      await redisClient.setEx('jobs:all', CACHE_TTL, JSON.stringify(result.rows));

      res.json({ jobs: result.rows, source: 'database' });
    } catch (error) {
      console.error('getJobs error:', error);
      res.status(500).json({ error: 'Failed to get jobs' });
    }
  };

  // QUERY SIDE — get single job by ID
  getJobById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      // Cache hit
      const cached = await redisClient.get(`jobs:${id}`);
      if (cached) {
        res.json({ job: JSON.parse(cached), source: 'cache' });
        return;
      }

      // Cache miss — query PostgreSQL
      const result = await pgPool.query(
        'SELECT * FROM jobs WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // Store in Redis cache
      await redisClient.setEx(`jobs:${id}`, CACHE_TTL, JSON.stringify(result.rows[0]));

      res.json({ job: result.rows[0], source: 'database' });
    } catch (error) {
      console.error('getJobById error:', error);
      res.status(500).json({ error: 'Failed to get job' });
    }
  };
}