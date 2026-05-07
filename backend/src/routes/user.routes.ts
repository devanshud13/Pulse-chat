import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { searchUsersSchema, updateProfileSchema } from '../validators/user';
import { getMe, searchUsers, updateProfile } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', validate(updateProfileSchema), updateProfile);
router.get('/search', validate(searchUsersSchema, 'query'), searchUsers);

export default router;
