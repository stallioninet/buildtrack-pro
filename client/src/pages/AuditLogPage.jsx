import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatDate } from '../utils/formatters';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit-log').then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-500">Loading audit log...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-4">
          {logs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0">
              <div className={`w-3 h-3 mt-1.5 rounded-full flex-shrink-0 ${
                entry.type === 'workflow' ? 'bg-blue-500' :
                entry.type === 'warning' ? 'bg-yellow-500' :
                entry.type === 'approval' ? 'bg-green-500' :
                'bg-slate-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800">{entry.action}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{entry.entity}</span>
                  <span className="text-xs text-slate-500">{entry.entity_id}</span>
                </div>
                {(entry.from_state || entry.to_state) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {entry.from_state && <span className="line-through text-slate-400">{entry.from_state}</span>}
                    {entry.from_state && entry.to_state && <span className="mx-1">&rarr;</span>}
                    {entry.to_state && <span className="text-blue-600 font-medium">{entry.to_state}</span>}
                  </p>
                )}
                {entry.details && <p className="text-xs text-slate-400 mt-1">{entry.details}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {entry.user_display || 'System'} &middot; {formatDate(entry.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
        {logs.length === 0 && (
          <div className="text-center py-8 text-slate-400">No audit entries found</div>
        )}
      </div>
    </div>
  );
}
