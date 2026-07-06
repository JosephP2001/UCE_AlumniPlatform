import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { messagingService } from '../services/messaging.service';

export class MessagingController {
  async getConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = String(req.user!.id);
      const conversations = await messagingService.getConversationsByUser(userId);
      res.json({ conversations });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  async startConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { recipientId } = req.body;
      if (!recipientId) {
        res.status(400).json({ error: 'recipientId is required' });
        return;
      }
      const senderId = String(req.user!.id);
      if (senderId === recipientId) {
        res.status(400).json({ error: 'Cannot start a conversation with yourself' });
        return;
      }
      const conversation = await messagingService.getOrCreateConversation(senderId, recipientId);
      res.status(201).json({ conversation });
    } catch (err) {
      res.status(500).json({ error: 'Failed to start conversation' });
    }
  }

  async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = String(req.user!.id);

      const conversation = await messagingService.getConversationById(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      if (!conversation.participants.includes(userId)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const result = await messagingService.getMessages(conversationId, page, limit);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      if (!content?.trim()) {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const conversation = await messagingService.getConversationById(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const senderId = String(req.user!.id);
      if (!conversation.participants.includes(senderId)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const recipientId = conversation.participants.find(p => p !== senderId)!;
      const message = await messagingService.sendMessage(
        conversationId,
        senderId,
        recipientId,
        content.trim()
      );

      res.status(201).json({ message });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = String(req.user!.id);
      const updated = await messagingService.markAsRead(conversationId, userId);
      res.json({ markedAsRead: updated });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = String(req.user!.id);
      const count = await messagingService.getUnreadCount(userId);
      res.json({ unread: count });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }
}

export const messagingController = new MessagingController();