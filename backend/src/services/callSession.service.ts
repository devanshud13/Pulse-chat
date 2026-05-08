import { randomUUID } from 'crypto';
import { Chat } from '../models/Chat';
import { User } from '../models/User';
import { CallLog } from '../models/CallLog';
import { getSocketServer } from '../sockets/ioRegistry';
import { logger } from '../utils/logger';

export type CallType = 'audio' | 'video';

export interface CallSession {
  callId: string;
  chatId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  state: 'ringing' | 'active';
  ringTimeout: NodeJS.Timeout;
}

const sessions = new Map<string, CallSession>();
/** Maps each user currently in a call flow (ringing or active) to their callId. */
const userToCall = new Map<string, string>();

const RING_MS = 45_000;

export const getSession = (callId: string): CallSession | undefined => sessions.get(callId);

export const userInCall = (userId: string): boolean => userToCall.has(userId);

function removeUserMappings(session: CallSession): void {
  userToCall.delete(session.callerId);
  userToCall.delete(session.calleeId);
}

export function destroySession(callId: string): void {
  const s = sessions.get(callId);
  if (!s) return;
  clearTimeout(s.ringTimeout);
  sessions.delete(callId);
  removeUserMappings(s);
}

export async function validateDirectChat(
  chatId: string,
  userId: string,
): Promise<{ ok: true; peerId: string } | { ok: false }> {
  const chat = await Chat.findById(chatId).select('members isGroup');
  if (!chat || chat.isGroup) return { ok: false };
  const ids = chat.members.map((m) => m.toString());
  if (ids.length !== 2 || !ids.includes(userId)) return { ok: false };
  const peerId = ids.find((id) => id !== userId);
  if (!peerId) return { ok: false };
  return { ok: true, peerId };
}

async function logCall(params: {
  chatId: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  status: 'missed' | 'rejected' | 'completed';
  durationSec?: number;
}): Promise<void> {
  try {
    await CallLog.create({
      chat: params.chatId,
      caller: params.callerId,
      callee: params.calleeId,
      callType: params.callType,
      status: params.status,
      durationSec: params.durationSec,
    });
  } catch (err) {
    logger.error('CallLog create failed', err);
  }
}

export type StartCallResult =
  | { ok: true; callId: string; calleeId: string }
  | { ok: false; reason: 'invalid_chat' | 'busy_self' | 'busy_peer' };

export function startCallSession(params: {
  chatId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
}): StartCallResult {
  if (userToCall.has(params.callerId)) return { ok: false, reason: 'busy_self' };
  if (userToCall.has(params.calleeId)) return { ok: false, reason: 'busy_peer' };

  const callId = randomUUID();
  const ringTimeout = setTimeout(() => {
    void (async () => {
      const s = sessions.get(callId);
      if (!s || s.state !== 'ringing') return;
      const io = getSocketServer();
      const callerDoc = await User.findById(s.callerId).select('name').lean();
      const callerName = callerDoc?.name ?? 'Someone';
      io.to(`user:${s.callerId}`).emit('call-timeout', {
        callId,
        chatId: s.chatId,
        role: 'caller' as const,
      });
      io.to(`user:${s.calleeId}`).emit('call-timeout', {
        callId,
        chatId: s.chatId,
        role: 'callee' as const,
        callerName,
      });
      void logCall({
        chatId: s.chatId,
        callerId: s.callerId,
        calleeId: s.calleeId,
        callType: s.type,
        status: 'missed',
      });
      destroySession(callId);
    })();
  }, RING_MS);

  const session: CallSession = {
    callId,
    chatId: params.chatId,
    callerId: params.callerId,
    calleeId: params.calleeId,
    type: params.type,
    state: 'ringing',
    ringTimeout,
  };
  sessions.set(callId, session);
  userToCall.set(params.callerId, callId);
  userToCall.set(params.calleeId, callId);

  return { ok: true, callId, calleeId: params.calleeId };
}

export function markCallActive(callId: string): boolean {
  const s = sessions.get(callId);
  if (!s || s.state !== 'ringing') return false;
  clearTimeout(s.ringTimeout);
  s.state = 'active';
  return true;
}

export function endCallByUser(callId: string, userId: string): CallSession | null {
  const s = sessions.get(callId);
  if (!s) return null;
  if (userId !== s.callerId && userId !== s.calleeId) return null;
  destroySession(callId);
  return s;
}

export function rejectCallSession(callId: string, calleeId: string): CallSession | null {
  const s = sessions.get(callId);
  if (!s || s.state !== 'ringing' || calleeId !== s.calleeId) return null;
  clearTimeout(s.ringTimeout);
  void logCall({
    chatId: s.chatId,
    callerId: s.callerId,
    calleeId: s.calleeId,
    callType: s.type,
    status: 'rejected',
  });
  destroySession(callId);
  return s;
}

export function forceEndCallsForUser(userId: string): CallSession | null {
  const callId = userToCall.get(userId);
  if (!callId) return null;
  const s = sessions.get(callId);
  if (!s) {
    userToCall.delete(userId);
    return null;
  }
  destroySession(callId);
  return s;
}

export function logCompletedCall(params: {
  chatId: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  durationSec: number;
}): void {
  void logCall({
    chatId: params.chatId,
    callerId: params.callerId,
    calleeId: params.calleeId,
    callType: params.callType,
    status: 'completed',
    durationSec: params.durationSec,
  });
}
