import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, requireRole, getUserProjectIds } from '../middleware/auth.js';
import { validateTransition, checkGuards, logAudit } from '../services/workflowEngine.js';
import { validate, rfiSchema } from '../middleware/validate.js';
import { generateNextCode } from '../services/codeGenerator.js';

const router = Router();

const VALID_STATUSES = ['Draft', 'Open', 'Responded', 'Closed', 'Void'];

// GET /api/rfis — list RFIs
router.get('/', requireAuth, (req, res) => {
  const { project_id, status, priority, stage_id } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('r.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    conditions.push(`r.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }

  if (status) { conditions.push('r.status = ?'); params.push(status); }
  if (priority) { conditions.push('r.priority = ?'); params.push(priority); }
  if (stage_id) { conditions.push('r.stage_id = ?'); params.push(stage_id); }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM rfis r${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);

  let sql = `
    SELECT r.*, s.name as stage_name, p.name as project_name,
           u1.name as raised_by_name, u2.name as response_by_name,
           t.task_code, t.title as task_title,
           CASE
             WHEN r.status = 'Open' AND r.due_date IS NOT NULL AND r.due_date < datetime('now')
             THEN 1 ELSE 0
           END as is_overdue,
           CASE
             WHEN r.status = 'Open' AND r.due_date IS NOT NULL
             THEN CAST((julianday(r.due_date) - julianday('now')) AS INTEGER)
             ELSE NULL
           END as days_remaining
    FROM rfis r
    LEFT JOIN stages s ON r.stage_id = s.id
    LEFT JOIN projects p ON r.project_id = p.id
    LEFT JOIN users u1 ON r.raised_by = u1.id
    LEFT JOIN users u2 ON r.response_by = u2.id
    LEFT JOIN tasks t ON r.task_id = t.id
  ${whereClause} ORDER BY CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, r.id DESC LIMIT ? OFFSET ?`;

  const data = db.prepare(sql).all(...params, limit, offset);
  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /api/rfis/summary — RFI stats
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.json({ total: 0 });

  const total = db.prepare('SELECT COUNT(*) as c FROM rfis WHERE project_id = ?').get(project_id).c;
  const open = db.prepare("SELECT COUNT(*) as c FROM rfis WHERE project_id = ? AND status = 'Open'").get(project_id).c;
  const overdue = db.prepare("SELECT COUNT(*) as c FROM rfis WHERE project_id = ? AND status = 'Open' AND due_date < datetime('now')").get(project_id).c;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM rfis WHERE project_id = ? GROUP BY status').all(project_id);
  const avgResponseDays = db.prepare(`
    SELECT AVG(CAST(julianday(response_date) - julianday(created_at) AS REAL)) as avg_days
    FROM rfis WHERE project_id = ? AND response_date IS NOT NULL
  `).get(project_id)?.avg_days || 0;

  res.json({ total, open, overdue, byStatus, avgResponseDays: Math.round(avgResponseDays * 10) / 10 });
});

// GET /api/rfis/:id — single RFI
router.get('/:id', requireAuth, (req, res) => {
  const rfi = db.prepare(`
    SELECT r.*, s.name as stage_name, p.name as project_name,
           u1.name as raised_by_name, u2.name as response_by_name,
           t.task_code, t.title as task_title
    FROM rfis r
    LEFT JOIN stages s ON r.stage_id = s.id
    LEFT JOIN projects p ON r.project_id = p.id
    LEFT JOIN users u1 ON r.raised_by = u1.id
    LEFT JOIN users u2 ON r.response_by = u2.id
    LEFT JOIN tasks t ON r.task_id = t.id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!rfi) return res.status(404).json({ error: 'RFI not found' });
  res.json(rfi);
});

// POST /api/rfis — create RFI
router.post('/', requireAuth, validate(rfiSchema), (req, res) => {
  if (!['pm', 'engineer', 'contractor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { project_id, stage_id, task_id, subject, question, drawing_ref, spec_ref, location, priority, due_date } = req.validated;
  if (!project_id || !subject || !question) {
    return res.status(400).json({ error: 'project_id, subject, and question are required' });
  }

  // Generate RFI code
  const code = generateNextCode('rfis', 'rfi_code', 'RFI');

  // Default due date: 14 days from now if not specified
  const safeDueDate = due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO rfis (rfi_code, project_id, stage_id, task_id, subject, question, drawing_ref, spec_ref, location, status, priority, due_date, raised_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)
  `).run(code, project_id, stage_id || null, task_id || null, subject, question, drawing_ref || null, spec_ref || null, location || null, priority || 'medium', safeDueDate, req.user.id);

  logAudit(project_id, 'rfi', code, null, 'Draft', 'created', req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, rfi_code: code });
});

