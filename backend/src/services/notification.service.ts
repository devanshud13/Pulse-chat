import { Notification } from '../models/Notification';
import { Types } from 'mongoose';

interface CreateNotificationInput {
  userId: string;
  type?: 'message' | 'group_invite' | 'system';
  title: string;
  body: string;
  chatId?: string;
  messageId?: string;
}

export const createNotificationService = async (input: CreateNotificationInput) => {
  return Notification.create({
    user: new Types.ObjectId(input.userId),
    type: input.type ?? 'message',
    title: input.title,
    body: input.body,
    chat: input.chatId ? new Types.ObjectId(input.chatId) : undefined,
    message: input.messageId ? new Types.ObjectId(input.messageId) : undefined,
  });
};

export const listNotificationsService = async (userId: string, limit = 50) => {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
};

export const markNotificationReadService = async (id: string, userId: string) => {
  return Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { read: true },
    { new: true },
  );
};

export const markAllNotificationsReadService = async (userId: string): Promise<number> => {
  const result = await Notification.updateMany({ user: userId, read: false }, { read: true });
  return result.modifiedCount ?? 0;
};

export const unreadNotificationCountService = async (userId: string): Promise<number> => {
  return Notification.countDocuments({ user: userId, read: false });
};
