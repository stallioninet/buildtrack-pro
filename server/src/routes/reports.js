import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

// Project overview report
router.get('/project-overview', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({});
  const pid = projectIds[0];

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  const stages = db.prepare('SELECT id, name, status, completion, budget, spent FROM stages WHERE project_id = ? ORDER BY stage_order').all(pid);

  const taskStats = db.prepare(`
    SELECT t.status, COUNT(*) as count FROM tasks t
    JOIN stages s ON t.stage_id = s.id WHERE s.project_id = ? GROUP BY t.status
  `).all(pid);

  const inspectionStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM inspections WHERE project_id = ? GROUP BY status
  `).all(pid);

  const ncrStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM ncrs WHERE project_id = ? GROUP BY status
  `).all(pid);

  const rfiStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM rfis WHERE project_id = ? GROUP BY status
  `).all(pid);

  const defectStats = db.prepare(`
    SELECT severity, COUNT(*) as count FROM defects WHERE project_id = ? GROUP BY severity
  `).all(pid);

  res.json({ project, stages, taskStats, inspectionStats, ncrStats, rfiStats, defectStats });
});

// Budget report
router.get('/budget', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({});
  const pid = projectIds[0];

  const project = db.prepare('SELECT name, total_budget, spent FROM projects WHERE id = ?').get(pid);
  const stagesBudget = db.prepare('SELECT name, budget, spent FROM stages WHERE project_id = ? AND budget > 0 ORDER BY stage_order').all(pid);

  const ph = projectIds.map(() => '?').join(',');
  const expensesByCategory = db.prepare(`
    SELECT e.category, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e LEFT JOIN stages s ON e.stage_id = s.id
    WHERE s.project_id IN (${ph}) GROUP BY e.category ORDER BY total DESC
  `).all(...projectIds);

  const expensesByMonth = db.prepare(`
    SELECT strftime('%Y-%m', e.expense_date) as month, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e LEFT JOIN stages s ON e.stage_id = s.id
    WHERE s.project_id IN (${ph}) AND e.expense_date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all(...projectIds);

  const paymentsByMonth = db.prepare(`
    SELECT strftime('%Y-%m', p.payment_date) as month, COALESCE(SUM(p.amount), 0) as total
    FROM payments p LEFT JOIN stages s ON p.stage_id = s.id
    WHERE s.project_id IN (${ph}) AND p.payment_date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all(...projectIds);

  res.json({ project, stagesBudget, expensesByCategory, expensesByMonth, paymentsByMonth });
});

// Quality report
router.get('/quality', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({});
  const pid = projectIds[0];

  const inspectionsByResult = db.prepare(`
    SELECT result, COUNT(*) as count FROM inspections WHERE project_id = ? AND result IS NOT NULL GROUP BY result
  `).all(pid);

  const inspectionsByCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM inspections WHERE project_id = ? GROUP BY category
  `).all(pid);

  const ncrsBySeverity = db.prepare(`
    SELECT severity, COUNT(*) as count FROM ncrs WHERE project_id = ? GROUP BY severity
  `).all(pid);

  const ncrsByCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM ncrs WHERE project_id = ? GROUP BY category
  `).all(pid);

  const ncrTrend = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as raised,
    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
    FROM ncrs WHERE project_id = ? GROUP BY month ORDER BY month
  `).all(pid);

  const defectsBySeverity = db.prepare(`
    SELECT severity, status, COUNT(*) as count FROM defects WHERE project_id = ? GROUP BY severity, status
  `).all(pid);

  const passRate = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as passed
    FROM inspections WHERE project_id = ? AND result IS NOT NULL
  `).get(pid);

  res.json({ inspectionsByResult, inspectionsByCategory, ncrsBySeverity, ncrsByCategory, ncrTrend, defectsBySeverity, passRate });
});

// Task progress report
router.get('/tasks', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({});
  const pid = projectIds[0];

  const byStatus = db.prepare(`
    SELECT t.status, COUNT(*) as count FROM tasks t
    JOIN stages s ON t.stage_id = s.id WHERE s.project_id = ? AND t.parent_task_id IS NULL GROUP BY t.status
  `).all(pid);

  const byPriority = db.prepare(`
    SELECT t.priority, COUNT(*) as count FROM tasks t
    JOIN stages s ON t.stage_id = s.id WHERE s.project_id = ? AND t.parent_task_id IS NULL GROUP BY t.priority
  `).all(pid);

  const byStage = db.prepare(`
    SELECT s.name as stage_name,
      COUNT(*) as total,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM tasks t JOIN stages s ON t.stage_id = s.id
    WHERE s.project_id = ? AND t.parent_task_id IS NULL GROUP BY s.id ORDER BY s.stage_order
  `).all(pid);

  const overdue = db.prepare(`
    SELECT COUNT(*) as count FROM tasks t
    JOIN stages s ON t.stage_id = s.id
    WHERE s.project_id = ? AND t.due_date < date('now') AND t.status NOT IN ('completed')
  `).get(pid);

  res.json({ byStatus, byPriority, byStage, overdue: overdue.count });
});

export default router;
