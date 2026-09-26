import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
      const currentPath = window.location.pathname;
      if (!publicPaths.some((p) => currentPath.startsWith(p))) {
        // Prevent redirect loop and clear stale storage
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
