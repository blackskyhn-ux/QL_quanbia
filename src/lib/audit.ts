import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export interface RecordAuditParams {
  tx?: any;
  action: string;
  entityType?: string;
  entityId: number;
  performedBy?: number | null;
  reason?: string | null;
  oldValue?: any;
  newValue?: any;
}

/**
 * Utility to safely record audit logs across API handlers and DB transactions.
 */
export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  const {
    tx,
    action,
    entityType = 'order',
    entityId,
    performedBy,
    reason,
    oldValue,
    newValue,
  } = params;

  const dbClient = tx || db;

  const formattedOldValue =
    oldValue !== undefined && oldValue !== null
      ? typeof oldValue === 'string'
        ? oldValue
        : JSON.stringify(oldValue)
      : null;

  const formattedNewValue =
    newValue !== undefined && newValue !== null
      ? typeof newValue === 'string'
        ? newValue
        : JSON.stringify(newValue)
      : null;

  try {
    await dbClient.insert(auditLogs).values({
      action: action.toUpperCase(),
      entityType,
      entityId: Number(entityId),
      performedBy: performedBy ? Number(performedBy) : null,
      reason: reason || null,
      oldValue: formattedOldValue,
      newValue: formattedNewValue,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.warn(`[AuditLog Warning] Failed to record audit log for action ${action}:`, error.message);
  }
}
