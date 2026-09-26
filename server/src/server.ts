import http from 'http';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { initSocket } from './lib/socket';

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = createApp();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Initialize socket layer (JWT auth + warehouse rooms)
initSocket(io);

server.listen(PORT, () => {
  console.log(`[StockSense Pro API] Server running on port ${PORT}`);
});
