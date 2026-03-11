import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function StagesPage() {
  const { currentProject } = useProject();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject) {
      setStages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/stages?project_id=${currentProject.id}`)
      .then(setStages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentProject?.id]);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading stages...</div>;

  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p className="text-slate-500">Select a project to view its construction stages.</p>
        <Link to="/projects" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Go to Projects
        </Link>
      </div>
    );
  }

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const activeCount = stages.filter(s => s.status === 'in_progress').length;
  const overallProgress = stages.length > 0
    ? Math.round(stages.reduce((sum, s) => sum + (s.completion || 0), 0) / stages.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
          <Link to="/projects" className="hover:text-blue-600">Projects</Link>
          <span>/</span>
          <span className="text-slate-600">{currentProject.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Construction Stages</h1>
        <p className="text-sm text-slate-500 mt-1">
          {stages.length} stages | {completedCount} completed | {activeCount} in progress | {overallProgress}% overall
        </p>
      </div>

      {/* Overall progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Project Progress</span>
          <span className="text-sm font-bold text-blue-600">{overallProgress}%</span>
        </div>
        <ProgressBar value={overallProgress} />
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> {completedCount} Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> {activeCount} In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-300" /> {stages.length - completedCount - activeCount} Pending
          </span>
        </div>
      </div>

      {/* Stages list */}
      <div className="space-y-3">
        {stages.map((stage) => (
          <Link
            key={stage.id}
            to={`/stages/${stage.id}`}
            className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                  stage.status === 'completed' ? 'bg-green-100 text-green-700' :
                  stage.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {stage.stage_order}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{stage.name}</h3>
                  <p className="text-xs text-slate-400">
                    {stage.start_date ? formatDate(stage.start_date) : 'Not started'}
                    {stage.end_date ? ` - ${formatDate(stage.end_date)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {stage.budget > 0 && (
                  <span className="text-sm font-medium text-slate-600">{formatCurrency(stage.budget)}</span>
                )}
                <Badge status={stage.status} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar value={stage.completion} />
              </div>
              <span className="text-xs text-slate-500 w-10 text-right">{stage.completion}%</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
