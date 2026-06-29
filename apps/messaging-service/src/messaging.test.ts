import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('./services/messaging.service', () => ({
  messagingService: {
    getConversationsByUser: jest.fn(),
    getOrCreateConversation: jest.fn(),
    getConversationById: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    markAsRead: jest.fn(),
    getUnreadCount: jest.fn(),
  },
}));

import { messagingService } from './services/messaging.service';
import messagingRoutes from './routes/messaging.routes';

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
app.use('/', messagingRoutes);

function makeToken(userId = 'user-1') {
  return jwt.sign({ userId, email: 'test@uce.edu.ec', role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /conversations', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/conversations');
    expect(res.status).toBe(401);
  });

  it('should return conversations for authenticated user', async () => {
    (messagingService.getConversationsByUser as jest.Mock).mockResolvedValue([
      { _id: 'c1', participants: ['user-1', 'user-2'] },
    ]);

    const res = await request(app)
      .get('/conversations')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
  });
});

describe('POST /conversations', () => {
  it('should return 400 without recipientId', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 400 when starting a conversation with yourself', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)
      .send({ recipientId: 'user-1' });
    expect(res.status).toBe(400);
  });

  it('should create or return conversation', async () => {
    (messagingService.getOrCreateConversation as jest.Mock).mockResolvedValue({
      _id: 'c1', participants: ['user-1', 'user-2'],
    });

    const res = await request(app)
      .post('/conversations')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)
      .send({ recipientId: 'user-2' });

    expect(res.status).toBe(201);
    expect(res.body.conversation._id).toBe('c1');
  });
});

describe('GET /conversations/:id/messages', () => {
  it('should return 403 if user is not a participant', async () => {
    (messagingService.getConversationById as jest.Mock).mockResolvedValue({
      _id: 'c1', participants: ['user-2', 'user-3'],
    });

    const res = await request(app)
      .get('/conversations/c1/messages')
      .set('Authorization', `Bearer ${makeToken('user-1')}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 if conversation does not exist', async () => {
    (messagingService.getConversationById as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/conversations/missing/messages')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });

  it('should return paginated messages for a participant', async () => {
    (messagingService.getConversationById as jest.Mock).mockResolvedValue({
      _id: 'c1', participants: ['user-1', 'user-2'],
    });
    (messagingService.getMessages as jest.Mock).mockResolvedValue({
      messages: [{ _id: 'm1', content: 'hi' }], total: 1, page: 1,
    });

    const res = await request(app)
      .get('/conversations/c1/messages')
      .set('Authorization', `Bearer ${makeToken('user-1')}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
  });
});

describe('POST /conversations/:id/messages', () => {
  it('should return 400 without content', async () => {
    const res = await request(app)
      .post('/conversations/c1/messages')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should send a message for a participant', async () => {
    (messagingService.getConversationById as jest.Mock).mockResolvedValue({
      _id: 'c1', participants: ['user-1', 'user-2'],
    });
    (messagingService.sendMessage as jest.Mock).mockResolvedValue({
      _id: 'm1', conversationId: 'c1', senderId: 'user-1', recipientId: 'user-2', content: 'hola',
    });

    const res = await request(app)
      .post('/conversations/c1/messages')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)
      .send({ content: 'hola' });

    expect(res.status).toBe(201);
    expect(res.body.message.content).toBe('hola');
  });
});

describe('PATCH /conversations/:id/read', () => {
  it('should mark messages as read', async () => {
    (messagingService.markAsRead as jest.Mock).mockResolvedValue(3);

    const res = await request(app)
      .patch('/conversations/c1/read')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.markedAsRead).toBe(3);
  });
});

describe('GET /unread', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/unread');
    expect(res.status).toBe(401);
  });

  it('should return unread count', async () => {
    (messagingService.getUnreadCount as jest.Mock).mockResolvedValue(5);

    const res = await request(app)
      .get('/unread')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(5);
  });
});
