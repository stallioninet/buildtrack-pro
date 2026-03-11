import db from '../config/db.js';

/**
 * Centralized Workflow Engine
 *
 * Reads state machine definitions from the state_machines table and enforces
 * transitions, guard conditions, role checks, and cross-entity blocking.
 * All entity route handlers should call this service instead of hard-coding transitions.
 */

// Cache workflow definitions (they don't change at runtime)
const workflowCache = new Map();

function loadWorkflow(machineKey) {
  if (workflowCache.has(machineKey)) return workflowCache.get(machineKey);

  const row = db.prepare('SELECT * FROM state_machines WHERE machine_key = ?').get(machineKey);
  if (!row) return null;

  const workflow = {
    id: row.id,
    key: row.machine_key,
    name: row.name,
    entity: row.entity,
    category: row.category,
    states: JSON.parse(row.states_json),
    transitions: JSON.parse(row.transitions_json),
    rules: row.rules_json ? JSON.parse(row.rules_json) : [],
    blocking: row.blocking_json ? JSON.parse(row.blocking_json) : [],
  };

  workflowCache.set(machineKey, workflow);
  return workflow;
}

/** Clear the cache (call after editing workflow definitions) */
export function clearCache() {
  workflowCache.clear();
}

/**
 * Get valid next states for an entity given its current state and the user's role.
 */
export function getValidTransitions(machineKey, currentState, userRole) {
  const wf = loadWorkflow(machineKey);
  if (!wf) return [];

  return wf.transitions
    .filter(t => {
      // Normalize state matching (case-insensitive, underscore/space flexible)
      if (normalizeState(t.from) !== normalizeState(currentState)) return false;
      // Check role permission
      if (t.role) {
        const allowedRoles = t.role.split(',').map(r => r.trim().toLowerCase());
        if (!allowedRoles.includes(userRole) && userRole !== 'pm') return false;
      }
      return true;
    })
    .map(t => ({
      to: t.to,
      trigger: t.trigger,
      guard: t.guard || null,
      role: t.role || null,
    }));
}

/**
 * Validate and execute a state transition.
 * Returns { success, error, fromState, toState, transition }
 */
