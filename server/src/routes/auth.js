import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

// POST /api/auth/register — self-registration (owner accounts only)
router.post('/register', (req, res) => {
  const { email, password, name, role, owner_type } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  // Self-registration only allowed for owner role
  const registerRole = 'owner';
  const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(registerRole);
  if (!roleRow) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const validOwnerTypes = ['firm', 'individual'];
  const ot = validOwnerTypes.includes(owner_type) ? owner_type : 'individual';

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, role_id, owner_type) VALUES (?, ?, ?, ?, ?)'
  ).run(email, passwordHash, name, roleRow.id, ot);

  const user = db.prepare(`
    SELECT u.id, u.email, u.name, u.owner_type, r.name as role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(result.lastInsertRowid);

  req.session.userId = user.id;
  res.status(201).json({ user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const row = db.prepare(`
    SELECT u.id, u.email, u.name, u.password_hash, u.is_active, u.owner_type, u.created_by,
           r.name as role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.email = ?
  `).get(email);

  if (!row) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!row.is_active) {
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.userId = row.id;

  const { password_hash, is_active, ...user } = row;
  res.json({ user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users — list users for assignment dropdowns
// Owner sees users they created + themselves
// Other roles see members of their projects
router.get('/users', requireAuth, (req, res) => {
  const { project_id } = req.query;

  let users;
  if (project_id) {
    // Get members of a specific project
    users = db.prepare(`
      SELECT u.id, u.name, pm.role, r.display_name as roleDisplayName
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE pm.project_id = ? AND u.is_active = 1
      ORDER BY u.name
    `).all(project_id);

    // Also include the owner
    const project = db.prepare('SELECT created_by FROM projects WHERE id = ?').get(project_id);
    if (project) {
      const owner = db.prepare(`
        SELECT u.id, u.name, 'owner' as role, r.display_name as roleDisplayName
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.id = ? AND u.is_active = 1
      `).get(project.created_by);
      if (owner && !users.find(u => u.id === owner.id)) {
        users.unshift(owner);
      }
    }
  } else if (req.user.role === 'owner') {
    // Owner sees team members they created
    users = db.prepare(`
      SELECT u.id, u.name, r.name as role, r.display_name as roleDisplayName
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE (u.created_by = ? OR u.id = ?) AND u.is_active = 1
      ORDER BY u.name
    `).all(req.user.id, req.user.id);
  } else {
    // Non-owner: see all co-members across their projects
    users = db.prepare(`
      SELECT DISTINCT u.id, u.name, r.name as role, r.display_name as roleDisplayName
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN project_members pm ON pm.user_id = u.id
      WHERE pm.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = ?
      ) AND u.is_active = 1
      ORDER BY u.name
    `).all(req.user.id);
  }

  res.json(users);
});

// POST /api/auth/team — Owner creates a team member
router.post('/team', requireAuth, requireRole('owner'), (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const validRoles = ['pm', 'engineer', 'contractor', 'procurement', 'accounts', 'inspector'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
  if (!roleRow) {
    return res.status(400).json({ error: 'Role not found' });
  }

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(email, passwordHash, name, roleRow.id, req.user.id);

  const user = db.prepare(`
    SELECT u.id, u.email, u.name, r.name as role, r.display_name as roleDisplayName
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(user);
});

// GET /api/auth/team — Owner lists their team members
router.get('/team', requireAuth, requireRole('owner'), (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.email, u.name, u.is_active, r.name as role, r.display_name as roleDisplayName, r.avatar_code as avatarCode,
           u.created_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.created_by = ?
    ORDER BY u.name
  `).all(req.user.id);

  // For each member, list their project assignments
  const memberStmt = db.prepare(`
    SELECT pm.project_id, pm.role, p.name as project_name
    FROM project_members pm
    JOIN projects p ON pm.project_id = p.id
    WHERE pm.user_id = ?
  `);

  for (const m of members) {
    m.projects = memberStmt.all(m.id);
  }

  res.json(members);
});

// PATCH /api/auth/team/:id — Owner updates a team member
router.patch('/team/:id', requireAuth, requireRole('owner'), (req, res) => {
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(404).json({ error: 'Team member not found' });

  const { name, email, is_active, role } = req.body;

  if (role) {
    const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
    if (roleRow) {
      db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(roleRow.id, member.id);
    }
  }

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name || null, email || null, is_active !== undefined ? (is_active ? 1 : 0) : null, member.id);

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.is_active, r.name as role, r.display_name as roleDisplayName
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(member.id);

  res.json(updated);
});

export default router;
