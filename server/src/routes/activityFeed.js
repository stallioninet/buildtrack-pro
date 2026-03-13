import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

// GET /api/activity-feed — unified activity timeline
router.get('/', requireAuth, (req, res) => {
  const { project_id, entity, user_id, date_from, date_to } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const offset = (page - 1) * limit;

  // Project scoping
  const projectIds = project_id ? [parseInt(project_id)] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) {
    return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 }, summary: {} });
  }
  const ph = projectIds.map(() => '?').join(',');

  // Build conditions
  const conditions = [`(a.project_id IN (${ph}) OR a.project_id IS NULL)`];
  const params = [...projectIds];

  if (entity) {
    conditions.push('a.entity = ?');
    params.push(entity);
  }
  if (user_id) {
    conditions.push('a.user_id = ?');
    params.push(parseInt(user_id));
  }
  if (date_from) {
    conditions.push('a.timestamp >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push("a.timestamp <= ? || ' 23:59:59'");
    params.push(date_to);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Count
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM audit_log a ${whereClause}`).get(...params);

  // Fetch activities with project name
  const activities = db.prepare(`
    SELECT a.*, p.name as project_name
    FROM audit_log a
    LEFT JOIN projects p ON a.project_id = p.id
    ${whereClause}
    ORDER BY a.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Summary: activity counts by entity for the filter period
  const summaryParams = [...params]; // same filters minus pagination
  const entityCounts = db.prepare(`
    SELECT entity, COUNT(*) as count FROM audit_log a ${whereClause} GROUP BY entity ORDER BY count DESC
  `).all(...summaryParams);

  const todayCount = db.prepare(`
    SELECT COUNT(*) as count FROM audit_log a ${whereClause} AND date(a.timestamp) = date('now')
  `).get(...summaryParams).count;

  const uniqueUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM audit_log a ${whereClause} AND a.user_id IS NOT NULL
  `).get(...summaryParams).count;

  res.json({
    data: activities,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { total, todayCount, uniqueUsers, entityCounts },
  });
});

// GET /api/activity-feed/recent — compact recent feed for dashboard widgets
router.get('/recent', requireAuth, (req, res) => {
  const { project_id } = req.query;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));

  const projectIds = project_id ? [parseInt(project_id)] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');

  const activities = db.prepare(`
    SELECT a.*, p.name as project_name
    FROM audit_log a
    LEFT JOIN projects p ON a.project_id = p.id
    WHERE (a.project_id IN (${ph}) OR a.project_id IS NULL)
    ORDER BY a.timestamp DESC
    LIMIT ?
  `).all(...projectIds, limit);

  res.json(activities);
});

export default router;
