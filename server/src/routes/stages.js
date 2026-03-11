import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { project_id } = req.query;

  if (project_id) {
    const stages = db.prepare('SELECT * FROM stages WHERE project_id = ? ORDER BY stage_order').all(project_id);
    return res.json(stages);
  }

  // Return stages for all projects the user has access to
  const projectIds = getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);

  const ph = projectIds.map(() => '?').join(',');
  const stages = db.prepare(`SELECT * FROM stages WHERE project_id IN (${ph}) ORDER BY project_id, stage_order`).all(...projectIds);
  res.json(stages);
});

router.get('/:id', requireAuth, (req, res) => {
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'Stage not found' });

  const substages = db.prepare('SELECT * FROM substages WHERE stage_id = ? ORDER BY substage_order').all(stage.id);

  // Get checklist items for each substage
  for (const sub of substages) {
    sub.checklistItems = db.prepare(
      'SELECT * FROM checklist_items WHERE substage_id = ? ORDER BY item_order'
    ).all(sub.id);
  }

  // Get SP62 chapters for this stage
  const sp62Chapters = db.prepare('SELECT * FROM sp62_chapters WHERE stage_id = ? ORDER BY chapter_number').all(stage.id);

  // Get tasks for this stage (hierarchical)
  const allTasks = db.prepare(`
    SELECT t.*, a.name as assigned_to_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN users a ON t.assigned_to = a.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.stage_id = ?
    ORDER BY t.id ASC
  `).all(stage.id);

  // Add attachment counts
  const attCountStmt = db.prepare('SELECT COUNT(*) as c FROM task_attachments WHERE task_id = ?');
  for (const t of allTasks) {
    t.attachment_count = attCountStmt.get(t.id)?.c || 0;
  }

  // Build hierarchy
  const parentTasks = allTasks.filter(t => !t.parent_task_id);
  const subtaskMap = {};
  for (const t of allTasks) {
    if (t.parent_task_id) {
      if (!subtaskMap[t.parent_task_id]) subtaskMap[t.parent_task_id] = [];
      subtaskMap[t.parent_task_id].push(t);
    }
  }
  for (const p of parentTasks) {
    p.subtasks = subtaskMap[p.id] || [];
  }

  res.json({ ...stage, substages, sp62Chapters, tasks: parentTasks });
});

// Toggle checklist item
router.patch('/checklist/:itemId', requireAuth, (req, res) => {
  const { is_checked } = req.body;
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Checklist item not found' });

  db.prepare(`
    UPDATE checklist_items SET is_checked = ?, checked_by = ?, checked_at = datetime('now')
    WHERE id = ?
  `).run(is_checked ? 1 : 0, req.user.id, item.id);

  // Recalculate substage completion
  const substage = db.prepare('SELECT * FROM substages WHERE id = ?').get(item.substage_id);
  const total = db.prepare('SELECT COUNT(*) as c FROM checklist_items WHERE substage_id = ?').get(substage.id).c;
  const checked = db.prepare('SELECT COUNT(*) as c FROM checklist_items WHERE substage_id = ? AND is_checked = 1').get(substage.id).c;
  const completion = total > 0 ? Math.round((checked / total) * 100) : 0;
  db.prepare('UPDATE substages SET completion = ?, status = ? WHERE id = ?').run(
    completion,
    completion === 100 ? 'completed' : completion > 0 ? 'in_progress' : 'pending',
    substage.id
  );

  // Recalculate stage completion
  const stageSubstages = db.prepare('SELECT completion FROM substages WHERE stage_id = ?').all(substage.stage_id);
  const stageCompletion = stageSubstages.length > 0
    ? Math.round(stageSubstages.reduce((s, r) => s + r.completion, 0) / stageSubstages.length)
    : 0;
  db.prepare('UPDATE stages SET completion = ? WHERE id = ?').run(stageCompletion, substage.stage_id);

  res.json({ success: true, completion, stageCompletion });
});

export default router;
