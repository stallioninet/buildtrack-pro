import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, commentSchema } from '../middleware/validate.js';
import { audit } from '../services/auditHelper.js';
import { notify } from '../services/notificationService.js';

const router = Router();

// Get comments for an entity
router.get('/', requireAuth, (req, res) => {
  const { entity_type, entity_id } = req.query;
  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: 'entity_type and entity_id are required' });
  }

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email,
    (SELECT r.name FROM roles r JOIN users u2 ON u2.role_id = r.id WHERE u2.id = c.user_id) as user_role
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.entity_type = ? AND c.entity_id = ?
    ORDER BY c.created_at ASC
  `).all(entity_type, parseInt(entity_id));

  res.json(comments);
});

// Add comment
router.post('/', requireAuth, validate(commentSchema), (req, res) => {
  const { entity_type, entity_id, content, parent_id } = req.validated;
  if (!entity_type || !entity_id || !content?.trim()) {
    return res.status(400).json({ error: 'entity_type, entity_id, and content are required' });
  }

  const result = db.prepare(`
    INSERT INTO comments (entity_type, entity_id, user_id, content, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(entity_type, parseInt(entity_id), req.user.id, content.trim(), parent_id || null);

  audit({ entity: entity_type, entityId: parseInt(entity_id), action: 'comment_added', userId: req.user.id, userName: req.user.name, details: content.substring(0, 200), type: 'info' });

  // Create notification for relevant users
  try {
    let notifyUserIds = [];
    // Notify other commenters on this entity
    const otherCommenters = db.prepare(`
      SELECT DISTINCT user_id FROM comments
      WHERE entity_type = ? AND entity_id = ? AND user_id != ?
    `).all(entity_type, parseInt(entity_id), req.user.id);
    notifyUserIds = otherCommenters.map(c => c.user_id);

    // Notify entity owner/assignee
    if (entity_type === 'task') {
      const task = db.prepare('SELECT assigned_to, created_by FROM tasks WHERE id = ?').get(parseInt(entity_id));
      if (task) {
        if (task.assigned_to) notifyUserIds.push(task.assigned_to);
        if (task.created_by) notifyUserIds.push(task.created_by);
      }
    } else if (entity_type === 'ncr') {
      const ncr = db.prepare('SELECT assigned_to, raised_by FROM ncrs WHERE id = ?').get(parseInt(entity_id));
      if (ncr) {
        if (ncr.assigned_to) notifyUserIds.push(ncr.assigned_to);
        if (ncr.raised_by) notifyUserIds.push(ncr.raised_by);
      }
    } else if (entity_type === 'rfi') {
      const rfi = db.prepare('SELECT raised_by, response_by FROM rfis WHERE id = ?').get(parseInt(entity_id));
      if (rfi) {
        if (rfi.raised_by) notifyUserIds.push(rfi.raised_by);
        if (rfi.response_by) notifyUserIds.push(rfi.response_by);
      }
    }

    notify({
      userIds: notifyUserIds,
      type: 'comment',
      title: `New comment on ${entity_type.replace('_', ' ')}`,
      message: `${req.user.name} commented: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      entityType: entity_type,
      entityId: parseInt(entity_id),
      triggeredBy: req.user.id,
    });
  } catch (e) {
    console.error('Notification error:', e.message);
  }

  const created = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// Delete comment (own comments only, or PM/owner)
router.delete('/:id', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (comment.user_id !== req.user.id && !['owner', 'pm'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to delete this comment' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  audit({ entity: comment.entity_type, entityId: comment.entity_id, action: 'comment_deleted', userId: req.user.id, userName: req.user.name, details: `Deleted comment #${comment.id}`, type: 'info' });
  res.json({ success: true });
});

export default router;
