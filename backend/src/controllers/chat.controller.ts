import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../types';
import {
  accessOrCreateOneToOne,
  addMemberService,
  createGroupService,
  getChatById,
  leaveGroupService,
  listUserChats,
  removeMemberService,
  updateGroupService,
} from '../services/chat.service';
import { unreadCountsByChat } from '../services/message.service';

export const accessOneToOne = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const chat = await accessOrCreateOneToOne(me, req.body.userId);
  res.json({ success: true, data: chat });
});

export const myChats = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const [chats, unread] = await Promise.all([listUserChats(me), unreadCountsByChat(me)]);
  res.json({ success: true, data: { chats, unread } });
});

export const getChat = asyncHandler(async (req, res: Response) => {
  const chat = await getChatById(req.params.id, (req as AuthenticatedRequest).user!.userId);
  res.json({ success: true, data: chat });
});

export const createGroup = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const chat = await createGroupService(me, req.body);
  res.status(201).json({ success: true, data: chat });
});

export const updateGroup = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const chat = await updateGroupService(req.params.id, me, req.body);
  res.json({ success: true, data: chat });
});

export const addMember = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const chat = await addMemberService(req.params.id, me, req.body.userId);
  res.json({ success: true, data: chat });
});

export const removeMember = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const chat = await removeMemberService(req.params.id, me, req.body.userId);
  res.json({ success: true, data: chat });
});

export const leaveGroup = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const chat = await leaveGroupService(req.params.id, me);
  res.json({ success: true, data: chat });
});
