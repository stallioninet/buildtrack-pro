import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id, status } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  let sql = `SELECT rb.*, v.name as vendor_name, u1.name as prepared_by_name, u2.name as approved_by_name
    FROM ra_bills rb LEFT JOIN vendors v ON rb.vendor_id = v.id
    LEFT JOIN users u1 ON rb.prepared_by = u1.id LEFT JOIN users u2 ON rb.approved_by = u2.id
    WHERE rb.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { sql += ' AND rb.status = ?'; params.push(status); }
  sql += ' ORDER BY rb.bill_number DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, totalGross: 0, totalNet: 0, totalRetention: 0 });
  const ph = projectIds.map(() => '?').join(',');
  const stats = db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(gross_amount),0) as totalGross, COALESCE(SUM(net_payable),0) as totalNet, COALESCE(SUM(retention_amount),0) as totalRetention FROM ra_bills WHERE project_id IN (${ph})`).get(...projectIds);
  const pending = db.prepare(`SELECT COUNT(*) as c FROM ra_bills WHERE project_id IN (${ph}) AND status IN ('Draft','Submitted','Under Review')`).get(...projectIds).c;
  res.json({ ...stats, pending });
});

router.post('/', requireAuth, (req, res) => {
  if (!['owner', 'pm', 'accounts', 'engineer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { project_id, vendor_id, title, description, period_from, period_to, gross_amount, previous_amount, retention_percent, deductions } = req.body;
  if (!title || !project_id) return res.status(400).json({ error: 'Title and project are required' });

  const lastBill = db.prepare('SELECT MAX(bill_number) as max_num FROM ra_bills WHERE project_id = ?').get(project_id);
  const bill_number = (lastBill?.max_num || 0) + 1;
  const bill_code = `RAB-${String(bill_number).padStart(3, '0')}`;

  const gross = parseFloat(gross_amount) || 0;
  const prev = parseFloat(previous_amount) || 0;
  const current_amount = gross - prev;
  const retPct = parseFloat(retention_percent) || 5;
  const retention_amount = Math.round(current_amount * retPct / 100);
  const ded = parseFloat(deductions) || 0;
  const net_payable = current_amount - retention_amount - ded;

  const result = db.prepare(`INSERT INTO ra_bills (bill_code, project_id, vendor_id, bill_number, title, description, period_from, period_to, gross_amount, previous_amount, current_amount, retention_percent, retention_amount, deductions, net_payable, status, prepared_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`)
    .run(bill_code, project_id, vendor_id || null, bill_number, title, description || null, period_from || null, period_to || null, gross, prev, current_amount, retPct, retention_amount, ded, net_payable, req.user.id);

  const created = db.prepare(`SELECT rb.*, v.name as vendor_name FROM ra_bills rb LEFT JOIN vendors v ON rb.vendor_id = v.id WHERE rb.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.patch('/:id', requireAuth, (req, res) => {
  const bill = db.prepare('SELECT * FROM ra_bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'RA Bill not found' });

  const { title, description, period_from, period_to, gross_amount, previous_amount, retention_percent, deductions, vendor_id } = req.body;
  const gross = gross_amount !== undefined ? parseFloat(gross_amount) : bill.gross_amount;
  const prev = previous_amount !== undefined ? parseFloat(previous_amount) : bill.previous_amount;
  const current_amount = gross - prev;
  const retPct = retention_percent !== undefined ? parseFloat(retention_percent) : bill.retention_percent;
  const retention_amount = Math.round(current_amount * retPct / 100);
  const ded = deductions !== undefined ? parseFloat(deductions) : bill.deductions;
  const net_payable = current_amount - retention_amount - ded;

  db.prepare(`UPDATE ra_bills SET title=COALESCE(?,title), description=COALESCE(?,description), period_from=COALESCE(?,period_from), period_to=COALESCE(?,period_to),
    gross_amount=?, previous_amount=?, current_amount=?, retention_percent=?, retention_amount=?, deductions=?, net_payable=?,
    vendor_id=COALESCE(?,vendor_id), updated_at=datetime('now') WHERE id=?`)
    .run(title||null, description||null, period_from||null, period_to||null, gross, prev, current_amount, retPct, retention_amount, ded, net_payable, vendor_id||null, bill.id);

  res.json(db.prepare('SELECT * FROM ra_bills WHERE id = ?').get(bill.id));
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const bill = db.prepare('SELECT * FROM ra_bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'RA Bill not found' });

  if (status === 'Approved') {
    db.prepare("UPDATE ra_bills SET status=?, approved_by=?, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(status, req.user.id, bill.id);
  } else {
    db.prepare("UPDATE ra_bills SET status=?, updated_at=datetime('now') WHERE id=?").run(status, bill.id);
  }

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'ra_bill', ?, ?, ?, 'status_change', ?, ?, 'workflow')`)
    .run(bill.project_id, bill.bill_code, bill.status, status, req.user.id, req.user.name);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const bill = db.prepare('SELECT * FROM ra_bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'RA Bill not found' });
  db.prepare('DELETE FROM ra_bills WHERE id = ?').run(bill.id);
  res.json({ success: true });
});

export default router;
