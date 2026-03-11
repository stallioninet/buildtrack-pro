import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { requireAuth, requireRole, getUserProjectIds, getProjectStageIds } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../data/uploads');

const router = Router();

const VALID_TRANSITIONS = {
  not_started: ['in_progress'],
  in_progress: ['on_hold', 'ready_for_inspection'],
  on_hold: ['in_progress'],
  ready_for_inspection: ['completed', 'rework'],
  rework: ['in_progress'],
  completed: [],  // terminal state
};

// GET /api/tasks — list tasks with filters, scoped by project
// Returns hierarchical structure: parent tasks with nested subtasks
router.get('/', requireAuth, (req, res) => {
  const { stage_id, status, priority, assigned_to, project_id, flat } = req.query;
  const role = req.user.role;

  let sql = `
    SELECT t.*, s.name as stage_name, s.project_id,
           a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN stages s ON t.stage_id = s.id
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
  `;
  const conditions = [];
  const params = [];

  // Project scoping
  if (project_id) {
    conditions.push('s.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length > 0) {
      const ph = projectIds.map(() => '?').join(',');
      conditions.push(`s.project_id IN (${ph})`);
      params.push(...projectIds);
    } else {
      return res.json([]);
    }
  }

  // Contractors see only tasks assigned to them
  if (role === 'contractor') {
    conditions.push('t.assigned_to = ?');
    params.push(req.user.id);
  }

  if (stage_id) {
    conditions.push('t.stage_id = ?');
    params.push(stage_id);
  }
  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }
  if (priority) {
    conditions.push('t.priority = ?');
    params.push(priority);
  }
  if (assigned_to) {
    conditions.push('t.assigned_to = ?');
    params.push(assigned_to);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY t.stage_id, t.id ASC';

  const allTasks = db.prepare(sql).all(...params);

  // Add attachment counts and inspection link counts
  const attCountStmt = db.prepare('SELECT COUNT(*) as c FROM task_attachments WHERE task_id = ?');
  const inspCountStmt = db.prepare('SELECT COUNT(*) as c FROM task_inspections WHERE task_id = ?');
  const inspRequiredPassStmt = db.prepare(`
    SELECT ti.link_type, i.status as insp_status, i.result as insp_result
    FROM task_inspections ti
    JOIN inspections i ON ti.inspection_id = i.id
    WHERE ti.task_id = ? AND ti.link_type = 'required'
  `);
  for (const t of allTasks) {
    t.attachment_count = attCountStmt.get(t.id)?.c || 0;
    t.inspection_count = inspCountStmt.get(t.id)?.c || 0;
    // Check if all required inspections passed
    if (t.inspection_count > 0) {
      const required = inspRequiredPassStmt.all(t.id);
      if (required.length > 0) {
        const allPassed = required.every(r => r.insp_status === 'Completed' && (r.insp_result === 'Pass' || r.insp_result === 'Conditional'));
        const anyFailed = required.some(r => r.insp_result === 'Fail');
        t.inspection_gate = anyFailed ? 'blocked' : allPassed ? 'clear' : 'pending';
      }
    }
  }

  // If flat mode requested, return as-is
  if (flat === '1') {
    return res.json(allTasks);
  }

  // Build hierarchical structure: parent tasks with subtasks nested
  const parentTasks = allTasks.filter(t => !t.parent_task_id);
  const subtaskMap = {};
  for (const t of allTasks) {
    if (t.parent_task_id) {
      if (!subtaskMap[t.parent_task_id]) subtaskMap[t.parent_task_id] = [];
      subtaskMap[t.parent_task_id].push(t);
    }
  }
  for (const p of parentTasks) {
    p.subtasks = subtaskMap[p.id] || [];
  }

  res.json(parentTasks);
});

