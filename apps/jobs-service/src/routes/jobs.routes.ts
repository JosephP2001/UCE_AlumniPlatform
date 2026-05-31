import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller';

const router = Router();
const jobsController = new JobsController();

router.post('/', jobsController.createJob);
router.get('/', jobsController.getJobs);
router.get('/:id', jobsController.getJobById);

export { router as jobsRouter };