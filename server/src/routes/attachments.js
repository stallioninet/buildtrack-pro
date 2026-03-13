import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { audit } from '../services/auditHelper.js';

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

// Magic byte signatures for file type validation
const MAGIC_BYTES = {
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])], // .PNG
  'image/gif': [Buffer.from([0x47, 0x49, 0x46])], // GIF
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF (WebP)
  'application/zip': [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // docx is zip
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // xlsx is zip
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // pptx is zip
};

function validateMagicBytes(filePath, mimetype) {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return true; // skip check for types without known signatures (txt, csv, dwg, etc)

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(8);
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);

  return signatures.some(sig => buffer.subarray(0, sig.length).equals(sig));
}

const CATEGORIES = ['general', 'drawing', 'report', 'approval', 'specification', 'photo', 'contract'];

// Check if user has access to the project that owns an attachment
function verifyAttachmentAccess(attId, userId, userRole) {
  const row = db.prepare(`
    SELECT s.project_id FROM task_attachments ta
    JOIN tasks t ON ta.task_id = t.id
    JOIN stages s ON t.stage_id = s.id
    WHERE ta.id = ?
  `).get(attId);
  if (!row) return false;
  const projectIds = getUserProjectIds(userId, userRole);
  return projectIds.includes(row.project_id);
}

const router = Router();

// POST /api/tasks/:taskId/attachments — upload files to a task
router.post('/:taskId/attachments', requireAuth, upload.array('files', 10), (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const stageRow = db.prepare('SELECT s.project_id FROM tasks t JOIN stages s ON t.stage_id = s.id WHERE t.id = ?').get(task.id);
  if (!stageRow || !getUserProjectIds(req.user.id, req.user.role).includes(stageRow.project_id)) {
    // Delete uploaded files since validation failed
    for (const f of req.files) { try { fs.unlinkSync(f.path); } catch (_) {} }
    return res.status(403).json({ error: 'You do not have access to this task' });
  }

  // Validate magic bytes for each uploaded file
  for (const file of req.files) {
    if (!validateMagicBytes(file.path, file.mimetype)) {
      // Delete ALL uploaded files from disk on validation failure
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (_) { /* already removed */ }
      }
      return res.status(400).json({ error: 'File content does not match its type. Upload rejected for security.' });
    }
  }

  const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'general';

  const insertStmt = db.prepare(
    'INSERT INTO task_attachments (task_id, file_name, original_name, file_size, mime_type, category, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const attachments = [];
  for (const file of req.files) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const result = insertStmt.run(task.id, file.filename, safeName, file.size, file.mimetype, category, req.user.id);
    attachments.push({
      id: result.lastInsertRowid,
      task_id: task.id,
      file_name: file.filename,
      original_name: safeName,
      file_size: file.size,
      mime_type: file.mimetype,
      category,
      uploaded_by: req.user.id,
      uploaded_by_name: req.user.name,
    });
  }

  audit({ entity: 'task', entityId: task.id, action: 'files_uploaded', userId: req.user.id, userName: req.user.name, details: `Uploaded ${req.files.length} file(s): ${req.files.map(f => f.originalname).join(', ')}`, type: 'info' });
  res.status(201).json(attachments);
});

// GET /api/tasks/:taskId/attachments — list attachments for a task
router.get('/:taskId/attachments', requireAuth, (req, res) => {
  const stageRow = db.prepare('SELECT s.project_id FROM tasks t JOIN stages s ON t.stage_id = s.id WHERE t.id = ?').get(req.params.taskId);
  if (!stageRow || !getUserProjectIds(req.user.id, req.user.role).includes(stageRow.project_id)) {
    return res.status(403).json({ error: 'You do not have access to this task' });
  }

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

  if (!verifyAttachmentAccess(att.id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

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

  if (!verifyAttachmentAccess(att.id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  const filePath = path.join(UPLOAD_DIR, att.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `inline; filename="${att.original_name}"`);
  res.setHeader('Content-Type', att.mime_type);
  res.sendFile(filePath);
});

// GET /api/tasks/attachments/:id/text — read text file content for preview
router.get('/attachments/:id/text', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  if (!verifyAttachmentAccess(att.id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  const textTypes = ['text/plain', 'text/csv', 'text/html', 'application/json', 'text/xml', 'application/xml'];
  const textExts = ['.txt', '.csv', '.json', '.xml', '.html', '.log', '.md'];
  const ext = att.original_name ? '.' + att.original_name.split('.').pop().toLowerCase() : '';

  if (!textTypes.includes(att.mime_type) && !textExts.includes(ext)) {
    return res.status(400).json({ error: 'File is not a text file' });
  }

  const filePath = path.join(UPLOAD_DIR, att.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  const content = fs.readFileSync(filePath, 'utf-8').substring(0, 500000); // limit to 500KB text
  res.json({ content, fileName: att.original_name, mimeType: att.mime_type });
});

// GET /api/tasks/attachments/:id/thumbnail — generate image thumbnail
router.get('/attachments/:id/thumbnail', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  if (!verifyAttachmentAccess(att.id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  if (!att.mime_type.startsWith('image/')) {
    return res.status(400).json({ error: 'Not an image file' });
  }

  const filePath = path.join(UPLOAD_DIR, att.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  // Serve the image directly — browsers handle resizing via CSS
  res.setHeader('Content-Disposition', `inline; filename="${att.original_name}"`);
  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // cache thumbnails 24h
  res.sendFile(filePath);
});

// GET /api/tasks/attachments/:id/annotations — get photo annotations
router.get('/attachments/:id/annotations', requireAuth, (req, res) => {
  if (!verifyAttachmentAccess(parseInt(req.params.id), req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  const annotations = db.prepare(`SELECT pa.*, u.name as created_by_name
    FROM photo_annotations pa LEFT JOIN users u ON pa.created_by = u.id
    WHERE pa.attachment_id = ? ORDER BY pa.created_at DESC`).all(req.params.id);
  res.json(annotations);
});

// POST /api/tasks/attachments/:id/annotations — save photo annotation
router.post('/attachments/:id/annotations', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  if (!verifyAttachmentAccess(att.id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  const { annotation_data } = req.body;
  if (!annotation_data) return res.status(400).json({ error: 'annotation_data is required' });

  // Upsert: replace existing annotation by this user for this attachment
  const existing = db.prepare('SELECT id FROM photo_annotations WHERE attachment_id = ? AND created_by = ?').get(att.id, req.user.id);
  if (existing) {
    db.prepare("UPDATE photo_annotations SET annotation_data = ?, updated_at = datetime('now') WHERE id = ?").run(annotation_data, existing.id);
    res.json(db.prepare('SELECT * FROM photo_annotations WHERE id = ?').get(existing.id));
  } else {
    const result = db.prepare('INSERT INTO photo_annotations (attachment_id, annotation_data, created_by) VALUES (?, ?, ?)').run(att.id, annotation_data, req.user.id);
    res.status(201).json(db.prepare('SELECT * FROM photo_annotations WHERE id = ?').get(result.lastInsertRowid));
  }
});

// DELETE /api/tasks/attachments/:id — delete an attachment
router.delete('/attachments/:id', requireAuth, (req, res) => {
  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  if (!verifyAttachmentAccess(att.id, req.user.id, req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

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
  audit({ entity: 'task', entityId: att.task_id, action: 'file_deleted', userId: req.user.id, userName: req.user.name, details: `Deleted: ${att.original_name}`, type: 'info' });
  res.json({ success: true });
});

export default router;
