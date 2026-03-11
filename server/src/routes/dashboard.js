import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const role = req.user.role;
  const data = { role };

  // For owner: return project list if no project_id specified
  if (role === 'owner' && !req.query.project_id) {
    const projects = db.prepare(`
      SELECT id, name, location, plot_size, start_date, planned_end, status, total_budget, spent, completion
      FROM projects WHERE created_by = ? ORDER BY id DESC
    `).all(req.user.id);

    // Add stage counts for each project
    const stageCountStmt = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active FROM stages WHERE project_id = ?");
    const memberCountStmt = db.prepare('SELECT COUNT(*) as c FROM project_members WHERE project_id = ?');
    for (const p of projects) {
      const counts = stageCountStmt.get(p.id);
      p.totalStages = counts?.total || 0;
      p.activeStages = counts?.active || 0;
      p.memberCount = memberCountStmt.get(p.id)?.c || 0;
    }

    data.projects = projects;
    return res.json(data);
  }

  // Determine which project to show
  let project;
  if (req.query.project_id) {
    project = db.prepare(`
      SELECT id, name, location, plot_size, start_date, planned_end, status, total_budget, spent, completion
      FROM projects WHERE id = ?
    `).get(req.query.project_id);
  } else {
    // For non-owner roles, get first project they have access to
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length > 0) {
      project = db.prepare(`
        SELECT id, name, location, plot_size, start_date, planned_end, status, total_budget, spent, completion
        FROM projects WHERE id = ?
      `).get(projectIds[0]);
    }
  }
  data.project = project;

  if (!project) {
    data.stages = [];
    return res.json(data);
  }

  // Stages summary
  const stages = db.prepare(`
    SELECT id, name, stage_order, status, completion, budget, spent, start_date, end_date
    FROM stages WHERE project_id = ? ORDER BY stage_order
  `).all(project.id);
  data.stages = stages;

  const stageIds = stages.map(s => s.id);
  const stageIdsPh = stageIds.length > 0 ? stageIds.map(() => '?').join(',') : '0';

  if (role === 'owner') {
    data.stats = {
      totalBudget: project.total_budget || 0,
      totalSpent: project.spent || 0,
      completion: project.completion || 0,
      activeStages: stages.filter(s => s.status === 'in_progress').length,
      totalStages: stages.length,
      pendingApprovals: (stageIds.length > 0 ? (
        db.prepare(`SELECT COUNT(*) as c FROM material_requests WHERE status = 'Pending Approval' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        + db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status = 'Pending Approval' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        + db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE status = 'Pending Approval' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
      ) : 0),
      openDefects: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'Open' AND inspection_id IN (SELECT id FROM inspections WHERE stage_id IN (${stageIdsPh}))`).get(...stageIds).c
        : 0,
    };
    data.recentAudit = db.prepare(`SELECT * FROM audit_log WHERE project_id = ? OR project_id IS NULL ORDER BY timestamp DESC LIMIT 5`).all(project.id);
  }

  if (role === 'pm') {
    data.stats = {
      completion: project.completion || 0,
      activeStages: stages.filter(s => s.status === 'in_progress').length,
      pendingMaterials: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM material_requests WHERE status IN ('Draft','Pending Approval') AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      openDefects: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'Open' AND inspection_id IN (SELECT id FROM inspections WHERE stage_id IN (${stageIdsPh}))`).get(...stageIds).c
        : 0,
      todayLaborCount: db.prepare(`SELECT labor_count FROM daily_logs WHERE log_date = date('now') AND project_id = ? LIMIT 1`).get(project.id)?.labor_count || 0,
      scheduledInspections: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE status = 'Scheduled' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      totalTasks: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      completedTasks: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'completed' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      highPriorityTasks: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE priority = 'high' AND status != 'completed' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
    };
    data.upcomingInspections = stageIds.length > 0 ? db.prepare(`
      SELECT i.*, s.name as stage_name FROM inspections i
      LEFT JOIN stages s ON i.stage_id = s.id
      WHERE i.status = 'Scheduled' AND i.stage_id IN (${stageIdsPh}) ORDER BY i.inspection_date LIMIT 5
    `).all(...stageIds) : [];
    data.recentTasks = stageIds.length > 0 ? db.prepare(`
      SELECT t.*, s.name as stage_name, a.name as assigned_to_name
      FROM tasks t
      LEFT JOIN stages s ON t.stage_id = s.id
      LEFT JOIN users a ON t.assigned_to = a.id
      WHERE t.stage_id IN (${stageIdsPh})
      ORDER BY t.id DESC LIMIT 5
    `).all(...stageIds) : [];
  }

  if (role === 'engineer') {
    const activeStage = stages.find(s => s.status === 'in_progress');
    data.activeStage = activeStage;
    if (activeStage) {
      data.substages = db.prepare(`
        SELECT * FROM substages WHERE stage_id = ? ORDER BY substage_order
      `).all(activeStage.id);
      const substageIds = data.substages.map(s => s.id);
      if (substageIds.length > 0) {
        const placeholders = substageIds.map(() => '?').join(',');
        const total = db.prepare(`SELECT COUNT(*) as c FROM checklist_items WHERE substage_id IN (${placeholders})`).get(...substageIds).c;
        const checked = db.prepare(`SELECT COUNT(*) as c FROM checklist_items WHERE substage_id IN (${placeholders}) AND is_checked = 1`).get(...substageIds).c;
        data.checklistProgress = { total, checked };
      }
    }
    data.stats = {
      todayLabor: db.prepare(`SELECT labor_count FROM daily_logs WHERE log_date = date('now') AND project_id = ? LIMIT 1`).get(project.id)?.labor_count || 0,
      openDefects: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'Open' AND inspection_id IN (SELECT id FROM inspections WHERE stage_id IN (${stageIdsPh}))`).get(...stageIds).c
        : 0,
      totalTasks: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      inProgressTasks: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'in_progress' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
    };
  }

  if (role === 'contractor') {
    const assignedFilter = stageIds.length > 0
      ? ` AND stage_id IN (${stageIdsPh})`
      : ' AND 1=0';
    const taskParams = [...(stageIds.length > 0 ? stageIds : [])];

    const assignedTotal = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ?${assignedFilter}`).get(req.user.id, ...taskParams).c;
    const assignedOngoing = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status = 'in_progress'${assignedFilter}`).get(req.user.id, ...taskParams).c;
    const assignedCompleted = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status = 'completed'${assignedFilter}`).get(req.user.id, ...taskParams).c;
    data.stats = {
      activeStages: stages.filter(s => s.status === 'in_progress').length,
      pendingMaterials: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM material_requests WHERE status IN ('Draft','Pending Approval') AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      todayLabor: db.prepare(`SELECT labor_count FROM daily_logs WHERE log_date = date('now') AND project_id = ? LIMIT 1`).get(project.id)?.labor_count || 0,
      assignedTasks: assignedTotal,
      inProgressTasks: assignedOngoing,
      completedTasks: assignedCompleted,
    };
    data.materialRequests = stageIds.length > 0 ? db.prepare(`
      SELECT mr.*, s.name as stage_name FROM material_requests mr
      LEFT JOIN stages s ON mr.stage_id = s.id WHERE mr.stage_id IN (${stageIdsPh}) ORDER BY mr.id DESC LIMIT 5
    `).all(...stageIds) : [];
  }

  if (role === 'procurement') {
    data.stats = {
      pendingRequests: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM material_requests WHERE status = 'Pending Approval' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      activeVendors: db.prepare(`SELECT COUNT(*) as c FROM vendors WHERE status = 'Active' AND project_id = ?`).get(project.id).c,
      lowStockItems: db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE stock < total_inward * 0.2 AND project_id = ?`).get(project.id).c,
    };
    data.recentRequests = stageIds.length > 0 ? db.prepare(`
      SELECT mr.*, s.name as stage_name FROM material_requests mr
      LEFT JOIN stages s ON mr.stage_id = s.id WHERE mr.stage_id IN (${stageIdsPh}) ORDER BY mr.id DESC LIMIT 5
    `).all(...stageIds) : [];
    data.inventory = db.prepare(`SELECT * FROM inventory WHERE project_id = ?`).all(project.id);
  }

  if (role === 'accounts') {
    const totalExpenses = stageIds.length > 0
      ? db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE stage_id IN (${stageIdsPh})`).get(...stageIds).total
      : 0;
    const totalPayments = stageIds.length > 0
      ? db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE stage_id IN (${stageIdsPh})`).get(...stageIds).total
      : 0;
    data.stats = {
      totalBudget: project.total_budget || 0,
      totalSpent: project.spent || 0,
      totalExpenses,
      totalPayments,
      pendingPayments: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status IN ('Draft','Pending Approval') AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      pendingExpenses: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE status IN ('Draft','Pending Approval') AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
    };
    data.recentExpenses = stageIds.length > 0 ? db.prepare(`SELECT e.*, s.name as stage_name FROM expenses e LEFT JOIN stages s ON e.stage_id = s.id WHERE e.stage_id IN (${stageIdsPh}) ORDER BY e.id DESC LIMIT 5`).all(...stageIds) : [];
    data.recentPayments = stageIds.length > 0 ? db.prepare(`SELECT p.*, v.name as vendor_name, s.name as stage_name FROM payments p LEFT JOIN vendors v ON p.vendor_id = v.id LEFT JOIN stages s ON p.stage_id = s.id WHERE p.stage_id IN (${stageIdsPh}) ORDER BY p.id DESC LIMIT 5`).all(...stageIds) : [];
  }

  if (role === 'inspector') {
    data.stats = {
      scheduledInspections: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE status = 'Scheduled' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      completedInspections: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM inspections WHERE status = 'Completed' AND stage_id IN (${stageIdsPh})`).get(...stageIds).c
        : 0,
      openDefects: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM defects WHERE status = 'Open' AND inspection_id IN (SELECT id FROM inspections WHERE stage_id IN (${stageIdsPh}))`).get(...stageIds).c
        : 0,
      totalDefects: stageIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as c FROM defects WHERE inspection_id IN (SELECT id FROM inspections WHERE stage_id IN (${stageIdsPh}))`).get(...stageIds).c
        : 0,
    };
    data.inspections = stageIds.length > 0 ? db.prepare(`
      SELECT i.*, s.name as stage_name FROM inspections i
      LEFT JOIN stages s ON i.stage_id = s.id WHERE i.stage_id IN (${stageIdsPh}) ORDER BY i.inspection_date DESC LIMIT 10
    `).all(...stageIds) : [];
    data.defects = stageIds.length > 0 ? db.prepare(`
      SELECT d.*, i.inspection_code FROM defects d
      LEFT JOIN inspections i ON d.inspection_id = i.id WHERE i.stage_id IN (${stageIdsPh}) ORDER BY d.id DESC LIMIT 10
    `).all(...stageIds) : [];
  }

  res.json(data);
});

export default router;
