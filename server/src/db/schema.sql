CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  owner_type TEXT,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  plot_size TEXT,
  start_date TEXT,
  planned_end TEXT,
  status TEXT DEFAULT 'active',
  total_budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  completion INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  added_by INTEGER,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (added_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  completion INTEGER DEFAULT 0,
  budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS substages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  substage_order INTEGER NOT NULL,
  completion INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (stage_id) REFERENCES stages(id)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  substage_id INTEGER NOT NULL,
  item_order INTEGER NOT NULL,
  description TEXT NOT NULL,
  standard_ref TEXT,
  is_mandatory INTEGER DEFAULT 0,
  is_checked INTEGER DEFAULT 0,
  checked_by INTEGER,
  checked_at TEXT,
  FOREIGN KEY (substage_id) REFERENCES substages(id),
  FOREIGN KEY (checked_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  name TEXT NOT NULL,
  type TEXT,
  rating REAL DEFAULT 0,
  status TEXT DEFAULT 'Active',
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS material_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT NOT NULL UNIQUE,
  material TEXT NOT NULL,
  quantity TEXT NOT NULL,
  stage_id INTEGER,
  status TEXT DEFAULT 'Draft',
  requested_date TEXT,
  requested_by INTEGER,
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  log_date TEXT NOT NULL,
  weather TEXT,
  work_description TEXT,
  labor_count INTEGER DEFAULT 0,
  issues TEXT,
  logged_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (logged_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  type TEXT DEFAULT 'General',
  category TEXT DEFAULT 'hold_point',
  inspection_date TEXT,
  inspector_id INTEGER,
  status TEXT DEFAULT 'Scheduled',
  result TEXT,
  defect_count INTEGER DEFAULT 0,
  notes TEXT,
  location TEXT,
  standard_ref TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (inspector_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS defects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  defect_code TEXT NOT NULL UNIQUE,
  inspection_id INTEGER,
  project_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',
  category TEXT DEFAULT 'Workmanship',
  location TEXT,
  assigned_to TEXT,
  resolution_notes TEXT,
  resolved_by INTEGER,
  resolved_at TEXT,
  due_date TEXT,
  task_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (inspection_id) REFERENCES inspections(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount REAL DEFAULT 0,
  stage_id INTEGER,
  status TEXT DEFAULT 'Draft',
  created_by INTEGER,
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_code TEXT NOT NULL UNIQUE,
  vendor_id INTEGER,
  stage_id INTEGER,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  payment_date TEXT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  material TEXT NOT NULL,
  unit TEXT NOT NULL,
  total_inward REAL DEFAULT 0,
  consumed REAL DEFAULT 0,
  stock REAL DEFAULT 0,
  wastage_percent REAL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  timestamp TEXT DEFAULT (datetime('now')),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  action TEXT NOT NULL,
  user_id INTEGER,
  user_display TEXT,
  details TEXT,
  type TEXT DEFAULT 'info',
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sp62_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY (stage_id) REFERENCES stages(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_code TEXT NOT NULL UNIQUE,
  stage_id INTEGER NOT NULL,
  parent_task_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER,
  status TEXT DEFAULT 'not_started',
  priority TEXT DEFAULT 'medium',
  start_date TEXT,
  due_date TEXT,
  is_default INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  uploaded_by INTEGER NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS task_inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  inspection_id INTEGER NOT NULL,
  link_type TEXT DEFAULT 'related',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(task_id, inspection_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS estimator_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value_json TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(category, item_key)
);

CREATE TABLE IF NOT EXISTS ncrs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ncr_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  task_id INTEGER,
  inspection_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'Major',
  category TEXT DEFAULT 'Workmanship',
  root_cause TEXT,
  root_cause_method TEXT,
  disposition TEXT,
  corrective_action TEXT,
  verification_notes TEXT,
  location TEXT,
  is_code_ref TEXT,
  status TEXT DEFAULT 'Identified',
  raised_by INTEGER,
  assigned_to INTEGER,
  closed_by INTEGER,
  closed_at TEXT,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (inspection_id) REFERENCES inspections(id),
  FOREIGN KEY (raised_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (closed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rfis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rfi_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  task_id INTEGER,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  drawing_ref TEXT,
  spec_ref TEXT,
  location TEXT,
  response TEXT,
  response_by INTEGER,
  response_date TEXT,
  cost_impact TEXT,
  schedule_impact TEXT,
  status TEXT DEFAULT 'Draft',
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  raised_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (response_by) REFERENCES users(id),
  FOREIGN KEY (raised_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS state_machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  entity TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  states_json TEXT NOT NULL,
  current_state TEXT NOT NULL,
  transitions_json TEXT NOT NULL,
  rules_json TEXT,
  blocking_json TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  parent_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  triggered_by INTEGER,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (triggered_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_expenses_stage ON expenses(stage_id);
CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_ncrs_project ON ncrs(project_id);
CREATE INDEX IF NOT EXISTS idx_rfis_project ON rfis(project_id);

CREATE TABLE IF NOT EXISTS change_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  co_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  type TEXT DEFAULT 'scope_change',
  cost_impact REAL DEFAULT 0,
  schedule_impact_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  requested_by INTEGER,
  approved_by INTEGER,
  approved_at TEXT,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS safety_permits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permit_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  permit_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  risk_level TEXT DEFAULT 'medium',
  precautions TEXT,
  valid_from TEXT,
  valid_to TEXT,
  status TEXT DEFAULT 'Draft',
  requested_by INTEGER,
  approved_by INTEGER,
  approved_at TEXT,
  closed_by INTEGER,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (closed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS safety_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  incident_type TEXT NOT NULL,
  severity TEXT DEFAULT 'minor',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  incident_date TEXT,
  incident_time TEXT,
  persons_involved TEXT,
  injuries TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  status TEXT DEFAULT 'Reported',
  reported_by INTEGER,
  investigated_by INTEGER,
  closed_by INTEGER,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (reported_by) REFERENCES users(id),
  FOREIGN KEY (investigated_by) REFERENCES users(id),
  FOREIGN KEY (closed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ra_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  vendor_id INTEGER,
  bill_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  period_from TEXT,
  period_to TEXT,
  gross_amount REAL DEFAULT 0,
  previous_amount REAL DEFAULT 0,
  current_amount REAL DEFAULT 0,
  retention_percent REAL DEFAULT 5,
  retention_amount REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  net_payable REAL DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  prepared_by INTEGER,
  verified_by INTEGER,
  approved_by INTEGER,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  doc_type TEXT DEFAULT 'drawing',
  revision TEXT DEFAULT 'R0',
  revision_date TEXT,
  description TEXT,
  file_name TEXT,
  original_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT DEFAULT 'Draft',
  uploaded_by INTEGER,
  reviewed_by INTEGER,
  approved_by INTEGER,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS submittals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submittal_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  title TEXT NOT NULL,
  spec_section TEXT,
  submittal_type TEXT DEFAULT 'shop_drawing',
  description TEXT,
  vendor_id INTEGER,
  revision TEXT DEFAULT 'R0',
  revision_date TEXT,
  due_date TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'Draft',
  submitted_by INTEGER,
  reviewer_id INTEGER,
  reviewed_at TEXT,
  review_notes TEXT,
  approved_by INTEGER,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_code TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'progress',
  meeting_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  attendees TEXT,
  agenda TEXT,
  minutes TEXT,
  decisions TEXT,
  status TEXT DEFAULT 'Scheduled',
  organized_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (organized_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  assigned_to INTEGER,
  due_date TEXT,
  status TEXT DEFAULT 'open',
  completed_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_permits_project ON safety_permits(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_project ON safety_incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_ra_bills_project ON ra_bills(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_submittals_project ON submittals(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON meeting_action_items(meeting_id);
