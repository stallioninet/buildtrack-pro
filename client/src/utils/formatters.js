export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function statusColor(status) {
  const map = {
    not_started: 'bg-slate-100 text-slate-700',
    active: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    on_hold: 'bg-orange-100 text-orange-800',
    ready_for_inspection: 'bg-purple-100 text-purple-800',
    rework: 'bg-red-100 text-red-800',
    new: 'bg-purple-100 text-purple-800',
    ongoing: 'bg-blue-100 text-blue-800',
    'Draft': 'bg-gray-100 text-gray-800',
    'Pending Approval': 'bg-yellow-100 text-yellow-800',
    'Approved': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Ordered': 'bg-blue-100 text-blue-800',
    'Delivered': 'bg-green-100 text-green-800',
    'Scheduled': 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    'Completed': 'bg-green-100 text-green-800',
    'Open': 'bg-red-100 text-red-800',
    'Resolved': 'bg-green-100 text-green-800',
    'Active': 'bg-green-100 text-green-800',
    'Paid': 'bg-green-100 text-green-800',
    'Passed': 'bg-green-100 text-green-800',
    'Conditional': 'bg-amber-100 text-amber-800',
    'Failed': 'bg-red-100 text-red-800',
    'Critical': 'bg-red-200 text-red-900',
    'High': 'bg-red-100 text-red-800',
    'Medium': 'bg-yellow-100 text-yellow-800',
    'Low': 'bg-slate-100 text-slate-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}
