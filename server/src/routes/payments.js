import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { generateNextCode } from '../services/codeGenerator.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  let sql = `
    SELECT p.*, v.name as vendor_name, s.name as stage_name, s.project_id
    FROM payments p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN stages s ON p.stage_id = s.id
  `;

  if (project_id) {
    sql += ' WHERE s.project_id = ? ORDER BY p.id DESC';
    return res.json(db.prepare(sql).all(project_id));
  }

  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  sql += ` WHERE s.project_id IN (${ph}) ORDER BY p.id DESC`;
  res.json(db.prepare(sql).all(...projectIds));
});

// Create payment
router.post('/', requireAuth, (req, res) => {
  if (!['owner', 'pm', 'accounts'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { vendor_id, stage_id, amount, payment_date, description } = req.body;
  if (!vendor_id || !amount) {
    return res.status(400).json({ error: 'Vendor and amount are required' });
  }

  const payment_code = generateNextCode('payments', 'payment_code', 'PAY');

  const result = db.prepare(`
    INSERT INTO payments (payment_code, vendor_id, stage_id, amount, status, payment_date)
    VALUES (?, ?, ?, ?, 'Draft', ?)
  `).run(payment_code, vendor_id, stage_id || null, amount, payment_date || null);

  const created = db.prepare(`
    SELECT p.*, v.name as vendor_name, s.name as stage_name
    FROM payments p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN stages s ON p.stage_id = s.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (!['owner', 'pm', 'accounts'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to change payment status' });
  }

  db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(status, payment.id);

  db.prepare(`
    INSERT INTO audit_log (entity, entity_id, from_state, to_state, action, user_id, user_display, type)
    VALUES ('payment', ?, ?, ?, 'status_change', ?, ?, 'workflow')
  `).run(payment.payment_code, payment.status, status, req.user.id, req.user.name);

  res.json({ success: true });
});

// Update payment fields
router.patch('/:id', requireAuth, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (!['owner', 'pm', 'accounts'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to edit payments' });
  }

  const { vendor_id, stage_id, amount, payment_date } = req.body;
  db.prepare(`
    UPDATE payments SET vendor_id = COALESCE(?, vendor_id), stage_id = COALESCE(?, stage_id),
    amount = COALESCE(?, amount), payment_date = COALESCE(?, payment_date) WHERE id = ?
  `).run(vendor_id || null, stage_id || null, amount ?? null, payment_date || null, payment.id);

  const updated = db.prepare(`
    SELECT p.*, v.name as vendor_name, s.name as stage_name
    FROM payments p LEFT JOIN vendors v ON p.vendor_id = v.id LEFT JOIN stages s ON p.stage_id = s.id
    WHERE p.id = ?
  `).get(payment.id);
  res.json(updated);
});

// Delete payment
router.delete('/:id', requireAuth, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (!['owner', 'pm', 'accounts'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM payments WHERE id = ?').run(payment.id);
  res.json({ success: true });
});

export default router;
