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

export const setPublicKeyService = async (userId: string, publicKey: string) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { publicKey },
    { new: true, runValidators: true },
  );
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const setKeyBundleService = async (
  userId: string,
  bundle: { publicKey: string; encryptedPrivateKey: string; keySalt: string; keyIv: string },
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      publicKey: bundle.publicKey,
      encryptedPrivateKey: bundle.encryptedPrivateKey,
      keySalt: bundle.keySalt,
      keyIv: bundle.keyIv,
    },
    { new: true, runValidators: true },
  );
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const getKeyBundleService = async (
  userId: string,
): Promise<{
  publicKey: string;
  encryptedPrivateKey: string;
  keySalt: string;
  keyIv: string;
}> => {
  const user = await User.findById(userId).select(
    '+encryptedPrivateKey +keySalt +keyIv publicKey',
  );
  if (!user) throw ApiError.notFound('User not found');
  return {
    publicKey: user.publicKey ?? '',
    encryptedPrivateKey: user.encryptedPrivateKey ?? '',
    keySalt: user.keySalt ?? '',
    keyIv: user.keyIv ?? '',
  };
};

export const getPublicKeysService = async (
  ids: string[],
): Promise<Record<string, string>> => {
  const valid = ids.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
  if (valid.length === 0) return {};
  const users = await User.find({ _id: { $in: valid } }).select('_id publicKey');
  const out: Record<string, string> = {};
  for (const u of users) {
    if (u.publicKey) out[u._id.toString()] = u.publicKey;
  }
  return out;
};
