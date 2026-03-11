import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds, getProjectStageIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  let sql = `
    SELECT mr.*, s.name as stage_name, s.project_id, u.name as requested_by_name
    FROM material_requests mr
    LEFT JOIN stages s ON mr.stage_id = s.id
    LEFT JOIN users u ON mr.requested_by = u.id
  `;

  if (project_id) {
    sql += ' WHERE s.project_id = ? ORDER BY mr.id DESC';
    return res.json(db.prepare(sql).all(project_id));
  }

  // Scope to user's projects
  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  sql += ` WHERE s.project_id IN (${ph}) ORDER BY mr.id DESC`;
  res.json(db.prepare(sql).all(...projectIds));
});

router.post('/', requireAuth, (req, res) => {
  const { material, quantity, stage_id, requested_date } = req.body;
  if (!material || !quantity) {
    return res.status(400).json({ error: 'Material and quantity are required' });
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM material_requests').get().c;
  const request_code = `MR-${String(count + 1).padStart(3, '0')}`;

  const result = db.prepare(`
    INSERT INTO material_requests (request_code, material, quantity, stage_id, status, requested_date, requested_by)
    VALUES (?, ?, ?, ?, 'Draft', ?, ?)
  `).run(request_code, material, quantity, stage_id || null, requested_date || null, req.user.id);

  const created = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const item = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Material request not found' });

  db.prepare('UPDATE material_requests SET status = ? WHERE id = ?').run(status, item.id);

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, from_state, to_state, action, user_id, user_display, type)
    VALUES ('material_request', ?, ?, ?, 'status_change', ?, ?, 'workflow')
  `).run(item.request_code, item.status, status, req.user.id, req.user.name);

  res.json({ success: true });
});

// Update material request fields
router.patch('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Material request not found' });

  const { material, quantity, stage_id, requested_date } = req.body;
  db.prepare(`
    UPDATE material_requests SET material = COALESCE(?, material), quantity = COALESCE(?, quantity),
    stage_id = COALESCE(?, stage_id), requested_date = COALESCE(?, requested_date) WHERE id = ?
  `).run(material || null, quantity || null, stage_id || null, requested_date || null, item.id);

  const updated = db.prepare(`
    SELECT mr.*, s.name as stage_name, u.name as requested_by_name
    FROM material_requests mr LEFT JOIN stages s ON mr.stage_id = s.id LEFT JOIN users u ON mr.requested_by = u.id
    WHERE mr.id = ?
  `).get(item.id);
  res.json(updated);
});

// Delete material request
router.delete('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Material request not found' });
  if (!['owner', 'pm', 'procurement'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM material_requests WHERE id = ?').run(item.id);
  res.json({ success: true });
});

export default router;
