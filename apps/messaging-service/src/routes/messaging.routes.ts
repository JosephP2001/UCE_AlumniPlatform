import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { messagingController } from '../controllers/messaging.controller';

const router = Router();

router.use(authMiddleware);

// GET    /conversations                          -> list user's conversations
// POST   /conversations                          -> start/get conversation with recipientId
router.get('/conversations', messagingController.getConversations);
router.post('/conversations', messagingController.startConversation);

// GET    /conversations/:conversationId/messages -> paginated message history
// POST   /conversations/:conversationId/messages -> send message (REST fallback to WS)
router.get('/conversations/:conversationId/messages', messagingController.getMessages);
router.post('/conversations/:conversationId/messages', messagingController.sendMessage);

// PATCH  /conversations/:conversationId/read     -> mark conversation as read
router.patch('/conversations/:conversationId/read', messagingController.markAsRead);

// GET    /unread                                  -> total unread count for the user
router.get('/unread', messagingController.getUnreadCount);

export default router;
