import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
const controller = new ProfileController();

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: List all alumni profiles
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: List of profiles
 */
router.get('/', controller.listProfiles);

/**
 * @swagger
 * /profile/{userId}:
 *   get:
 *     summary: Get a profile by user ID
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile found
 *       404:
 *         description: Profile not found
 */
router.get('/:userId', controller.getProfile);

/**
 * @swagger
 * /profile:
 *   post:
 *     summary: Create alumni profile (JWT required)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, career]
 *             properties:
 *               full_name:
 *                 type: string
 *               career:
 *                 type: string
 *               graduation_year:
 *                 type: integer
 *               bio:
 *                 type: string
 *               skills:
 *                 type: string
 *               location:
 *                 type: string
 *               linkedin_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile created
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Profile already exists
 */
router.post('/', requireAuth, controller.createProfile);

/**
 * @swagger
 * /profile/{userId}:
 *   put:
 *     summary: Update own profile (JWT required)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot update another user's profile
 */
router.put('/:userId', requireAuth, controller.updateProfile);

export { router as profileRouter };
