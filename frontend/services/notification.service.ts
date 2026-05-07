import { api } from './api';
import type { ApiResponse, NotificationItem } from '@/types';

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
    const { data } = await api.get<ApiResponse<NotificationItem[]>>('/notifications');
    return data.data;
  },
  async unreadCount(): Promise<number> {
    const { data } = await api.get<ApiResponse<{ count: number }>>('/notifications/unread/count');
    return data.data.count;
  },
  async markRead(id: string): Promise<NotificationItem> {
    const { data } = await api.post<ApiResponse<NotificationItem>>(`/notifications/${id}/read`);
    return data.data;
  },
  async markAllRead(): Promise<void> {
    await api.post('/notifications/read-all');
  },
};
