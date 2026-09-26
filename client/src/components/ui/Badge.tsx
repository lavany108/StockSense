import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#714B67] text-white shadow hover:bg-[#5f3d56]',
        secondary:
          'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750',
        destructive:
          'border-rose-900/60 bg-rose-950/70 text-rose-300 hover:bg-rose-900/50',
        outline:
          'text-slate-300 border-slate-700',
        subtle:
          'bg-[#714B67]/20 text-[#dfbed3] border-[#714B67]/40',
        // Status pills (requirement: Draft gray, Waiting blue, Ready amber, Done green, Canceled red)
        draft:
          'bg-slate-800/80 text-slate-300 border-slate-700 font-semibold',
        waiting:
          'bg-blue-950/70 text-blue-300 border-blue-800/60 font-semibold',
        ready:
          'bg-amber-950/70 text-amber-300 border-amber-700/60 font-semibold',
        done:
          'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 font-semibold',
        canceled:
          'bg-rose-950/70 text-rose-300 border-rose-800/60 font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  switch (s) {
    case 'DRAFT':
      return (
        <Badge variant="draft" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Draft
        </Badge>
      );
    case 'WAITING':
      return (
        <Badge variant="waiting" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Waiting
        </Badge>
      );
    case 'READY':
      return (
        <Badge variant="ready" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Ready
        </Badge>
      );
    case 'DONE':
      return (
        <Badge variant="done" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Done
        </Badge>
      );
    case 'CANCELED':
      return (
        <Badge variant="canceled" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          Canceled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export { Badge, badgeVariants };
