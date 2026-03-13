import db from '../config/db.js';

export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = db.prepare(`
    SELECT u.id, u.email, u.name, u.phone, u.owner_type, u.created_by, u.created_at,
           r.name as role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND u.is_active = 1
  `).get(req.session.userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Middleware to check if user has access to a project
// Sets req.projectId and req.projectRole
export function requireProjectAccess(req, res, next) {
  const projectId = req.query.project_id || req.body?.project_id || req.params.project_id;

  if (!projectId) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Owner who created the project always has access
  if (req.user.role === 'owner' && project.created_by === req.user.id) {
    req.projectId = parseInt(projectId);
    req.projectRole = 'owner';
    return next();
  }

  // Check project_members table
  const membership = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, req.user.id);

  if (!membership) {
    return res.status(403).json({ error: 'You do not have access to this project' });
  }

  req.projectId = parseInt(projectId);
  req.projectRole = membership.role;
  next();
}

// Get all project IDs a user has access to
export function getUserProjectIds(userId, userRole) {
  if (userRole === 'owner') {
    return db.prepare('SELECT id FROM projects WHERE created_by = ?').all(userId).map(p => p.id);
  }
  return db.prepare('SELECT project_id as id FROM project_members WHERE user_id = ?').all(userId).map(p => p.id);
}

// Get stage IDs for a project
export function getProjectStageIds(projectId) {
  return db.prepare('SELECT id FROM stages WHERE project_id = ?').all(projectId).map(s => s.id);
}
