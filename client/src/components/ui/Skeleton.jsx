/**
 * Reusable skeleton/placeholder UI primitives for loading states.
 * All use Tailwind animate-pulse with slate-200 backgrounds.
 */

export function SkeletonLine({ width = 'w-full', height = 'h-4' }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${width} ${height}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonLine width="w-2/3" height="h-5" />
        <SkeletonLine width="w-16" height="h-5" />
      </div>
      <SkeletonLine width="w-1/2" height="h-3" />
      <SkeletonLine width="w-full" height="h-2" />
      <SkeletonLine width="w-3/4" height="h-3" />
      <div className="flex items-center gap-2 pt-2">
        <SkeletonLine width="w-24" height="h-8" />
        <SkeletonLine width="w-16" height="h-8" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-4">
        <SkeletonLine width="w-20" height="h-3" />
        <SkeletonLine width="w-32" height="h-3" />
        <SkeletonLine width="w-24" height="h-3" />
        <SkeletonLine width="w-16" height="h-3" />
        <SkeletonLine width="w-20" height="h-3" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 border-b border-slate-100 last:border-0 flex items-center gap-4">
          <SkeletonLine width="w-16" height="h-3" />
          <SkeletonLine width="w-40" height="h-3" />
          <SkeletonLine width="w-20" height="h-3" />
          <SkeletonLine width="w-14" height="h-3" />
          <SkeletonLine width="w-24" height="h-3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine width="w-1/3" height="h-6" />
        <SkeletonLine width="w-1/2" height="h-4" />
      </div>
      {/* Field rows */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <SkeletonLine width="w-20" height="h-3" />
          <SkeletonLine width="w-full" height="h-8" />
        </div>
        <div className="space-y-2">
          <SkeletonLine width="w-24" height="h-3" />
          <SkeletonLine width="w-full" height="h-8" />
        </div>
        <div className="space-y-2">
          <SkeletonLine width="w-16" height="h-3" />
          <SkeletonLine width="w-full" height="h-8" />
        </div>
        <div className="space-y-2">
          <SkeletonLine width="w-20" height="h-3" />
          <SkeletonLine width="w-full" height="h-8" />
        </div>
      </div>
      {/* Description area */}
      <div className="space-y-2">
        <SkeletonLine width="w-24" height="h-3" />
        <SkeletonLine width="w-full" height="h-20" />
      </div>
    </div>
  );
}
