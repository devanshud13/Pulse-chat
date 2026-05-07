import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createGroupSchema,
  memberActionSchema,
  oneToOneSchema,
  updateGroupSchema,
} from '../validators/chat';
import {
  accessOneToOne,
  addMember,
  createGroup,
  getChat,
  leaveGroup,
  myChats,
  removeMember,
  updateGroup,
} from '../controllers/chat.controller';

const router = Router();

router.use(authenticate);

router.get('/', myChats);
router.post('/one-to-one', validate(oneToOneSchema), accessOneToOne);
router.post('/group', validate(createGroupSchema), createGroup);
router.get('/:id', getChat);
router.patch('/:id/group', validate(updateGroupSchema), updateGroup);
router.post('/:id/group/members', validate(memberActionSchema), addMember);
router.delete('/:id/group/members', validate(memberActionSchema), removeMember);
router.post('/:id/group/leave', leaveGroup);

export default router;
