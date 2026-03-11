import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

const TYPES = ['shop_drawing', 'product_data', 'sample', 'mock_up', 'test_report', 'certificate', 'method_statement', 'other'];
const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Revise & Resubmit', 'Approved', 'Approved as Noted', 'Rejected', 'Closed'];

router.get('/', requireAuth, (req, res) => {
  const { project_id, status, submittal_type } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  let sql = `SELECT sub.*, s.name as stage_name, v.name as vendor_name,
    u1.name as submitted_by_name, u2.name as reviewer_name, u3.name as approved_by_name
    FROM submittals sub LEFT JOIN stages s ON sub.stage_id = s.id
    LEFT JOIN vendors v ON sub.vendor_id = v.id
    LEFT JOIN users u1 ON sub.submitted_by = u1.id
    LEFT JOIN users u2 ON sub.reviewer_id = u2.id
    LEFT JOIN users u3 ON sub.approved_by = u3.id
    WHERE sub.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { sql += ' AND sub.status = ?'; params.push(status); }
  if (submittal_type) { sql += ' AND sub.submittal_type = ?'; params.push(submittal_type); }
  sql += ' ORDER BY sub.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, pending: 0, approved: 0, overdue: 0 });
  const ph = projectIds.map(() => '?').join(',');
  const total = db.prepare(`SELECT COUNT(*) as c FROM submittals WHERE project_id IN (${ph})`).get(...projectIds).c;
  const pending = db.prepare(`SELECT COUNT(*) as c FROM submittals WHERE project_id IN (${ph}) AND status IN ('Submitted','Under Review')`).get(...projectIds).c;
  const approved = db.prepare(`SELECT COUNT(*) as c FROM submittals WHERE project_id IN (${ph}) AND status IN ('Approved','Approved as Noted')`).get(...projectIds).c;
  const overdue = db.prepare(`SELECT COUNT(*) as c FROM submittals WHERE project_id IN (${ph}) AND due_date < date('now') AND status NOT IN ('Approved','Approved as Noted','Closed','Rejected')`).get(...projectIds).c;
  res.json({ total, pending, approved, overdue });
});

router.post('/', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'contractor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { project_id, stage_id, title, spec_section, submittal_type, description, vendor_id, due_date, priority } = req.body;
  if (!title || !project_id) return res.status(400).json({ error: 'Title and project are required' });
  const count = db.prepare('SELECT COUNT(*) as c FROM submittals').get().c;
  const submittal_code = `SUB-${String(count + 1).padStart(3, '0')}`;
  const result = db.prepare(`INSERT INTO submittals (submittal_code, project_id, stage_id, title, spec_section, submittal_type, description, vendor_id, due_date, priority, status, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`)
    .run(submittal_code, project_id, stage_id || null, title, spec_section || null, submittal_type || 'shop_drawing', description || null, vendor_id || null, due_date || null, priority || 'medium', req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM submittals WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', requireAuth, (req, res) => {
  const sub = db.prepare('SELECT * FROM submittals WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submittal not found' });
  const { title, spec_section, submittal_type, description, vendor_id, stage_id, due_date, priority } = req.body;
  db.prepare(`UPDATE submittals SET title=COALESCE(?,title), spec_section=COALESCE(?,spec_section),
    submittal_type=COALESCE(?,submittal_type), description=COALESCE(?,description),
    vendor_id=COALESCE(?,vendor_id), stage_id=COALESCE(?,stage_id),
    due_date=COALESCE(?,due_date), priority=COALESCE(?,priority), updated_at=datetime('now') WHERE id=?`)
    .run(title||null, spec_section||null, submittal_type||null, description||null, vendor_id||null, stage_id||null, due_date||null, priority||null, sub.id);
  res.json(db.prepare('SELECT * FROM submittals WHERE id = ?').get(sub.id));
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status, review_notes } = req.body;
  const sub = db.prepare('SELECT * FROM submittals WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submittal not found' });

  const updates = {};
  if (['Under Review'].includes(status)) {
    updates.reviewer_id = req.user.id;
  }
  if (['Approved', 'Approved as Noted'].includes(status)) {
    updates.approved_by = req.user.id;
    updates.approved_at = new Date().toISOString();
    updates.reviewed_at = new Date().toISOString();
    updates.reviewer_id = req.user.id;
  }
  if (['Revise & Resubmit', 'Rejected'].includes(status)) {
    updates.reviewed_at = new Date().toISOString();
    updates.reviewer_id = req.user.id;
  }

  db.prepare(`UPDATE submittals SET status=?, review_notes=COALESCE(?,review_notes),
    reviewer_id=COALESCE(?,reviewer_id), reviewed_at=COALESCE(?,reviewed_at),
    approved_by=COALESCE(?,approved_by), approved_at=COALESCE(?,approved_at),
    updated_at=datetime('now') WHERE id=?`)
    .run(status, review_notes||null, updates.reviewer_id||null, updates.reviewed_at||null, updates.approved_by||null, updates.approved_at||null, sub.id);

  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'submittal', ?, ?, ?, 'status_change', ?, ?, 'workflow')`)
    .run(sub.project_id, sub.submittal_code, sub.status, status, req.user.id, req.user.name);
  res.json({ success: true });
});

router.patch('/:id/revise', requireAuth, (req, res) => {
  const sub = db.prepare('SELECT * FROM submittals WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submittal not found' });
  const { revision, description } = req.body;
  if (!revision) return res.status(400).json({ error: 'Revision number is required' });
  db.prepare("UPDATE submittals SET revision=?, revision_date=datetime('now'), description=COALESCE(?,description), status='Submitted', updated_at=datetime('now') WHERE id=?")
    .run(revision, description||null, sub.id);
  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, details, type) VALUES (?, 'submittal', ?, ?, 'Submitted', 'revision', ?, ?, ?, 'workflow')`)
    .run(sub.project_id, sub.submittal_code, sub.revision, req.user.id, req.user.name, `Revised to ${revision}`);
  res.json(db.prepare('SELECT * FROM submittals WHERE id = ?').get(sub.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const sub = db.prepare('SELECT * FROM submittals WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submittal not found' });
  db.prepare('DELETE FROM submittals WHERE id = ?').run(sub.id);
  res.json({ success: true });
});

export default router;
