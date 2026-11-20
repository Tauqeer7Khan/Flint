import { SessionUser } from '@flint/shared';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
