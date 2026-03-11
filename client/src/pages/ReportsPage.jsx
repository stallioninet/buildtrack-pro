import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { formatCurrency } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STATUS_COLORS = {
  not_started: '#94a3b8', in_progress: '#3b82f6', completed: '#10b981',
  on_hold: '#f59e0b', rework: '#ef4444', ready_for_inspection: '#8b5cf6',
  Pass: '#10b981', Fail: '#ef4444', Conditional: '#f59e0b',
  Open: '#3b82f6', Closed: '#10b981', Resolved: '#10b981',
  Critical: '#ef4444', Major: '#f59e0b', Minor: '#94a3b8', High: '#ef4444', Medium: '#f59e0b', Low: '#94a3b8',
};

export default function ReportsPage() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [budget, setBudget] = useState(null);
  const [quality, setQuality] = useState(null);
  const [taskReport, setTaskReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject?.id) return;
    setLoading(true);
    const pid = currentProject.id;
    Promise.all([
      api.get(`/reports/project-overview?project_id=${pid}`),
      api.get(`/reports/budget?project_id=${pid}`),
      api.get(`/reports/quality?project_id=${pid}`),
      api.get(`/reports/tasks?project_id=${pid}`),
    ]).then(([ov, bud, qual, task]) => {
      setOverview(ov);
      setBudget(bud);
      setQuality(qual);
      setTaskReport(task);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;
  if (loading) return <div className="text-center py-12 text-slate-500">Loading reports...</div>;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'budget', label: 'Budget & Finance' },
    { key: 'quality', label: 'Quality & NCR' },
    { key: 'tasks', label: 'Task Progress' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${activeTab === t.key ? 'bg-white text-slate-800 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && overview && <OverviewTab data={overview} />}
      {activeTab === 'budget' && budget && <BudgetTab data={budget} />}
      {activeTab === 'quality' && quality && <QualityTab data={quality} />}
      {activeTab === 'tasks' && taskReport && <TasksTab data={taskReport} />}
    </div>
  );
}

function OverviewTab({ data }) {
  const { project, stages, taskStats, inspectionStats, ncrStats, rfiStats, defectStats } = data;
  const totalTasks = taskStats.reduce((s, t) => s + t.count, 0);
  const completedTasks = taskStats.find(t => t.status === 'completed')?.count || 0;
  const totalNCRs = ncrStats.reduce((s, n) => s + n.count, 0);
  const openNCRs = ncrStats.filter(n => !['Closed', 'Void'].includes(n.status)).reduce((s, n) => s + n.count, 0);
  const totalRFIs = rfiStats.reduce((s, r) => s + r.count, 0);
  const totalDefects = defectStats.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Project Completion" value={`${project?.completion || 0}%`} color="blue" />
        <StatCard label="Tasks" value={`${completedTasks}/${totalTasks}`} sub="completed" color="green" />
        <StatCard label="Open NCRs" value={openNCRs} sub={`of ${totalNCRs} total`} color="red" />
        <StatCard label="RFIs" value={totalRFIs} sub={`${totalDefects} defects`} color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Stage Progress">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stages} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="completion" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Task Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={taskStats} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label={({ status, count }) => `${status.replace(/_/g, ' ')} (${count})`} labelLine={{ stroke: '#94a3b8' }}>
                {taskStats.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="NCR Status">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ncrStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Defects by Severity">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={defectStats} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={90} label={({ severity, count }) => `${severity} (${count})`}>
                {defectStats.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.severity] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function BudgetTab({ data }) {
  const { project, stagesBudget, expensesByCategory, expensesByMonth, paymentsByMonth } = data;
  const remaining = (project?.total_budget || 0) - (project?.spent || 0);
  const utilization = project?.total_budget > 0 ? Math.round((project.spent / project.total_budget) * 100) : 0;

  const monthlyData = {};
  expensesByMonth?.forEach(e => { monthlyData[e.month] = { ...monthlyData[e.month], month: e.month, expenses: e.total }; });
  paymentsByMonth?.forEach(p => { monthlyData[p.month] = { ...monthlyData[p.month], month: p.month, payments: p.total }; });
  const combinedMonthly = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Budget" value={formatCurrency(project?.total_budget)} color="blue" />
        <StatCard label="Total Spent" value={formatCurrency(project?.spent)} color="orange" />
        <StatCard label="Remaining" value={formatCurrency(remaining)} color={remaining >= 0 ? 'green' : 'red'} />
        <StatCard label="Utilization" value={`${utilization}%`} color={utilization > 90 ? 'red' : utilization > 70 ? 'yellow' : 'green'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Budget vs Spent by Stage">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stagesBudget} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="budget" fill="#3b82f6" name="Budget" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spent" fill="#f59e0b" name="Spent" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={expensesByCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, total }) => `${category}`}>
                {expensesByCategory?.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {combinedMonthly.length > 0 && (
        <ChartCard title="Monthly Expenses & Payments Trend">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={combinedMonthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="payments" stroke="#3b82f6" name="Payments" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function QualityTab({ data }) {
  const { inspectionsByResult, inspectionsByCategory, ncrsBySeverity, ncrsByCategory, ncrTrend, defectsBySeverity, passRate } = data;
  const passRatePct = passRate?.total > 0 ? Math.round((passRate.passed / passRate.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Inspection Pass Rate" value={`${passRatePct}%`} color={passRatePct >= 80 ? 'green' : passRatePct >= 60 ? 'yellow' : 'red'} />
        <StatCard label="Total Inspections" value={passRate?.total || 0} color="blue" />
        <StatCard label="NCRs Raised" value={ncrsBySeverity?.reduce((s, n) => s + n.count, 0) || 0} color="orange" />
        <StatCard label="Total Defects" value={defectsBySeverity?.reduce((s, d) => s + d.count, 0) || 0} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Inspection Results">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={inspectionsByResult} dataKey="count" nameKey="result" cx="50%" cy="50%" outerRadius={90} label={({ result, count }) => `${result} (${count})`}>
                {inspectionsByResult?.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.result] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="NCRs by Severity">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ncrsBySeverity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="severity" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {ncrsBySeverity?.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.severity] || COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="NCRs by Category">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ncrsByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {ncrTrend?.length > 0 && (
          <ChartCard title="NCR Trend (Monthly)">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={ncrTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="raised" stroke="#ef4444" name="Raised" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="closed" stroke="#10b981" name="Closed" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function TasksTab({ data }) {
  const { byStatus, byPriority, byStage, overdue } = data;
  const totalTasks = byStatus?.reduce((s, t) => s + t.count, 0) || 0;
  const completed = byStatus?.find(t => t.status === 'completed')?.count || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={totalTasks} color="blue" />
        <StatCard label="Completed" value={completed} color="green" />
        <StatCard label="Overdue" value={overdue} color="red" />
        <StatCard label="Completion Rate" value={totalTasks > 0 ? `${Math.round((completed / totalTasks) * 100)}%` : '0%'} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Tasks by Status">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label={({ status, count }) => `${status.replace(/_/g, ' ')} (${count})`} labelLine={{ stroke: '#94a3b8' }}>
                {byStatus?.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasks by Priority">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byPriority}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byPriority?.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.priority] || COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {byStage?.length > 0 && (
        <ChartCard title="Task Completion by Stage">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byStage} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage_name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#94a3b8" name="Total" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}
