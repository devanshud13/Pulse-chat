import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadFile } from '../controllers/upload.controller';

const router = Router();

router.use(authenticate);

router.post('/', upload.single('file'), uploadFile);

export default router;
