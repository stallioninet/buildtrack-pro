import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

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
router.post('/', requireAuth, (req, res) => {
  const { entity_type, entity_id, content, parent_id } = req.body;
  if (!entity_type || !entity_id || !content?.trim()) {
    return res.status(400).json({ error: 'entity_type, entity_id, and content are required' });
  }

  const result = db.prepare(`
    INSERT INTO comments (entity_type, entity_id, user_id, content, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(entity_type, parseInt(entity_id), req.user.id, content.trim(), parent_id || null);

  // Create notification for relevant users
  try {
    let notifyUsers = [];
    // Notify other commenters on this entity
    const otherCommenters = db.prepare(`
      SELECT DISTINCT user_id FROM comments
      WHERE entity_type = ? AND entity_id = ? AND user_id != ?
    `).all(entity_type, parseInt(entity_id), req.user.id);
    notifyUsers = otherCommenters.map(c => c.user_id);

    // Notify entity owner/assignee
    if (entity_type === 'task') {
      const task = db.prepare('SELECT assigned_to, created_by FROM tasks WHERE id = ?').get(parseInt(entity_id));
      if (task) {
        if (task.assigned_to && task.assigned_to !== req.user.id) notifyUsers.push(task.assigned_to);
        if (task.created_by && task.created_by !== req.user.id) notifyUsers.push(task.created_by);
      }
    } else if (entity_type === 'ncr') {
      const ncr = db.prepare('SELECT assigned_to, raised_by FROM ncrs WHERE id = ?').get(parseInt(entity_id));
      if (ncr) {
        if (ncr.assigned_to && ncr.assigned_to !== req.user.id) notifyUsers.push(ncr.assigned_to);
        if (ncr.raised_by && ncr.raised_by !== req.user.id) notifyUsers.push(ncr.raised_by);
      }
    } else if (entity_type === 'rfi') {
      const rfi = db.prepare('SELECT raised_by, response_by FROM rfis WHERE id = ?').get(parseInt(entity_id));
      if (rfi) {
        if (rfi.raised_by && rfi.raised_by !== req.user.id) notifyUsers.push(rfi.raised_by);
        if (rfi.response_by && rfi.response_by !== req.user.id) notifyUsers.push(rfi.response_by);
      }
    }

    // Deduplicate
    notifyUsers = [...new Set(notifyUsers)];

    const insertNotif = db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const userId of notifyUsers) {
      insertNotif.run(
        userId, 'comment',
        `New comment on ${entity_type.toUpperCase()}`,
        `${req.user.name} commented: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
        entity_type, parseInt(entity_id), req.user.id
      );
    }
  } catch (e) {
    // Don't fail comment creation if notification fails
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
  res.json({ success: true });
});

export default router;