// GET /api/tasks/summary/counts — task stats, scoped by project
router.get('/summary/counts', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const role = req.user.role;

  let stageFilter = '';
  const params = [];

  if (project_id) {
    const stageIds = getProjectStageIds(parseInt(project_id));
    if (stageIds.length === 0) return res.json({ total: 0, not_started: 0, in_progress: 0, on_hold: 0, ready_for_inspection: 0, rework: 0, completed: 0, highPriority: 0 });
    const ph = stageIds.map(() => '?').join(',');
    stageFilter = `stage_id IN (${ph})`;
    params.push(...stageIds);
  }

  let roleFilter = '';
  const roleParams = [];
  if (role === 'contractor') {
    roleFilter = 'assigned_to = ?';
    roleParams.push(req.user.id);
  }

  // Only count parent tasks for summary
  const parentFilter = 'parent_task_id IS NULL';

  const where = [stageFilter, roleFilter, parentFilter].filter(Boolean).join(' AND ');
  const whereClause = where ? `WHERE ${where}` : '';
  const allParams = [...params, ...roleParams];

  const total = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause}`).get(...allParams).c;
  const notStartedCount = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'not_started'`).get(...allParams).c;
  const inProgressCount = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'in_progress'`).get(...allParams).c;
  const onHoldCount = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'on_hold'`).get(...allParams).c;
  const rfiCount = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'ready_for_inspection'`).get(...allParams).c;
  const reworkCount = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'rework'`).get(...allParams).c;
  const completed = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'completed'`).get(...allParams).c;
  const highPriority = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereClause ? whereClause + ' AND' : 'WHERE'} priority = 'high' AND status != 'completed'`).get(...allParams).c;

  res.json({ total, not_started: notStartedCount, in_progress: inProgressCount, on_hold: onHoldCount, ready_for_inspection: rfiCount, rework: reworkCount, completed, highPriority });
});

// GET /api/tasks/:id — single task with subtasks
router.get('/:id', requireAuth, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, s.name as stage_name,
           a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN stages s ON t.stage_id = s.id
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Include subtasks
  task.subtasks = db.prepare(`
    SELECT t.*, a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.parent_task_id = ?
    ORDER BY t.id ASC
  `).all(task.id);

  // Include linked inspections
  task.inspections = db.prepare(`
    SELECT ti.id as link_id, ti.link_type, ti.created_at as linked_at,
           i.id as inspection_id, i.inspection_code, i.type, i.category, i.inspection_date,
           i.status, i.result, i.defect_count, i.location, i.standard_ref,
           u.name as inspector_name
    FROM task_inspections ti
    JOIN inspections i ON ti.inspection_id = i.id
    LEFT JOIN users u ON i.inspector_id = u.id
    WHERE ti.task_id = ?
    ORDER BY i.inspection_date DESC
  `).all(task.id);

  // Linked defects (defects with task_id = this task)
  task.defects = db.prepare(`
    SELECT d.*, i.inspection_code
    FROM defects d
    LEFT JOIN inspections i ON d.inspection_id = i.id
    WHERE d.task_id = ?
    ORDER BY d.id DESC
  `).all(task.id);

  res.json(task);
});

