import { memo } from 'react';

function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
      <span>{total} total results</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100">
          Prev
        </button>
        {start > 1 && <span className="px-1">...</span>}
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-2 py-1 rounded border ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 hover:bg-slate-100'}`}>
            {p}
          </button>
        ))}
        {end < totalPages && <span className="px-1">...</span>}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100">
          Next
        </button>
      </div>
    </div>
  );
}

export default memo(Pagination);
