// ============================================================================
// Centralized constants for BuildTrack Pro
// All status colors, priority colors, severity colors, and common arrays
// ============================================================================

// --- Priority colors (used by Tasks, RFIs, Submittals, StageDetail, Quality) ---

// Standard priority colors (no border) — used by TasksPage, StageDetailPage
export const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-600',
};

// Priority colors with border — used by RFIsPage, SubmittalsPage
export const PRIORITY_COLORS_BORDERED = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

// Priority colors (subtle) — used inside QualityPage inspection-task linker
export const PRIORITY_COLORS_SUBTLE = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-yellow-50 text-yellow-600',
  low: 'bg-slate-50 text-slate-500',
};

// --- Severity colors ---

// NCR severity (with border)
export const NCR_SEVERITY_COLORS = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  Major: 'bg-orange-100 text-orange-700 border-orange-200',
  Minor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

// Defect / Inspection severity — used by QualityPage, DefectsPage, InspectorDashboard
export const DEFECT_SEVERITY_COLORS = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-slate-100 text-slate-600',
};

// Safety incident severity (with border)
export const INCIDENT_SEVERITY_COLORS = {
  minor: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  moderate: 'bg-orange-50 text-orange-700 border-orange-200',
  serious: 'bg-red-50 text-red-700 border-red-200',
  fatal: 'bg-red-100 text-red-800 border-red-300',
};

// --- Per-module status colors ---

// NCR statuses
export const NCR_STATUS_COLORS = {
  Identified: 'bg-slate-100 text-slate-700',
  Reported: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Root Cause Analysis': 'bg-purple-100 text-purple-700',
  Disposition: 'bg-indigo-100 text-indigo-700',
  'Corrective Action': 'bg-orange-100 text-orange-700',
  Verification: 'bg-teal-100 text-teal-700',
  Closed: 'bg-green-100 text-green-700',
  Void: 'bg-slate-200 text-slate-500',
};

// RFI statuses
export const RFI_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Open: 'bg-blue-100 text-blue-700',
  Responded: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-200 text-slate-500',
  Void: 'bg-red-100 text-red-500',
};

// Expense statuses
export const EXPENSE_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Paid: 'bg-blue-100 text-blue-700',
};

// Payment statuses
export const PAYMENT_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

// Document statuses
export const DOCUMENT_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Superseded: 'bg-purple-100 text-purple-700',
  Void: 'bg-slate-200 text-slate-500',
};

// Submittal statuses
export const SUBMITTAL_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Revise & Resubmit': 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700',
  'Approved as Noted': 'bg-teal-100 text-teal-700',
  Rejected: 'bg-red-100 text-red-700',
  Closed: 'bg-slate-200 text-slate-500',
};

// Meeting statuses
export const MEETING_STATUS_COLORS = {
  Scheduled: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-500',
};

// Change Order statuses
export const CHANGE_ORDER_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Executed: 'bg-purple-100 text-purple-700',
  Void: 'bg-slate-200 text-slate-500',
};

// Safety Permit statuses
export const PERMIT_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Active: 'bg-emerald-100 text-emerald-700',
  Suspended: 'bg-amber-100 text-amber-700',
  Closed: 'bg-slate-200 text-slate-500',
  Expired: 'bg-red-100 text-red-500',
};

// Safety Incident statuses
export const INCIDENT_STATUS_COLORS = {
  Reported: 'bg-blue-100 text-blue-700',
  'Under Investigation': 'bg-amber-100 text-amber-700',
  'Action Required': 'bg-orange-100 text-orange-700',
  Closed: 'bg-green-100 text-green-700',
};

// Safety risk level colors (with border)
export const RISK_COLORS = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

// RA Bill statuses
export const RA_BILL_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Verified: 'bg-purple-100 text-purple-700',
  Approved: 'bg-green-100 text-green-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
};

// Punch item statuses
export const PUNCH_STATUS_COLORS = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  ready_for_review: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
  void: 'bg-slate-200 text-slate-500',
};
export const PUNCH_STATUSES = ['open', 'in_progress', 'ready_for_review', 'closed', 'void'];
export const PUNCH_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  ready_for_review: 'Ready for Review',
  closed: 'Closed',
  void: 'Void',
};
export const PUNCH_CATEGORIES = ['General', 'Electrical', 'Plumbing', 'HVAC', 'Finishing', 'Structural', 'Painting', 'Landscaping'];
export const PUNCH_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Project statuses — used by ProjectsPage, OwnerDashboard
export const PROJECT_STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  planning: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
};

