import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  publicKeyQuerySchema,
  searchUsersSchema,
  setKeyBundleSchema,
  setPublicKeySchema,
  updateProfileSchema,
} from '../validators/user';
import {
  getKeyBundle,
  getMe,
  getPublicKeys,
  searchUsers,
  setKeyBundle,
  setPublicKey,
  updateProfile,
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', validate(updateProfileSchema), updateProfile);
router.post('/me/public-key', validate(setPublicKeySchema), setPublicKey);
router.get('/me/key-bundle', getKeyBundle);
router.post('/me/key-bundle', validate(setKeyBundleSchema), setKeyBundle);
router.get('/public-keys', validate(publicKeyQuerySchema, 'query'), getPublicKeys);
router.get('/search', validate(searchUsersSchema, 'query'), searchUsers);

export default router;
