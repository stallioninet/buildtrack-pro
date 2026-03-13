import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, requireRole, getUserProjectIds } from '../middleware/auth.js';
import { validateTransition, checkGuards, executePostTransitionActions, logAudit } from '../services/workflowEngine.js';
import { validate, ncrSchema } from '../middleware/validate.js';
import { generateNextCode } from '../services/codeGenerator.js';
import { notifyNCREscalation, notifyStatusChange } from '../services/notificationService.js';

const router = Router();

const VALID_STATUSES = ['Identified', 'Reported', 'Under Review', 'Root Cause Analysis', 'Disposition', 'Corrective Action', 'Verification', 'Closed', 'Void'];
const SEVERITIES = ['Minor', 'Major', 'Critical'];
const CATEGORIES = ['Workmanship', 'Material', 'Design', 'Method', 'Supervision', 'Environmental'];
const ROOT_CAUSE_METHODS = ['5_whys', 'fishbone', 'pareto', 'other'];
const DISPOSITIONS = ['Rework', 'Repair', 'Use-As-Is', 'Reject'];

// GET /api/ncrs — list NCRs
router.get('/', requireAuth, (req, res) => {
  const { project_id, status, severity, stage_id, assigned_to } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('n.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    conditions.push(`n.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }

  if (status) { conditions.push('n.status = ?'); params.push(status); }
  if (severity) { conditions.push('n.severity = ?'); params.push(severity); }
  if (stage_id) { conditions.push('n.stage_id = ?'); params.push(stage_id); }
  if (assigned_to) { conditions.push('n.assigned_to = ?'); params.push(assigned_to); }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM ncrs n${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);

  let sql = `
    SELECT n.*, s.name as stage_name, p.name as project_name,
           u1.name as raised_by_name, u2.name as assigned_to_name,
           t.task_code, t.title as task_title,
           i.inspection_code
    FROM ncrs n
    LEFT JOIN stages s ON n.stage_id = s.id
    LEFT JOIN projects p ON n.project_id = p.id
    LEFT JOIN users u1 ON n.raised_by = u1.id
    LEFT JOIN users u2 ON n.assigned_to = u2.id
    LEFT JOIN tasks t ON n.task_id = t.id
    LEFT JOIN inspections i ON n.inspection_id = i.id
  ${whereClause} ORDER BY CASE n.severity WHEN 'Critical' THEN 1 WHEN 'Major' THEN 2 ELSE 3 END, n.id DESC LIMIT ? OFFSET ?`;

  const data = db.prepare(sql).all(...params, limit, offset);
  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /api/ncrs/summary — NCR stats
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.json({ total: 0 });

  const total = db.prepare('SELECT COUNT(*) as c FROM ncrs WHERE project_id = ?').get(project_id).c;
  const open = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE project_id = ? AND status NOT IN ('Closed', 'Void')").get(project_id).c;
  const critical = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE project_id = ? AND severity = 'Critical' AND status NOT IN ('Closed', 'Void')").get(project_id).c;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM ncrs WHERE project_id = ? GROUP BY status').all(project_id);
  const bySeverity = db.prepare("SELECT severity, COUNT(*) as count FROM ncrs WHERE project_id = ? AND status NOT IN ('Closed', 'Void') GROUP BY severity").all(project_id);
  const byCategory = db.prepare("SELECT category, COUNT(*) as count FROM ncrs WHERE project_id = ? AND status NOT IN ('Closed', 'Void') GROUP BY category").all(project_id);

  res.json({ total, open, critical, byStatus, bySeverity, byCategory });
});

// GET /api/ncrs/:id — single NCR detail
router.get('/:id', requireAuth, (req, res) => {
  const ncr = db.prepare(`
    SELECT n.*, s.name as stage_name, p.name as project_name,
           u1.name as raised_by_name, u2.name as assigned_to_name, u3.name as closed_by_name,
           t.task_code, t.title as task_title,
           i.inspection_code, i.type as inspection_type
    FROM ncrs n
    LEFT JOIN stages s ON n.stage_id = s.id
    LEFT JOIN projects p ON n.project_id = p.id
    LEFT JOIN users u1 ON n.raised_by = u1.id
    LEFT JOIN users u2 ON n.assigned_to = u2.id
    LEFT JOIN users u3 ON n.closed_by = u3.id
    LEFT JOIN tasks t ON n.task_id = t.id
    LEFT JOIN inspections i ON n.inspection_id = i.id
    WHERE n.id = ?
  `).get(req.params.id);

  if (!ncr) return res.status(404).json({ error: 'NCR not found' });
  res.json(ncr);
});

// POST /api/ncrs — create NCR
router.post('/', requireAuth, validate(ncrSchema), requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const { project_id, stage_id, task_id, inspection_id, title, description, severity, category, location, is_code_ref, assigned_to, due_date } = req.validated;

  if (!project_id || !title) {
    return res.status(400).json({ error: 'project_id and title are required' });
  }

  const safeSeverity = SEVERITIES.includes(severity) ? severity : 'Major';
  const safeCategory = CATEGORIES.includes(category) ? category : 'Workmanship';

  // Generate NCR code
  const code = generateNextCode('ncrs', 'ncr_code', 'NCR');

  const result = db.prepare(`
    INSERT INTO ncrs (ncr_code, project_id, stage_id, task_id, inspection_id, title, description, severity, category, location, is_code_ref, status, raised_by, assigned_to, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Identified', ?, ?, ?)
  `).run(code, project_id, stage_id || null, task_id || null, inspection_id || null, title, description || null, safeSeverity, safeCategory, location || null, is_code_ref || null, req.user.id, assigned_to || null, due_date || null);

  logAudit(project_id, 'ncr', code, null, 'Identified', 'created', req.user.id);

  // Notify for Critical/Major NCRs
  if (['Critical', 'Major'].includes(safeSeverity)) {
    notifyNCREscalation({
      ncrCode: code,
      ncrTitle: title,
      ncrId: result.lastInsertRowid,
      severity: safeSeverity,
      projectId: project_id,
      raisedBy: req.user.id,
      raisedByName: req.user.name,
    });
  }

  res.status(201).json({ id: result.lastInsertRowid, ncr_code: code });
});

