import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { entity, type, limit, project_id } = req.query;

  let query = 'SELECT * FROM audit_log';
  const params = [];
  const conditions = [];

  if (project_id) {
    conditions.push('project_id = ?');
    params.push(project_id);
  } else {
    const projectIds = getUserProjectIds(req.user.id, req.user.role);
    if (projectIds.length > 0) {
      const ph = projectIds.map(() => '?').join(',');
      conditions.push(`(project_id IN (${ph}) OR project_id IS NULL)`);
      params.push(...projectIds);
    }
  }

  if (entity) {
    conditions.push('entity = ?');
    params.push(entity);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY timestamp DESC';
  query += ` LIMIT ${parseInt(limit) || 50}`;

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

export default router;