// POST /api/tasks — create task or subtask (PM, engineer, owner)
router.post('/', requireAuth, requireRole('pm', 'engineer', 'owner'), (req, res) => {
  const { stage_id, parent_task_id, title, description, assigned_to, priority, start_date, due_date } = req.body;

  if (!stage_id || !title) {
    return res.status(400).json({ error: 'stage_id and title are required' });
  }

  // If creating a subtask, validate parent exists and belongs to same stage
  if (parent_task_id) {
    const parent = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parent_task_id);
    if (!parent) return res.status(400).json({ error: 'Parent task not found' });
    if (parent.stage_id !== Number(stage_id)) {
      return res.status(400).json({ error: 'Subtask must belong to same stage as parent' });
    }
  }

  // Generate next task code
  const last = db.prepare("SELECT task_code FROM tasks ORDER BY id DESC LIMIT 1").get();
  let nextNum = 1;
  if (last) {
    const match = last.task_code.match(/T-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const task_code = `T-${String(nextNum).padStart(3, '0')}`;

  const result = db.prepare(`
    INSERT INTO tasks (task_code, stage_id, parent_task_id, title, description, assigned_to, status, priority, start_date, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, ?)
  `).run(task_code, stage_id, parent_task_id || null, title, description || null, assigned_to || null, priority || 'medium', start_date || null, due_date || null, req.user.id);

  const task = db.prepare(`
    SELECT t.*, s.name as stage_name,
           a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN stages s ON t.stage_id = s.id
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});

// PATCH /api/tasks/:id — update task fields (PM, engineer, owner)
router.patch('/:id', requireAuth, requireRole('pm', 'engineer', 'owner'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, description, assigned_to, priority, start_date, due_date, stage_id } = req.body;

  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      assigned_to = COALESCE(?, assigned_to),
      priority = COALESCE(?, priority),
      start_date = COALESCE(?, start_date),
      due_date = COALESCE(?, due_date),
      stage_id = COALESCE(?, stage_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title || null, description || null, assigned_to || null, priority || null, start_date || null, due_date || null, stage_id || null, req.params.id);

  const updated = db.prepare(`
    SELECT t.*, s.name as stage_name,
           a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN stages s ON t.stage_id = s.id
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// PATCH /api/tasks/:id/status — change status
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status, force } = req.body;
  const validStatuses = ['not_started', 'in_progress', 'on_hold', 'ready_for_inspection', 'rework', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: not_started, in_progress, on_hold, ready_for_inspection, rework, completed' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const role = req.user.role;

  // Owner and PM can update any task, engineer/contractor only assigned tasks
  if (role === 'owner' || role === 'pm') {
    // allowed
  } else if (role === 'engineer' || role === 'contractor') {
    if (task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'You can only update status of tasks assigned to you' });
    }
  } else {
    return res.status(403).json({ error: 'You do not have permission to change task status' });
  }

  // Validate state transition (PM can bypass with force for administrative corrections)
  const allowedTransitions = VALID_TRANSITIONS[task.status];
  if (allowedTransitions && !allowedTransitions.includes(status)) {
    if (!(role === 'pm' && force)) {
      return res.status(400).json({
        error: `Invalid transition from '${task.status}' to '${status}'. Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
        allowed: allowedTransitions,
      });
    }
  }

  // Completion gating: check subtasks are all completed
  if (status === 'completed') {
    const subtasks = db.prepare('SELECT id, status FROM tasks WHERE parent_task_id = ?').all(task.id);
    const incompleteSubtasks = subtasks.filter(st => st.status !== 'completed');
    if (incompleteSubtasks.length > 0) {
      return res.status(400).json({
        error: `Cannot complete: ${incompleteSubtasks.length} subtask(s) are not yet completed.`,
        blockers: incompleteSubtasks.map(st => st.id),
      });
    }

    // Check all linked defects are resolved
    const unresolvedDefects = db.prepare(`SELECT id, defect_code, status FROM defects WHERE task_id = ? AND status != 'Resolved'`).all(task.id);
    if (unresolvedDefects.length > 0) {
      return res.status(400).json({
        error: `Cannot complete: ${unresolvedDefects.length} defect(s) are not resolved.`,
        blockers: unresolvedDefects.map(d => d.defect_code),
      });
    }

    // Check required inspections before allowing completion
    const requiredInsps = db.prepare(`
      SELECT ti.link_type, i.inspection_code, i.status as insp_status, i.result as insp_result
      FROM task_inspections ti
      JOIN inspections i ON ti.inspection_id = i.id
      WHERE ti.task_id = ? AND ti.link_type = 'required'
    `).all(task.id);

    const failed = requiredInsps.filter(r => r.insp_result === 'Fail');
    if (failed.length > 0) {
      return res.status(400).json({
        error: `Cannot complete: inspection ${failed[0].inspection_code} failed. Resolve defects first.`,
        blockers: failed.map(f => f.inspection_code),
      });
    }

    const notCompleted = requiredInsps.filter(r => r.insp_status !== 'Completed');
    if (notCompleted.length > 0) {
      // Allow with force flag, otherwise block
      if (!force) {
        return res.status(400).json({
          error: `Cannot complete: inspection ${notCompleted[0].inspection_code} is not yet completed.`,
          blockers: notCompleted.map(f => f.inspection_code),
          canForce: false,
        });
      }
    }
  }

  db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

  // Audit log for status change
  const stage = db.prepare('SELECT project_id FROM stages WHERE id = ?').get(task.stage_id);
  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'task', ?, ?, ?, 'status_change', ?, ?, 'workflow')`).run(stage?.project_id, task.task_code, task.status, status, req.user.id, req.user.name);

  const updated = db.prepare(`
    SELECT t.*, s.name as stage_name,
           a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN stages s ON t.stage_id = s.id
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/tasks/:id — delete task and its subtasks (PM, owner)
router.delete('/:id', requireAuth, requireRole('pm', 'engineer', 'owner'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Collect all task IDs to delete (parent + subtasks)
  const subtaskIds = db.prepare('SELECT id FROM tasks WHERE parent_task_id = ?').all(task.id).map(t => t.id);
  const allIds = [task.id, ...subtaskIds];

  // Delete attachment files from disk
  const ph = allIds.map(() => '?').join(',');
  const attachments = db.prepare(`SELECT file_name FROM task_attachments WHERE task_id IN (${ph})`).all(...allIds);
  for (const att of attachments) {
    const filePath = path.join(UPLOAD_DIR, att.file_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  // Delete attachments, subtasks, then task
  db.prepare(`DELETE FROM task_attachments WHERE task_id IN (${ph})`).run(...allIds);
  db.prepare('DELETE FROM tasks WHERE parent_task_id = ?').run(task.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);

  res.json({ success: true });
});

// ==================== TASK-INSPECTION LINKS ====================

// GET /api/tasks/:id/inspections — get inspections linked to a task
router.get('/:id/inspections', requireAuth, (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const inspections = db.prepare(`
    SELECT ti.id as link_id, ti.link_type, ti.created_at as linked_at,
           i.id as inspection_id, i.inspection_code, i.type, i.category, i.inspection_date,
           i.status, i.result, i.defect_count, i.location, i.standard_ref, i.notes,
           u.name as inspector_name
    FROM task_inspections ti
    JOIN inspections i ON ti.inspection_id = i.id
    LEFT JOIN users u ON i.inspector_id = u.id
    WHERE ti.task_id = ?
    ORDER BY i.inspection_date DESC
  `).all(req.params.id);

  res.json(inspections);
});

// POST /api/tasks/:id/inspections — link an inspection to a task
router.post('/:id/inspections', requireAuth, requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const { inspection_id, link_type } = req.body;
  if (!inspection_id) return res.status(400).json({ error: 'inspection_id is required' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const inspection = db.prepare('SELECT id FROM inspections WHERE id = ?').get(inspection_id);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const validTypes = ['required', 'related', 'blocked_by'];
  const type = validTypes.includes(link_type) ? link_type : 'related';

  // Check duplicate
  const existing = db.prepare('SELECT id FROM task_inspections WHERE task_id = ? AND inspection_id = ?').get(req.params.id, inspection_id);
  if (existing) return res.status(409).json({ error: 'This inspection is already linked to this task' });

  const result = db.prepare(
    'INSERT INTO task_inspections (task_id, inspection_id, link_type, created_by) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, inspection_id, type, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, link_type: type });
});

// PATCH /api/tasks/:taskId/inspections/:linkId — update link type
router.patch('/:taskId/inspections/:linkId', requireAuth, requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const { link_type } = req.body;
  const validTypes = ['required', 'related', 'blocked_by'];
  if (!validTypes.includes(link_type)) return res.status(400).json({ error: 'Invalid link_type' });

  const link = db.prepare('SELECT id FROM task_inspections WHERE id = ? AND task_id = ?').get(req.params.linkId, req.params.taskId);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  db.prepare('UPDATE task_inspections SET link_type = ? WHERE id = ?').run(link_type, link.id);
  res.json({ success: true });
});

// DELETE /api/tasks/:taskId/inspections/:linkId — remove link
router.delete('/:taskId/inspections/:linkId', requireAuth, requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const link = db.prepare('SELECT id FROM task_inspections WHERE id = ? AND task_id = ?').get(req.params.linkId, req.params.taskId);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  db.prepare('DELETE FROM task_inspections WHERE id = ?').run(link.id);
  res.json({ success: true });
});

export default router;
