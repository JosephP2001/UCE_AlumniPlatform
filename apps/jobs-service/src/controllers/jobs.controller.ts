import { Request, Response } from 'express';
import { pgPool, redisClient } from '../services/db.service';
import logger from '../logger';

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

      await redisClient.del('jobs:all');
      logger.info('Job created', { jobId: result.rows[0].id, title, company });
      res.status(201).json({ job: result.rows[0] });
    } catch (error) {
      logger.error('createJob error', { error });
      res.status(500).json({ error: 'Failed to create job' });
    }
  };

  // QUERY SIDE — Redis cache first, fallback to PostgreSQL
  getJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const cached = await redisClient.get('jobs:all');
      if (cached) {
        logger.info('getJobs cache hit');
        res.json({ jobs: JSON.parse(cached), source: 'cache' });
        return;
      }

      const result = await pgPool.query(
        'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50'
      );

      await redisClient.setEx('jobs:all', CACHE_TTL, JSON.stringify(result.rows));
      logger.info('getJobs cache miss — queried PostgreSQL', { count: result.rows.length });
      res.json({ jobs: result.rows, source: 'database' });
    } catch (error) {
      logger.error('getJobs error', { error });
      res.status(500).json({ error: 'Failed to get jobs' });
    }
  };

  // QUERY SIDE — get single job by ID
  getJobById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const cached = await redisClient.get(`jobs:${id}`);
      if (cached) {
        logger.info('getJobById cache hit', { jobId: id });
        res.json({ job: JSON.parse(cached), source: 'cache' });
        return;
      }

      const result = await pgPool.query(
        'SELECT * FROM jobs WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        logger.warn('getJobById not found', { jobId: id });
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      await redisClient.setEx(`jobs:${id}`, CACHE_TTL, JSON.stringify(result.rows[0]));
      logger.info('getJobById cache miss — queried PostgreSQL', { jobId: id });
      res.json({ job: result.rows[0], source: 'database' });
    } catch (error) {
      logger.error('getJobById error', { error, jobId: id });
      res.status(500).json({ error: 'Failed to get job' });
    }
  };
}