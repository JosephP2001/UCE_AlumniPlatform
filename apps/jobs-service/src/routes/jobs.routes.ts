import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const jobsController = new JobsController();

router.post('/', authMiddleware, jobsController.createJob);   // ← protected
router.get('/', jobsController.getJobs);                        
router.get('/:id', jobsController.getJobById);                  

export { router as jobsRouter };