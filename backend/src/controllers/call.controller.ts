import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../types';
import { listCallLogsForUser } from '../services/callLog.service';

export const myCallLogs = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const items = await listCallLogsForUser(me);
  res.json({ success: true, data: items });
});
