import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import localApi from './localApi';

const axiosApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

axiosApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Proxy that checks window.electronAPI on EVERY call.
 * This avoids the module-load-time race where electronAPI isn't injected yet.
 */
const api = new Proxy({} as typeof axiosApi, {
  get(_target, prop: string) {
    const impl = window.electronAPI ? localApi : axiosApi;
    return (impl as any)[prop];
  },
});

export default api;
