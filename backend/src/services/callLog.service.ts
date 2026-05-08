import { CallLog } from '../models/CallLog';

export async function listCallLogsForUser(userId: string, limit = 50) {
  return CallLog.find({ $or: [{ caller: userId }, { callee: userId }] })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('caller', 'name avatar')
    .populate('callee', 'name avatar')
    .populate('chat', 'isGroup members')
    .lean();
}
