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
  if (!['pm', 'engineer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to edit meetings' });
  }
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
  if (!['pm', 'engineer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to change meeting status' });
  }
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
  if (!['pm', 'engineer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to delete action items' });
  }
  db.prepare('DELETE FROM meeting_action_items WHERE id = ?').run(action.id);
  res.json({ success: true });
});

// Attendees
router.get('/:id/attendees', requireAuth, (req, res) => {
  const attendees = db.prepare(`SELECT ma.*, u.name as user_name, u.email as user_email
    FROM meeting_attendees ma LEFT JOIN users u ON ma.user_id = u.id
    WHERE ma.meeting_id = ? ORDER BY ma.id`).all(req.params.id);
  res.json(attendees);
});

router.post('/:id/attendees', requireAuth, (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  const { user_id, name, role } = req.body;
  if (!name && !user_id) return res.status(400).json({ error: 'Name or user is required' });
  const attendeeName = name || db.prepare('SELECT name FROM users WHERE id = ?').get(user_id)?.name || 'Unknown';
  const result = db.prepare('INSERT INTO meeting_attendees (meeting_id, user_id, name, role) VALUES (?, ?, ?, ?)')
    .run(meeting.id, user_id || null, attendeeName, role || null);
  res.status(201).json(db.prepare('SELECT * FROM meeting_attendees WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/attendees/:attendeeId', requireAuth, (req, res) => {
  const attendee = db.prepare('SELECT * FROM meeting_attendees WHERE id = ?').get(req.params.attendeeId);
  if (!attendee) return res.status(404).json({ error: 'Attendee not found' });
  if (!['pm', 'engineer', 'owner'].includes(req.user.role) && attendee.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to modify attendees' });
  }
  const { rsvp, attended } = req.body;
  db.prepare('UPDATE meeting_attendees SET rsvp=COALESCE(?,rsvp), attended=COALESCE(?,attended) WHERE id=?')
    .run(rsvp || null, attended !== undefined ? (attended ? 1 : 0) : null, attendee.id);
  res.json(db.prepare('SELECT * FROM meeting_attendees WHERE id = ?').get(attendee.id));
});

router.delete('/attendees/:attendeeId', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to remove attendees' });
  }
  db.prepare('DELETE FROM meeting_attendees WHERE id = ?').run(req.params.attendeeId);
  res.json({ success: true });
});

// Convert action item to task
router.post('/actions/:actionId/convert-to-task', requireAuth, (req, res) => {
  const action = db.prepare('SELECT mai.*, m.project_id FROM meeting_action_items mai JOIN meetings m ON mai.meeting_id = m.id WHERE mai.id = ?').get(req.params.actionId);
  if (!action) return res.status(404).json({ error: 'Action item not found' });

  // Get first stage for the project
  const stage = db.prepare('SELECT id FROM stages WHERE project_id = ? ORDER BY stage_order LIMIT 1').get(action.project_id);
  if (!stage) return res.status(400).json({ error: 'No stages found for project' });

  const count = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
  const task_code = `TSK-${String(count + 1).padStart(4, '0')}`;

  const result = db.prepare(`INSERT INTO tasks (task_code, stage_id, title, description, assigned_to, status, priority, due_date, created_by) VALUES (?, ?, ?, ?, ?, 'not_started', 'medium', ?, ?)`)
    .run(task_code, stage.id, action.description, `Converted from meeting action item #${action.id}`, action.assigned_to || null, action.due_date || null, req.user.id);

  // Mark action as completed with reference
  db.prepare("UPDATE meeting_action_items SET status='completed', completed_at=datetime('now') WHERE id=?").run(action.id);

  res.status(201).json({ task_id: result.lastInsertRowid, task_code });
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
