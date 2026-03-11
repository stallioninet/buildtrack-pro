import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

// GET /inspections/summary — stats for dashboard cards
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  let stageIds;

  if (project_id) {
    stageIds = db.prepare('SELECT id FROM stages WHERE project_id = ?').all(project_id).map(s => s.id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json({ inspections: {}, defects: {} });
    const ph = projectIds.map(() => '?').join(',');
    stageIds = db.prepare(`SELECT id FROM stages WHERE project_id IN (${ph})`).all(...projectIds).map(s => s.id);
  }

  if (stageIds.length === 0) {
    return res.json({
      inspections: { total: 0, scheduled: 0, inProgress: 0, completed: 0, passRate: 0 },
      defects: { total: 0, open: 0, inProgress: 0, resolved: 0, highSeverity: 0 },
    });
  }

  const ph = stageIds.map(() => '?').join(',');
  const projectIds2 = project_id ? [parseInt(project_id)] : getUserProjectIds(req.user.id, req.user.role);
  const pph = projectIds2.map(() => '?').join(',');

  const inspTotal = db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE stage_id IN (${ph})`).get(...stageIds).c;
  const inspScheduled = db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE status = 'Scheduled' AND stage_id IN (${ph})`).get(...stageIds).c;
  const inspInProgress = db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE status = 'In Progress' AND stage_id IN (${ph})`).get(...stageIds).c;
  const inspCompleted = db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE status = 'Completed' AND stage_id IN (${ph})`).get(...stageIds).c;
  const inspPassed = db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE result = 'Pass' AND stage_id IN (${ph})`).get(...stageIds).c;

  const defTotal = db.prepare(`SELECT COUNT(*) as c FROM defects WHERE project_id IN (${pph})`).get(...projectIds2).c;
  const defOpen = db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'Open' AND project_id IN (${pph})`).get(...projectIds2).c;
  const defInProgress = db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'In Progress' AND project_id IN (${pph})`).get(...projectIds2).c;
  const defResolved = db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'Resolved' AND project_id IN (${pph})`).get(...projectIds2).c;
  const defHigh = db.prepare(`SELECT COUNT(*) as c FROM defects WHERE severity = 'High' AND status != 'Resolved' AND project_id IN (${pph})`).get(...projectIds2).c;

  res.json({
    inspections: {
      total: inspTotal,
      scheduled: inspScheduled,
      inProgress: inspInProgress,
      completed: inspCompleted,
      passRate: inspCompleted > 0 ? Math.round((inspPassed / inspCompleted) * 100) : 0,
    },
    defects: {
      total: defTotal,
      open: defOpen,
      inProgress: defInProgress,
      resolved: defResolved,
      highSeverity: defHigh,
    },
  });
});

