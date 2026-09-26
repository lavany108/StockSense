import { create } from 'zustand';
import api from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'STAFF';
  warehouseId?: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedWarehouseId: string | null;
  checkAuth: () => Promise<User | null>;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setSelectedWarehouseId: (id: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  selectedWarehouseId: null,

  checkAuth: async () => {
    try {
      const res = await api.get('/auth/me');
      const user = res.data as User;
      set({
        user,
        isAuthenticated: true,
        selectedWarehouseId: user.warehouseId || null,
      });
      return user;
    } catch {
      set({ user: null, isAuthenticated: false });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  login: (user: User) => {
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
      selectedWarehouseId: user.warehouseId || null,
    });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false, selectedWarehouseId: null });
      window.location.href = '/login';
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user,
      selectedWarehouseId: user?.warehouseId || null,
    });
  },

  setSelectedWarehouseId: (id: string | null) => {
    set({ selectedWarehouseId: id });
  },
}));
