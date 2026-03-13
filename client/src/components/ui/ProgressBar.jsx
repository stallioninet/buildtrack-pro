import { memo } from 'react';

function ProgressBar({ value = 0, className = '' }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-blue-500' : 'bg-yellow-500';

  return (
    <div className={`w-full bg-slate-200 rounded-full h-2 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export default memo(ProgressBar);
