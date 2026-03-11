import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get user's notifications
router.get('/', requireAuth, (req, res) => {
  const { unread_only } = req.query;
  let sql = `
    SELECT n.*, u.name as triggered_by_name
    FROM notifications n
    LEFT JOIN users u ON n.triggered_by = u.id
    WHERE n.user_id = ?
  `;
  if (unread_only === 'true') sql += ' AND n.is_read = 0';
  sql += ' ORDER BY n.created_at DESC LIMIT 50';

  const notifications = db.prepare(sql).all(req.user.id);
  res.json(notifications);
});

// Get unread count
router.get('/count', requireAuth, (req, res) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
  res.json({ count: result.count });
});

// Mark one as read
router.patch('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Mark all as read
router.patch('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ success: true });
});

// Delete notification
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

export default router;
