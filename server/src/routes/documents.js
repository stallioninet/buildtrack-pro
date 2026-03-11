import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

const CATEGORIES = ['Structural', 'Architectural', 'MEP', 'Civil', 'Landscape', 'Interior', 'Safety', 'Specification', 'Report', 'Other'];
const DOC_TYPES = ['drawing', 'specification', 'report', 'submittal', 'manual', 'certificate', 'other'];

router.get('/', requireAuth, (req, res) => {
  const { project_id, category, status } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  let sql = `SELECT d.*, s.name as stage_name, u1.name as uploaded_by_name, u2.name as approved_by_name
    FROM documents d LEFT JOIN stages s ON d.stage_id = s.id
    LEFT JOIN users u1 ON d.uploaded_by = u1.id LEFT JOIN users u2 ON d.approved_by = u2.id
    WHERE d.project_id IN (${ph})`;
  const params = [...projectIds];
  if (category) { sql += ' AND d.category = ?'; params.push(category); }
  if (status) { sql += ' AND d.status = ?'; params.push(status); }
  sql += ' ORDER BY d.updated_at DESC';
  res.json(db.prepare(sql).all(...params));
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
  const count = db.prepare('SELECT COUNT(*) as c FROM documents').get().c;
  const doc_code = `DOC-${String(count + 1).padStart(3, '0')}`;
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
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  res.json({ success: true });
});

export default router;
