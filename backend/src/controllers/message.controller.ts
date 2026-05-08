import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../types';
import {
  clearChatForUserService,
  createMessageService,
  deleteForEveryoneService,
  deleteForMeService,
  editMessageService,
  filterEncryptionForRecipient,
  listMessagesService,
  markChatReadService,
  messageToJson,
  totalUnreadService,
} from '../services/message.service';
import {
  broadcastMessageDeleted,
  broadcastMessageEdited,
  broadcastNewMessage,
  broadcastReadReceipt,
} from '../sockets/emitters';

export const sendMessage = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const message = await createMessageService({
    chatId: req.body.chatId,
    senderId: me,
    content: req.body.content,
    type: req.body.type,
    attachment: req.body.attachment,
    encryption: req.body.encryption,
  });
  await broadcastNewMessage(message);
  res
    .status(201)
    .json({ success: true, data: filterEncryptionForRecipient(messageToJson(message), me) });
});

export const listMessages = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 30);
  const data = await listMessagesService(req.params.chatId, me, page, limit);
  res.json({ success: true, data });
});

export const markRead = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const updated = await markChatReadService(req.params.chatId, me);
  broadcastReadReceipt(req.params.chatId, me);
  res.json({ success: true, data: { updated } });
});

export const totalUnread = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const count = await totalUnreadService(me);
  res.json({ success: true, data: { count } });
});

export const deleteForMe = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const message = await deleteForMeService(req.params.id, me);
  res.json({ success: true, data: message });
});

export const deleteForEveryone = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const message = await deleteForEveryoneService(req.params.id, me);
  await broadcastMessageDeleted(message);
  res.json({ success: true, data: message });
});

export const editMessage = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const message = await editMessageService(req.params.id, me, {
    content: req.body.content,
    encryption: req.body.encryption,
  });
  await broadcastMessageEdited(message);
  res.json({ success: true, data: filterEncryptionForRecipient(messageToJson(message), me) });
});

export const clearChat = asyncHandler(async (req, res: Response) => {
  const me = (req as AuthenticatedRequest).user!.userId;
  const withMedia = String(req.query.withMedia ?? 'false') === 'true';
  const result = await clearChatForUserService(req.params.chatId, me, withMedia);
  res.json({ success: true, data: result });
});
