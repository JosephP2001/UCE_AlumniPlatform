import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
const authController = new AuthController();

router.get('/github', authController.githubLogin);
router.get('/github/callback', authController.githubCallback);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authController.me);

export { router as authRouter };