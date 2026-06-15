import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const ctrl = new NotificationController();

router.get('/health', ctrl.health);
router.get('/:userId', authMiddleware, ctrl.getByUser);
router.put('/:id/read', authMiddleware, ctrl.markRead);

export { router as notificationRouter };
