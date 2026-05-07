import { Types } from 'mongoose';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';

export const getMeService = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const updateProfileService = async (
  userId: string,
  patch: { name?: string; bio?: string; avatar?: string },
) => {
  const user = await User.findByIdAndUpdate(userId, patch, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const searchUsersService = async (query: string, currentUserId: string) => {
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.find({
    _id: { $ne: new Types.ObjectId(currentUserId) },
    $or: [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }],
  }).limit(20);
};

export const setUserStatusService = async (
  userId: string,
  status: 'online' | 'offline',
): Promise<void> => {
  await User.findByIdAndUpdate(userId, { status, lastSeen: new Date() });
};
