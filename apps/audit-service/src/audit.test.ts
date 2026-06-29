import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock DB and Kafka before importing routes
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn(),
  },
  initDB: jest.fn(),
}));

jest.mock('../src/consumers/kafkaConsumer', () => ({
  startKafkaConsumer: jest.fn(),
  stopKafkaConsumer: jest.fn(),
}));

jest.mock('../src/index', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { pool } from '../src/db';
import auditRouter from '../src/routes/audit';

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
app.use('/audit', auditRouter);

function makeToken(role: string) {
  return jwt.sign({ id: 1, username: 'testuser', role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('GET /audit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 if no Authorization header', async () => {
    const res = await request(app).get('/audit');
    expect(res.status).toBe(401);
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app)
      .get('/audit')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });

  it('should return 403 if user is not admin', async () => {
    const token = makeToken('student');
    const res = await request(app)
      .get('/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 with audit logs for admin', async () => {
    const mockRows = [
      {
        id: 'uuid-1',
        event_type: 'job.created',
        payload: { title: 'Dev' },
        user_id: '42',
        timestamp: new Date().toISOString(),
      },
    ];
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

    const token = makeToken('admin');
    const res = await request(app)
      .get('/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.count).toBe(1);
  });

  it('should filter by event_type when provided', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const token = makeToken('admin');
    const res = await request(app)
      .get('/audit?event_type=job.created&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const call = (pool.query as jest.Mock).mock.calls[0];
    expect(call[0]).toContain('WHERE event_type');
    expect(call[1]).toContain('job.created');
  });

  it('should cap limit at 200', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const token = makeToken('admin');
    await request(app)
      .get('/audit?limit=9999')
      .set('Authorization', `Bearer ${token}`);

    const call = (pool.query as jest.Mock).mock.calls[0];
    expect(call[1]).toContain(200);
  });

  it('should return 500 on DB error', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('DB down'));

    const token = makeToken('admin');
    const res = await request(app)
      .get('/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});
