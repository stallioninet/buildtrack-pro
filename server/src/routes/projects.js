import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, requireRole, getUserProjectIds } from '../middleware/auth.js';
import DEFAULT_STAGE_TASKS from '../config/defaultTasks.js';

const router = Router();

// GET /api/projects - List projects the user has access to
router.get('/', requireAuth, (req, res) => {
  let projects;
  if (req.user.role === 'owner') {
    projects = db.prepare('SELECT * FROM projects WHERE created_by = ? ORDER BY id DESC').all(req.user.id);
  } else {
    // Non-owner: see projects they're members of
    projects = db.prepare(`
      SELECT p.*, pm.role as member_role FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.id DESC
    `).all(req.user.id);
  }

  // Add stage counts for each project
  const stageCountStmt = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active FROM stages WHERE project_id = ?");
  const memberCountStmt = db.prepare('SELECT COUNT(*) as c FROM project_members WHERE project_id = ?');
  for (const p of projects) {
    const counts = stageCountStmt.get(p.id);
    p.totalStages = counts?.total || 0;
    p.activeStages = counts?.active || 0;
    p.memberCount = memberCountStmt.get(p.id)?.c || 0;
  }

  res.json(projects);
});

// GET /api/projects/:id - Get a single project with summary
router.get('/:id', requireAuth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check access
  if (req.user.role === 'owner') {
    if (project.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  } else {
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(project.id, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json(project);
});

// POST /api/projects - Create a new project (owner only)
router.post('/', requireAuth, requireRole('owner'), (req, res) => {
  const { name, location, plot_size, start_date, planned_end, total_budget } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const result = db.prepare(
    'INSERT INTO projects (name, location, plot_size, start_date, planned_end, status, total_budget, spent, completion, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)'
  ).run(name, location || null, plot_size || null, start_date || null, planned_end || null, 'active', total_budget || 0, req.user.id);

  // Create default stages for the new project
  const defaultStages = [
    'Planning & Design', 'Approvals & Permits', 'Foundation', 'Structure',
    'Brickwork', 'Roofing', 'Electrical & Plumbing', 'Plastering',
    'Flooring', 'Finishing', 'Handover'
  ];

  const projectId = result.lastInsertRowid;
  const insertStage = db.prepare('INSERT INTO stages (project_id, name, stage_order, status) VALUES (?, ?, ?, ?)');
  const insertTask = db.prepare('INSERT INTO tasks (task_code, stage_id, parent_task_id, title, status, priority, is_default, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?)');

  // Get current max task code number
  const lastTask = db.prepare("SELECT task_code FROM tasks ORDER BY id DESC LIMIT 1").get();
  let taskNum = 1;
  if (lastTask) {
    const match = lastTask.task_code.match(/T-(\d+)/);
    if (match) taskNum = parseInt(match[1]) + 1;
  }

  for (let i = 0; i < defaultStages.length; i++) {
    const stageResult = insertStage.run(projectId, defaultStages[i], i + 1, 'pending');
    const stageId = stageResult.lastInsertRowid;

    // Create default tasks and subtasks for this stage
    const stageTasks = DEFAULT_STAGE_TASKS[defaultStages[i]] || [];
    for (const taskDef of stageTasks) {
      const taskCode = `T-${String(taskNum++).padStart(3, '0')}`;
      const taskResult = insertTask.run(taskCode, stageId, null, taskDef.title, 'new', taskDef.priority || 'medium', req.user.id);
      const parentTaskId = taskResult.lastInsertRowid;

      // Create subtasks
      if (taskDef.subtasks) {
        for (const subTitle of taskDef.subtasks) {
          const subCode = `T-${String(taskNum++).padStart(3, '0')}`;
          insertTask.run(subCode, stageId, parentTaskId, subTitle, 'new', taskDef.priority || 'medium', req.user.id);
        }
      }
    }
  }

  const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json(created);
});

// PATCH /api/projects/:id - Update a project (owner only)
router.patch('/:id', requireAuth, requireRole('owner'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, location, plot_size, start_date, planned_end, status, total_budget } = req.body;

  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      location = COALESCE(?, location),
      plot_size = COALESCE(?, plot_size),
      start_date = COALESCE(?, start_date),
      planned_end = COALESCE(?, planned_end),
      status = COALESCE(?, status),
      total_budget = COALESCE(?, total_budget)
    WHERE id = ?
  `).run(
    name || null, location || null, plot_size || null,
    start_date || null, planned_end || null, status || null,
    total_budget !== undefined ? total_budget : null, project.id
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
  res.json(updated);
});

// DELETE /api/projects/:id - Delete a project (owner only)
router.delete('/:id', requireAuth, requireRole('owner'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Delete associated data in order (cascading)
  const stageIds = db.prepare('SELECT id FROM stages WHERE project_id = ?').all(project.id).map(s => s.id);

  if (stageIds.length > 0) {
    const ph = stageIds.map(() => '?').join(',');
    const substageIds = db.prepare(`SELECT id FROM substages WHERE stage_id IN (${ph})`).all(...stageIds).map(s => s.id);

    if (substageIds.length > 0) {
      const ph2 = substageIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM checklist_items WHERE substage_id IN (${ph2})`).run(...substageIds);
      db.prepare(`DELETE FROM substages WHERE id IN (${ph2})`).run(...substageIds);
    }

    db.prepare(`DELETE FROM tasks WHERE stage_id IN (${ph})`).run(...stageIds);
    db.prepare(`DELETE FROM inspections WHERE stage_id IN (${ph})`).run(...stageIds);
    db.prepare(`DELETE FROM material_requests WHERE stage_id IN (${ph})`).run(...stageIds);
    db.prepare(`DELETE FROM expenses WHERE stage_id IN (${ph})`).run(...stageIds);
    db.prepare(`DELETE FROM payments WHERE stage_id IN (${ph})`).run(...stageIds);
    db.prepare(`DELETE FROM sp62_chapters WHERE stage_id IN (${ph})`).run(...stageIds);
    db.prepare(`DELETE FROM stages WHERE project_id = ?`).run(project.id);
  }

  db.prepare('DELETE FROM daily_logs WHERE project_id = ?').run(project.id);
  db.prepare('DELETE FROM vendors WHERE project_id = ?').run(project.id);
  db.prepare('DELETE FROM inventory WHERE project_id = ?').run(project.id);
  db.prepare('DELETE FROM audit_log WHERE project_id = ?').run(project.id);
  db.prepare('DELETE FROM project_members WHERE project_id = ?').run(project.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);

  res.json({ success: true });
});

