import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/estimator/rates - Get all rates grouped by category
router.get('/rates', requireAuth, (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) {
    rows = db.prepare('SELECT * FROM estimator_rates WHERE category = ? ORDER BY sort_order').all(category);
  } else {
    rows = db.prepare('SELECT * FROM estimator_rates ORDER BY category, sort_order').all();
  }

  // Parse value_json for each row
  const parsed = rows.map((r) => ({
    ...r,
    value: JSON.parse(r.value_json),
  }));

  // Group by category
  if (!category) {
    const grouped = {};
    for (const r of parsed) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r);
    }
    return res.json(grouped);
  }

  res.json(parsed);
});

// GET /api/estimator/rates/:id - Get a single rate
router.get('/rates/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM estimator_rates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rate not found' });
  row.value = JSON.parse(row.value_json);
  res.json(row);
});

// POST /api/estimator/rates - Create a new rate
router.post('/rates', requireAuth, requireRole('pm', 'owner'), (req, res) => {
  const { category, item_key, label, value, sort_order } = req.body;

  if (!category || !item_key || !label || !value) {
    return res.status(400).json({ error: 'category, item_key, label, and value are required' });
  }

  const existing = db.prepare('SELECT id FROM estimator_rates WHERE category = ? AND item_key = ?').get(category, item_key);
  if (existing) {
    return res.status(409).json({ error: 'A rate with this category and key already exists' });
  }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM estimator_rates WHERE category = ?').get(category)?.m || 0;

  const result = db.prepare(
    'INSERT INTO estimator_rates (category, item_key, label, value_json, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(category, item_key, label, JSON.stringify(value), sort_order || maxOrder + 1);

  const created = db.prepare('SELECT * FROM estimator_rates WHERE id = ?').get(result.lastInsertRowid);
  created.value = JSON.parse(created.value_json);
  res.status(201).json(created);
});

// PATCH /api/estimator/rates/:id - Update a rate
router.patch('/rates/:id', requireAuth, requireRole('pm', 'owner'), (req, res) => {
  const row = db.prepare('SELECT * FROM estimator_rates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rate not found' });

  const { label, value, sort_order } = req.body;

  db.prepare(`
    UPDATE estimator_rates SET
      label = COALESCE(?, label),
      value_json = COALESCE(?, value_json),
      sort_order = COALESCE(?, sort_order),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    label || null,
    value ? JSON.stringify(value) : null,
    sort_order !== undefined ? sort_order : null,
    row.id
  );

  const updated = db.prepare('SELECT * FROM estimator_rates WHERE id = ?').get(row.id);
  updated.value = JSON.parse(updated.value_json);
  res.json(updated);
});

// DELETE /api/estimator/rates/:id - Delete a rate
router.delete('/rates/:id', requireAuth, requireRole('pm', 'owner'), (req, res) => {
  const row = db.prepare('SELECT * FROM estimator_rates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rate not found' });

  db.prepare('DELETE FROM estimator_rates WHERE id = ?').run(row.id);
  res.json({ success: true });
});

// GET /api/estimator/categories - List distinct categories
router.get('/categories', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM estimator_rates ORDER BY category').all();
  res.json(rows.map((r) => r.category));
});

export default router;
