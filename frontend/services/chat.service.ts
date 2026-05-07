import { api } from './api';
import type { ApiResponse, Chat, Message, User } from '@/types';

export interface ChatListResponse {
  chats: Chat[];
  unread: Record<string, number>;
}

export const chatService = {
  async list(): Promise<ChatListResponse> {
    const { data } = await api.get<ApiResponse<ChatListResponse>>('/chats');
    return data.data;
  },
  async accessOneToOne(userId: string): Promise<Chat> {
    const { data } = await api.post<ApiResponse<Chat>>('/chats/one-to-one', { userId });
    return data.data;
  },
  async createGroup(payload: { name: string; members: string[]; description?: string }): Promise<Chat> {
    const { data } = await api.post<ApiResponse<Chat>>('/chats/group', payload);
    return data.data;
  },
  async updateGroup(
    id: string,
    payload: { name?: string; description?: string; avatar?: string },
  ): Promise<Chat> {
    const { data } = await api.patch<ApiResponse<Chat>>(`/chats/${id}/group`, payload);
    return data.data;
  },
  async addMember(id: string, userId: string): Promise<Chat> {
    const { data } = await api.post<ApiResponse<Chat>>(`/chats/${id}/group/members`, { userId });
    return data.data;
  },
  async removeMember(id: string, userId: string): Promise<Chat> {
    const { data } = await api.delete<ApiResponse<Chat>>(`/chats/${id}/group/members`, {
      data: { userId },
    });
    return data.data;
  },
  async leaveGroup(id: string): Promise<Chat | null> {
    const { data } = await api.post<ApiResponse<Chat | null>>(`/chats/${id}/group/leave`);
    return data.data;
  },
  async getById(id: string): Promise<Chat> {
    const { data } = await api.get<ApiResponse<Chat>>(`/chats/${id}`);
    return data.data;
  },
  async searchUsers(q: string): Promise<User[]> {
    const { data } = await api.get<ApiResponse<User[]>>('/users/search', { params: { q } });
    return data.data;
  },
};

export const messageService = {
  async list(
    chatId: string,
    page = 1,
    limit = 30,
  ): Promise<{ items: Message[]; total: number; page: number; limit: number }> {
    const { data } = await api.get<
      ApiResponse<{ items: Message[]; total: number; page: number; limit: number }>
    >(`/messages/${chatId}`, { params: { page, limit } });
    return data.data;
  },
  async send(payload: {
    chatId: string;
    content?: string;
    type?: 'text' | 'image' | 'file';
    attachment?: { url: string; publicId?: string; name: string; size: number; mime: string };
  }): Promise<Message> {
    const { data } = await api.post<ApiResponse<Message>>('/messages', payload);
    return data.data;
  },
  async markRead(chatId: string): Promise<void> {
    await api.post(`/messages/${chatId}/read`);
  },
  async totalUnread(): Promise<number> {
    const { data } = await api.get<ApiResponse<{ count: number }>>('/messages/unread/total');
    return data.data.count;
  },
  async remove(messageId: string): Promise<Message> {
    const { data } = await api.delete<ApiResponse<Message>>(`/messages/${messageId}`);
    return data.data;
  },
};

export const uploadService = {
  async upload(
    file: File,
  ): Promise<{ url: string; publicId: string; name: string; size: number; mime: string }> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post<
      ApiResponse<{ url: string; publicId: string; name: string; size: number; mime: string }>
    >('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data.data;
  },
};

export const userService = {
  async updateProfile(payload: { name?: string; bio?: string; avatar?: string }): Promise<User> {
    const { data } = await api.patch<ApiResponse<User>>('/users/me', payload);
    return data.data;
  },
};
