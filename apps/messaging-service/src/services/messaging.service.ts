import { Conversation, IConversation } from '../models/conversation.model';
import { Message, IMessage } from '../models/message.model';

export type LeanConversation = {
  _id: string;
  participants: string[];
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LeanMessage = {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

class MessagingService {
  // ── Conversations ──────────────────────────────────────────────

  async getConversationsByUser(userId: string): Promise<LeanConversation[]> {
    return Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean() as unknown as LeanConversation[];
  }

  async getConversationById(conversationId: string): Promise<LeanConversation | null> {
    return Conversation.findById(conversationId).lean() as unknown as LeanConversation | null;
  }

  async getOrCreateConversation(userIdA: string, userIdB: string): Promise<LeanConversation> {
    const existing = await Conversation.findOne({
      participants: { $all: [userIdA, userIdB], $size: 2 },
    }).lean() as unknown as LeanConversation | null;

    if (existing) return existing;

    const created = await Conversation.create({
      participants: [userIdA, userIdB],
    });
    return created.toObject() as unknown as LeanConversation;
  }

  // ── Messages ───────────────────────────────────────────────────

  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: LeanMessage[]; total: number; page: number }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as unknown as Promise<LeanMessage[]>,
      Message.countDocuments({ conversationId }),
    ]);

    return { messages: messages.reverse(), total, page };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    recipientId: string,
    content: string
  ): Promise<LeanMessage> {
    const message = await Message.create({
      conversationId,
      senderId,
      recipientId,
      content,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: content,
      lastMessageAt: message.createdAt,
    });

    return message.toObject() as unknown as LeanMessage;
  }

  async markAsRead(conversationId: string, userId: string): Promise<number> {
    const result = await Message.updateMany(
      { conversationId, recipientId: userId, readAt: null },
      { readAt: new Date() }
    );
    return result.modifiedCount;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Message.countDocuments({ recipientId: userId, readAt: null });
  }
}

export const messagingService = new MessagingService();
