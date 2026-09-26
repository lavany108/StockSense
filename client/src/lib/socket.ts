import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;
type ListenerCallback = (data: any) => void;
const listeners = new Map<string, Set<ListenerCallback>>();

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚡ Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message);
    });

    // Default global listener for document:validated to trigger real-time Sonner toast
    socket.on('document:validated', (data: { documentId?: string; docNumber?: string; type?: string }) => {
      const docLabel = data?.docNumber || 'DO-xxxx';
      toast.success(`📦 ${docLabel} validated — live sync`, {
        description: `Status changed to DONE and stock moves committed.`,
      });
      notifyListeners('document:validated', data);
      notifyListeners('refresh:dashboard', data);
    });

    socket.on('stock:updated', (data: any) => {
      notifyListeners('stock:updated', data);
      notifyListeners('refresh:dashboard', data);
    });

    socket.on('document:status_changed', (data: any) => {
      notifyListeners('document:status_changed', data);
      notifyListeners('refresh:dashboard', data);
    });

    socket.on('alert:low-stock', (data: any) => {
      toast.warning(`⚠️ Low stock alert for product ${data?.product?.sku || data?.productId}`, {
        description: `Current balance is below minimum safety threshold.`,
      });
      notifyListeners('alert:low-stock', data);
      notifyListeners('refresh:dashboard', data);
    });
  }

  return socket;
};

export const joinWarehouseRoom = (warehouseId: string) => {
  const s = getSocket();
  if (warehouseId) {
    s.emit('join_warehouse', warehouseId);
  }
};

export const leaveWarehouseRoom = (warehouseId: string) => {
  const s = getSocket();
  if (warehouseId) {
    s.emit('leave_warehouse', warehouseId);
  }
};

function notifyListeners(event: string, data: any) {
  const set = listeners.get(event);
  if (set) {
    set.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in socket listener for ${event}:`, err);
      }
    });
  }
}

export const subscribeToSocket = (event: string, callback: ListenerCallback): (() => void) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback);

  // Return unsubscribe
  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  };
};

export default getSocket;
