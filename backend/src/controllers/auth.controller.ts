import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { loginService, logoutService, refreshService, signupService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await signupService(req.body);
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginService(req.body);
  res.json({ success: true, data: result });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await refreshService(req.body.refreshToken);
  res.json({ success: true, data: tokens });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  await logoutService(userId, req.body?.refreshToken ?? '');
  res.json({ success: true, message: 'Logged out' });
});
