import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  if (project_id) {
    const items = db.prepare('SELECT * FROM inventory WHERE project_id = ? ORDER BY material').all(project_id);
    return res.json(items);
  }

  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  const items = db.prepare(`SELECT * FROM inventory WHERE project_id IN (${ph}) ORDER BY material`).all(...projectIds);
  res.json(items);
});

// Create inventory item
router.post('/', requireAuth, (req, res) => {
  const { project_id, material, unit, total_inward, consumed, wastage_percent } = req.body;
  if (!material || !unit) {
    return res.status(400).json({ error: 'Material and unit are required' });
  }

  const stock = (total_inward || 0) - (consumed || 0);
  const result = db.prepare(`
    INSERT INTO inventory (project_id, material, unit, total_inward, consumed, stock, wastage_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id || null, material, unit, total_inward || 0, consumed || 0, stock, wastage_percent || 0);

  const created = db.prepare('SELECT * FROM inventory WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Update inventory
router.patch('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found' });

  const { total_inward, consumed, wastage_percent } = req.body;
  const newInward = total_inward ?? item.total_inward;
  const newConsumed = consumed ?? item.consumed;
  const newStock = newInward - newConsumed;

  db.prepare(`
    UPDATE inventory SET total_inward = ?, consumed = ?, stock = ?, wastage_percent = COALESCE(?, wastage_percent) WHERE id = ?
  `).run(newInward, newConsumed, newStock, wastage_percent ?? null, item.id);

  const updated = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item.id);
  res.json(updated);
});

// Delete inventory item
router.delete('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found' });
  if (!['owner', 'pm', 'procurement'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM inventory WHERE id = ?').run(item.id);
  res.json({ success: true });
});

export default router;
