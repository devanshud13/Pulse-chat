import { api, tokenStorage } from './api';
import type { ApiResponse, AuthResponse, User } from '@/types';

export const authService = {
  async signup(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/signup', payload);
    tokenStorage.set(data.data.accessToken, data.data.refreshToken);
    return data.data;
  },
  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/login', payload);
    tokenStorage.set(data.data.accessToken, data.data.refreshToken);
    return data.data;
  },
  async logout(): Promise<void> {
    const refresh = tokenStorage.getRefresh();
    try {
      await api.post('/auth/logout', { refreshToken: refresh });
    } finally {
      tokenStorage.clear();
    }
  },
  async me(): Promise<User> {
    const { data } = await api.get<ApiResponse<User>>('/users/me');
    return data.data;
  },
};
