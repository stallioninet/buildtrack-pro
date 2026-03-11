import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../data/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.ms-powerpoint', // ppt
  'application/zip',
  'application/x-rar-compressed',
  'text/plain',
  'text/csv',
  'application/dxf', 'image/vnd.dxf', 'application/x-dxf', // AutoCAD DXF
  'application/dwg', 'image/vnd.dwg', 'application/x-dwg', // AutoCAD DWG
];

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    // Allow common extensions even if mime type is generic
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf','.jpg','.jpeg','.png','.gif','.webp','.svg','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip','.rar','.txt','.csv','.dwg','.dxf','.skp','.3ds','.rvt'];
    if (ALLOWED_TYPES.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype} (${ext})`));
    }
  },
});

const CATEGORIES = ['general', 'drawing', 'report', 'approval', 'specification', 'photo', 'contract'];

const router = Router();

// POST /api/tasks/:taskId/attachments — upload files to a task
router.post('/:taskId/attachments', requireAuth, upload.array('files', 10), (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'general';

  const insertStmt = db.prepare(
    'INSERT INTO task_attachments (task_id, file_name, original_name, file_size, mime_type, category, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const attachments = [];
  for (const file of req.files) {
    const result = insertStmt.run(task.id, file.filename, file.originalname, file.size, file.mimetype, category, req.user.id);
    attachments.push({
      id: result.lastInsertRowid,
      task_id: task.id,
      file_name: file.filename,
      original_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      category,
      uploaded_by: req.user.id,
      uploaded_by_name: req.user.name,
    });
  }

  res.status(201).json(attachments);
});

// GET /api/tasks/:taskId/attachments — list attachments for a task
router.get('/:taskId/attachments', requireAuth, (req, res) => {
  const attachments = db.prepare(`
    SELECT ta.*, u.name as uploaded_by_name
    FROM task_attachments ta
    LEFT JOIN users u ON ta.uploaded_by = u.id
    WHERE ta.task_id = ?
    ORDER BY ta.uploaded_at DESC
  `).all(req.params.taskId);

  res.json(attachments);
});

// GET /api/tasks/attachments/:id/download — download a file
router.get('/attachments/:id/download', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = path.join(UPLOAD_DIR, att.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${att.original_name}"`);
  res.setHeader('Content-Type', att.mime_type);
  res.sendFile(filePath);
});

// GET /api/tasks/attachments/:id/view — view/preview a file (inline)
router.get('/attachments/:id/view', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = path.join(UPLOAD_DIR, att.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `inline; filename="${att.original_name}"`);
  res.setHeader('Content-Type', att.mime_type);
  res.sendFile(filePath);
});

// DELETE /api/tasks/attachments/:id — delete an attachment
router.delete('/attachments/:id', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  // Only uploader, PM, or owner can delete
  const role = req.user.role;
  if (att.uploaded_by !== req.user.id && role !== 'pm' && role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized to delete this file' });
  }

  // Delete from disk
  const filePath = path.join(UPLOAD_DIR, att.file_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Delete from DB
  db.prepare('DELETE FROM task_attachments WHERE id = ?').run(att.id);
  res.json({ success: true });
});

export default router;
