import { Socket, Server as SocketIOServer } from 'socket.io';

export interface PresenceUser {
  id: string;
  name: string;
  role: string;
  department: string;
}

// Map from roomKey (e.g. "page:deal:cmwp...") to Map<socketId, PresenceUser>
const presenceMap = new Map<string, Map<string, PresenceUser>>();

// Map from socketId to Set of roomKeys
const socketRooms = new Map<string, Set<string>>();

/**
 * Attaches presence listeners to an authenticated socket connection.
 */
export function handlePresence(io: SocketIOServer, socket: Socket) {
  const user = (socket as any).user as PresenceUser | undefined;
  if (!user) return;

  socket.on('presence:join', ({ pageType, pageId }: { pageType: string; pageId: string }) => {
    if (!pageType || !pageId) return;
    const room = `page:${pageType}:${pageId}`;
    socket.join(room);

    if (!presenceMap.has(room)) {
      presenceMap.set(room, new Map());
    }
    presenceMap.get(room)!.set(socket.id, {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
    });

    if (!socketRooms.has(socket.id)) {
      socketRooms.set(socket.id, new Set());
    }
    socketRooms.get(socket.id)!.add(room);

    emitPresenceUpdate(io, room);
  });

  socket.on('presence:leave', ({ pageType, pageId }: { pageType: string; pageId: string }) => {
    if (!pageType || !pageId) return;
    const room = `page:${pageType}:${pageId}`;
    socket.leave(room);

    const roomUsers = presenceMap.get(room);
    if (roomUsers) {
      roomUsers.delete(socket.id);
      if (roomUsers.size === 0) {
        presenceMap.delete(room);
      }
    }

    const rooms = socketRooms.get(socket.id);
    if (rooms) {
      rooms.delete(room);
    }

    emitPresenceUpdate(io, room);
  });

  socket.on('disconnect', () => {
    const rooms = socketRooms.get(socket.id);
    if (rooms) {
      for (const room of rooms) {
        const roomUsers = presenceMap.get(room);
        if (roomUsers) {
          roomUsers.delete(socket.id);
          if (roomUsers.size === 0) {
            presenceMap.delete(room);
          }
          emitPresenceUpdate(io, room);
        }
      }
      socketRooms.delete(socket.id);
    }
  });
}

function emitPresenceUpdate(io: SocketIOServer, room: string) {
  const roomUsers = presenceMap.get(room);
  const uniqueUsers: PresenceUser[] = [];
  if (roomUsers) {
    const seenIds = new Set<string>();
    for (const u of roomUsers.values()) {
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id);
        uniqueUsers.push(u);
      }
    }
  }

  io.to(room).emit('presence:update', {
    room,
    users: uniqueUsers,
  });
}
