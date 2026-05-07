import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  list,
  markAllRead,
  markRead,
  unreadCount,
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.get('/unread/count', unreadCount);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

export default router;
