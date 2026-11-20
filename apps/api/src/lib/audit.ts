export interface AuditLogParams {
  userId?: string | null;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONVERT';
  changes?: Record<string, any>;
}

export async function logAudit(
  prismaClient: any,
  params: AuditLogParams
) {
  try {
    return await prismaClient.auditLog.create({
      data: {
        user_id: params.userId && params.userId !== "SYSTEM" ? params.userId : null,
        entity: params.entity.toUpperCase(),
        entity_id: params.entityId,
        action: params.action,
        changes: params.changes || {},
      },
    });
  } catch (err) {
    console.error('Failed to create audit log:', err);
  }
}
