import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifySocketToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { handlePresence } from './presence';

let io: SocketIOServer | null = null;

export function initRealtime(server: http.Server): SocketIOServer {
  const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';

  io = new SocketIOServer(server, {
    cors: {
      origin: webOrigin,
      credentials: true,
    },
  });

  // Socket authentication handshake middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const payload = verifySocketToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          team_id: true,
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as any).user = user;
      next();
    } catch (err: any) {
      return next(new Error('Invalid or expired socket token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (user) {
      socket.join(`user:${user.id}`);
      console.log(`socket connected user=${user.name}`);
      handlePresence(io!, socket);
    }

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
}
