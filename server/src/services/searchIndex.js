import db from '../config/db.js';

// Rebuild the entire FTS index
export function rebuildSearchIndex() {
  // Clear existing
  db.exec("DELETE FROM fts_search");

  const insert = db.prepare("INSERT INTO fts_search (entity_type, entity_id, project_id, code, title, description, path) VALUES (?, ?, ?, ?, ?, ?, ?)");

  const insertMany = db.transaction(() => {
    // Tasks
    const tasks = db.prepare("SELECT t.id, t.task_code, t.title, t.description, s.project_id FROM tasks t JOIN stages s ON t.stage_id = s.id").all();
    for (const r of tasks) insert.run('task', r.id, r.project_id, r.task_code, r.title, r.description || '', '/tasks');

    // Stages
    const stages = db.prepare("SELECT id, name, description, project_id FROM stages").all();
    for (const r of stages) insert.run('stage', r.id, r.project_id, 'Stage #' + r.id, r.name, r.description || '', '/stages/' + r.id);

    // NCRs
    const ncrs = db.prepare("SELECT id, ncr_code, title, description, project_id FROM ncrs").all();
    for (const r of ncrs) insert.run('ncr', r.id, r.project_id, r.ncr_code, r.title, r.description || '', '/ncrs');

    // RFIs
    const rfis = db.prepare("SELECT id, rfi_code, subject, question, project_id FROM rfis").all();
    for (const r of rfis) insert.run('rfi', r.id, r.project_id, r.rfi_code, r.subject, r.question || '', '/rfis');

    // Change Orders
    const cos = db.prepare("SELECT id, co_code, title, description, project_id FROM change_orders").all();
    for (const r of cos) insert.run('change_order', r.id, r.project_id, r.co_code, r.title, r.description || '', '/change-orders');

    // Safety Permits
    const permits = db.prepare("SELECT id, permit_code, title, description, project_id FROM safety_permits").all();
    for (const r of permits) insert.run('permit', r.id, r.project_id, r.permit_code, r.title, r.description || '', '/safety');

    // Safety Incidents
    const incidents = db.prepare("SELECT id, incident_code, title, description, project_id FROM safety_incidents").all();
    for (const r of incidents) insert.run('incident', r.id, r.project_id, r.incident_code, r.title, r.description || '', '/safety');

    // RA Bills
    const bills = db.prepare("SELECT id, bill_code, title, description, project_id FROM ra_bills").all();
    for (const r of bills) insert.run('ra_bill', r.id, r.project_id, r.bill_code, r.title, r.description || '', '/ra-bills');

    // Documents
    const docs = db.prepare("SELECT id, doc_code, title, description, project_id FROM documents").all();
    for (const r of docs) insert.run('document', r.id, r.project_id, r.doc_code, r.title, r.description || '', '/documents');

    // Submittals
    const subs = db.prepare("SELECT id, submittal_code, title, description, project_id FROM submittals").all();
    for (const r of subs) insert.run('submittal', r.id, r.project_id, r.submittal_code, r.title, r.description || '', '/submittals');

    // Meetings
    const meetings = db.prepare("SELECT id, meeting_code, title, minutes, project_id FROM meetings").all();
    for (const r of meetings) insert.run('meeting', r.id, r.project_id, r.meeting_code, r.title, r.minutes || '', '/meetings');

    // Vendors
    const vendors = db.prepare("SELECT id, name, type, project_id FROM vendors").all();
    for (const r of vendors) insert.run('vendor', r.id, r.project_id || 0, '', r.name, r.type || '', '/vendors');

    // Defects
    const defects = db.prepare("SELECT id, defect_code, description, project_id FROM defects").all();
    for (const r of defects) insert.run('defect', r.id, r.project_id, r.defect_code, r.description, '', '/defects');
  });

  insertMany();
}

// Index a single entity (for real-time updates)
export function indexEntity(entityType, entityId, projectId, code, title, description, path) {
  // Remove old entry
  db.prepare("DELETE FROM fts_search WHERE entity_type = ? AND entity_id = ?").run(entityType, entityId);
  // Insert new
  db.prepare("INSERT INTO fts_search (entity_type, entity_id, project_id, code, title, description, path) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(entityType, entityId, projectId, code, title, description || '', path);
}

// Remove an entity from the index
export function removeFromIndex(entityType, entityId) {
  db.prepare("DELETE FROM fts_search WHERE entity_type = ? AND entity_id = ?").run(entityType, entityId);
}
