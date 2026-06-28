import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../src/db/postgres', () => ({
  pgPool: { query: jest.fn() },
  initPG: jest.fn(),
}));

jest.mock('../src/db/mongo', () => ({
  getMongoDB: jest.fn(),
  initMongo: jest.fn(),
}));

jest.mock('../src/index', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { pgPool } from '../src/db/postgres';
import { getMongoDB } from '../src/db/mongo';
import analyticsRouter from '../src/routes/analytics';

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
app.use('/analytics', analyticsRouter);

function makeToken(role: string) {
  return jwt.sign({ id: 1, username: 'test', role }, JWT_SECRET, { expiresIn: '1h' });
}

const mockCollection = {
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getMongoDB as jest.Mock).mockReturnValue({ collection: () => mockCollection });
});

describe('GET /analytics/summary', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/analytics/summary');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${makeToken('student')}`);
    expect(res.status).toBe(403);
  });

  it('should return summary for admin', async () => {
    (pgPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ total: '10' }] })
      .mockResolvedValueOnce({ rows: [{ total: '5' }] })
      .mockResolvedValueOnce({ rows: [{ total: '20' }] });
    mockCollection.countDocuments.mockResolvedValue(8);

    const res = await request(app)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total_jobs).toBe(10);
    expect(res.body.data.total_profiles).toBe(8);
  });
});

describe('GET /analytics/jobs', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/analytics/jobs');
    expect(res.status).toBe(401);
  });

  it('should return jobs analytics for admin', async () => {
    (pgPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ job_type: 'remote', total: '5' }] })
      .mockResolvedValueOnce({ rows: [{ day: '2026-06-01', total: '3' }] });

    const res = await request(app)
      .get('/analytics/jobs')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.by_type).toHaveLength(1);
    expect(res.body.data.by_day).toHaveLength(1);
  });
});

describe('GET /analytics/matches', () => {
  it('should return matches analytics for admin', async () => {
    (pgPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ total_matches: '15', avg_score: '78.50', max_score: '95', min_score: '40' }] })
      .mockResolvedValueOnce({ rows: [{ day: '2026-06-01', total: '5' }] });

    const res = await request(app)
      .get('/analytics/matches')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.avg_score).toBe('78.50');
    expect(res.body.data.by_day).toHaveLength(1);
  });
});

describe('GET /analytics/profiles', () => {
  it('should return profiles analytics for admin', async () => {
    mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([{ career: 'CS', total: 5 }]) });

    const res = await request(app)
      .get('/analytics/profiles')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.by_career).toHaveLength(1);
  });
});
