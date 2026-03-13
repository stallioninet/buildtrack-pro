import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { generateNextCode } from '../services/codeGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../data/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `doc-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

const CATEGORIES = ['Structural', 'Architectural', 'MEP', 'Civil', 'Landscape', 'Interior', 'Safety', 'Specification', 'Report', 'Other'];
const DOC_TYPES = ['drawing', 'specification', 'report', 'submittal', 'manual', 'certificate', 'other'];

router.get('/', requireAuth, (req, res) => {
  const { project_id, category, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  const ph = projectIds.map(() => '?').join(',');

  let whereClause = `WHERE d.project_id IN (${ph})`;
  const params = [...projectIds];
  if (category) { whereClause += ' AND d.category = ?'; params.push(category); }
  if (status) { whereClause += ' AND d.status = ?'; params.push(status); }

  const countSql = `SELECT COUNT(*) as total FROM documents d ${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);

  const sql = `SELECT d.*, s.name as stage_name, u1.name as uploaded_by_name, u2.name as approved_by_name
    FROM documents d LEFT JOIN stages s ON d.stage_id = s.id
    LEFT JOIN users u1 ON d.uploaded_by = u1.id LEFT JOIN users u2 ON d.approved_by = u2.id
    ${whereClause} ORDER BY d.updated_at DESC LIMIT ? OFFSET ?`;
  const data = db.prepare(sql).all(...params, limit, offset);
  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, byCategory: [], byStatus: [] });
  const ph = projectIds.map(() => '?').join(',');
  const total = db.prepare(`SELECT COUNT(*) as c FROM documents WHERE project_id IN (${ph})`).get(...projectIds).c;
  const byCategory = db.prepare(`SELECT category, COUNT(*) as count FROM documents WHERE project_id IN (${ph}) GROUP BY category ORDER BY count DESC`).all(...projectIds);
  const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM documents WHERE project_id IN (${ph}) GROUP BY status`).all(...projectIds);
  res.json({ total, byCategory, byStatus });
});