// PATCH /api/rfis/:id — update RFI fields
router.patch('/:id', requireAuth, (req, res) => {
  const rfi = db.prepare('SELECT * FROM rfis WHERE id = ?').get(req.params.id);
  if (!rfi) return res.status(404).json({ error: 'RFI not found' });

  const { subject, question, drawing_ref, spec_ref, location, response, cost_impact, schedule_impact, priority, due_date } = req.body;

  // If providing a response, record responder and date
  let responseBy = null;
  let responseDate = null;
  if (response && !rfi.response) {
    responseBy = req.user.id;
    responseDate = new Date().toISOString();
  }

  db.prepare(`
    UPDATE rfis SET
      subject = COALESCE(?, subject),
      question = COALESCE(?, question),
      drawing_ref = COALESCE(?, drawing_ref),
      spec_ref = COALESCE(?, spec_ref),
      location = COALESCE(?, location),
      response = COALESCE(?, response),
      response_by = COALESCE(?, response_by),
      response_date = COALESCE(?, response_date),
      cost_impact = COALESCE(?, cost_impact),
      schedule_impact = COALESCE(?, schedule_impact),
      priority = COALESCE(?, priority),
      due_date = COALESCE(?, due_date),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(subject, question, drawing_ref, spec_ref, location, response, responseBy, responseDate, cost_impact, schedule_impact, priority, due_date, req.params.id);

  res.json({ success: true });
});

// PATCH /api/rfis/:id/status — change status with workflow validation
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status, force } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const rfi = db.prepare('SELECT * FROM rfis WHERE id = ?').get(req.params.id);
  if (!rfi) return res.status(404).json({ error: 'RFI not found' });

  // Validate transition
  const validation = validateTransition('rfi', rfi.status, status, req.user.role, { force });
  if (!validation.success) {
    return res.status(400).json({ error: validation.error, allowed: validation.allowed });
  }

  // Guard checks
  const guards = checkGuards('rfi', rfi.id, status);
  if (!guards.canProceed && !force) {
    return res.status(400).json({
      error: guards.blockers[0]?.message || 'Guard condition not met',
      blockers: guards.blockers,
    });
  }

  db.prepare("UPDATE rfis SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, rfi.id);
  logAudit(rfi.project_id, 'rfi', rfi.rfi_code, rfi.status, status, 'status_change', req.user.id);

  res.json({ success: true, from: rfi.status, to: status });
});

// PATCH /api/rfis/:id/respond — submit response (shortcut for updating response + status)
router.patch('/:id/respond', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only PM, Engineer, or Owner can respond to RFIs' });
  }

  const rfi = db.prepare('SELECT * FROM rfis WHERE id = ?').get(req.params.id);
  if (!rfi) return res.status(404).json({ error: 'RFI not found' });

  const { response, cost_impact, schedule_impact } = req.body;
  if (!response) return res.status(400).json({ error: 'Response text is required' });

  db.prepare(`
    UPDATE rfis SET
      response = ?,
      response_by = ?,
      response_date = datetime('now'),
      cost_impact = COALESCE(?, cost_impact),
      schedule_impact = COALESCE(?, schedule_impact),
      status = 'Responded',
      updated_at = datetime('now')
    WHERE id = ?
  `).run(response, req.user.id, cost_impact || null, schedule_impact || null, rfi.id);

  logAudit(rfi.project_id, 'rfi', rfi.rfi_code, rfi.status, 'Responded', 'responded', req.user.id);

  res.json({ success: true });
});

// DELETE /api/rfis/:id
router.delete('/:id', requireAuth, requireRole('pm'), (req, res) => {
  const rfi = db.prepare('SELECT * FROM rfis WHERE id = ?').get(req.params.id);
  if (!rfi) return res.status(404).json({ error: 'RFI not found' });

  db.prepare('DELETE FROM rfis WHERE id = ?').run(rfi.id);
  logAudit(rfi.project_id, 'rfi', rfi.rfi_code, rfi.status, null, 'deleted', req.user.id);

  res.json({ success: true });
});

export default router;
