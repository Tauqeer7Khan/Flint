import { io, Socket } from 'socket.io-client';
import { apiFetch } from './api';

let socketInstance: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
  }

  try {
    const { token } = await apiFetch<{ token: string }>('/auth/socket-token');
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

    socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    return socketInstance;
  } catch (err) {
    console.warn('Failed to obtain socket token or connect:', err);
    throw err;
  }
}

export function getSocket(): Socket | null {
  return socketInstance;
}
