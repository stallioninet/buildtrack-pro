import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, requireRole, getUserProjectIds } from '../middleware/auth.js';
import { logAudit } from '../services/workflowEngine.js';
import { generateNextCode } from '../services/codeGenerator.js';

const router = Router();

const VALID_STATUSES = ['open', 'in_progress', 'ready_for_review', 'closed', 'void'];
const CATEGORIES = ['General', 'Electrical', 'Plumbing', 'HVAC', 'Finishing', 'Structural', 'Painting', 'Landscaping'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

// GET /api/punch-lists — list punch items
router.get('/', requireAuth, (req, res) => {
  const { project_id, status, priority, category, stage_id, assigned_to } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('p.project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    conditions.push(`p.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }

  // Contractors see only assigned items
  if (req.user.role === 'contractor') {
    conditions.push('p.assigned_to = ?');
    params.push(req.user.id);
  }

  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (priority) { conditions.push('p.priority = ?'); params.push(priority); }
  if (category) { conditions.push('p.category = ?'); params.push(category); }
  if (stage_id) { conditions.push('p.stage_id = ?'); params.push(stage_id); }
  if (assigned_to) { conditions.push('p.assigned_to = ?'); params.push(assigned_to); }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM punch_items p${whereClause}`).get(...params);

  const sql = `
    SELECT p.*, s.name as stage_name, pr.name as project_name,
           u1.name as created_by_name, u2.name as assigned_to_name, u3.name as closed_by_name
    FROM punch_items p
    LEFT JOIN stages s ON p.stage_id = s.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.assigned_to = u2.id
    LEFT JOIN users u3 ON p.closed_by = u3.id
    ${whereClause}
    ORDER BY CASE p.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, p.id DESC
    LIMIT ? OFFSET ?`;

  const data = db.prepare(sql).all(...params, limit, offset);
  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /api/punch-lists/summary — summary counts
router.get('/summary', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json({ total: 0, byStatus: [], byPriority: [], byCategory: [] });
  const ph = projectIds.map(() => '?').join(',');

  const extra = req.user.role === 'contractor' ? ' AND assigned_to = ?' : '';
  const extraParams = req.user.role === 'contractor' ? [req.user.id] : [];

  const total = db.prepare(`SELECT COUNT(*) as c FROM punch_items WHERE project_id IN (${ph})${extra}`).get(...projectIds, ...extraParams).c;
  const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM punch_items WHERE project_id IN (${ph})${extra} GROUP BY status`).all(...projectIds, ...extraParams);
  const byPriority = db.prepare(`SELECT priority, COUNT(*) as count FROM punch_items WHERE project_id IN (${ph})${extra} GROUP BY priority ORDER BY count DESC`).all(...projectIds, ...extraParams);
  const byCategory = db.prepare(`SELECT category, COUNT(*) as count FROM punch_items WHERE project_id IN (${ph})${extra} GROUP BY category ORDER BY count DESC`).all(...projectIds, ...extraParams);

  res.json({ total, byStatus, byPriority, byCategory });
});

// GET /api/punch-lists/:id — single punch item
router.get('/:id', requireAuth, (req, res) => {
  const item = db.prepare(`
    SELECT p.*, s.name as stage_name, pr.name as project_name,
           u1.name as created_by_name, u2.name as assigned_to_name, u3.name as closed_by_name
    FROM punch_items p
    LEFT JOIN stages s ON p.stage_id = s.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.assigned_to = u2.id
    LEFT JOIN users u3 ON p.closed_by = u3.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Punch item not found' });
  res.json(item);
});

// POST /api/punch-lists — create punch item
router.post('/', requireAuth, requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const { project_id, stage_id, title, description, location, category, priority, assigned_to, due_date } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });

  const safeCategory = CATEGORIES.includes(category) ? category : 'General';
  const safePriority = PRIORITIES.includes(priority) ? priority : 'medium';
  const code = generateNextCode('punch_items', 'punch_code', 'PUN');

  const result = db.prepare(`
    INSERT INTO punch_items (punch_code, project_id, stage_id, title, description, location, category, priority, status, assigned_to, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).run(code, project_id, stage_id || null, title, description || null, location || null, safeCategory, safePriority, assigned_to || null, due_date || null, req.user.id);

  logAudit(project_id, 'punch_item', code, null, 'open', 'created', req.user.id);

  const item = db.prepare('SELECT * FROM punch_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// PATCH /api/punch-lists/:id — update punch item fields
router.patch('/:id', requireAuth, requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const item = db.prepare('SELECT * FROM punch_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Punch item not found' });
  if (item.status === 'closed') return res.status(400).json({ error: 'Cannot edit a closed punch item' });

  const { title, description, location, category, priority, stage_id, assigned_to, due_date } = req.body;

  db.prepare(`
    UPDATE punch_items SET
      title = COALESCE(?, title), description = COALESCE(?, description), location = COALESCE(?, location),
      category = COALESCE(?, category), priority = COALESCE(?, priority), stage_id = COALESCE(?, stage_id),
      assigned_to = COALESCE(?, assigned_to), due_date = COALESCE(?, due_date),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title || null, description || null, location || null, category || null, priority || null, stage_id || null, assigned_to || null, due_date || null, item.id);

  res.json(db.prepare('SELECT * FROM punch_items WHERE id = ?').get(item.id));
});

// PATCH /api/punch-lists/:id/status — change status
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const item = db.prepare('SELECT * FROM punch_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Punch item not found' });

  // Role-based restrictions
  const role = req.user.role;
  if (role === 'owner') return res.status(403).json({ error: 'Owner cannot change punch item status' });
  if (role === 'contractor' && item.assigned_to !== req.user.id) {
    return res.status(403).json({ error: 'Contractors can only update assigned items' });
  }
  // Only PM/inspector can close or void
  if (['closed', 'void'].includes(status) && !['pm', 'inspector'].includes(role)) {
    return res.status(403).json({ error: 'Only PM or Inspector can close/void punch items' });
  }

  const updates = {};
  if (status === 'closed') {
    updates.closed_by = req.user.id;
    updates.closed_at = new Date().toISOString();
  }

  db.prepare(`
    UPDATE punch_items SET status = ?, closed_by = COALESCE(?, closed_by), closed_at = COALESCE(?, closed_at), updated_at = datetime('now') WHERE id = ?
  `).run(status, updates.closed_by || null, updates.closed_at || null, item.id);

  logAudit(item.project_id, 'punch_item', item.punch_code, item.status, status, 'status_change', req.user.id);

  res.json({ success: true, from: item.status, to: status });
});

// POST /api/punch-lists/bulk — bulk operations
router.post('/bulk', requireAuth, requireRole('pm', 'engineer', 'inspector'), (req, res) => {
  const { action, item_ids, status, assigned_to, priority, category } = req.body;

  if (!action || !item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ error: 'action and item_ids[] are required' });
  }

  if (item_ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 items per bulk operation' });
  }

  const ph = item_ids.map(() => '?').join(',');
  const items = db.prepare(`SELECT * FROM punch_items WHERE id IN (${ph})`).all(...item_ids);

  if (items.length === 0) {
    return res.status(404).json({ error: 'No matching items found' });
  }

  let updated = 0;

  if (action === 'status' && status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updateStmt = db.prepare("UPDATE punch_items SET status = ?, updated_at = datetime('now') WHERE id = ?");
    for (const item of items) {
      updateStmt.run(status, item.id);
      logAudit(item.project_id, 'punch_item', item.punch_code, item.status, status, 'bulk_status_change', req.user.id);
      updated++;
    }
  } else if (action === 'assign' && assigned_to) {
    const updateStmt = db.prepare("UPDATE punch_items SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?");
    for (const item of items) {
      updateStmt.run(assigned_to, item.id);
      updated++;
    }
  } else if (action === 'priority' && priority) {
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    const updateStmt = db.prepare("UPDATE punch_items SET priority = ?, updated_at = datetime('now') WHERE id = ?");
    for (const item of items) {
      updateStmt.run(priority, item.id);
      updated++;
    }
  } else if (action === 'delete') {
    const deleteStmt = db.prepare('DELETE FROM punch_items WHERE id = ?');
    for (const item of items) {
      deleteStmt.run(item.id);
      logAudit(item.project_id, 'punch_item', item.punch_code, item.status, null, 'bulk_deleted', req.user.id);
      updated++;
    }
  } else {
    return res.status(400).json({ error: 'Invalid action. Must be: status, assign, priority, delete' });
  }

  res.json({ success: true, updated });
});

// DELETE /api/punch-lists/:id
router.delete('/:id', requireAuth, requireRole('pm'), (req, res) => {
  const item = db.prepare('SELECT * FROM punch_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Punch item not found' });

  db.prepare('DELETE FROM punch_items WHERE id = ?').run(item.id);
  logAudit(item.project_id, 'punch_item', item.punch_code, item.status, null, 'deleted', req.user.id);

  res.json({ success: true });
});

export default router;
