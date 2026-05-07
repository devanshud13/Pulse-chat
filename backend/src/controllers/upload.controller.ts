import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const uploadFile = asyncHandler(async (req, res: Response) => {
  const file = req.file as Express.Multer.File & { path: string; filename: string };
  if (!file) throw ApiError.badRequest('No file uploaded');

  res.status(201).json({
    success: true,
    data: {
      url: file.path,
      publicId: file.filename,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    },
  });
});
