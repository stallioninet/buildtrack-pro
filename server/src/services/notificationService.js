import db from '../config/db.js';

// SSE client registry: Map of userId -> Set of response objects
const sseClients = new Map();

export function addSSEClient(userId, res) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);
}

export function removeSSEClient(userId, res) {
  const clients = sseClients.get(userId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) sseClients.delete(userId);
  }
}

function broadcastToUser(userId, data) {
  const clients = sseClients.get(userId);
  if (clients) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch (_) { /* client disconnected */ }
    }
  }
}

// Central notification creator
export function notify({ userIds, type, title, message, entityType, entityId, triggeredBy }) {
  if (!userIds || userIds.length === 0) return;

  const insertStmt = db.prepare(`
    INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, triggered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const dedupedIds = [...new Set(userIds)].filter(id => id !== triggeredBy);

  for (const userId of dedupedIds) {
    const result = insertStmt.run(userId, type, title, message || '', entityType || null, entityId || null, triggeredBy || null);

    // Broadcast via SSE
    const notification = {
      id: result.lastInsertRowid,
      user_id: userId,
      type,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      triggered_by: triggeredBy,
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    broadcastToUser(userId, { type: 'notification', notification });
  }
}

// Helper: get users to notify for a project event
export function getProjectUserIds(projectId, excludeUserId) {
  const members = db.prepare(
    'SELECT user_id FROM project_members WHERE project_id = ?'
  ).all(projectId).map(m => m.user_id);

  const creator = db.prepare('SELECT created_by FROM projects WHERE id = ?').get(projectId);
  if (creator) members.push(creator.created_by);

  return [...new Set(members)].filter(id => id !== excludeUserId);
}

// Pre-built notification helpers for common events
export function notifyTaskAssignment({ taskCode, taskTitle, taskId, assigneeId, assignerId, assignerName }) {
  notify({
    userIds: [assigneeId],
    type: 'task_assigned',
    title: `Task assigned: ${taskCode}`,
    message: `${assignerName} assigned you to "${taskTitle}"`,
    entityType: 'task',
    entityId: taskId,
    triggeredBy: assignerId,
  });
}

export function notifyStatusChange({ entityType, entityCode, entityTitle, entityId, fromStatus, toStatus, projectId, changedBy, changedByName }) {
  const userIds = getProjectUserIds(projectId, changedBy);
  notify({
    userIds,
    type: 'status_change',
    title: `${entityType.toUpperCase()} ${entityCode} status changed`,
    message: `${changedByName} changed "${entityTitle}" from ${fromStatus} to ${toStatus}`,
    entityType,
    entityId,
    triggeredBy: changedBy,
  });
}

export function notifyNCREscalation({ ncrCode, ncrTitle, ncrId, severity, projectId, raisedBy, raisedByName }) {
  const userIds = getProjectUserIds(projectId, raisedBy);
  notify({
    userIds,
    type: 'ncr_escalation',
    title: `${severity} NCR raised: ${ncrCode}`,
    message: `${raisedByName} raised "${ncrTitle}" with ${severity} severity`,
    entityType: 'ncr',
    entityId: ncrId,
    triggeredBy: raisedBy,
  });
}

export function notifyRFIDueSoon({ rfiCode, rfiTitle, rfiId, dueDate, assigneeId }) {
  notify({
    userIds: [assigneeId],
    type: 'rfi_due_soon',
    title: `RFI due soon: ${rfiCode}`,
    message: `"${rfiTitle}" is due on ${dueDate}`,
    entityType: 'rfi',
    entityId: rfiId,
    triggeredBy: null,
  });
}

export function notifyDocumentApproval({ docCode, docTitle, docId, projectId, userId, userName, action }) {
  const userIds = getProjectUserIds(projectId, userId);
  notify({
    userIds,
    type: 'document_approval',
    title: `Document ${action}: ${docCode}`,
    message: `${userName} ${action} "${docTitle}"`,
    entityType: 'document',
    entityId: docId,
    triggeredBy: userId,
  });
}

export function notifySafetyAlert({ type: alertType, code, title, entityId, projectId, userId, userName }) {
  const userIds = getProjectUserIds(projectId, userId);
  notify({
    userIds,
    type: 'safety_alert',
    title: `Safety ${alertType}: ${code}`,
    message: `${userName} reported "${title}"`,
    entityType: alertType === 'incident' ? 'safety_incident' : 'safety_permit',
    entityId,
    triggeredBy: userId,
  });
}
