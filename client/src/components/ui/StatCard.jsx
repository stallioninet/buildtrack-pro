import { memo } from 'react';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'border-blue-500 bg-blue-50',
    green: 'border-green-500 bg-green-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    red: 'border-red-500 bg-red-50',
    purple: 'border-purple-500 bg-purple-50',
    orange: 'border-orange-500 bg-orange-50',
  };

  return (
    <div className={`rounded-xl border-l-4 ${colors[color] || colors.blue} p-5`}>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default memo(StatCard);
