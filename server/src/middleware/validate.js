import { z } from 'zod';

// Strip HTML tags to prevent stored XSS
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

// Middleware factory
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.validated = result.data;
    next();
  };
}

// 1. Login
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
});

// 2. Register
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).trim(),
  owner_type: z.enum(['firm', 'individual']).optional(),
});

// 3. Team member
export const teamMemberSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).trim(),
  role: z.enum(['pm', 'engineer', 'contractor', 'procurement', 'accounts', 'inspector']),
});

// 4. Task
export const taskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  stage_id: z.number().int().positive(),
  description: z.string().max(2000).optional().transform(v => v ? stripHtml(v) : v),
  assigned_to: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
});

// 5. NCR
export const ncrSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  project_id: z.number().int().positive(),
  description: z.string().max(5000).optional().transform(v => v ? stripHtml(v) : v),
  severity: z.enum(['Minor', 'Major', 'Critical']).optional(),
  category: z.enum(['Workmanship', 'Material', 'Design', 'Method', 'Supervision', 'Environmental']).optional(),
  stage_id: z.number().optional(),
  task_id: z.number().optional(),
  inspection_id: z.number().optional(),
  location: z.string().max(200).optional(),
  due_date: z.string().optional(),
});

// 6. RFI
export const rfiSchema = z.object({
  subject: z.string().min(1).max(200).trim(),
  question: z.string().min(1).max(5000).transform(stripHtml),
  project_id: z.number().int().positive(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  stage_id: z.number().optional(),
  task_id: z.number().optional(),
  drawing_ref: z.string().max(200).optional(),
  spec_ref: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  due_date: z.string().optional(),
});

// 7. Comment
export const commentSchema = z.object({
  content: z.string().min(1).max(5000).trim().transform(stripHtml),
  entity_type: z.enum(['task', 'ncr', 'rfi', 'change_order', 'submittal', 'document', 'vendor', 'punch_item', 'safety_permit', 'safety_incident', 'expense', 'payment']),
  entity_id: z.number().int().positive(),
  parent_id: z.number().optional(),
});

// 8. Change order
export const changeOrderSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  project_id: z.number().int().positive(),
  description: z.string().max(5000).optional().transform(v => v ? stripHtml(v) : v),
  reason: z.string().max(2000).optional().transform(v => v ? stripHtml(v) : v),
  type: z.enum(['scope_change', 'design_change', 'site_condition', 'client_request', 'regulatory', 'other']).optional(),
  cost_impact: z.number().optional(),
  schedule_impact_days: z.number().int().optional(),
  stage_id: z.number().optional(),
  due_date: z.string().optional(),
});

// 9. Expense
export const expenseSchema = z.object({
  expense_date: z.string().min(1),
  category: z.string().min(1).max(100),
  amount: z.number().min(0),
  description: z.string().max(2000).optional().transform(v => v ? stripHtml(v) : v),
  stage_id: z.number().optional(),
  status: z.string().optional(),
});

// 10. Password change
export const passwordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

// 11. Profile update
export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  phone: z.string().max(20).trim().optional().nullable(),
});
