import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { generateNextCode } from '../services/codeGenerator.js';

const router = Router();

const VALID_STATUSES = ['Draft', 'Open', 'Under Review', 'Awarded', 'Cancelled'];
const VALID_TRADES = ['General', 'Electrical', 'Plumbing', 'HVAC', 'Structural', 'Finishing', 'Landscaping', 'Roofing', 'Flooring', 'Painting', 'Other'];

// GET / - List bid packages with filtering, vendor count, awarded vendor name, pagination
router.get('/', requireAuth, (req, res) => {
  const { project_id, status, trade, page = 1, limit = 50 } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ data: [], total: 0 });
  const ph = projectIds.map(() => '?').join(',');

  let where = `bp.project_id IN (${ph})`;
  const params = [...projectIds];

  if (status) { where += ' AND bp.status = ?'; params.push(status); }
  if (trade) { where += ' AND bp.trade = ?'; params.push(trade); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM bid_packages bp WHERE ${where}`).get(...params).c;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const sql = `SELECT bp.*, p.name as project_name,
    (SELECT COUNT(*) FROM bid_responses br WHERE br.bid_package_id = bp.id) as vendor_count,
    av.name as awarded_vendor_name
    FROM bid_packages bp
    LEFT JOIN projects p ON bp.project_id = p.id
    LEFT JOIN vendors av ON bp.awarded_to = av.id
    WHERE ${where}
    ORDER BY bp.created_at DESC
    LIMIT ? OFFSET ?`;

  const data = db.prepare(sql).all(...params, parseInt(limit), offset);
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /summary - Stats: total, open, awarded, total budget
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, open: 0, awarded: 0, totalBudget: 0 });
  const ph = projectIds.map(() => '?').join(',');

  const total = db.prepare(`SELECT COUNT(*) as c FROM bid_packages WHERE project_id IN (${ph})`).get(...projectIds).c;
  const open = db.prepare(`SELECT COUNT(*) as c FROM bid_packages WHERE project_id IN (${ph}) AND status = 'Open'`).get(...projectIds).c;
  const awarded = db.prepare(`SELECT COUNT(*) as c FROM bid_packages WHERE project_id IN (${ph}) AND status = 'Awarded'`).get(...projectIds).c;
  const totalBudget = db.prepare(`SELECT COALESCE(SUM(budget_estimate),0) as s FROM bid_packages WHERE project_id IN (${ph})`).get(...projectIds).s;

  res.json({ total, open, awarded, totalBudget });
});

// GET /:id - Single bid package with all bid responses, vendor names, and scores
router.get('/:id', requireAuth, (req, res) => {
  const bp = db.prepare(`SELECT bp.*, p.name as project_name, av.name as awarded_vendor_name, u.name as created_by_name
    FROM bid_packages bp
    LEFT JOIN projects p ON bp.project_id = p.id
    LEFT JOIN vendors av ON bp.awarded_to = av.id
    LEFT JOIN users u ON bp.created_by = u.id
    WHERE bp.id = ?`).get(req.params.id);
  if (!bp) return res.status(404).json({ error: 'Bid package not found' });

  const responses = db.prepare(`SELECT br.*, v.name as vendor_name, v.email as vendor_email, v.type as vendor_type
    FROM bid_responses br
    LEFT JOIN vendors v ON br.vendor_id = v.id
    WHERE br.bid_package_id = ?
    ORDER BY br.amount ASC`).all(bp.id);

  res.json({ ...bp, responses });
});

// POST / - Create bid package
router.post('/', requireAuth, (req, res) => {
  if (!['pm', 'procurement', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { project_id, title, description, trade, scope_of_work, budget_estimate, bid_due_date } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'Project and title are required' });
  if (trade && !VALID_TRADES.includes(trade)) return res.status(400).json({ error: 'Invalid trade' });

  const bid_code = generateNextCode('bid_packages', 'bid_code', 'BID');

  const result = db.prepare(`INSERT INTO bid_packages (bid_code, project_id, title, description, trade, scope_of_work, budget_estimate, bid_due_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`)
    .run(bid_code, project_id, title, description || null, trade || null, scope_of_work || null,
      budget_estimate != null ? parseFloat(budget_estimate) : null,
      bid_due_date || null, req.user.id);

  const created = db.prepare(`SELECT bp.*, p.name as project_name FROM bid_packages bp LEFT JOIN projects p ON bp.project_id = p.id WHERE bp.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PATCH /:id - Update bid package
router.patch('/:id', requireAuth, (req, res) => {
  const bp = db.prepare('SELECT * FROM bid_packages WHERE id = ?').get(req.params.id);
  if (!bp) return res.status(404).json({ error: 'Bid package not found' });

  const { title, description, trade, scope_of_work, budget_estimate, bid_due_date, status } = req.body;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (trade && !VALID_TRADES.includes(trade)) {
    return res.status(400).json({ error: 'Invalid trade' });
  }

  db.prepare(`UPDATE bid_packages SET title=COALESCE(?,title), description=COALESCE(?,description),
    trade=COALESCE(?,trade), scope_of_work=COALESCE(?,scope_of_work),
    budget_estimate=COALESCE(?,budget_estimate), bid_due_date=COALESCE(?,bid_due_date),
    status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?`)
    .run(title || null, description || null, trade || null, scope_of_work || null,
      budget_estimate != null ? parseFloat(budget_estimate) : null,
      bid_due_date || null, status || null, bp.id);

  const updated = db.prepare(`SELECT bp.*, p.name as project_name FROM bid_packages bp LEFT JOIN projects p ON bp.project_id = p.id WHERE bp.id = ?`).get(bp.id);
  res.json(updated);
});

// PATCH /:id/award - Award bid to a vendor
router.patch('/:id/award', requireAuth, (req, res) => {
  const bp = db.prepare('SELECT * FROM bid_packages WHERE id = ?').get(req.params.id);
  if (!bp) return res.status(404).json({ error: 'Bid package not found' });

  const { vendor_id, awarded_amount } = req.body;
  if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });

  const response = db.prepare('SELECT * FROM bid_responses WHERE bid_package_id = ? AND vendor_id = ?').get(bp.id, vendor_id);
  if (!response) return res.status(400).json({ error: 'Vendor does not have a bid response for this package' });

  const amount = awarded_amount != null ? parseFloat(awarded_amount) : response.amount;

  db.prepare("UPDATE bid_packages SET awarded_to=?, awarded_amount=?, awarded_at=datetime('now'), status='Awarded', updated_at=datetime('now') WHERE id=?")
    .run(vendor_id, amount, bp.id);

  const updated = db.prepare(`SELECT bp.*, p.name as project_name, av.name as awarded_vendor_name
    FROM bid_packages bp LEFT JOIN projects p ON bp.project_id = p.id
    LEFT JOIN vendors av ON bp.awarded_to = av.id WHERE bp.id = ?`).get(bp.id);
  res.json(updated);
});