// Reports page — hex colors for Recharts charts
export const REPORT_STATUS_COLORS = {
  not_started: '#94a3b8', in_progress: '#3b82f6', completed: '#10b981',
  on_hold: '#f59e0b', rework: '#ef4444', ready_for_inspection: '#8b5cf6',
  Pass: '#10b981', Fail: '#ef4444', Conditional: '#f59e0b',
  Open: '#3b82f6', Closed: '#10b981', Resolved: '#10b981',
  Critical: '#ef4444', Major: '#f59e0b', Minor: '#94a3b8', High: '#ef4444', Medium: '#f59e0b', Low: '#94a3b8',
};

// --- Role colors ---

// Role colors for comments section
export const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-700',
  pm: 'bg-blue-100 text-blue-700',
  engineer: 'bg-green-100 text-green-700',
  contractor: 'bg-orange-100 text-orange-700',
  inspector: 'bg-teal-100 text-teal-700',
  procurement: 'bg-yellow-100 text-yellow-700',
  accounts: 'bg-pink-100 text-pink-700',
};

// --- Status dot colors (defects / inspections) ---
export const STATUS_DOTS = {
  Open: 'bg-red-500',
  'In Progress': 'bg-amber-500',
  Resolved: 'bg-green-500',
  Scheduled: 'bg-blue-500',
  Completed: 'bg-green-500',
};

// --- Common status arrays ---

export const NCR_STATUSES = ['Identified', 'Reported', 'Under Review', 'Root Cause Analysis', 'Disposition', 'Corrective Action', 'Verification', 'Closed'];
export const NCR_SEVERITIES = ['Minor', 'Major', 'Critical'];
export const NCR_CATEGORIES = ['Workmanship', 'Material', 'Design', 'Method', 'Supervision', 'Environmental'];
export const NCR_DISPOSITIONS = ['Rework', 'Repair', 'Use-As-Is', 'Reject'];

export const RFI_STATUSES = ['Draft', 'Open', 'Responded', 'Closed', 'Void'];

export const EXPENSE_CATEGORIES = ['Labor', 'Material', 'Equipment', 'Transport', 'Permits', 'Utilities', 'Subcontractor', 'Overhead', 'Other'];
export const EXPENSE_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Paid'];

export const PAYMENT_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Paid', 'Cancelled'];

export const DOCUMENT_STATUSES = ['Draft', 'Under Review', 'Approved', 'Superseded', 'Void'];

export const CHANGE_ORDER_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Executed', 'Void'];

export const RA_BILL_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Verified', 'Approved', 'Paid', 'Rejected'];

export const DEFECT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
export const DEFECT_STATUSES = ['Open', 'In Progress', 'Resolved'];
export const DEFECT_CATEGORIES = ['Structural', 'Workmanship', 'Material', 'Safety', 'Waterproofing', 'Electrical', 'Plumbing', 'Finishing'];

export const INSPECTION_STATUSES = ['Scheduled', 'In Progress', 'Completed'];
export const INSPECTION_RESULTS = ['Pass', 'Conditional', 'Fail'];

export const PERMIT_TYPES = ['Hot Work', 'Confined Space', 'Height Work', 'Excavation', 'Electrical', 'General'];
export const PERMIT_STATUSES = ['Draft', 'Submitted', 'Approved', 'Active', 'Suspended', 'Closed', 'Expired'];
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export const INCIDENT_TYPES = ['Injury', 'Near Miss', 'Property Damage', 'Environmental', 'Fire', 'Collapse'];
export const INCIDENT_SEVERITIES = ['minor', 'moderate', 'serious', 'fatal'];
export const INCIDENT_STATUSES = ['Reported', 'Under Investigation', 'Action Required', 'Closed'];

export const TASK_STATUSES = ['not_started', 'in_progress', 'on_hold', 'ready_for_inspection', 'rework', 'completed'];
export const TASK_STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  ready_for_inspection: 'Ready for Inspection',
  rework: 'Rework',
  completed: 'Completed',
};
export const TASK_STATUS_COLORS = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  ready_for_inspection: 'bg-purple-100 text-purple-700',
  rework: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
};
