import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: 'success' | 'danger' | 'warning' | 'accent' | 'muted';
  hint?: string;
}

const accents = {
  success: 'text-success',
  danger:  'text-danger',
  warning: 'text-warning',
  accent:  'text-accent',
  muted:   'text-muted',
};

export function StatCard({ label, value, icon: Icon, accent = 'accent', hint }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
          <p className={cn('mt-2 text-3xl font-semibold tabular-nums', accents[accent])}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn('rounded-lg p-2', `bg-${accent}-soft`)}>
            <Icon className={accents[accent]} size={20} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