// DELETE /:id - Delete bid package (pm, owner only)
router.delete('/:id', requireAuth, (req, res) => {
  if (!['pm', 'owner'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const bp = db.prepare('SELECT * FROM bid_packages WHERE id = ?').get(req.params.id);
  if (!bp) return res.status(404).json({ error: 'Bid package not found' });
  db.prepare('DELETE FROM bid_responses WHERE bid_package_id = ?').run(bp.id);
  db.prepare('DELETE FROM bid_packages WHERE id = ?').run(bp.id);
  res.json({ success: true });
});

// POST /:id/responses - Add bid response from a vendor
router.post('/:id/responses', requireAuth, (req, res) => {
  const bp = db.prepare('SELECT * FROM bid_packages WHERE id = ?').get(req.params.id);
  if (!bp) return res.status(404).json({ error: 'Bid package not found' });

  const { vendor_id, amount, notes } = req.body;
  if (!vendor_id || amount == null) return res.status(400).json({ error: 'vendor_id and amount are required' });

  const existing = db.prepare('SELECT * FROM bid_responses WHERE bid_package_id = ? AND vendor_id = ?').get(bp.id, vendor_id);
  if (existing) return res.status(409).json({ error: 'Vendor already has a response for this bid package' });

  const result = db.prepare(`INSERT INTO bid_responses (bid_package_id, vendor_id, amount, notes) VALUES (?, ?, ?, ?)`)
    .run(bp.id, vendor_id, parseFloat(amount), notes || null);

  const created = db.prepare(`SELECT br.*, v.name as vendor_name FROM bid_responses br LEFT JOIN vendors v ON br.vendor_id = v.id WHERE br.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PATCH /responses/:responseId - Update bid response (score, notes)
router.patch('/responses/:responseId', requireAuth, (req, res) => {
  const br = db.prepare('SELECT * FROM bid_responses WHERE id = ?').get(req.params.responseId);
  if (!br) return res.status(404).json({ error: 'Bid response not found' });

  const { score, notes, amount } = req.body;

  db.prepare(`UPDATE bid_responses SET score=COALESCE(?,score), notes=COALESCE(?,notes),
    amount=COALESCE(?,amount), updated_at=datetime('now') WHERE id=?`)
    .run(score != null ? parseFloat(score) : null, notes || null,
      amount != null ? parseFloat(amount) : null, br.id);

  const updated = db.prepare(`SELECT br.*, v.name as vendor_name FROM bid_responses br LEFT JOIN vendors v ON br.vendor_id = v.id WHERE br.id = ?`).get(br.id);
  res.json(updated);
});

// DELETE /responses/:responseId - Delete bid response
router.delete('/responses/:responseId', requireAuth, (req, res) => {
  const br = db.prepare('SELECT * FROM bid_responses WHERE id = ?').get(req.params.responseId);
  if (!br) return res.status(404).json({ error: 'Bid response not found' });
  db.prepare('DELETE FROM bid_responses WHERE id = ?').run(br.id);
  res.json({ success: true });
});

export default router;
