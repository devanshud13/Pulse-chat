import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../types';
import {
  listNotificationsService,
  markAllNotificationsReadService,
  markNotificationReadService,
  unreadNotificationCountService,
} from '../services/notification.service';

export const list = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const data = await listNotificationsService(me);
  res.json({ success: true, data });
});

export const unreadCount = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const count = await unreadNotificationCountService(me);
  res.json({ success: true, data: { count } });
});

export const markRead = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const data = await markNotificationReadService(req.params.id, me);
  res.json({ success: true, data });
});

export const markAllRead = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const updated = await markAllNotificationsReadService(me);
  res.json({ success: true, data: { updated } });
});
