import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, requireRole, getUserProjectIds } from '../middleware/auth.js';
import { generateNextCode } from '../services/codeGenerator.js';
import { audit } from '../services/auditHelper.js';

const router = Router();

const TYPES = ['labor', 'equipment', 'material'];

// GET /api/resources — list resources for a project
router.get('/', requireAuth, (req, res) => {
  const { project_id, type } = req.query;

  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('r.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json([]);
    conditions.push(`r.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }

  if (type && TYPES.includes(type)) {
    conditions.push('r.type = ?');
    params.push(type);
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const resources = db.prepare(`
    SELECT r.*, p.name as project_name, u.name as created_by_name
    FROM resources r
    LEFT JOIN projects p ON r.project_id = p.id
    LEFT JOIN users u ON r.created_by = u.id
    ${whereClause}
    ORDER BY r.type, r.name
  `).all(...params);

  // Attach assignment summary
  const assignStmt = db.prepare(`
    SELECT resource_id,
           COALESCE(SUM(planned_qty), 0) as total_planned,
           COALESCE(SUM(actual_qty), 0) as total_actual,
           COUNT(*) as assignment_count
    FROM resource_assignments WHERE resource_id = ?
  `);

  for (const r of resources) {
    const summary = assignStmt.get(r.id);
    r.total_planned = summary?.total_planned || 0;
    r.total_actual = summary?.total_actual || 0;
    r.assignment_count = summary?.assignment_count || 0;
    r.utilization = r.available_qty > 0 ? Math.round((r.total_actual / r.available_qty) * 100) : 0;
  }

  res.json(resources);
});

// GET /api/resources/summary — summary stats
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, byType: [], totalCost: 0 });

  const ph = projectIds.map(() => '?').join(',');

  const total = db.prepare(`SELECT COUNT(*) as c FROM resources WHERE project_id IN (${ph})`).get(...projectIds).c;
  const byType = db.prepare(`SELECT type, COUNT(*) as count FROM resources WHERE project_id IN (${ph}) GROUP BY type`).all(...projectIds);

  const totalPlanned = db.prepare(`
    SELECT COALESCE(SUM(ra.planned_qty * r.rate), 0) as cost
    FROM resource_assignments ra
    JOIN resources r ON ra.resource_id = r.id
    WHERE r.project_id IN (${ph})
  `).get(...projectIds).cost;

  const totalActual = db.prepare(`
    SELECT COALESCE(SUM(ra.actual_qty * r.rate), 0) as cost
    FROM resource_assignments ra
    JOIN resources r ON ra.resource_id = r.id
    WHERE r.project_id IN (${ph})
  `).get(...projectIds).cost;

  res.json({ total, byType, totalPlannedCost: totalPlanned, totalActualCost: totalActual });
});

// GET /api/resources/:id — single resource with assignments
router.get('/:id', requireAuth, (req, res) => {
  const resource = db.prepare(`
    SELECT r.*, p.name as project_name, u.name as created_by_name
    FROM resources r
    LEFT JOIN projects p ON r.project_id = p.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  resource.assignments = db.prepare(`
    SELECT ra.*, t.task_code, t.title as task_title, s.name as stage_name
    FROM resource_assignments ra
    LEFT JOIN tasks t ON ra.task_id = t.id
    LEFT JOIN stages s ON t.stage_id = s.id
    WHERE ra.resource_id = ?
    ORDER BY ra.date DESC
  `).all(resource.id);

  res.json(resource);
});

// POST /api/resources — create resource
router.post('/', requireAuth, requireRole('pm', 'engineer', 'owner'), (req, res) => {
  const { project_id, type, name, unit, rate, available_qty } = req.body;

  if (!project_id || !type || !name) {
    return res.status(400).json({ error: 'project_id, type, and name are required' });
  }

  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${TYPES.join(', ')}` });
  }

  const code = generateNextCode('resources', 'resource_code', 'RES');

  const result = db.prepare(`
    INSERT INTO resources (resource_code, project_id, type, name, unit, rate, available_qty, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, project_id, type, name, unit || null, rate || 0, available_qty || 0, req.user.id);

  audit({ projectId: project_id, entity: 'resource', entityId: code, action: 'created', userId: req.user.id, userName: req.user.name, details: `Created ${type} resource: ${name}`, type: 'info' });

  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(resource);
});

// PATCH /api/resources/:id — update resource
router.patch('/:id', requireAuth, requireRole('pm', 'engineer', 'owner'), (req, res) => {
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  const { name, unit, rate, available_qty, status } = req.body;

  db.prepare(`
    UPDATE resources SET
      name = COALESCE(?, name), unit = COALESCE(?, unit),
      rate = COALESCE(?, rate), available_qty = COALESCE(?, available_qty),
      status = COALESCE(?, status), updated_at = datetime('now')
    WHERE id = ?
  `).run(name || null, unit || null, rate !== undefined ? rate : null, available_qty !== undefined ? available_qty : null, status || null, resource.id);

  res.json(db.prepare('SELECT * FROM resources WHERE id = ?').get(resource.id));
});

// DELETE /api/resources/:id
router.delete('/:id', requireAuth, requireRole('pm', 'owner'), (req, res) => {
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  db.prepare('DELETE FROM resources WHERE id = ?').run(resource.id);
  audit({ projectId: resource.project_id, entity: 'resource', entityId: resource.resource_code, action: 'deleted', userId: req.user.id, userName: req.user.name, type: 'info' });
  res.json({ success: true });
});

// ===== RESOURCE ASSIGNMENTS =====

// POST /api/resources/:id/assignments — assign resource to task
router.post('/:id/assignments', requireAuth, requireRole('pm', 'engineer'), (req, res) => {
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  const { task_id, planned_qty, actual_qty, date, notes } = req.body;
  if (!task_id) return res.status(400).json({ error: 'task_id is required' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(task_id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const result = db.prepare(`
    INSERT INTO resource_assignments (resource_id, task_id, planned_qty, actual_qty, date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(resource.id, task_id, planned_qty || 0, actual_qty || 0, date || null, notes || null);

  const assignment = db.prepare('SELECT * FROM resource_assignments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(assignment);
});

// PATCH /api/resources/assignments/:assignId — update assignment
router.patch('/assignments/:assignId', requireAuth, requireRole('pm', 'engineer'), (req, res) => {
  const assignment = db.prepare('SELECT * FROM resource_assignments WHERE id = ?').get(req.params.assignId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const { planned_qty, actual_qty, date, notes } = req.body;

  db.prepare(`
    UPDATE resource_assignments SET
      planned_qty = COALESCE(?, planned_qty), actual_qty = COALESCE(?, actual_qty),
      date = COALESCE(?, date), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(planned_qty !== undefined ? planned_qty : null, actual_qty !== undefined ? actual_qty : null, date || null, notes || null, assignment.id);

  res.json(db.prepare('SELECT * FROM resource_assignments WHERE id = ?').get(assignment.id));
});

// DELETE /api/resources/assignments/:assignId
router.delete('/assignments/:assignId', requireAuth, requireRole('pm', 'engineer'), (req, res) => {
  const assignment = db.prepare('SELECT * FROM resource_assignments WHERE id = ?').get(req.params.assignId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  db.prepare('DELETE FROM resource_assignments WHERE id = ?').run(assignment.id);
  res.json({ success: true });
});

export default router;
