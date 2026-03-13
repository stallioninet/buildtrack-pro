import db from '../config/db.js';

// Centralized audit logging helper
export function audit({ projectId, entity, entityId, action, fromState, toState, userId, userName, details, type }) {
  try {
    db.prepare(`
      INSERT INTO audit_log (project_id, entity, entity_id, action, from_state, to_state, user_id, user_display, details, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId || null,
      entity,
      String(entityId),
      action,
      fromState || null,
      toState || null,
      userId || null,
      userName || null,
      details || null,
      type || 'info'
    );
  } catch (e) {
    // Don't break the request if audit logging fails
    console.error('Audit log error:', e.message);
  }
}
