import jwt from 'jsonwebtoken';
import { SessionUser, Role, Department } from '@flint/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'flint-super-secret-jwt-key-2026';

export interface SessionTokenPayload {
  userId: string;
  role: Role;
  department: Department;
  teamId: string | null;
}

export interface SocketTokenPayload extends SessionTokenPayload {
  purpose: 'socket';
}

export function signSessionToken(user: SessionUser): string {
  const payload: SessionTokenPayload = {
    userId: user.id,
    role: user.role,
    department: user.department,
    teamId: user.teamId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifySessionToken(token: string): SessionTokenPayload {
  return jwt.verify(token, JWT_SECRET) as SessionTokenPayload;
}

export function signSocketToken(user: SessionUser): string {
  const payload: SocketTokenPayload = {
    userId: user.id,
    role: user.role,
    department: user.department,
    teamId: user.teamId,
    purpose: 'socket',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '60s' });
}

export function verifySocketToken(token: string): SocketTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as SocketTokenPayload;
  if (decoded.purpose !== 'socket') {
    throw new Error('Invalid token purpose');
  }
  return decoded;
}
