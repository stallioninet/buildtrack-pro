import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../services/notificationService.js';

const router = Router();

// SSE stream for real-time notifications
router.get('/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n');

  const userId = req.user.id;
  addSSEClient(userId, res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(userId, res);
  });
});

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

// Get notification preferences
router.get('/preferences', requireAuth, (req, res) => {
  let prefs = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(req.user.id);
  if (!prefs) {
    // Create default preferences
    db.prepare('INSERT INTO notification_preferences (user_id) VALUES (?)').run(req.user.id);
    prefs = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(req.user.id);
  }
  res.json(prefs);
});

// Update notification preferences
router.patch('/preferences', requireAuth, (req, res) => {
  const fields = ['task_assigned', 'status_change', 'comment', 'ncr_escalation', 'rfi_due_soon', 'document_approval', 'safety_alert'];
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field] ? 1 : 0);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  // Upsert
  const existing = db.prepare('SELECT id FROM notification_preferences WHERE user_id = ?').get(req.user.id);
  if (!existing) {
    db.prepare('INSERT INTO notification_preferences (user_id) VALUES (?)').run(req.user.id);
  }

  values.push(req.user.id);
  db.prepare(`UPDATE notification_preferences SET ${updates.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`).run(...values);

  const prefs = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(req.user.id);
  res.json(prefs);
});

export default router;
