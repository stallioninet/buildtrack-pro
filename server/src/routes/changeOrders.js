import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { validate, changeOrderSchema } from '../middleware/validate.js';
import { generateNextCode } from '../services/codeGenerator.js';

const router = Router();

const VALID_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Executed', 'Void'];
const VALID_TYPES = ['scope_change', 'design_change', 'site_condition', 'client_request', 'regulatory', 'value_engineering'];

router.get('/', requireAuth, (req, res) => {
  const { project_id, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  const ph = projectIds.map(() => '?').join(',');

  let whereClause = `WHERE co.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { whereClause += ' AND co.status = ?'; params.push(status); }

  const countSql = `SELECT COUNT(*) as total FROM change_orders co ${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);

  const sql = `
    SELECT co.*, s.name as stage_name,
    u1.name as requested_by_name, u2.name as approved_by_name
    FROM change_orders co
    LEFT JOIN stages s ON co.stage_id = s.id
    LEFT JOIN users u1 ON co.requested_by = u1.id
    LEFT JOIN users u2 ON co.approved_by = u2.id
    ${whereClause} ORDER BY co.id DESC LIMIT ? OFFSET ?`;

  const data = db.prepare(sql).all(...params, limit, offset);
  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, pending: 0, totalCostImpact: 0, approved: 0 });
  const ph = projectIds.map(() => '?').join(',');

  const total = db.prepare(`SELECT COUNT(*) as count FROM change_orders WHERE project_id IN (${ph})`).get(...projectIds).count;
  const pending = db.prepare(`SELECT COUNT(*) as count FROM change_orders WHERE project_id IN (${ph}) AND status IN ('Submitted','Under Review')`).get(...projectIds).count;
  const approved = db.prepare(`SELECT COUNT(*) as count FROM change_orders WHERE project_id IN (${ph}) AND status = 'Approved'`).get(...projectIds).count;
  const totalCostImpact = db.prepare(`SELECT COALESCE(SUM(cost_impact),0) as total FROM change_orders WHERE project_id IN (${ph}) AND status IN ('Approved','Executed')`).get(...projectIds).total;

  res.json({ total, pending, approved, totalCostImpact });
});

router.get('/:id', requireAuth, (req, res) => {
  const co = db.prepare(`
    SELECT co.*, s.name as stage_name, u1.name as requested_by_name, u2.name as approved_by_name
    FROM change_orders co
    LEFT JOIN stages s ON co.stage_id = s.id
    LEFT JOIN users u1 ON co.requested_by = u1.id
    LEFT JOIN users u2 ON co.approved_by = u2.id
    WHERE co.id = ?
  `).get(req.params.id);
  if (!co) return res.status(404).json({ error: 'Change order not found' });
  res.json(co);
});

router.post('/', requireAuth, validate(changeOrderSchema), (req, res) => {
  if (!['owner', 'pm', 'engineer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { project_id, stage_id, title, description, reason, type, cost_impact, schedule_impact_days, due_date } = req.validated;
  if (!title || !project_id) return res.status(400).json({ error: 'Title and project are required' });

  const co_code = generateNextCode('change_orders', 'co_code', 'CO');

  const result = db.prepare(`
    INSERT INTO change_orders (co_code, project_id, stage_id, title, description, reason, type, cost_impact, schedule_impact_days, status, requested_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
  `).run(co_code, project_id, stage_id || null, title, description || null, reason || null, type || 'scope_change', cost_impact || 0, schedule_impact_days || 0, req.user.id, due_date || null);

  const created = db.prepare('SELECT * FROM change_orders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.patch('/:id', requireAuth, (req, res) => {
  const co = db.prepare('SELECT * FROM change_orders WHERE id = ?').get(req.params.id);
  if (!co) return res.status(404).json({ error: 'Change order not found' });

  const { title, description, reason, type, cost_impact, schedule_impact_days, stage_id, due_date } = req.body;
  db.prepare(`
    UPDATE change_orders SET title = COALESCE(?, title), description = COALESCE(?, description),
    reason = COALESCE(?, reason), type = COALESCE(?, type), cost_impact = COALESCE(?, cost_impact),
    schedule_impact_days = COALESCE(?, schedule_impact_days), stage_id = COALESCE(?, stage_id),
    due_date = COALESCE(?, due_date), updated_at = datetime('now') WHERE id = ?
  `).run(title || null, description || null, reason || null, type || null, cost_impact ?? null, schedule_impact_days ?? null, stage_id || null, due_date || null, co.id);

  const updated = db.prepare('SELECT * FROM change_orders WHERE id = ?').get(co.id);
  res.json(updated);
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const co = db.prepare('SELECT * FROM change_orders WHERE id = ?').get(req.params.id);
  if (!co) return res.status(404).json({ error: 'Change order not found' });

  const updates = { status };
  if (status === 'Approved') {
    updates.approved_by = req.user.id;
    updates.approved_at = new Date().toISOString();
  }

  db.prepare('UPDATE change_orders SET status = ?, approved_by = COALESCE(?, approved_by), approved_at = COALESCE(?, approved_at), updated_at = datetime(\'now\') WHERE id = ?')
    .run(status, updates.approved_by || null, updates.approved_at || null, co.id);

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type)
    VALUES (?, 'change_order', ?, ?, ?, 'status_change', ?, ?, 'workflow')
  `).run(co.project_id, co.co_code, co.status, status, req.user.id, req.user.name);

  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const co = db.prepare('SELECT * FROM change_orders WHERE id = ?').get(req.params.id);
  if (!co) return res.status(404).json({ error: 'Change order not found' });
  db.prepare('DELETE FROM change_orders WHERE id = ?').run(co.id);
  res.json({ success: true });
});

export default router;
