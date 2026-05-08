import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../types';
import {
  getMeService,
  getPublicKeysService,
  searchUsersService,
  setPublicKeyService,
  updateProfileService,
} from '../services/user.service';

export const getMe = asyncHandler(async (req, res: Response) => {
  const user = await getMeService((req as AuthenticatedRequest).user!.userId);
  res.json({ success: true, data: user });
});

export const updateProfile = asyncHandler(async (req, res: Response) => {
  const user = await updateProfileService((req as AuthenticatedRequest).user!.userId, req.body);
  res.json({ success: true, data: user });
});

export const searchUsers = asyncHandler(async (req, res: Response) => {
  const q = (req.query.q as string) ?? '';
  const users = await searchUsersService(q, (req as AuthenticatedRequest).user!.userId);
  res.json({ success: true, data: users });
});

export const setPublicKey = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const user = await setPublicKeyService(me, req.body.publicKey);
  res.json({ success: true, data: user });
});

export const getPublicKeys = asyncHandler(async (req, res: Response) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const keys = await getPublicKeysService(ids);
  res.json({ success: true, data: keys });
});
