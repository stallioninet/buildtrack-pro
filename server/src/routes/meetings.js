import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id, status } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  let sql = `SELECT m.*, u.name as organized_by_name,
    (SELECT COUNT(*) FROM meeting_action_items WHERE meeting_id = m.id) as action_count,
    (SELECT COUNT(*) FROM meeting_action_items WHERE meeting_id = m.id AND status = 'completed') as actions_completed
    FROM meetings m LEFT JOIN users u ON m.organized_by = u.id
    WHERE m.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { sql += ' AND m.status = ?'; params.push(status); }
  sql += ' ORDER BY m.meeting_date DESC, m.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, upcoming: 0, actionItems: 0, pendingActions: 0 });
  const ph = projectIds.map(() => '?').join(',');
  const total = db.prepare(`SELECT COUNT(*) as c FROM meetings WHERE project_id IN (${ph})`).get(...projectIds).c;
  const upcoming = db.prepare(`SELECT COUNT(*) as c FROM meetings WHERE project_id IN (${ph}) AND meeting_date >= date('now') AND status = 'Scheduled'`).get(...projectIds).c;
  const meetingIds = db.prepare(`SELECT id FROM meetings WHERE project_id IN (${ph})`).all(...projectIds).map(r => r.id);
  let actionItems = 0, pendingActions = 0;
  if (meetingIds.length > 0) {
    const miPh = meetingIds.map(() => '?').join(',');
    actionItems = db.prepare(`SELECT COUNT(*) as c FROM meeting_action_items WHERE meeting_id IN (${miPh})`).get(...meetingIds).c;
    pendingActions = db.prepare(`SELECT COUNT(*) as c FROM meeting_action_items WHERE meeting_id IN (${miPh}) AND status = 'open'`).get(...meetingIds).c;
  }
  res.json({ total, upcoming, actionItems, pendingActions });
});

router.get('/:id', requireAuth, (req, res) => {
  const meeting = db.prepare(`SELECT m.*, u.name as organized_by_name FROM meetings m LEFT JOIN users u ON m.organized_by = u.id WHERE m.id = ?`).get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  const actionItems = db.prepare(`SELECT mai.*, u.name as assigned_to_name FROM meeting_action_items mai LEFT JOIN users u ON mai.assigned_to = u.id WHERE mai.meeting_id = ? ORDER BY mai.id`).all(meeting.id);
  res.json({ ...meeting, action_items: actionItems });
});

router.post('/', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { project_id, title, meeting_type, meeting_date, start_time, end_time, location, attendees, agenda } = req.body;
  if (!title || !project_id || !meeting_date) return res.status(400).json({ error: 'Title, project, and date are required' });
  const count = db.prepare('SELECT COUNT(*) as c FROM meetings').get().c;
  const meeting_code = `MOM-${String(count + 1).padStart(3, '0')}`;
  const result = db.prepare(`INSERT INTO meetings (meeting_code, project_id, title, meeting_type, meeting_date, start_time, end_time, location, attendees, agenda, status, organized_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)`)
    .run(meeting_code, project_id, title, meeting_type || 'progress', meeting_date, start_time || null, end_time || null, location || null, attendees || null, agenda || null, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', requireAuth, (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  const { title, meeting_type, meeting_date, start_time, end_time, location, attendees, agenda, minutes, decisions } = req.body;
  db.prepare(`UPDATE meetings SET title=COALESCE(?,title), meeting_type=COALESCE(?,meeting_type),
    meeting_date=COALESCE(?,meeting_date), start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time),
    location=COALESCE(?,location), attendees=COALESCE(?,attendees), agenda=COALESCE(?,agenda),
    minutes=COALESCE(?,minutes), decisions=COALESCE(?,decisions), updated_at=datetime('now') WHERE id=?`)
    .run(title||null, meeting_type||null, meeting_date||null, start_time||null, end_time||null, location||null, attendees||null, agenda||null, minutes||null, decisions||null, meeting.id);
  res.json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(meeting.id));
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  db.prepare("UPDATE meetings SET status=?, updated_at=datetime('now') WHERE id=?").run(status, meeting.id);
  res.json({ success: true });
});

// Action Items
router.post('/:id/actions', requireAuth, (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  const { description, assigned_to, due_date } = req.body;
  if (!description) return res.status(400).json({ error: 'Description is required' });
  const result = db.prepare('INSERT INTO meeting_action_items (meeting_id, description, assigned_to, due_date) VALUES (?, ?, ?, ?)')
    .run(meeting.id, description, assigned_to || null, due_date || null);
  const item = db.prepare('SELECT mai.*, u.name as assigned_to_name FROM meeting_action_items mai LEFT JOIN users u ON mai.assigned_to = u.id WHERE mai.id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.patch('/actions/:actionId', requireAuth, (req, res) => {
  const action = db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(req.params.actionId);
  if (!action) return res.status(404).json({ error: 'Action item not found' });
  const { description, assigned_to, due_date, status } = req.body;
  const completed_at = status === 'completed' ? new Date().toISOString() : null;
  db.prepare('UPDATE meeting_action_items SET description=COALESCE(?,description), assigned_to=COALESCE(?,assigned_to), due_date=COALESCE(?,due_date), status=COALESCE(?,status), completed_at=COALESCE(?,completed_at) WHERE id=?')
    .run(description||null, assigned_to||null, due_date||null, status||null, completed_at, action.id);
  const updated = db.prepare('SELECT mai.*, u.name as assigned_to_name FROM meeting_action_items mai LEFT JOIN users u ON mai.assigned_to = u.id WHERE mai.id = ?').get(action.id);
  res.json(updated);
});

router.delete('/actions/:actionId', requireAuth, (req, res) => {
  const action = db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(req.params.actionId);
  if (!action) return res.status(404).json({ error: 'Action item not found' });
  db.prepare('DELETE FROM meeting_action_items WHERE id = ?').run(action.id);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  db.prepare('DELETE FROM meeting_action_items WHERE meeting_id = ?').run(meeting.id);
  db.prepare('DELETE FROM meetings WHERE id = ?').run(meeting.id);
  res.json({ success: true });
});

export default router;