// GET /inspections — list inspections
router.get('/', requireAuth, (req, res) => {
  const { project_id, status, type, stage_id } = req.query;

  let sql = `
    SELECT i.*, i.category, s.name as stage_name, s.project_id, u.name as inspector_name, p.name as project_name,
           (SELECT COUNT(*) FROM defects d WHERE d.inspection_id = i.id) as defect_count
    FROM inspections i
    LEFT JOIN stages s ON i.stage_id = s.id
    LEFT JOIN users u ON i.inspector_id = u.id
    LEFT JOIN projects p ON i.project_id = p.id
  `;
  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('i.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json([]);
    conditions.push(`i.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }

  if (status) { conditions.push('i.status = ?'); params.push(status); }
  if (type) { conditions.push('i.type = ?'); params.push(type); }
  if (stage_id) { conditions.push('i.stage_id = ?'); params.push(stage_id); }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY i.inspection_date DESC, i.id DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET /inspections/:id — single inspection with defects
router.get('/:id', requireAuth, (req, res) => {
  const inspection = db.prepare(`
    SELECT i.*, s.name as stage_name, s.project_id, u.name as inspector_name, p.name as project_name,
           c.name as created_by_name
    FROM inspections i
    LEFT JOIN stages s ON i.stage_id = s.id
    LEFT JOIN users u ON i.inspector_id = u.id
    LEFT JOIN projects p ON i.project_id = p.id
    LEFT JOIN users c ON i.created_by = c.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const defects = db.prepare(`
    SELECT d.*, r.name as resolved_by_name
    FROM defects d
    LEFT JOIN users r ON d.resolved_by = r.id
    WHERE d.inspection_id = ?
    ORDER BY CASE d.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, d.id
  `).all(inspection.id);

  // Linked tasks
  const linkedTasks = db.prepare(`
    SELECT ti.id as link_id, ti.link_type,
           t.id as task_id, t.task_code, t.title, t.status, t.priority,
           t.parent_task_id, s.name as stage_name
    FROM task_inspections ti
    JOIN tasks t ON ti.task_id = t.id
    LEFT JOIN stages s ON t.stage_id = s.id
    WHERE ti.inspection_id = ?
    ORDER BY t.task_code
  `).all(inspection.id);

  res.json({ ...inspection, defects, linkedTasks });
});

// POST /inspections — create inspection
router.post('/', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only PM, Engineer, or Inspector can create inspections' });
  }

  const { project_id, stage_id, type, inspection_date, inspector_id, notes, location, standard_ref, category } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  const validCategories = ['hold_point', 'witness_point', 'surveillance'];
  const safeCategory = validCategories.includes(category) ? category : 'hold_point';

  // Generate next code
  const last = db.prepare("SELECT inspection_code FROM inspections ORDER BY id DESC LIMIT 1").get();
  const nextNum = last ? parseInt(last.inspection_code.replace('INS-', '')) + 1 : 1;
  const code = `INS-${String(nextNum).padStart(3, '0')}`;

  const result = db.prepare(`
    INSERT INTO inspections (inspection_code, project_id, stage_id, type, category, inspection_date, inspector_id, status, notes, location, standard_ref, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?)
  `).run(code, project_id, stage_id || null, type || 'General', safeCategory, inspection_date, inspector_id || null, notes || null, location || null, standard_ref || null, req.user.id);

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, action, user_id, user_display, type) VALUES (?, 'inspection', ?, 'created', ?, ?, 'workflow')`).run(project_id, code, req.user.id, req.user.name);

  res.status(201).json({ id: result.lastInsertRowid, inspection_code: code });
});

// PATCH /inspections/:id — update inspection
router.patch('/:id', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const { status, result, notes, location, type, inspection_date, inspector_id, standard_ref, category } = req.body;

  const oldStatus = inspection.status;
  const newStatus = status || oldStatus;

  // When completing an inspection, result must be provided
  if ((status === 'Completed' || (newStatus === 'Completed' && !status)) && !result && !inspection.result) {
    return res.status(400).json({ error: 'Result (Pass/Fail/Conditional) is required when completing an inspection' });
  }

  const validCategories = ['hold_point', 'witness_point', 'surveillance'];
  const safeCategory = category && validCategories.includes(category) ? category : null;

  db.prepare(`
    UPDATE inspections SET
      status = COALESCE(?, status),
      result = COALESCE(?, result),
      notes = COALESCE(?, notes),
      location = COALESCE(?, location),
      type = COALESCE(?, type),
      category = COALESCE(?, category),
      inspection_date = COALESCE(?, inspection_date),
      inspector_id = COALESCE(?, inspector_id),
      standard_ref = COALESCE(?, standard_ref),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, result, notes, location, type, safeCategory, inspection_date, inspector_id, standard_ref, req.params.id);

  if (status && status !== oldStatus) {
    db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'inspection', ?, ?, ?, 'status_change', ?, ?, 'workflow')`).run(inspection.project_id, inspection.inspection_code, oldStatus, newStatus, req.user.id, req.user.name);
  }

  // If result changed to 'Fail', auto-set linked tasks to 'rework'
  if (result === 'Fail') {
    const linkedTasks = db.prepare(`
      SELECT ti.task_id, t.task_code, t.status
      FROM task_inspections ti
      JOIN tasks t ON ti.task_id = t.id
      WHERE ti.inspection_id = ? AND ti.link_type IN ('required', 'blocked_by')
    `).all(req.params.id);

    for (const lt of linkedTasks) {
      if (lt.status !== 'completed' && lt.status !== 'rework') {
        db.prepare("UPDATE tasks SET status = 'rework', updated_at = datetime('now') WHERE id = ?").run(lt.task_id);
        // Audit log for auto-rework
        db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, details, type) VALUES (?, 'task', ?, ?, 'rework', 'auto_status_change', ?, ?, ?, 'workflow')`).run(
          inspection.project_id, lt.task_code, lt.status, req.user.id, req.user.name,
          `Auto-rework: inspection ${inspection.inspection_code} failed`
        );
      }
    }
  }

  res.json({ success: true });
});

