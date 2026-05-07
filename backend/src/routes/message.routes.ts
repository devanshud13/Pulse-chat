import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '../validators/chat';
import {
  deleteMessage,
  listMessages,
  markRead,
  sendMessage,
  totalUnread,
} from '../controllers/message.controller';

const router = Router();

router.use(authenticate);

router.post('/', validate(sendMessageSchema), sendMessage);
router.get('/unread/total', totalUnread);
router.get('/:chatId', listMessages);
router.post('/:chatId/read', markRead);
router.delete('/:id', deleteMessage);

export default router;
