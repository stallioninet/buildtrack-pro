import { Router } from 'express';
import db from '../config/db.js';
import { requireAuth, getUserProjectIds } from '../middleware/auth.js';
import { rebuildSearchIndex } from '../services/searchIndex.js';

const router = Router();

// Check if FTS table exists and has data; if not, rebuild
let ftsReady = false;
try {
  const count = db.prepare("SELECT COUNT(*) as c FROM fts_search").get();
  ftsReady = count.c > 0;
} catch (e) {
  ftsReady = false;
}

if (!ftsReady) {
  try {
    // Create FTS table if it doesn't exist
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS fts_search USING fts5(
      entity_type, entity_id UNINDEXED, project_id UNINDEXED,
      code, title, description, path UNINDEXED,
      content='', tokenize='unicode61'
    )`);
    rebuildSearchIndex();
    ftsReady = true;
  } catch (e) {
    console.error('FTS5 initialization failed, falling back to LIKE queries:', e.message);
  }
}

router.get('/', requireAuth, (req, res) => {
  const { q, project_id } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  const projectIds = project_id ? [project_id] : getUserProjectIds(req.user.id, req.user.role);
  if (projectIds.length === 0) return res.json([]);

  if (ftsReady) {
    return ftsSearch(req, res, q.trim(), projectIds);
  }
  return fallbackSearch(req, res, q.trim(), projectIds);
});

function ftsSearch(req, res, query, projectIds) {
  const ph = projectIds.map(() => '?').join(',');
  // FTS5 match query - escape special chars and add wildcard
  const ftsQuery = query.replace(/['"*()]/g, '').split(/\s+/).map(w => `"${w}"*`).join(' ');

  try {
    const results = db.prepare(`
      SELECT entity_type, entity_id, code, title, description, path,
             rank
      FROM fts_search
      WHERE fts_search MATCH ? AND project_id IN (${ph})
      ORDER BY rank
      LIMIT 50
    `).all(ftsQuery, ...projectIds);

    // Also include vendor results where project_id might be 0
    const vendorResults = db.prepare(`
      SELECT entity_type, entity_id, code, title, description, path, rank
      FROM fts_search
      WHERE fts_search MATCH ? AND entity_type = 'vendor' AND project_id = 0
      ORDER BY rank
      LIMIT 10
    `).all(ftsQuery);

    const combined = [...results, ...vendorResults].slice(0, 50).map(r => ({
      code: r.code,
      title: r.title,
      status: '',
      entity_type: r.entity_type,
      path: r.path,
    }));

    res.json(combined);
  } catch (e) {
    // If FTS query fails (bad syntax), fall back to LIKE
    return fallbackSearch(req, res, query, projectIds);
  }
}

function fallbackSearch(req, res, query, projectIds) {
  const ph = projectIds.map(() => '?').join(',');
  const term = `%${query}%`;
  const limit = 10;
  const results = [];

  // Tasks
  const tasks = db.prepare(`SELECT t.task_code as code, t.title, t.status, 'task' as entity_type, '/tasks' as path FROM tasks t
    JOIN stages s ON t.stage_id = s.id WHERE s.project_id IN (${ph}) AND (t.title LIKE ? OR t.task_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  results.push(...tasks);

  // NCRs
  const ncrs = db.prepare(`SELECT ncr_code as code, title, status, 'ncr' as entity_type, '/ncrs' as path FROM ncrs
    WHERE project_id IN (${ph}) AND (title LIKE ? OR ncr_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  results.push(...ncrs);

  // RFIs
  const rfis = db.prepare(`SELECT rfi_code as code, subject as title, status, 'rfi' as entity_type, '/rfis' as path FROM rfis
    WHERE project_id IN (${ph}) AND (subject LIKE ? OR rfi_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  results.push(...rfis);

  // Documents
  const docs = db.prepare(`SELECT doc_code as code, title, status, 'document' as entity_type, '/documents' as path FROM documents
    WHERE project_id IN (${ph}) AND (title LIKE ? OR doc_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  results.push(...docs);

  // Vendors
  const vendors = db.prepare(`SELECT '' as code, name as title, status, 'vendor' as entity_type, '/vendors' as path FROM vendors
    WHERE (project_id IN (${ph}) OR project_id IS NULL) AND name LIKE ? LIMIT ?`)
    .all(...projectIds, term, limit);
  results.push(...vendors);

  // Submittals
  const subs = db.prepare(`SELECT submittal_code as code, title, status, 'submittal' as entity_type, '/submittals' as path FROM submittals
    WHERE project_id IN (${ph}) AND (title LIKE ? OR submittal_code LIKE ?) LIMIT ?`)
    .all(...projectIds, term, term, limit);
  results.push(...subs);

  res.json(results.slice(0, 50));
}

// POST /api/search/reindex — admin endpoint to rebuild FTS index
router.post('/reindex', requireAuth, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  try {
    rebuildSearchIndex();
    ftsReady = true;
    res.json({ message: 'Search index rebuilt' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to rebuild index: ' + e.message });
  }
});

export default router;