// PATCH /inspections/:id/status — quick status change (kept for backward compatibility)
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status, result } = req.body;
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  db.prepare('UPDATE inspections SET status = ?, result = COALESCE(?, result), updated_at = datetime(\'now\') WHERE id = ?').run(status, result || null, inspection.id);

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'inspection', ?, ?, ?, 'status_change', ?, ?, 'workflow')`).run(inspection.project_id, inspection.inspection_code, inspection.status, status, req.user.id, req.user.name);

  res.json({ success: true });
});

// DELETE /inspections/:id
router.delete('/:id', requireAuth, (req, res) => {
  if (!['pm', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only PM or Inspector can delete inspections' });
  }

  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  db.prepare('DELETE FROM defects WHERE inspection_id = ?').run(inspection.id);
  db.prepare('DELETE FROM inspections WHERE id = ?').run(inspection.id);

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, action, user_id, user_display, type) VALUES (?, 'inspection', ?, 'deleted', ?, ?, 'workflow')`).run(inspection.project_id, inspection.inspection_code, req.user.id, req.user.name);

  res.json({ success: true });
});

// ==================== DEFECT ROUTES ====================

// GET /inspections/defects/all — list all defects
router.get('/defects/all', requireAuth, (req, res) => {
  const { project_id, status, severity, category } = req.query;

  let sql = `
    SELECT d.*, i.inspection_code, i.type as inspection_type, s.name as stage_name, p.name as project_name,
           r.name as resolved_by_name
    FROM defects d
    LEFT JOIN inspections i ON d.inspection_id = i.id
    LEFT JOIN stages s ON i.stage_id = s.id
    LEFT JOIN projects p ON d.project_id = p.id
    LEFT JOIN users r ON d.resolved_by = r.id
  `;
  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('d.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json([]);
    conditions.push(`d.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }

  if (status) { conditions.push('d.status = ?'); params.push(status); }
  if (severity) { conditions.push('d.severity = ?'); params.push(severity); }
  if (category) { conditions.push('d.category = ?'); params.push(category); }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY CASE d.severity WHEN \'Critical\' THEN 1 WHEN \'High\' THEN 2 WHEN \'Medium\' THEN 3 ELSE 4 END, d.id DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST /inspections/defects — create defect
router.post('/defects', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { inspection_id, project_id, description, severity, category, location, assigned_to, due_date } = req.body;
  if (!project_id || !description) return res.status(400).json({ error: 'project_id and description are required' });

  const last = db.prepare("SELECT defect_code FROM defects ORDER BY id DESC LIMIT 1").get();
  const nextNum = last ? parseInt(last.defect_code.replace('DEF-', '')) + 1 : 1;
  const code = `DEF-${String(nextNum).padStart(3, '0')}`;

  const result = db.prepare(`
    INSERT INTO defects (defect_code, inspection_id, project_id, description, severity, category, location, assigned_to, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, inspection_id || null, project_id, description, severity || 'Medium', category || 'Workmanship', location || null, assigned_to || null, due_date || null);

  // Update inspection defect count
  if (inspection_id) {
    const count = db.prepare('SELECT COUNT(*) as c FROM defects WHERE inspection_id = ?').get(inspection_id).c;
    db.prepare('UPDATE inspections SET defect_count = ? WHERE id = ?').run(count, inspection_id);
  }

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, action, user_id, user_display, type) VALUES (?, 'defect', ?, 'created', ?, ?, 'workflow')`).run(project_id, code, req.user.id, req.user.name);

  res.status(201).json({ id: result.lastInsertRowid, defect_code: code });
});

// PATCH /inspections/defects/:id — update defect
router.patch('/defects/:id', requireAuth, (req, res) => {
  const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(req.params.id);
  if (!defect) return res.status(404).json({ error: 'Defect not found' });

  const { status, severity, assigned_to, description, category, location, due_date, resolution_notes } = req.body;

  const oldStatus = defect.status;
  const newStatus = status || oldStatus;

  let resolvedBy = null;
  let resolvedAt = null;
  if (newStatus === 'Resolved' && oldStatus !== 'Resolved') {
    resolvedBy = req.user.id;
    resolvedAt = new Date().toISOString();
  }

  db.prepare(`
    UPDATE defects SET
      status = COALESCE(?, status),
      severity = COALESCE(?, severity),
      assigned_to = COALESCE(?, assigned_to),
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      location = COALESCE(?, location),
      due_date = COALESCE(?, due_date),
      resolution_notes = COALESCE(?, resolution_notes),
      resolved_by = COALESCE(?, resolved_by),
      resolved_at = COALESCE(?, resolved_at)
    WHERE id = ?
  `).run(status, severity, assigned_to, description, category, location, due_date, resolution_notes, resolvedBy, resolvedAt, req.params.id);

  if (status && status !== oldStatus) {
    db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'defect', ?, ?, ?, 'status_change', ?, ?, 'workflow')`).run(defect.project_id, defect.defect_code, oldStatus, newStatus, req.user.id, req.user.name);
  }

  res.json({ success: true });
});

export default router;