router.post('/', requireAuth, (req, res) => {
  const { project_id, stage_id, title, category, doc_type, revision, revision_date, description } = req.body;
  if (!title || !category || !project_id) return res.status(400).json({ error: 'Title, category, and project are required' });
  const doc_code = generateNextCode('documents', 'doc_code', 'DOC');
  const result = db.prepare(`INSERT INTO documents (doc_code, project_id, stage_id, title, category, doc_type, revision, revision_date, description, status, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`)
    .run(doc_code, project_id, stage_id || null, title, category, doc_type || 'drawing', revision || 'R0', revision_date || null, description || null, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const { title, category, doc_type, revision, revision_date, description, stage_id } = req.body;
  db.prepare(`UPDATE documents SET title=COALESCE(?,title), category=COALESCE(?,category), doc_type=COALESCE(?,doc_type),
    revision=COALESCE(?,revision), revision_date=COALESCE(?,revision_date), description=COALESCE(?,description),
    stage_id=COALESCE(?,stage_id), updated_at=datetime('now') WHERE id=?`)
    .run(title||null, category||null, doc_type||null, revision||null, revision_date||null, description||null, stage_id||null, doc.id);
  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id));
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (status === 'Approved') {
    db.prepare("UPDATE documents SET status=?, approved_by=?, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(status, req.user.id, doc.id);
  } else {
    db.prepare("UPDATE documents SET status=?, updated_at=datetime('now') WHERE id=?").run(status, doc.id);
  }
  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, type) VALUES (?, 'document', ?, ?, ?, 'status_change', ?, ?, 'workflow')`)
    .run(doc.project_id, doc.doc_code, doc.status, status, req.user.id, req.user.name);
  res.json({ success: true });
});

router.patch('/:id/revise', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const { revision, revision_date, description } = req.body;
  if (!revision) return res.status(400).json({ error: 'Revision number is required' });
  db.prepare("UPDATE documents SET revision=?, revision_date=COALESCE(?,datetime('now')), description=COALESCE(?,description), status='Under Review', updated_at=datetime('now') WHERE id=?")
    .run(revision, revision_date||null, description||null, doc.id);
  db.prepare(`INSERT INTO audit_log (project_id, entity, entity_id, from_state, to_state, action, user_id, user_display, details, type) VALUES (?, 'document', ?, ?, 'Under Review', 'revision', ?, ?, ?, 'workflow')`)
    .run(doc.project_id, doc.doc_code, doc.revision, req.user.id, req.user.name, `Revised to ${revision}`);
  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  if (!['owner', 'pm'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  // Delete file from disk if exists
  if (doc.file_name) {
    const filePath = path.join(UPLOAD_DIR, doc.file_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  res.json({ success: true });
});

// POST /api/documents/:id/upload — upload a file attachment to a document
router.post('/:id/upload', requireAuth, upload.array('files', 1), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const file = req.files?.[0];
  if (!file) return res.status(400).json({ error: 'No file provided' });

  // Delete old file if replacing
  if (doc.file_name) {
    const oldPath = path.join(UPLOAD_DIR, doc.file_name);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  db.prepare("UPDATE documents SET file_name=?, original_name=?, file_size=?, mime_type=?, updated_at=datetime('now') WHERE id=?")
    .run(file.filename, safeName, file.size, file.mimetype, doc.id);

  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id));
});

// GET /api/documents/:id/file — view/preview document file (inline)
router.get('/:id/file', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.file_name) return res.status(404).json({ error: 'No file attached to this document' });

  const filePath = path.join(UPLOAD_DIR, doc.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
});

// GET /api/documents/:id/download — download document file
router.get('/:id/download', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.file_name) return res.status(404).json({ error: 'No file attached to this document' });

  const filePath = path.join(UPLOAD_DIR, doc.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
});

// ─── Document Pins API ────────────────────────────────────────

// GET /api/documents/:id/pins — list all pins for a document
router.get('/:id/pins', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const pins = db.prepare(`
    SELECT p.*, u1.name as created_by_name, u2.name as assigned_to_name, u3.name as resolved_by_name
    FROM document_pins p
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.assigned_to = u2.id
    LEFT JOIN users u3 ON p.resolved_by = u3.id
    WHERE p.document_id = ?
    ORDER BY p.created_at DESC
  `).all(req.params.id);

  res.json(pins);
});

// POST /api/documents/:id/pins — create a new pin
router.post('/:id/pins', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { x, y, pin_type, title, description, severity, assigned_to, linked_ncr_id, linked_task_id } = req.body;
  if (x == null || y == null || !title) return res.status(400).json({ error: 'x, y, and title are required' });

  const result = db.prepare(`
    INSERT INTO document_pins (document_id, x, y, pin_type, title, description, severity, assigned_to, linked_ncr_id, linked_task_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(doc.id, x, y, pin_type || 'note', title, description || null, severity || 'info', assigned_to || null, linked_ncr_id || null, linked_task_id || null, req.user.id);

  const pin = db.prepare(`
    SELECT p.*, u1.name as created_by_name, u2.name as assigned_to_name
    FROM document_pins p
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.assigned_to = u2.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(pin);
});

// PATCH /api/documents/pins/:pinId — update a pin
router.patch('/pins/:pinId', requireAuth, (req, res) => {
  const pin = db.prepare('SELECT * FROM document_pins WHERE id = ?').get(req.params.pinId);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  const { title, description, severity, status, assigned_to, pin_type, linked_ncr_id, linked_task_id } = req.body;

  // Handle resolve action
  let resolvedBy = pin.resolved_by;
  let resolvedAt = pin.resolved_at;
  if (status === 'resolved' && pin.status !== 'resolved') {
    resolvedBy = req.user.id;
    resolvedAt = new Date().toISOString();
  }
  if (status && status !== 'resolved') {
    resolvedBy = null;
    resolvedAt = null;
  }

  db.prepare(`
    UPDATE document_pins SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      severity = COALESCE(?, severity),
      status = COALESCE(?, status),
      pin_type = COALESCE(?, pin_type),
      assigned_to = ?,
      linked_ncr_id = ?,
      linked_task_id = ?,
      resolved_by = ?,
      resolved_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title || null, description || null, severity || null, status || null, pin_type || null,
    assigned_to !== undefined ? assigned_to : pin.assigned_to,
    linked_ncr_id !== undefined ? linked_ncr_id : pin.linked_ncr_id,
    linked_task_id !== undefined ? linked_task_id : pin.linked_task_id,
    resolvedBy, resolvedAt, pin.id
  );

  const updated = db.prepare(`
    SELECT p.*, u1.name as created_by_name, u2.name as assigned_to_name, u3.name as resolved_by_name
    FROM document_pins p
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.assigned_to = u2.id
    LEFT JOIN users u3 ON p.resolved_by = u3.id
    WHERE p.id = ?
  `).get(pin.id);

  res.json(updated);
});

// DELETE /api/documents/pins/:pinId — delete a pin
router.delete('/pins/:pinId', requireAuth, (req, res) => {
  const pin = db.prepare('SELECT * FROM document_pins WHERE id = ?').get(req.params.pinId);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  // Only creator, owner, or pm can delete
  if (pin.created_by !== req.user.id && !['owner', 'pm'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized to delete this pin' });
  }

  db.prepare('DELETE FROM document_pins WHERE id = ?').run(pin.id);
  res.json({ success: true });
});

export default router;
