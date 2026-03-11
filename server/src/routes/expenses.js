import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  let sql = `
    SELECT e.*, s.name as stage_name, s.project_id, u.name as created_by_name
    FROM expenses e
    LEFT JOIN stages s ON e.stage_id = s.id
    LEFT JOIN users u ON e.created_by = u.id
  `;

  if (project_id) {
    sql += ' WHERE s.project_id = ? ORDER BY e.expense_date DESC';
    return res.json(db.prepare(sql).all(project_id));
  }

  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  sql += ` WHERE s.project_id IN (${ph}) ORDER BY e.expense_date DESC`;
  res.json(db.prepare(sql).all(...projectIds));
});

// Summary endpoint
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, totalAmount: 0, byCategory: [], byStatus: [] });
  const ph = projectIds.map(() => '?').join(',');

  const total = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(e.amount), 0) as totalAmount FROM expenses e LEFT JOIN stages s ON e.stage_id = s.id WHERE s.project_id IN (${ph})`).get(...projectIds);
  const byCategory = db.prepare(`SELECT e.category, COUNT(*) as count, COALESCE(SUM(e.amount), 0) as amount FROM expenses e LEFT JOIN stages s ON e.stage_id = s.id WHERE s.project_id IN (${ph}) GROUP BY e.category`).all(...projectIds);
  const byStatus = db.prepare(`SELECT e.status, COUNT(*) as count, COALESCE(SUM(e.amount), 0) as amount FROM expenses e LEFT JOIN stages s ON e.stage_id = s.id WHERE s.project_id IN (${ph}) GROUP BY e.status`).all(...projectIds);

  res.json({ total: total.count, totalAmount: total.totalAmount, byCategory, byStatus });
});

router.post('/', requireAuth, (req, res) => {
  const { expense_date, category, description, amount, stage_id } = req.body;
  if (!expense_date || !category) {
    return res.status(400).json({ error: 'Date and category are required' });
  }

  const result = db.prepare(`
    INSERT INTO expenses (expense_date, category, description, amount, stage_id, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'Draft', ?)
  `).run(expense_date, category, description || null, amount || 0, stage_id || null, req.user.id);

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  db.prepare('UPDATE expenses SET status = ? WHERE id = ?').run(status, expense.id);

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, from_state, to_state, action, user_id, user_display, type)
    VALUES ('expense', ?, ?, ?, 'status_change', ?, ?, 'workflow')
  `).run(String(expense.id), expense.status, status, req.user.id, req.user.name);

  res.json({ success: true });
});

// Update expense fields
router.patch('/:id', requireAuth, (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const { expense_date, category, description, amount, stage_id } = req.body;
  db.prepare(`
    UPDATE expenses SET expense_date = COALESCE(?, expense_date), category = COALESCE(?, category),
    description = COALESCE(?, description), amount = COALESCE(?, amount), stage_id = COALESCE(?, stage_id)
    WHERE id = ?
  `).run(expense_date || null, category || null, description || null, amount ?? null, stage_id || null, expense.id);

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expense.id);
  res.json(updated);
});

// Delete expense
router.delete('/:id', requireAuth, (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  if (!['owner', 'pm', 'accounts'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to delete expenses' });
  }
  db.prepare('DELETE FROM expenses WHERE id = ?').run(expense.id);
  res.json({ success: true });
});

export default router;
