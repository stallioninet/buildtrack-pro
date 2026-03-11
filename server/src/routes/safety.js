import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

// ---- PERMITS ----
router.get('/permits', requireAuth, (req, res) => {
  const { project_id, status } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  let sql = `SELECT sp.*, s.name as stage_name, u1.name as requested_by_name, u2.name as approved_by_name
    FROM safety_permits sp LEFT JOIN stages s ON sp.stage_id = s.id
    LEFT JOIN users u1 ON sp.requested_by = u1.id LEFT JOIN users u2 ON sp.approved_by = u2.id
    WHERE sp.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { sql += ' AND sp.status = ?'; params.push(status); }
  sql += ' ORDER BY sp.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/permits', requireAuth, (req, res) => {
  const { project_id, stage_id, permit_type, title, description, location, risk_level, precautions, valid_from, valid_to } = req.body;
  if (!title || !permit_type || !project_id) return res.status(400).json({ error: 'Title, type, and project are required' });
  const count = db.prepare('SELECT COUNT(*) as c FROM safety_permits').get().c;
  const permit_code = `PTW-${String(count + 1).padStart(3, '0')}`;
  const result = db.prepare(`INSERT INTO safety_permits (permit_code, project_id, stage_id, permit_type, title, description, location, risk_level, precautions, valid_from, valid_to, status, requested_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`).run(permit_code, project_id, stage_id || null, permit_type, title, description || null, location || null, risk_level || 'medium', precautions || null, valid_from || null, valid_to || null, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM safety_permits WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/permits/:id', requireAuth, (req, res) => {
  const permit = db.prepare('SELECT * FROM safety_permits WHERE id = ?').get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const { title, description, location, risk_level, precautions, valid_from, valid_to, permit_type, stage_id } = req.body;
  db.prepare(`UPDATE safety_permits SET title=COALESCE(?,title), description=COALESCE(?,description), location=COALESCE(?,location),
    risk_level=COALESCE(?,risk_level), precautions=COALESCE(?,precautions), valid_from=COALESCE(?,valid_from), valid_to=COALESCE(?,valid_to),
    permit_type=COALESCE(?,permit_type), stage_id=COALESCE(?,stage_id) WHERE id=?`)
    .run(title||null, description||null, location||null, risk_level||null, precautions||null, valid_from||null, valid_to||null, permit_type||null, stage_id||null, permit.id);
  res.json(db.prepare('SELECT * FROM safety_permits WHERE id = ?').get(permit.id));
});

router.patch('/permits/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const permit = db.prepare('SELECT * FROM safety_permits WHERE id = ?').get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  const updates = {};
  if (status === 'Approved') { updates.approved_by = req.user.id; updates.approved_at = new Date().toISOString(); }
  if (status === 'Closed') { updates.closed_by = req.user.id; updates.closed_at = new Date().toISOString(); }
  db.prepare('UPDATE safety_permits SET status=?, approved_by=COALESCE(?,approved_by), approved_at=COALESCE(?,approved_at), closed_by=COALESCE(?,closed_by), closed_at=COALESCE(?,closed_at) WHERE id=?')
    .run(status, updates.approved_by||null, updates.approved_at||null, updates.closed_by||null, updates.closed_at||null, permit.id);
  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'safety_permit', ?, ?, ?, 'status_change', ?, ?, 'workflow')`)
    .run(permit.project_id, permit.permit_code, permit.status, status, req.user.id, req.user.name);
  res.json({ success: true });
});

router.delete('/permits/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const permit = db.prepare('SELECT * FROM safety_permits WHERE id = ?').get(req.params.id);
  if (!permit) return res.status(404).json({ error: 'Permit not found' });
  db.prepare('DELETE FROM safety_permits WHERE id = ?').run(permit.id);
  res.json({ success: true });
});

