import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { editMessageSchema, sendMessageSchema } from '../validators/chat';
import {
  clearChat,
  deleteForEveryone,
  deleteForMe,
  editMessage,
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
router.delete('/:chatId/clear', clearChat);
router.patch('/:id', validate(editMessageSchema), editMessage);
router.delete('/:id/me', deleteForMe);
router.delete('/:id/everyone', deleteForEveryone);
/** Legacy: maps to delete-for-everyone for backward compatibility. */
router.delete('/:id', deleteForEveryone);

export default router;
