import { SessionUser } from '@flint/shared';

export type SupportedEntity = 'leads' | 'accounts' | 'contacts' | 'deals' | 'tickets' | 'tasks';

/**
 * Returns a Prisma `where` clause restricting list/read queries per user role & team.
 * Returns `null` if the user is forbidden from viewing this entity entirely (e.g. SUPPORT_AGENT + leads).
 */
export function scopeFor(
  user: SessionUser,
  entity: SupportedEntity
): Record<string, any> | null {
  switch (entity) {
    case 'leads':
      switch (user.role) {
        case 'ADMIN':
          return {};
        case 'MANAGER':
          return user.teamId ? { owner: { team_id: user.teamId } } : { owner_id: user.id };
        case 'SALES_REP':
          return { owner_id: user.id };
        case 'SUPPORT_AGENT':
          return null; // ❌ forbidden in matrix
      }

    case 'accounts':
    case 'contacts':
      // Admin/Manager: All. Sales Rep: Read all. Support: Read all.
      return {};

    case 'deals':
      switch (user.role) {
        case 'ADMIN':
          return {};
        case 'MANAGER':
          return user.teamId ? { owner: { team_id: user.teamId } } : { owner_id: user.id };
        case 'SALES_REP':
          return {}; // Read others, edit own
        case 'SUPPORT_AGENT':
          return {}; // Read-only (context)
      }

    case 'tickets':
      switch (user.role) {
        case 'ADMIN':
          return {};
        case 'MANAGER':
          return user.teamId ? { assignee: { team_id: user.teamId } } : { assignee_id: user.id };
        case 'SALES_REP':
          return {}; // Read-only
        case 'SUPPORT_AGENT':
          return {}; // Edit own + team's, readable
      }

    case 'tasks':
      switch (user.role) {
        case 'ADMIN':
          return {};
        case 'MANAGER':
          return user.teamId
            ? { OR: [{ assignee: { team_id: user.teamId } }, { creator: { team_id: user.teamId } }] }
            : { OR: [{ assignee_id: user.id }, { created_by: user.id }] };
        case 'SALES_REP':
        case 'SUPPORT_AGENT':
          return { OR: [{ assignee_id: user.id }, { created_by: user.id }] };
      }

    default:
      return null;
  }
}

/**
 * Checks if the user is permitted to create/update/delete the entity record.
 */
export function canWrite(
  user: SessionUser,
  entity: SupportedEntity,
  record?: any
): boolean {
  if (user.role === 'ADMIN') return true;

  switch (entity) {
    case 'leads':
      if (user.role === 'SUPPORT_AGENT') return false;
      if (user.role === 'SALES_REP') {
        return !record || record.owner_id === user.id;
      }
      if (user.role === 'MANAGER') {
        if (!record) return true;
        return Boolean(
          !record.owner_id ||
          record.owner_id === user.id ||
          (user.teamId && record.owner?.team_id === user.teamId)
        );
      }
      return false;

    case 'accounts':
    case 'contacts':
      if (user.role === 'SUPPORT_AGENT') return false; // Read-only, no edit
      if (user.role === 'SALES_REP') {
        return !record || record.owner_id === user.id; // Edit own
      }
      if (user.role === 'MANAGER') {
        return true; // All
      }
      return false;

    case 'deals':
      if (user.role === 'SUPPORT_AGENT') return false; // Read-only
      if (user.role === 'SALES_REP') {
        return !record || record.owner_id === user.id; // Edit own
      }
      if (user.role === 'MANAGER') {
        if (!record) return true;
        return Boolean(
          !record.owner_id ||
          record.owner_id === user.id ||
          (user.teamId && record.owner?.team_id === user.teamId)
        );
      }
      return false;

    case 'tickets':
      if (user.role === 'SALES_REP') return false; // Read-only
      if (user.role === 'SUPPORT_AGENT') {
        if (!record) return true;
        return Boolean(
          record.assignee_id === user.id ||
          (user.teamId && record.assignee?.team_id === user.teamId) ||
          !record.assignee_id
        );
      }
      if (user.role === 'MANAGER') {
        if (!record) return true;
        return Boolean(
          record.assignee_id === user.id ||
          (user.teamId && record.assignee?.team_id === user.teamId) ||
          !record.assignee_id
        );
      }
      return false;

    case 'tasks':
      if (!record) return true;
      if (user.role === 'MANAGER') {
        return Boolean(
          record.assignee_id === user.id ||
          record.created_by === user.id ||
          (user.teamId &&
            (record.assignee?.team_id === user.teamId || record.creator?.team_id === user.teamId))
        );
      }
      return Boolean(record.assignee_id === user.id || record.created_by === user.id);

    default:
      return false;
  }
}
