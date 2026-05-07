import { create } from 'zustand';
import type { User } from '@/types';
import { authService } from '@/services/auth.service';
import { tokenStorage } from '@/services/api';
import { disconnectSocket } from '@/services/socket';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  setUser: (user) => set({ user }),

  hydrate: async () => {
    /* Skip the network round-trip when there's no token — otherwise the
       login page would issue a guaranteed-401 request on every render. */
    if (!tokenStorage.getAccess()) {
      set({ user: null, loading: false, initialized: true });
      return;
    }
    set({ loading: true });
    try {
      const user = await authService.me();
      set({ user });
    } catch {
      set({ user: null });
      tokenStorage.clear();
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await authService.login({ email, password });
      set({ user: res.user });
    } finally {
      set({ loading: false });
    }
  },

  signup: async (name, email, password) => {
    set({ loading: true });
    try {
      const res = await authService.signup({ name, email, password });
      set({ user: res.user });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      disconnectSocket();
      set({ user: null });
    }
  },
}));
