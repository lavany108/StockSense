import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../middleware/auth';

let _io: SocketIOServer | null = null;

export const initSocket = (io: SocketIOServer): void => {
  _io = io;

  io.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers?.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('stocksense_token='))
          ?.split('=')[1]);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      (socket as Socket & { user?: JwtPayload }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as Socket & { user?: JwtPayload }).user;

    // Auto-join user's warehouse room
    if (user?.warehouseId) {
      socket.join(`warehouse-${user.warehouseId}`);
    }

    socket.on('join_warehouse', (warehouseId: string) => {
      socket.join(`warehouse-${warehouseId}`);
    });

    socket.on('leave_warehouse', (warehouseId: string) => {
      socket.leave(`warehouse-${warehouseId}`);
    });

    socket.on('disconnect', () => {
      // cleanup handled by socket.io
    });
  });
};

export const getIO = (): SocketIOServer => {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
};

export const emitToWarehouse = (warehouseId: string, event: string, data: unknown): void => {
  if (_io) {
    _io.to(`warehouse-${warehouseId}`).emit(event, data);
  }
};