export function validateTransition(machineKey, currentState, toState, userRole, options = {}) {
  const wf = loadWorkflow(machineKey);
  if (!wf) {
    return { success: true, warning: 'No workflow definition found, allowing transition' };
  }

  const normalizedCurrent = normalizeState(currentState);
  const normalizedTo = normalizeState(toState);

  // Find matching transition
  const transition = wf.transitions.find(t =>
    normalizeState(t.from) === normalizedCurrent &&
    normalizeState(t.to) === normalizedTo
  );

  if (!transition) {
    // PM with force can bypass
    if (userRole === 'pm' && options.force) {
      return { success: true, bypassed: true, warning: 'Transition bypassed by PM force override' };
    }

    const allowed = wf.transitions
      .filter(t => normalizeState(t.from) === normalizedCurrent)
      .map(t => t.to);

    return {
      success: false,
      error: `Invalid transition from '${currentState}' to '${toState}'. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      allowed,
    };
  }

  // Check role permission
  if (transition.role) {
    const allowedRoles = transition.role.split(',').map(r => r.trim().toLowerCase());
    // PM always allowed, owner allowed for most things
    if (!allowedRoles.includes(userRole) && userRole !== 'pm' && userRole !== 'owner') {
      if (options.force && userRole === 'pm') {
        return { success: true, bypassed: true };
      }
      return {
        success: false,
        error: `Role '${userRole}' cannot perform this transition. Required: ${transition.role}`,
      };
    }
  }

  return {
    success: true,
    transition,
    fromState: currentState,
    toState,
  };
}

/**
 * Check entity-specific guard conditions (blocking rules) before completion.
 * Returns { canProceed, blockers[] }
 */
export function checkGuards(entityType, entityId, toState, options = {}) {
  const blockers = [];

  if (entityType === 'task') {
    return checkTaskGuards(entityId, toState, options);
  }

  if (entityType === 'inspection') {
    return checkInspectionGuards(entityId, toState, options);
  }

  if (entityType === 'stage') {
    return checkStageGuards(entityId, toState, options);
  }

  if (entityType === 'ncr') {
    return checkNCRGuards(entityId, toState, options);
  }

  if (entityType === 'rfi') {
    return checkRFIGuards(entityId, toState, options);
  }

  return { canProceed: true, blockers: [] };
}

// ─── Task Guard Conditions ───

function checkTaskGuards(taskId, toState, options) {
  const blockers = [];
  const normalizedTo = normalizeState(toState);

  if (normalizedTo === 'completed') {
    // 1. All subtasks must be completed
    const subtasks = db.prepare('SELECT id, status, title FROM tasks WHERE parent_task_id = ?').all(taskId);
    const incomplete = subtasks.filter(s => s.status !== 'completed');
    if (incomplete.length > 0) {
      blockers.push({
        type: 'subtasks_incomplete',
        message: `${incomplete.length} subtask(s) not completed`,
        details: incomplete.map(s => ({ id: s.id, title: s.title, status: s.status })),
      });
    }

    // 2. All linked defects must be resolved
    const unresolved = db.prepare("SELECT id, defect_code, status FROM defects WHERE task_id = ? AND status != 'Resolved'").all(taskId);
    if (unresolved.length > 0) {
      blockers.push({
        type: 'defects_unresolved',
        message: `${unresolved.length} defect(s) not resolved`,
        details: unresolved.map(d => d.defect_code),
      });
    }

    // 3. Required inspections must pass
    const requiredInsps = db.prepare(`
      SELECT ti.link_type, i.inspection_code, i.status as insp_status, i.result as insp_result
      FROM task_inspections ti
      JOIN inspections i ON ti.inspection_id = i.id
      WHERE ti.task_id = ? AND ti.link_type = 'required'
    `).all(taskId);

    const failed = requiredInsps.filter(r => r.insp_result === 'Fail');
    if (failed.length > 0) {
      blockers.push({
        type: 'inspections_failed',
        message: `Inspection ${failed[0].inspection_code} failed`,
        details: failed.map(f => f.inspection_code),
      });
    }

    const notCompleted = requiredInsps.filter(r => r.insp_status !== 'Completed');
    if (notCompleted.length > 0 && !options.force) {
      blockers.push({
        type: 'inspections_pending',
        message: `Inspection ${notCompleted[0].inspection_code} not yet completed`,
        details: notCompleted.map(f => f.inspection_code),
        canForce: true,
      });
    }

    // 4. Check linked NCRs
    const openNCRs = db.prepare("SELECT id, ncr_code FROM ncrs WHERE task_id = ? AND status NOT IN ('Closed', 'Void')").all(taskId);
    if (openNCRs.length > 0) {
      blockers.push({
        type: 'ncrs_open',
        message: `${openNCRs.length} NCR(s) still open`,
        details: openNCRs.map(n => n.ncr_code),
      });
    }
  }

  return {
    canProceed: blockers.length === 0,
    blockers,
  };
}

// ─── Inspection Guard Conditions ───

function checkInspectionGuards(inspectionId, toState, options) {
  const blockers = [];

  if (toState === 'Completed' || toState === 'Passed') {
    const insp = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId);
    if (insp && !insp.result && !options.result) {
      blockers.push({
        type: 'result_required',
        message: 'Result (Pass/Fail/Conditional) is required when completing an inspection',
      });
    }
  }

  return { canProceed: blockers.length === 0, blockers };
}

// ─── Stage Guard Conditions ───

function checkStageGuards(stageId, toState, options) {
  const blockers = [];

  if (normalizeState(toState) === 'completed') {
    // All tasks must be completed
    const tasks = db.prepare("SELECT id, title, status FROM tasks WHERE stage_id = ? AND parent_task_id IS NULL").all(stageId);
    const incomplete = tasks.filter(t => t.status !== 'completed');
    if (incomplete.length > 0) {
      blockers.push({
        type: 'tasks_incomplete',
        message: `${incomplete.length} task(s) not completed`,
        details: incomplete.map(t => ({ id: t.id, title: t.title, status: t.status })),
      });
    }

    // All NCRs for this stage must be closed
    const openNCRs = db.prepare("SELECT id, ncr_code FROM ncrs WHERE stage_id = ? AND status NOT IN ('Closed', 'Void')").all(stageId);
    if (openNCRs.length > 0) {
      blockers.push({
        type: 'ncrs_open',
        message: `${openNCRs.length} NCR(s) still open for this stage`,
        details: openNCRs.map(n => n.ncr_code),
      });
    }

    // All hold-point inspections must pass
    const holdPoints = db.prepare(`
      SELECT id, inspection_code, status, result
      FROM inspections
      WHERE stage_id = ? AND category = 'hold_point' AND (result IS NULL OR result = 'Fail')
    `).all(stageId);
    if (holdPoints.length > 0) {
      blockers.push({
        type: 'hold_points_pending',
        message: `${holdPoints.length} hold point inspection(s) not cleared`,
        details: holdPoints.map(h => h.inspection_code),
      });
    }
  }

  return { canProceed: blockers.length === 0, blockers };
}

// ─── NCR Guard Conditions ───

function checkNCRGuards(ncrId, toState, options) {
  const blockers = [];

  if (toState === 'Closed') {
    const ncr = db.prepare('SELECT * FROM ncrs WHERE id = ?').get(ncrId);
    if (ncr && !ncr.verification_notes) {
      blockers.push({
        type: 'verification_required',
        message: 'Verification notes required before closing NCR',
      });
    }
  }

  return { canProceed: blockers.length === 0, blockers };
}

// ─── RFI Guard Conditions ───

function checkRFIGuards(rfiId, toState, options) {
  const blockers = [];

  if (toState === 'Closed') {
    const rfi = db.prepare('SELECT * FROM rfis WHERE id = ?').get(rfiId);
    if (rfi && !rfi.response) {
      blockers.push({
        type: 'response_required',
        message: 'RFI must have a response before closing',
      });
    }
  }

  return { canProceed: blockers.length === 0, blockers };
}

/**
 * Execute side effects after a transition (auto-actions).
 */
export function executePostTransitionActions(entityType, entityId, fromState, toState, userId, context = {}) {
  const actions = [];

  if (entityType === 'inspection') {
    // Auto-rework: when inspection fails, set linked tasks to 'rework'
    if (context.result === 'Fail') {
      const linkedTasks = db.prepare(`
        SELECT ti.task_id, t.task_code, t.status
        FROM task_inspections ti
        JOIN tasks t ON ti.task_id = t.id
        WHERE ti.inspection_id = ? AND ti.link_type IN ('required', 'blocked_by')
      `).all(entityId);

      for (const lt of linkedTasks) {
        if (lt.status !== 'completed' && lt.status !== 'rework') {
          db.prepare("UPDATE tasks SET status = 'rework', updated_at = datetime('now') WHERE id = ?").run(lt.task_id);
          const inspection = db.prepare('SELECT inspection_code, project_id FROM inspections WHERE id = ?').get(entityId);
          logAudit(inspection?.project_id, 'task', lt.task_code, lt.status, 'rework', 'auto_rework', userId, `Inspection ${inspection?.inspection_code} failed`);
          actions.push({ action: 'task_auto_rework', taskId: lt.task_id, taskCode: lt.task_code });
        }
      }
    }
  }

  if (entityType === 'ncr' && toState === 'Closed') {
    // When NCR closed, check if linked task can now proceed
    const ncr = db.prepare('SELECT task_id FROM ncrs WHERE id = ?').get(entityId);
    if (ncr?.task_id) {
      actions.push({ action: 'ncr_closed_check_task', taskId: ncr.task_id });
    }
  }

  return actions;
}

/**
 * Log a state transition to the audit trail.
 */
export function logAudit(projectId, entity, entityCode, fromState, toState, action, userId, details = null) {
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
  db.prepare(`
    INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, details, type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'workflow')
  `).run(projectId, entity, entityCode, fromState, toState, action, userId, user?.name || 'System', details);
}

/**
 * Get workflow dashboard stats — active items per state per workflow.
 */
export function getWorkflowDashboard(projectId) {
  const stats = {};

  // Task stats
  const taskCounts = db.prepare(`
    SELECT t.status, COUNT(*) as count
    FROM tasks t
    JOIN stages s ON t.stage_id = s.id
    WHERE s.project_id = ? AND t.parent_task_id IS NULL
    GROUP BY t.status
  `).all(projectId);
  stats.task = { items: taskCounts, total: taskCounts.reduce((s, c) => s + c.count, 0) };

  // Inspection stats
  const inspCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM inspections WHERE project_id = ? GROUP BY status
  `).all(projectId);
  stats.inspection = { items: inspCounts, total: inspCounts.reduce((s, c) => s + c.count, 0) };

  // Defect stats
  const defCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM defects WHERE project_id = ? GROUP BY status
  `).all(projectId);
  stats.defect = { items: defCounts, total: defCounts.reduce((s, c) => s + c.count, 0) };

  // NCR stats
  try {
    const ncrCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM ncrs WHERE project_id = ? GROUP BY status
    `).all(projectId);
    stats.ncr = { items: ncrCounts, total: ncrCounts.reduce((s, c) => s + c.count, 0) };
  } catch { stats.ncr = { items: [], total: 0 }; }

  // RFI stats
  try {
    const rfiCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM rfis WHERE project_id = ? GROUP BY status
    `).all(projectId);
    stats.rfi = { items: rfiCounts, total: rfiCounts.reduce((s, c) => s + c.count, 0) };
  } catch { stats.rfi = { items: [], total: 0 }; }

  // Recent transitions (last 20)
  stats.recentTransitions = db.prepare(`
    SELECT * FROM audit_log
    WHERE project_id = ? AND type = 'workflow'
    ORDER BY timestamp DESC LIMIT 20
  `).all(projectId);

  // Bottlenecks — items stuck in non-terminal states for > 7 days
  try {
    stats.bottlenecks = db.prepare(`
      SELECT entity, entity_id, to_state as state, timestamp,
             CAST((julianday('now') - julianday(timestamp)) AS INTEGER) as days_in_state
      FROM audit_log
      WHERE project_id = ? AND type = 'workflow' AND action = 'status_change'
      AND entity_id NOT IN (
        SELECT entity_id FROM audit_log
        WHERE project_id = ? AND type = 'workflow' AND action = 'status_change'
        AND timestamp > audit_log.timestamp AND entity = audit_log.entity
      )
      AND CAST((julianday('now') - julianday(timestamp)) AS INTEGER) > 7
      ORDER BY days_in_state DESC
      LIMIT 10
    `).all(projectId, projectId);
  } catch { stats.bottlenecks = []; }

  return stats;
}

// ─── Helpers ───

function normalizeState(state) {
  if (!state) return '';
  return state.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}
