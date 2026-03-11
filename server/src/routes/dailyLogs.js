import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  let sql = `
    SELECT dl.*, u.name as logged_by_name, p.name as project_name
    FROM daily_logs dl
    LEFT JOIN users u ON dl.logged_by = u.id
    LEFT JOIN projects p ON dl.project_id = p.id
  `;

  if (project_id) {
    sql += ' WHERE dl.project_id = ? ORDER BY dl.log_date DESC';
    return res.json(db.prepare(sql).all(project_id));
  }

  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  sql += ` WHERE dl.project_id IN (${ph}) ORDER BY dl.log_date DESC`;
  res.json(db.prepare(sql).all(...projectIds));
});

router.post('/', requireAuth, (req, res) => {
  const { project_id, log_date, weather, work_description, labor_count, issues } = req.body;
  if (!project_id || !log_date) {
    return res.status(400).json({ error: 'Project and date are required' });
  }

  const result = db.prepare(`
    INSERT INTO daily_logs (project_id, log_date, weather, work_description, labor_count, issues, logged_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, log_date, weather || null, work_description || null, labor_count || 0, issues || null, req.user.id);

  const created = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Update daily log
router.patch('/:id', requireAuth, (req, res) => {
  const log = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Daily log not found' });

  const { log_date, weather, work_description, labor_count, issues } = req.body;
  db.prepare(`
    UPDATE daily_logs SET log_date = COALESCE(?, log_date), weather = COALESCE(?, weather),
    work_description = COALESCE(?, work_description), labor_count = COALESCE(?, labor_count),
    issues = COALESCE(?, issues) WHERE id = ?
  `).run(log_date || null, weather || null, work_description || null, labor_count ?? null, issues || null, log.id);

  const updated = db.prepare(`
    SELECT dl.*, u.name as logged_by_name, p.name as project_name
    FROM daily_logs dl LEFT JOIN users u ON dl.logged_by = u.id LEFT JOIN projects p ON dl.project_id = p.id
    WHERE dl.id = ?
  `).get(log.id);
  res.json(updated);
});

// Delete daily log
router.delete('/:id', requireAuth, (req, res) => {
  const log = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Daily log not found' });
  if (!['owner', 'pm'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM daily_logs WHERE id = ?').run(log.id);
  res.json({ success: true });
});

export default router;
