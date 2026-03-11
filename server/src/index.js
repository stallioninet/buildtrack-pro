import express from 'express';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import projectRoutes from './routes/projects.js';
import stageRoutes from './routes/stages.js';
import materialRoutes from './routes/materials.js';
import vendorRoutes from './routes/vendors.js';
import inspectionRoutes from './routes/inspections.js';
import expenseRoutes from './routes/expenses.js';
import paymentRoutes from './routes/payments.js';
import inventoryRoutes from './routes/inventory.js';
import dailyLogRoutes from './routes/dailyLogs.js';
import auditLogRoutes from './routes/auditLog.js';
import taskRoutes from './routes/tasks.js';
import estimatorRoutes from './routes/estimator.js';
import attachmentRoutes from './routes/attachments.js';
import workflowRoutes from './routes/workflows.js';
import ncrRoutes from './routes/ncrs.js';
import rfiRoutes from './routes/rfis.js';
import commentRoutes from './routes/comments.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import changeOrderRoutes from './routes/changeOrders.js';
import safetyRoutes from './routes/safety.js';
import raBillRoutes from './routes/raBills.js';
import documentRoutes from './routes/documents.js';
import submittalRoutes from './routes/submittals.js';
import meetingRoutes from './routes/meetings.js';
import searchRoutes from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLiteStore = connectSqlite3(session);

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Trust proxy (Railway, Render use reverse proxies)
if (isProd) app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Session
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, '../data'),
  }),
  secret: process.env.SESSION_SECRET || 'buildtrack-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProd ? 'none' : 'lax',
  },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/estimator', estimatorRoutes);
app.use('/api/tasks', attachmentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/ncrs', ncrRoutes);
app.use('/api/rfis', rfiRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/change-orders', changeOrderRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/ra-bills', raBillRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/submittals', submittalRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/search', searchRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`BuildTrack server running on http://localhost:${PORT}`);
});
