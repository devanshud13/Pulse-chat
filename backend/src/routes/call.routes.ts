import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { myCallLogs } from '../controllers/call.controller';

const router = Router();

router.use(authenticate);
router.get('/logs', myCallLogs);

export default router;
