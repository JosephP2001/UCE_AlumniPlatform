import { Request, Response } from 'express';
import { JobsController } from '../controllers/jobs.controller';
import { pgPool, redisClient } from '../services/db.service';

jest.mock('../services/db.service', () => ({
  pgPool: { query: jest.fn() },
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  },
  connectRedis: jest.fn(),
}));

const mockReq = (body = {}, params = {}) => ({
  body, params
} as unknown as Request);

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('JobsController', () => {
  let controller: JobsController;

  beforeEach(() => {
    controller = new JobsController();
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('should return 400 if title or company is missing', async () => {
      const req = mockReq({ description: 'test' });
      const res = mockRes();
      await controller.createJob(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create a job and return 201', async () => {
      const mockJob = { id: 1, title: 'Dev', company: 'UCE' };
      (pgPool.query as jest.Mock).mockResolvedValue({ rows: [mockJob] });
      (redisClient.del as jest.Mock).mockResolvedValue(1);

      const req = mockReq({ title: 'Dev', company: 'UCE' });
      const res = mockRes();
      await controller.createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ job: mockJob });
    });
  });

  describe('getJobs', () => {
    it('should return cached jobs if cache hit', async () => {
      const cachedJobs = [{ id: 1, title: 'Dev' }];
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedJobs));

      const req = mockReq();
      const res = mockRes();
      await controller.getJobs(req, res);

      expect(res.json).toHaveBeenCalledWith({ jobs: cachedJobs, source: 'cache' });
    });

    it('should query PostgreSQL on cache miss', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      const dbJobs = [{ id: 1, title: 'Dev' }];
      (pgPool.query as jest.Mock).mockResolvedValue({ rows: dbJobs });
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');

      const req = mockReq();
      const res = mockRes();
      await controller.getJobs(req, res);

      expect(pgPool.query).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ jobs: dbJobs, source: 'database' });
    });
  });

  describe('getJobById', () => {
    it('should return 404 if job not found', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (pgPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const req = mockReq({}, { id: '999' });
      const res = mockRes();
      await controller.getJobById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return job from database on cache miss', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      const mockJob = { id: 1, title: 'Dev' };
      (pgPool.query as jest.Mock).mockResolvedValue({ rows: [mockJob] });
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');

      const req = mockReq({}, { id: '1' });
      const res = mockRes();
      await controller.getJobById(req, res);

      expect(res.json).toHaveBeenCalledWith({ job: mockJob, source: 'database' });
    });
  });
});