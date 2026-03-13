import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const VALID_TRADES = [
  'General Conditions', 'Site Work', 'Concrete', 'Masonry', 'Metals',
  'Wood & Plastics', 'Thermal & Moisture', 'Doors & Windows', 'Finishes',
  'Specialties', 'Equipment', 'Furnishings', 'Special Construction',
  'Conveying', 'Mechanical', 'Electrical', 'Other'
];

// GET / - List SOV line items for a project
router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  const rows = db.prepare(`SELECT sov.*, s.name as stage_name
    FROM sov_line_items sov
    LEFT JOIN stages s ON sov.stage_id = s.id
    WHERE sov.project_id = ?
    ORDER BY sov.sort_order`).all(project_id);

  res.json(rows);
});

// GET /summary - Summary stats for a project
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  const stats = db.prepare(`SELECT
    COALESCE(SUM(scheduled_value), 0) as total_scheduled_value,
    COALESCE(SUM(previous_billed + current_billed + stored_materials), 0) as total_billed_to_date,
    COALESCE(SUM((previous_billed + current_billed + stored_materials) * retainage_percent / 100.0), 0) as total_retainage,
    CASE WHEN SUM(scheduled_value) > 0
      THEN ROUND(SUM((previous_billed + current_billed + stored_materials) * 1.0) / SUM(scheduled_value) * 100, 2)
      ELSE 0
    END as percent_complete
    FROM sov_line_items WHERE project_id = ?`).get(project_id);

  res.json(stats);
});

// POST / - Create a line item
router.post('/', requireAuth, (req, res) => {
  if (!['pm', 'accounts', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { project_id, stage_id, cost_code, description, trade, scheduled_value, retainage_percent, sort_order } = req.body;
  if (!project_id || !description) return res.status(400).json({ error: 'project_id and description are required' });

  if (trade && !VALID_TRADES.includes(trade)) {
    return res.status(400).json({ error: 'Invalid trade', valid_trades: VALID_TRADES });
  }

  const sv = parseFloat(scheduled_value) || 0;
  const retPct = parseFloat(retainage_percent) || 5;
  const order = parseInt(sort_order) || 0;

  const result = db.prepare(`INSERT INTO sov_line_items
    (project_id, stage_id, cost_code, description, trade, scheduled_value, retainage_percent, sort_order,
     previous_billed, current_billed, stored_materials, percent_complete, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, datetime('now'), datetime('now'))`)
    .run(project_id, stage_id || null, cost_code || null, description, trade || null, sv, retPct, order, req.user.id);

  const created = db.prepare(`SELECT sov.*, s.name as stage_name
    FROM sov_line_items sov LEFT JOIN stages s ON sov.stage_id = s.id
    WHERE sov.id = ?`).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// PATCH /:id - Update a line item (recalculates percent_complete)
router.patch('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM sov_line_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'SOV line item not found' });

  const { stage_id, cost_code, description, trade, scheduled_value, retainage_percent, sort_order,
          previous_billed, current_billed, stored_materials } = req.body;

  if (trade && !VALID_TRADES.includes(trade)) {
    return res.status(400).json({ error: 'Invalid trade', valid_trades: VALID_TRADES });
  }

  const sv = scheduled_value !== undefined ? parseFloat(scheduled_value) : item.scheduled_value;
  const retPct = retainage_percent !== undefined ? parseFloat(retainage_percent) : item.retainage_percent;
  const order = sort_order !== undefined ? parseInt(sort_order) : item.sort_order;
  const prevBilled = previous_billed !== undefined ? parseFloat(previous_billed) : item.previous_billed;
  const currBilled = current_billed !== undefined ? parseFloat(current_billed) : item.current_billed;
  const storedMat = stored_materials !== undefined ? parseFloat(stored_materials) : item.stored_materials;

  const percent_complete = sv > 0 ? Math.round(((prevBilled + currBilled + storedMat) / sv) * 100 * 100) / 100 : 0;

  db.prepare(`UPDATE sov_line_items SET
    stage_id=COALESCE(?,stage_id), cost_code=COALESCE(?,cost_code), description=COALESCE(?,description),
    trade=COALESCE(?,trade), scheduled_value=?, retainage_percent=?, sort_order=?,
    previous_billed=?, current_billed=?, stored_materials=?, percent_complete=?,
    updated_at=datetime('now') WHERE id=?`)
    .run(stage_id || null, cost_code || null, description || null, trade || null,
         sv, retPct, order, prevBilled, currBilled, storedMat, percent_complete, item.id);

  const updated = db.prepare(`SELECT sov.*, s.name as stage_name
    FROM sov_line_items sov LEFT JOIN stages s ON sov.stage_id = s.id
    WHERE sov.id = ?`).get(item.id);

  res.json(updated);
});

// POST /billing - Batch update current_billed and stored_materials, then roll forward previous_billed
router.post('/billing', requireAuth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const updateStmt = db.prepare(`UPDATE sov_line_items SET
    previous_billed = previous_billed + current_billed,
    current_billed = ?,
    stored_materials = ?,
    percent_complete = CASE WHEN scheduled_value > 0
      THEN ROUND(((previous_billed + current_billed + ? + ?) / scheduled_value) * 100, 2)
      ELSE 0 END,
    updated_at = datetime('now')
    WHERE id = ?`);

  const transaction = db.transaction((entries) => {
    const results = [];
    for (const entry of entries) {
      const { id, current_billed, stored_materials } = entry;
      const item = db.prepare('SELECT * FROM sov_line_items WHERE id = ?').get(id);
      if (!item) {
        results.push({ id, error: 'Not found' });
        continue;
      }

      const currBilled = parseFloat(current_billed) || 0;
      const storedMat = parseFloat(stored_materials) || 0;
      const newPrevBilled = item.previous_billed + item.current_billed;
      const sv = item.scheduled_value;
      const pctComplete = sv > 0 ? Math.round(((newPrevBilled + currBilled + storedMat) / sv) * 100 * 100) / 100 : 0;

      db.prepare(`UPDATE sov_line_items SET
        previous_billed = ?,
        current_billed = ?,
        stored_materials = ?,
        percent_complete = ?,
        updated_at = datetime('now')
        WHERE id = ?`).run(newPrevBilled, currBilled, storedMat, pctComplete, id);

      results.push({ id, previous_billed: newPrevBilled, current_billed: currBilled, stored_materials: storedMat, percent_complete: pctComplete });
    }
    return results;
  });

  const results = transaction(items);
  res.json({ success: true, results });
});

// DELETE /:id - Delete a line item
router.delete('/:id', requireAuth, (req, res) => {
  if (!['pm', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const item = db.prepare('SELECT * FROM sov_line_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'SOV line item not found' });

  db.prepare('DELETE FROM sov_line_items WHERE id = ?').run(item.id);
  res.json({ success: true });
});

export default router;