// ---- INCIDENTS ----
router.get('/incidents', requireAuth, (req, res) => {
  const { project_id, status } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  let sql = `SELECT si.*, s.name as stage_name, u1.name as reported_by_name, u2.name as investigated_by_name
    FROM safety_incidents si LEFT JOIN stages s ON si.stage_id = s.id
    LEFT JOIN users u1 ON si.reported_by = u1.id LEFT JOIN users u2 ON si.investigated_by = u2.id
    WHERE si.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { sql += ' AND si.status = ?'; params.push(status); }
  sql += ' ORDER BY si.incident_date DESC, si.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ permits: { total: 0, active: 0 }, incidents: { total: 0, open: 0 } });
  const ph = projectIds.map(() => '?').join(',');
  const permitsTotal = db.prepare(`SELECT COUNT(*) as c FROM safety_permits WHERE project_id IN (${ph})`).get(...projectIds).c;
  const permitsActive = db.prepare(`SELECT COUNT(*) as c FROM safety_permits WHERE project_id IN (${ph}) AND status = 'Approved'`).get(...projectIds).c;
  const incidentsTotal = db.prepare(`SELECT COUNT(*) as c FROM safety_incidents WHERE project_id IN (${ph})`).get(...projectIds).c;
  const incidentsOpen = db.prepare(`SELECT COUNT(*) as c FROM safety_incidents WHERE project_id IN (${ph}) AND status NOT IN ('Closed')`).get(...projectIds).c;
  res.json({ permits: { total: permitsTotal, active: permitsActive }, incidents: { total: incidentsTotal, open: incidentsOpen } });
});

router.post('/incidents', requireAuth, (req, res) => {
  const { project_id, stage_id, incident_type, severity, title, description, location, incident_date, incident_time, persons_involved, injuries } = req.body;
  if (!title || !incident_type || !project_id) return res.status(400).json({ error: 'Title, type, and project are required' });
  const count = db.prepare('SELECT COUNT(*) as c FROM safety_incidents').get().c;
  const incident_code = `INC-${String(count + 1).padStart(3, '0')}`;
  const result = db.prepare(`INSERT INTO safety_incidents (incident_code, project_id, stage_id, incident_type, severity, title, description, location, incident_date, incident_time, persons_involved, injuries, status, reported_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reported', ?)`).run(incident_code, project_id, stage_id || null, incident_type, severity || 'minor', title, description || null, location || null, incident_date || null, incident_time || null, persons_involved || null, injuries || null, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM safety_incidents WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/incidents/:id', requireAuth, (req, res) => {
  const inc = db.prepare('SELECT * FROM safety_incidents WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incident not found' });
  const { title, description, location, severity, root_cause, corrective_action, preventive_action, investigated_by, incident_type } = req.body;
  db.prepare(`UPDATE safety_incidents SET title=COALESCE(?,title), description=COALESCE(?,description), location=COALESCE(?,location),
    severity=COALESCE(?,severity), root_cause=COALESCE(?,root_cause), corrective_action=COALESCE(?,corrective_action),
    preventive_action=COALESCE(?,preventive_action), investigated_by=COALESCE(?,investigated_by), incident_type=COALESCE(?,incident_type) WHERE id=?`)
    .run(title||null, description||null, location||null, severity||null, root_cause||null, corrective_action||null, preventive_action||null, investigated_by||null, incident_type||null, inc.id);
  res.json(db.prepare('SELECT * FROM safety_incidents WHERE id = ?').get(inc.id));
});

router.patch('/incidents/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const inc = db.prepare('SELECT * FROM safety_incidents WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incident not found' });
  if (status === 'Closed') {
    db.prepare("UPDATE safety_incidents SET status=?, closed_by=?, closed_at=datetime('now') WHERE id=?").run(status, req.user.id, inc.id);
  } else {
    db.prepare('UPDATE safety_incidents SET status=? WHERE id=?').run(status, inc.id);
  }
  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'safety_incident', ?, ?, ?, 'status_change', ?, ?, 'workflow')`)
    .run(inc.project_id, inc.incident_code, inc.status, status, req.user.id, req.user.name);
  res.json({ success: true });
});

router.delete('/incidents/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const inc = db.prepare('SELECT * FROM safety_incidents WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incident not found' });
  db.prepare('DELETE FROM safety_incidents WHERE id = ?').run(inc.id);
  res.json({ success: true });
});

export default router;
