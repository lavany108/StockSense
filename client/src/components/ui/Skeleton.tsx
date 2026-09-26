import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-md bg-slate-800/60 ${className}`}
    aria-hidden="true"
  />
);

// A full-width skeleton table row with N columns
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <tr key={rowIdx} className="border-b border-slate-800/60">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <td key={colIdx} className="px-4 py-3">
            <Skeleton className={`h-4 ${colIdx === 0 ? 'w-24' : colIdx === cols - 1 ? 'w-16' : 'w-full max-w-[160px]'}`} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// Generic card skeleton
export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-1/3' : i === lines - 1 ? 'w-1/4' : 'w-full'}`} />
    ))}
  </div>
);
