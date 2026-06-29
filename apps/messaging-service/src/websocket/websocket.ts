import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'http';
import { messagingService } from '../services/messaging.service';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface WsMessage {
  type: 'send_message' | 'mark_read' | 'ping';
  conversationId?: string;
  content?: string;
}

const clients = new Map<string, Set<AuthenticatedWebSocket>>();

function registerClient(userId: string, ws: AuthenticatedWebSocket) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(ws);
}

function unregisterClient(userId: string, ws: AuthenticatedWebSocket) {
  clients.get(userId)?.delete(ws);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

function sendToUser(userId: string, payload: object) {
  const userSockets = clients.get(userId);
  if (!userSockets) return;
  const data = JSON.stringify(payload);
  for (const ws of userSockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

export function initWebSocketServer(server: Server): WebSocketServer {
  // path: '/ws' — Nginx hace proxy de /api/messaging/ws → /ws en el contenedor
  const wss = new WebSocketServer({ server, path: '/ws' });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedWebSocket;
      if (!socket.isAlive) return socket.terminate();
      socket.isAlive = false;
      socket.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    const url   = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) { ws.close(1008, 'Missing token'); return; }

    let userId: string;
    try {
      const secret = process.env.JWT_SECRET || 'default_secret';
      const decoded = jwt.verify(token, secret) as { userId: string };
      userId = decoded.userId;
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    ws.userId  = userId;
    ws.isAlive = true;
    registerClient(userId, ws);
    console.log(`[ws] User ${userId} connected (${wss.clients.size} total)`);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (msg.type === 'send_message' && msg.conversationId && msg.content?.trim()) {
          const conversation = await messagingService.getConversationById(msg.conversationId);
          if (!conversation || !conversation.participants.includes(userId)) {
            ws.send(JSON.stringify({ type: 'error', error: 'Access denied' }));
            return;
          }
          const recipientId = conversation.participants.find(p => p !== userId)!;
          const saved = await messagingService.sendMessage(
            msg.conversationId, userId, recipientId, msg.content.trim()
          );
          const payload = { type: 'new_message', message: saved };
          sendToUser(userId, payload);
          sendToUser(recipientId, payload);
        }

        if (msg.type === 'mark_read' && msg.conversationId) {
          await messagingService.markAsRead(msg.conversationId, userId);
          ws.send(JSON.stringify({ type: 'messages_read', conversationId: msg.conversationId }));
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      unregisterClient(userId, ws);
      console.log(`[ws] User ${userId} disconnected`);
    });

    ws.on('error', (err) => {
      console.error(`[ws] Error for ${userId}:`, err.message);
    });

    ws.send(JSON.stringify({ type: 'connected', userId }));
  });

  return wss;
}