// PATCH /api/ncrs/:id — update NCR fields
router.patch('/:id', requireAuth, (req, res) => {
  const ncr = db.prepare('SELECT * FROM ncrs WHERE id = ?').get(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'NCR not found' });

  const { title, description, severity, category, root_cause, root_cause_method, disposition, corrective_action, verification_notes, location, is_code_ref, assigned_to, due_date } = req.body;

  db.prepare(`
    UPDATE ncrs SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      severity = COALESCE(?, severity),
      category = COALESCE(?, category),
      root_cause = COALESCE(?, root_cause),
      root_cause_method = COALESCE(?, root_cause_method),
      disposition = COALESCE(?, disposition),
      corrective_action = COALESCE(?, corrective_action),
      verification_notes = COALESCE(?, verification_notes),
      location = COALESCE(?, location),
      is_code_ref = COALESCE(?, is_code_ref),
      assigned_to = COALESCE(?, assigned_to),
      due_date = COALESCE(?, due_date),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, severity, category, root_cause, root_cause_method, disposition, corrective_action, verification_notes, location, is_code_ref, assigned_to, due_date, req.params.id);

  res.json({ success: true });
});

// PATCH /api/ncrs/:id/status — change NCR status with workflow validation
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status, force } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const ncr = db.prepare('SELECT * FROM ncrs WHERE id = ?').get(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'NCR not found' });

  // Validate transition via workflow engine
  const validation = validateTransition('ncr', ncr.status, status, req.user.role, { force });
  if (!validation.success) {
    return res.status(400).json({ error: validation.error, allowed: validation.allowed });
  }

  // Check guard conditions
  const guards = checkGuards('ncr', ncr.id, status);
  if (!guards.canProceed && !force) {
    return res.status(400).json({
      error: guards.blockers[0]?.message || 'Guard condition not met',
      blockers: guards.blockers,
    });
  }

  // Update status
  const updates = { status };
  if (status === 'Closed') {
    updates.closed_by = req.user.id;
    updates.closed_at = new Date().toISOString();
  }

  db.prepare(`
    UPDATE ncrs SET status = ?, closed_by = COALESCE(?, closed_by), closed_at = COALESCE(?, closed_at), updated_at = datetime('now') WHERE id = ?
  `).run(status, updates.closed_by || null, updates.closed_at || null, ncr.id);

  // Audit log
  logAudit(ncr.project_id, 'ncr', ncr.ncr_code, ncr.status, status, 'status_change', req.user.id);

  // Post-transition actions
  executePostTransitionActions('ncr', ncr.id, ncr.status, status, req.user.id);

  // Notify project members about status change
  notifyStatusChange({
    entityType: 'ncr',
    entityCode: ncr.ncr_code,
    entityTitle: ncr.title,
    entityId: ncr.id,
    fromStatus: ncr.status,
    toStatus: status,
    projectId: ncr.project_id,
    changedBy: req.user.id,
    changedByName: req.user.name,
  });

  res.json({ success: true, from: ncr.status, to: status });
});

// DELETE /api/ncrs/:id
router.delete('/:id', requireAuth, requireRole('pm'), (req, res) => {
  const ncr = db.prepare('SELECT * FROM ncrs WHERE id = ?').get(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'NCR not found' });

  db.prepare('DELETE FROM ncrs WHERE id = ?').run(ncr.id);
  logAudit(ncr.project_id, 'ncr', ncr.ncr_code, ncr.status, null, 'deleted', req.user.id);

  res.json({ success: true });
});

export default router;
