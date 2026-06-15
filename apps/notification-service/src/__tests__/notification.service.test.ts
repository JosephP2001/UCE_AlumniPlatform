import { NotificationController } from '../controllers/notification.controller';
import { Request, Response } from 'express';

// Mock pg pool
jest.mock('../services/db.service', () => ({
  pgPool: {
    query: jest.fn(),
  },
  initDb: jest.fn(),
}));

jest.mock('../services/rabbitmq.service', () => ({
  connectRabbitMQ: jest.fn(),
  getChannel: jest.fn(),
}));

const { pgPool } = require('../services/db.service');

const mockRes = () => {
  const res = {} as Response;
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

describe('NotificationController', () => {
  const ctrl = new NotificationController();

  beforeEach(() => jest.clearAllMocks());

  it('GET /health returns ok', () => {
    const req = {} as Request;
    const res = mockRes();
    ctrl.health(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', service: 'notification-service' })
    );
  });

  it('GET /:userId returns notifications', async () => {
    const mockRows = [
      { id: 1, user_id: '123', type: 'welcome', title: 'Welcome', message: 'Hi!', read: false },
    ];
    pgPool.query.mockResolvedValueOnce({ rows: mockRows });

    const req = { params: { userId: '123' } } as unknown as Request;
    const res = mockRes();
    await ctrl.getByUser(req, res);

    expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), ['123']);
    expect(res.json).toHaveBeenCalledWith({ notifications: mockRows });
  });

  it('GET /:userId returns 500 on DB error', async () => {
    pgPool.query.mockRejectedValueOnce(new Error('DB error'));
    const req = { params: { userId: '123' } } as unknown as Request;
    const res = mockRes();
    await ctrl.getByUser(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('PUT /:id/read marks notification as read', async () => {
    pgPool.query.mockResolvedValueOnce({ rows: [] });
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await ctrl.markRead(req, res);
    expect(pgPool.query).toHaveBeenCalledWith(expect.stringContaining('SET read = TRUE'), ['1']);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('PUT /:id/read returns 500 on DB error', async () => {
    pgPool.query.mockRejectedValueOnce(new Error('DB error'));
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await ctrl.markRead(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('GET /:userId with no notifications returns empty array', async () => {
    pgPool.query.mockResolvedValueOnce({ rows: [] });
    const req = { params: { userId: '999' } } as unknown as Request;
    const res = mockRes();
    await ctrl.getByUser(req, res);
    expect(res.json).toHaveBeenCalledWith({ notifications: [] });
  });
});
