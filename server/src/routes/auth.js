import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { validate, loginSchema, registerSchema, teamMemberSchema, passwordChangeSchema, profileUpdateSchema } from '../middleware/validate.js';
import { audit } from '../services/auditHelper.js';

const router = Router();
const SALT_ROUNDS = 10;

// Helper: log login attempt
function logLoginAttempt(email, req, success) {
  try {
    db.prepare(
      "INSERT INTO login_attempts (email, ip_address, user_agent, success) VALUES (?, ?, ?, ?)"
    ).run(email, req.ip, req.get('user-agent')?.substring(0, 500) || '', success ? 1 : 0);
  } catch (_) { /* don't break login if logging fails */ }
}

// Helper: check if account is locked (10 failed attempts in last 30 minutes)
function isAccountLocked(email) {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND success = 0 AND attempted_at > datetime('now', '-30 minutes')"
  ).get(email);
  return row.count >= 10;
}

// POST /api/auth/register — self-registration (owner accounts only)
router.post('/register', registerLimiter, validate(registerSchema), (req, res) => {
  const { email, password, name, owner_type } = req.validated;

  const registerRole = 'owner';
  const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(registerRole);
  if (!roleRow) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const ot = owner_type || 'individual';
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
  audit({ entity: 'auth', entityId: result.lastInsertRowid, action: 'register', userId: result.lastInsertRowid, userName: name, details: `New owner registered: ${email}`, type: 'info' });
  res.status(201).json({ user });
});

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), (req, res) => {
  const { email, password } = req.validated;

  // Check account lockout
  if (isAccountLocked(email)) {
    return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 30 minutes.' });
  }

  const row = db.prepare(`
    SELECT u.id, u.email, u.name, u.password_hash, u.is_active, u.owner_type, u.created_by,
           r.name as role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.email = ?
  `).get(email);

  if (!row) {
    logLoginAttempt(email, req, false);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!row.is_active) {
    logLoginAttempt(email, req, false);
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) {
    logLoginAttempt(email, req, false);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Log successful attempt
  logLoginAttempt(email, req, true);

  audit({ entity: 'auth', entityId: row.id, action: 'login', userId: row.id, userName: row.name, details: `Login from ${req.ip}`, type: 'info' });

  // Session regeneration to prevent session fixation
  req.session.regenerate(function (err) {
    if (err) {
      // Fallback if regenerate not supported: set userId on current session
      req.session.userId = row.id;
    } else {
      req.session.userId = row.id;
    }
    const { password_hash, is_active, ...user } = row;
    res.json({ user });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const logoutUserId = req.session.userId;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    audit({ entity: 'auth', entityId: logoutUserId || 0, action: 'logout', type: 'info' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  // Return CSRF token with user data
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ user: req.user, csrfToken: req.session.csrfToken });
});

// PATCH /api/auth/profile — update own profile (name, phone)
router.patch('/profile', requireAuth, validate(profileUpdateSchema), (req, res) => {
  const { name, phone } = req.validated;

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      phone = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name || null, phone !== undefined ? phone : null, req.user.id);

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.phone, u.owner_type, u.created_by, u.created_at,
           r.name as role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(req.user.id);

  audit({ entity: 'auth', entityId: req.user.id, action: 'profile_updated', userId: req.user.id, userName: updated.name, details: JSON.stringify({ name, phone }), type: 'info' });
  res.json({ user: updated });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, validate(passwordChangeSchema), (req, res) => {
  const { current_password, new_password } = req.validated;

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!row) {
    return res.status(404).json({ error: 'User not found' });
  }

  const valid = bcrypt.compareSync(current_password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = bcrypt.hashSync(new_password, SALT_ROUNDS);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, req.user.id);
  audit({ entity: 'auth', entityId: req.user.id, action: 'password_change', userId: req.user.id, userName: req.user.name, type: 'info' });

  res.json({ message: 'Password changed successfully' });
});

// GET /api/auth/users — list users for assignment dropdowns
router.get('/users', requireAuth, (req, res) => {
  const { project_id } = req.query;

  let users;
  if (project_id) {
    users = db.prepare(`
      SELECT u.id, u.name, pm.role, r.display_name as roleDisplayName
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE pm.project_id = ? AND u.is_active = 1
      ORDER BY u.name
    `).all(project_id);

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
    users = db.prepare(`
      SELECT u.id, u.name, r.name as role, r.display_name as roleDisplayName
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE (u.created_by = ? OR u.id = ?) AND u.is_active = 1
      ORDER BY u.name
    `).all(req.user.id, req.user.id);
  } else {
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
router.post('/team', requireAuth, requireRole('owner'), validate(teamMemberSchema), (req, res) => {
  const { email, password, name, role } = req.validated;

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

  audit({ entity: 'auth', entityId: result.lastInsertRowid, action: 'team_member_created', userId: req.user.id, userName: req.user.name, details: `Created ${role}: ${name} (${email})`, type: 'info' });
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

  audit({ entity: 'auth', entityId: member.id, action: 'team_member_updated', userId: req.user.id, userName: req.user.name, details: JSON.stringify({ name, email, is_active, role }), type: 'info' });
  res.json(updated);
});

// POST /api/auth/forgot-password — request password reset
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ? AND is_active = 1').get(email);
  // Always return success to prevent email enumeration
  if (!user) return res.json({ message: 'If this email exists, a reset link has been sent.' });

  // Invalidate previous tokens
  db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").run(user.id);

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

  // In production, send email. For dev/demo, log to console.
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  console.log(`\n🔑 Password reset link for ${user.email}:\n   ${resetUrl}\n`);

  audit({ entity: 'auth', entityId: user.id, action: 'password_reset_requested', details: `Reset requested for ${email}`, type: 'info' });
  res.json({ message: 'If this email exists, a reset link has been sent.' });
});

// POST /api/auth/reset-password — reset password with token
router.post('/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new_password are required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const resetToken = db.prepare("SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')").get(token);
  if (!resetToken) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const newHash = bcrypt.hashSync(new_password, SALT_ROUNDS);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, resetToken.user_id);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

  audit({ entity: 'auth', entityId: resetToken.user_id, action: 'password_reset_completed', type: 'info' });
  res.json({ message: 'Password has been reset successfully. You can now log in.' });
});

export default router;
