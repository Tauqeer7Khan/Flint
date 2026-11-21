import { io, Socket } from 'socket.io-client';
import { apiFetch } from './api';

let socketInstance: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socketInstance) {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

  socketInstance = io(socketUrl, {
    auth: (cb) => {
      apiFetch<{ token: string }>('/auth/socket-token')
        .then((data) => {
          cb({ token: data.token });
        })
        .catch((err) => {
          console.warn('Failed to obtain fresh socket token for connect/reconnect:', err);
          cb({});
        });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  });

  if (typeof window !== 'undefined') {
    (window as any).__flintSocket = socketInstance;
  }

  return socketInstance;
}

export function getSocket(): Socket | null {
  return socketInstance;
}
