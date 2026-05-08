import { User } from '../models/User';
import { logger } from '../utils/logger';
import type { AuthedSocket } from './index';
import {
  destroySession,
  getSession,
  markCallActive,
  rejectCallSession,
  startCallSession,
  endCallByUser,
  validateDirectChat,
  logCompletedCall,
  type CallType,
} from '../services/callSession.service';
import { getSocketServer } from './ioRegistry';

const isCallType = (v: unknown): v is CallType => v === 'audio' || v === 'video';

type WireSession = { type?: string; sdp?: string };
type WireIce = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
} | null;

export const registerCallHandlers = (socket: AuthedSocket): void => {
  const { userId } = socket.data;
  const io = getSocketServer();

  socket.on('call-user', async (payload: { chatId?: string; type?: string }) => {
    try {
      const chatId = payload?.chatId;
      const type = payload?.type;
      if (!chatId || !isCallType(type)) {
        socket.emit('call:error', { code: 'invalid_payload', message: 'chatId and type required' });
        return;
      }
      const v = await validateDirectChat(chatId, userId);
      if (!v.ok) {
        socket.emit('call:error', { code: 'invalid_chat', message: 'Direct chat only' });
        return;
      }
      const started = startCallSession({
        chatId,
        callerId: userId,
        calleeId: v.peerId,
        type,
      });
      if (!started.ok) {
        if (started.reason === 'busy_self') {
          socket.emit('call-busy', { reason: 'self', message: 'Already in a call' });
        } else {
          socket.emit('call-busy', { reason: 'peer', message: 'User is busy' });
        }
        return;
      }
      const callerDoc = await User.findById(userId).select('name avatar').lean();
      const callerName = callerDoc?.name ?? 'Someone';
      const callerAvatar = typeof callerDoc?.avatar === 'string' ? callerDoc.avatar : undefined;
      const incoming = {
        callId: started.callId,
        chatId,
        callerId: userId,
        callerName,
        callerAvatar,
        type,
      };
      io.to(`user:${v.peerId}`).emit('incoming-call', incoming);
      io.to(`user:${v.peerId}`).emit('call:incoming', incoming);
      socket.emit('call:created', { callId: started.callId, calleeId: v.peerId, chatId, type });
    } catch (err) {
      logger.error('call-user error', err);
      socket.emit('call:error', { code: 'server', message: 'Failed to start call' });
    }
  });

  socket.on('accept-call', (payload: { callId?: string }) => {
    const callId = payload?.callId;
    if (!callId) return;
    const s = getSession(callId);
    if (!s || s.state !== 'ringing' || s.calleeId !== userId) {
      socket.emit('call:error', { code: 'no_call', message: 'Call not available' });
      return;
    }
    if (!markCallActive(callId)) {
      socket.emit('call:error', { code: 'no_call', message: 'Call not available' });
      return;
    }
    io.to(`user:${s.callerId}`).emit('call:accepted', {
      callId,
      chatId: s.chatId,
      calleeId: userId,
      type: s.type,
    });
    socket.emit('call:accepted', {
      callId,
      chatId: s.chatId,
      callerId: s.callerId,
      type: s.type,
    });
  });

  socket.on('reject-call', (payload: { callId?: string }) => {
    const callId = payload?.callId;
    if (!callId) return;
    const s = rejectCallSession(callId, userId);
    if (!s) return;
    io.to(`user:${s.callerId}`).emit('call:rejected', { callId });
    socket.emit('call:rejected', { callId });
  });

  socket.on('end-call', (payload: { callId?: string; durationSec?: number }) => {
    const callId = payload?.callId;
    if (!callId) return;
    const s = endCallByUser(callId, userId);
    if (!s) return;
    const durationSec =
      typeof payload.durationSec === 'number' && Number.isFinite(payload.durationSec)
        ? Math.max(0, Math.floor(payload.durationSec))
        : undefined;
    if (durationSec !== undefined && durationSec > 0) {
      logCompletedCall({
        chatId: s.chatId,
        callerId: s.callerId,
        calleeId: s.calleeId,
        callType: s.type,
        durationSec,
      });
    }
    io.to(`user:${s.callerId}`).emit('call:ended', { callId, by: userId });
    io.to(`user:${s.calleeId}`).emit('call:ended', { callId, by: userId });
  });

  socket.on('webrtc-offer', (p: { callId?: string; sdp?: WireSession }) => {
    if (!p?.callId || !p?.sdp) return;
    const s = getSession(p.callId);
    if (!s || userId !== s.callerId) return;
    io.to(`user:${s.calleeId}`).emit('webrtc-offer', { callId: p.callId, sdp: p.sdp });
  });

  socket.on('webrtc-answer', (p: { callId?: string; sdp?: WireSession }) => {
    if (!p?.callId || !p?.sdp) return;
    const s = getSession(p.callId);
    if (!s || userId !== s.calleeId) return;
    io.to(`user:${s.callerId}`).emit('webrtc-answer', { callId: p.callId, sdp: p.sdp });
  });

  socket.on('ice-candidate', (p: { callId?: string; candidate?: WireIce }) => {
    if (!p?.callId || p.candidate === undefined) return;
    const s = getSession(p.callId);
    if (!s) return;
    if (userId !== s.callerId && userId !== s.calleeId) return;
    const peerId = userId === s.callerId ? s.calleeId : s.callerId;
    io.to(`user:${peerId}`).emit('ice-candidate', {
      callId: p.callId,
      candidate: p.candidate,
    });
  });

  socket.on('toggle-mic', (p: { callId?: string; muted?: boolean }) => {
    if (!p?.callId || typeof p.muted !== 'boolean') return;
    const s = getSession(p.callId);
    if (!s) return;
    if (userId !== s.callerId && userId !== s.calleeId) return;
    const peerId = userId === s.callerId ? s.calleeId : s.callerId;
    io.to(`user:${peerId}`).emit('peer-toggle-mic', {
      callId: p.callId,
      muted: p.muted,
    });
  });

  socket.on('toggle-camera', (p: { callId?: string; enabled?: boolean }) => {
    if (!p?.callId || typeof p.enabled !== 'boolean') return;
    const s = getSession(p.callId);
    if (!s) return;
    if (userId !== s.callerId && userId !== s.calleeId) return;
    const peerId = userId === s.callerId ? s.calleeId : s.callerId;
    io.to(`user:${peerId}`).emit('peer-toggle-camera', {
      callId: p.callId,
      enabled: p.enabled,
    });
  });
};
