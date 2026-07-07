import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

jest.mock('./db', () => ({
  pool: { query: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { pool } from './db';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import usersRouter from './routes/users';

const mockedQuery = pool.query as jest.Mock;

const app = express();
app.use(express.json());
app.use('/users', usersRouter);

function adminToken(): string {
  return jwt.sign({ id: 1, username: 'admin', role: 'admin' }, 'test-secret');
}

function userToken(): string {
  return jwt.sign({ id: 2, username: 'regular', role: 'user' }, 'test-secret');
}

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('GET /users', () => {
  it('should return 401 if no Authorization header', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app).get('/users').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('should return 403 if user is not admin', async () => {
    const res = await request(app).get('/users').set('Authorization', `Bearer ${userToken()}`);
    expect(res.status).toBe(403);
  });

  it('should return 200 with user list for admin', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'ana', email: 'ana@uce.edu.ec', role: 'user', is_active: true, created_at: '2026-01-01' }],
    });

    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.count).toBe(1);
  });

  it('should cap limit at 200', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/users?limit=9999').set('Authorization', `Bearer ${adminToken()}`);
    const [, params] = mockedQuery.mock.calls[0];
    expect(params[0]).toBe(200);
  });

  it('should return 500 on DB error', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('connection lost'));
    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(500);
  });
});

describe('PUT /users/:id', () => {
  it('should return 400 if no fields provided', async () => {
    const res = await request(app)
      .put('/users/1')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 404 if user does not exist', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/users/999')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(404);
  });

  it('should return 200 and update role', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'ana', email: 'ana@uce.edu.ec', role: 'admin', is_active: true, created_at: '2026-01-01' }],
    });
    const res = await request(app)
      .put('/users/1')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });
});

describe('DELETE /users/:id', () => {
  it('should return 404 if user does not exist', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/users/999').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
  });

  it('should soft-delete (deactivate) and return 200', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'ana', email: 'ana@uce.edu.ec', role: 'user', is_active: false, created_at: '2026-01-01' }],
    });
    const res = await request(app).delete('/users/1').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });
});
