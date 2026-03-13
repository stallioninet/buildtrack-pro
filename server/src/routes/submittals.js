import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { generateNextCode } from '../services/codeGenerator.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/submittals');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

const TYPES = ['shop_drawing', 'product_data', 'sample', 'mock_up', 'test_report', 'certificate', 'method_statement', 'other'];
const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Revise & Resubmit', 'Approved', 'Approved as Noted', 'Rejected', 'Closed'];

router.get('/', requireAuth, (req, res) => {
  const { project_id, status, submittal_type } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  const ph = projectIds.map(() => '?').join(',');

  let whereClause = `WHERE sub.project_id IN (${ph})`;
  const params = [...projectIds];
  if (status) { whereClause += ' AND sub.status = ?'; params.push(status); }
  if (submittal_type) { whereClause += ' AND sub.submittal_type = ?'; params.push(submittal_type); }

  const countSql = `SELECT COUNT(*) as total FROM submittals sub ${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);

  const sql = `SELECT sub.*, s.name as stage_name, v.name as vendor_name,
    u1.name as submitted_by_name, u2.name as reviewer_name, u3.name as approved_by_name
    FROM submittals sub LEFT JOIN stages s ON sub.stage_id = s.id
    LEFT JOIN vendors v ON sub.vendor_id = v.id
    LEFT JOIN users u1 ON sub.submitted_by = u1.id
    LEFT JOIN users u2 ON sub.reviewer_id = u2.id
    LEFT JOIN users u3 ON sub.approved_by = u3.id
    ${whereClause} ORDER BY sub.id DESC LIMIT ? OFFSET ?`;
  const data = db.prepare(sql).all(...params, limit, offset);
  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
  const withAttachments = db.prepare(`SELECT COUNT(DISTINCT s.id) as c FROM submittals s JOIN submittal_attachments sa ON s.id = sa.submittal_id WHERE s.project_id IN (${ph})`).get(...projectIds).c;
  res.json({ total, pending, approved, overdue, withAttachments });
});

router.post('/', requireAuth, (req, res) => {
  if (!['pm', 'engineer', 'contractor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const { project_id, stage_id, title, spec_section, submittal_type, description, vendor_id, due_date, priority } = req.body;
  if (!title || !project_id) return res.status(400).json({ error: 'Title and project are required' });
  const submittal_code = generateNextCode('submittals', 'submittal_code', 'SUB');
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

// Submittal attachments
router.get('/:id/attachments', requireAuth, (req, res) => {
  const attachments = db.prepare(`SELECT sa.*, u.name as uploaded_by_name
    FROM submittal_attachments sa LEFT JOIN users u ON sa.uploaded_by = u.id
    WHERE sa.submittal_id = ? ORDER BY sa.uploaded_at DESC`).all(req.params.id);
  res.json(attachments);
});

router.post('/:id/attachments', requireAuth, upload.array('files', 10), (req, res) => {
  const sub = db.prepare('SELECT * FROM submittals WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submittal not found' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const insert = db.prepare('INSERT INTO submittal_attachments (submittal_id, file_name, original_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)');
  const results = [];
  for (const file of req.files) {
    const r = insert.run(sub.id, file.filename, file.originalname, file.size, file.mimetype, req.user.id);
    results.push(db.prepare('SELECT * FROM submittal_attachments WHERE id = ?').get(r.lastInsertRowid));
  }
  res.status(201).json(results);
});

router.get('/attachments/:attachId/download', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM submittal_attachments WHERE id = ?').get(req.params.attachId);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  const filePath = path.join(uploadsDir, att.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, att.original_name);
});

router.delete('/attachments/:attachId', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM submittal_attachments WHERE id = ?').get(req.params.attachId);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  const filePath = path.join(uploadsDir, att.file_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM submittal_attachments WHERE id = ?').run(att.id);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const sub = db.prepare('SELECT * FROM submittals WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submittal not found' });
  db.prepare('DELETE FROM submittals WHERE id = ?').run(sub.id);
  res.json({ success: true });
});

export default router;
