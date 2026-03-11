import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { q, project_id } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);
  const ph = projectIds.map(() => '?').join(',');
  const term = `%${q.trim()}%`;
  const limit = 25;
  const results = [];

  // Tasks
  const tasks = db.prepare(`SELECT t.task_code as code, t.title, t.status, 'task' as entity_type, t.stage_id FROM tasks t
    JOIN stages s ON t.stage_id = s.id WHERE s.project_id IN (${ph}) AND (t.title LIKE ? OR t.task_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  for (const t of tasks) results.push({ ...t, path: '/tasks' });

  // Stages
  const stages = db.prepare(`SELECT name as title, status, 'stage' as entity_type, id FROM stages
    WHERE project_id IN (${ph}) AND name LIKE ? LIMIT ?`)
    .all(...projectIds, term, limit);
  for (const s of stages) results.push({ code: `Stage #${s.id}`, title: s.title, status: s.status, entity_type: 'stage', path: `/stages/${s.id}` });

  // NCRs
  const ncrs = db.prepare(`SELECT ncr_code as code, title, status, 'ncr' as entity_type FROM ncrs
    WHERE project_id IN (${ph}) AND (title LIKE ? OR ncr_code LIKE ? OR description LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, term, limit);
  for (const n of ncrs) results.push({ ...n, path: '/ncrs' });

  // RFIs
  const rfis = db.prepare(`SELECT rfi_code as code, subject as title, status, 'rfi' as entity_type FROM rfis
    WHERE project_id IN (${ph}) AND (subject LIKE ? OR rfi_code LIKE ? OR question LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, term, limit);
  for (const r of rfis) results.push({ ...r, path: '/rfis' });

  // Change Orders
  const cos = db.prepare(`SELECT co_code as code, title, status, 'change_order' as entity_type FROM change_orders
    WHERE project_id IN (${ph}) AND (title LIKE ? OR co_code LIKE ? OR description LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, term, limit);
  for (const c of cos) results.push({ ...c, path: '/change-orders' });

  // Safety Permits
  const permits = db.prepare(`SELECT permit_code as code, title, status, 'permit' as entity_type FROM safety_permits
    WHERE project_id IN (${ph}) AND (title LIKE ? OR permit_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  for (const p of permits) results.push({ ...p, path: '/safety' });

  // Safety Incidents
  const incidents = db.prepare(`SELECT incident_code as code, title, status, 'incident' as entity_type FROM safety_incidents
    WHERE project_id IN (${ph}) AND (title LIKE ? OR incident_code LIKE ? OR description LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, term, limit);
  for (const i of incidents) results.push({ ...i, path: '/safety' });

  // RA Bills
  const bills = db.prepare(`SELECT bill_code as code, title, status, 'ra_bill' as entity_type FROM ra_bills
    WHERE project_id IN (${ph}) AND (title LIKE ? OR bill_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  for (const b of bills) results.push({ ...b, path: '/ra-bills' });

  // Documents
  const docs = db.prepare(`SELECT doc_code as code, title, status, 'document' as entity_type FROM documents
    WHERE project_id IN (${ph}) AND (title LIKE ? OR doc_code LIKE ? OR description LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, term, limit);
  for (const d of docs) results.push({ ...d, path: '/documents' });

  // Submittals
  const subs = db.prepare(`SELECT submittal_code as code, title, status, 'submittal' as entity_type FROM submittals
    WHERE project_id IN (${ph}) AND (title LIKE ? OR submittal_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  for (const s of subs) results.push({ ...s, path: '/submittals' });

  // Meetings
  const meetings = db.prepare(`SELECT meeting_code as code, title, status, 'meeting' as entity_type FROM meetings
    WHERE project_id IN (${ph}) AND (title LIKE ? OR meeting_code LIKE ? OR minutes LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, term, limit);
  for (const m of meetings) results.push({ ...m, path: '/meetings' });

  // Vendors
  const vendors = db.prepare(`SELECT name as title, status, 'vendor' as entity_type, id FROM vendors
    WHERE (project_id IN (${ph}) OR project_id IS NULL) AND name LIKE ? LIMIT ?`)
    .all(...projectIds, term, limit);
  for (const v of vendors) results.push({ code: '', title: v.title, status: v.status, entity_type: 'vendor', path: '/vendors' });

  // Expenses
  const expenses = db.prepare(`SELECT e.description as title, e.status, e.category, 'expense' as entity_type FROM expenses e
    LEFT JOIN stages s ON e.stage_id = s.id WHERE (s.project_id IN (${ph}) OR e.stage_id IS NULL) AND (e.description LIKE ? OR e.category LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  for (const e of expenses) results.push({ code: e.category, title: e.title || e.category, status: e.status, entity_type: 'expense', path: '/expenses' });

  // Defects
  const defects = db.prepare(`SELECT defect_code as code, defects.description as title, defects.status, 'defect' as entity_type FROM defects
    WHERE project_id IN (${ph}) AND (defects.description LIKE ? OR defect_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  for (const d of defects) results.push({ ...d, path: '/defects' });

  // Sort: prefer code matches first, then title matches
  const lowerQ = q.trim().toLowerCase();
  results.sort((a, b) => {
    const aCode = (a.code || '').toLowerCase().includes(lowerQ) ? 0 : 1;
    const bCode = (b.code || '').toLowerCase().includes(lowerQ) ? 0 : 1;
    return aCode - bCode;
  });

  res.json(results.slice(0, 50));
});

export default router;