// ===== PROJECT MEMBER MANAGEMENT =====

// GET /api/projects/:id/members — list project members
router.get('/:id/members', requireAuth, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const members = db.prepare(`
    SELECT pm.id as membership_id, pm.role as project_role, pm.added_at,
           u.id, u.email, u.name, u.is_active,
           r.name as global_role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    WHERE pm.project_id = ?
    ORDER BY u.name
  `).all(project.id);

  // Include the owner in the list
  const owner = db.prepare(`
    SELECT u.id, u.email, u.name, u.owner_type,
           r.name as global_role, r.display_name as roleDisplayName, r.avatar_code as avatarCode
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(project.created_by);

  res.json({ owner, members });
});

// POST /api/projects/:id/members — add a user to a project (owner only)
router.post('/:id/members', requireAuth, requireRole('owner'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found or access denied' });

  const { user_id, role } = req.body;
  if (!user_id || !role) {
    return res.status(400).json({ error: 'user_id and role are required' });
  }

  // Verify the user exists and was created by this owner (or is a valid user)
  const targetUser = db.prepare('SELECT id, created_by FROM users WHERE id = ? AND is_active = 1').get(user_id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if already a member
  const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(project.id, user_id);
  if (existing) {
    return res.status(409).json({ error: 'User is already a member of this project' });
  }

  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role, added_by) VALUES (?, ?, ?, ?)'
  ).run(project.id, user_id, role, req.user.id);

  res.status(201).json({ success: true });
});

// PATCH /api/projects/:id/members/:userId — update member role
router.patch('/:id/members/:userId', requireAuth, requireRole('owner'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role is required' });

  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?')
    .run(role, project.id, req.params.userId);

  res.json({ success: true });
});

// DELETE /api/projects/:id/members/:userId — remove member from project
router.delete('/:id/members/:userId', requireAuth, requireRole('owner'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND created_by = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
    .run(project.id, req.params.userId);

  res.json({ success: true });
});

export default router;
