import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  if (project_id) {
    const vendors = db.prepare('SELECT * FROM vendors WHERE project_id = ? ORDER BY name').all(project_id);
    return res.json(vendors);
  }

  // Return vendors for user's projects
  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  const vendors = db.prepare(`SELECT * FROM vendors WHERE project_id IN (${ph}) ORDER BY name`).all(...projectIds);
  res.json(vendors);
});

router.post('/', requireAuth, (req, res) => {
  const { name, type, phone, project_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    'INSERT INTO vendors (name, type, phone, project_id) VALUES (?, ?, ?, ?)'
  ).run(name, type || null, phone || null, project_id || null);

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(vendor);
});

// Update vendor
router.patch('/:id', requireAuth, (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const { name, type, phone, rating, status } = req.body;
  db.prepare(`
    UPDATE vendors SET name = COALESCE(?, name), type = COALESCE(?, type),
    phone = COALESCE(?, phone), rating = COALESCE(?, rating), status = COALESCE(?, status) WHERE id = ?
  `).run(name || null, type || null, phone || null, rating ?? null, status || null, vendor.id);

  const updated = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendor.id);
  res.json(updated);
});

// Delete vendor
router.delete('/:id', requireAuth, (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  if (!['owner', 'pm'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM vendors WHERE id = ?').run(vendor.id);
  res.json({ success: true });
});

export default router;
