import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import { formatCurrency } from '../utils/formatters';

export default function BudgetPage() {
  const { currentProject } = useProject();
  const [data, setData] = useState(null);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject?.id) return;
    Promise.all([
      api.get('/projects'),
      api.get(`/stages?project_id=${currentProject.id}`),
      api.get(`/expenses/summary?project_id=${currentProject.id}`),
    ]).then(([projects, stages, expenses]) => {
      const project = projects.find(p => p.id === currentProject.id) || projects[0];
      const stagesList = Array.isArray(stages) ? stages : stages.stages || [];
      setData({ project, stages: stagesList });
      setExpenseSummary(expenses);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (!currentProject) return <div className="text-center py-12 text-slate-400">Select a project first</div>;
  if (loading) return <div className="text-center py-12 text-slate-500">Loading budget...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load</div>;

  const { project, stages } = data;
  const totalBudget = project?.total_budget || 0;
  const totalSpent = project?.spent || 0;
  const remaining = totalBudget - totalSpent;
  const utilization = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const totalExpenses = expenseSummary?.totalAmount || 0;
  const approvedExpenses = expenseSummary?.byStatus?.find(s => s.status === 'Approved')?.amount || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Budget Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Budget" value={formatCurrency(totalBudget)} color="blue" />
        <StatCard label="Total Spent" value={formatCurrency(totalSpent)} color="orange" />
        <StatCard label="Remaining" value={formatCurrency(remaining)} color={remaining >= 0 ? 'green' : 'red'} />
        <StatCard label="Utilization" value={`${utilization}%`} color={utilization > 90 ? 'red' : utilization > 70 ? 'yellow' : 'green'} />
      </div>

      {expenseSummary && expenseSummary.byCategory?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Expenses by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {expenseSummary.byCategory.map(cat => (
              <div key={cat.category} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{cat.category}</p>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(cat.amount)}</p>
                <p className="text-[10px] text-slate-400">{cat.count} entries</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Budget by Stage</h3>
        <div className="space-y-4">
          {stages?.filter(s => s.budget > 0).map((stage) => {
            const usedPct = stage.budget > 0 ? Math.round((stage.spent / stage.budget) * 100) : 0;
            const isOverBudget = stage.spent > stage.budget;
            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{stage.name}</span>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${isOverBudget ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatCurrency(stage.spent)}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">/ {formatCurrency(stage.budget)}</span>
                    {isOverBudget && <span className="text-[10px] text-red-500 ml-2">OVER BUDGET</span>}
                  </div>
                </div>
                <ProgressBar value={Math.min(usedPct, 100)} />
              </div>
            );
          })}
          {(!stages || stages.filter(s => s.budget > 0).length === 0) && (
            <p className="text-sm text-slate-400 text-center py-4">No stage budgets configured</p>
          )}
        </div>
      </div>

      {expenseSummary && expenseSummary.byStatus?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Expense Status Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {expenseSummary.byStatus.map(s => (
              <div key={s.status} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-slate-800">{s.count}</p>
                <p className="text-xs text-slate-500">{s.status}</p>
                <p className="text-[10px] text-slate-400">{formatCurrency(s.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
