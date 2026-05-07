import { Types } from 'mongoose';
import { Chat } from '../models/Chat';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';

const POPULATE = [
  { path: 'members', select: 'name email avatar status lastSeen' },
  { path: 'admins', select: 'name email avatar' },
  {
    path: 'lastMessage',
    populate: { path: 'sender', select: 'name avatar' },
  },
];

export const accessOrCreateOneToOne = async (currentUserId: string, otherUserId: string) => {
  if (currentUserId === otherUserId) {
    throw ApiError.badRequest('Cannot create chat with yourself');
  }
  const other = await User.findById(otherUserId);
  if (!other) throw ApiError.notFound('User not found');

  const existing = await Chat.findOne({
    isGroup: false,
    members: { $all: [currentUserId, otherUserId], $size: 2 },
  }).populate(POPULATE);
  if (existing) return existing;

  const chat = await Chat.create({
    isGroup: false,
    members: [currentUserId, otherUserId],
    createdBy: currentUserId,
  });
  return chat.populate(POPULATE);
};

export const listUserChats = async (userId: string) => {
  return Chat.find({ members: userId }).sort({ updatedAt: -1 }).populate(POPULATE);
};

export const createGroupService = async (
  currentUserId: string,
  data: { name: string; members: string[]; description?: string },
) => {
  const memberSet = new Set([...data.members, currentUserId]);
  if (memberSet.size < 2) throw ApiError.badRequest('Group needs at least 2 members');

  const chat = await Chat.create({
    isGroup: true,
    name: data.name,
    description: data.description ?? '',
    members: [...memberSet].map((id) => new Types.ObjectId(id)),
    admins: [new Types.ObjectId(currentUserId)],
    createdBy: new Types.ObjectId(currentUserId),
  });
  return chat.populate(POPULATE);
};

const ensureGroupAdmin = async (chatId: string, userId: string) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw ApiError.notFound('Chat not found');
  if (!chat.isGroup) throw ApiError.badRequest('Not a group chat');
  if (!chat.admins.some((a) => a.toString() === userId)) {
    throw ApiError.forbidden('Only admins can perform this action');
  }
  return chat;
};

export const updateGroupService = async (
  chatId: string,
  userId: string,
  patch: { name?: string; description?: string; avatar?: string },
) => {
  const chat = await ensureGroupAdmin(chatId, userId);
  if (patch.name !== undefined) chat.name = patch.name;
  if (patch.description !== undefined) chat.description = patch.description;
  if (patch.avatar !== undefined) chat.avatar = patch.avatar;
  await chat.save();
  return chat.populate(POPULATE);
};

export const addMemberService = async (chatId: string, adminId: string, userId: string) => {
  const chat = await ensureGroupAdmin(chatId, adminId);
  if (chat.members.some((m) => m.toString() === userId)) {
    throw ApiError.conflict('User is already a member');
  }
  chat.members.push(new Types.ObjectId(userId));
  await chat.save();
  return chat.populate(POPULATE);
};

export const removeMemberService = async (
  chatId: string,
  adminId: string,
  userId: string,
) => {
  const chat = await ensureGroupAdmin(chatId, adminId);
  chat.members = chat.members.filter((m) => m.toString() !== userId);
  chat.admins = chat.admins.filter((a) => a.toString() !== userId);
  await chat.save();
  return chat.populate(POPULATE);
};

export const leaveGroupService = async (chatId: string, userId: string) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw ApiError.notFound('Chat not found');
  if (!chat.isGroup) throw ApiError.badRequest('Not a group chat');
  chat.members = chat.members.filter((m) => m.toString() !== userId);
  chat.admins = chat.admins.filter((a) => a.toString() !== userId);
  if (chat.members.length === 0) {
    await chat.deleteOne();
    return null;
  }
  if (chat.admins.length === 0 && chat.members.length > 0) {
    chat.admins.push(chat.members[0]);
  }
  await chat.save();
  return chat.populate(POPULATE);
};

export const getChatById = async (chatId: string, userId: string) => {
  const chat = await Chat.findById(chatId).populate(POPULATE);
  if (!chat) throw ApiError.notFound('Chat not found');
  if (!chat.members.some((m) => m._id.toString() === userId)) {
    throw ApiError.forbidden('You are not a member of this chat');
  }
  return chat;
};
