'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use } from 'react';
import { api } from '@/lib/api';
import type { Job, AuditLog } from '@/lib/types';
import { StatusBadge, StepBadge, FailureBadge, StrategyBadge } from '@/components/badges';
import { PageHeader } from '@/components/page-header';
import { formatRelative } from '@/lib/utils';
import { ArrowLeft, Clock } from 'lucide-react';

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const job = useQuery<Job>({
    queryKey: ['job', id],
    queryFn: async () => (await api.get(`/jobs/${id}`)).data,
  });

  const audit = useQuery<AuditLog[]>({
    queryKey: ['audit', id],
    queryFn: async () => (await api.get(`/audit/job/${id}`)).data,
  });

  if (job.isLoading) return <p className="text-muted">Loading…</p>;
  if (job.error) return <p className="text-danger">{(job.error as Error).message}</p>;
  if (!job.data) return null;

  return (
    <div>
      <Link href="/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ArrowLeft size={14} /> All jobs
      </Link>

      <PageHeader
        title={`Job ${job.data.id.slice(0, 12)}…`}
        description={job.data.workflow?.name}
        action={<StatusBadge status={job.data.status} />}
      />

      {/* Steps timeline */}
      <div className="card mb-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Steps Timeline
        </h3>
        <ol className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-0 before:h-full before:w-px before:bg-border">
          {job.data.steps.map((step) => (
            <li key={step.id} className="relative">
              <span className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-accent" />
              <div className="rounded-lg border border-border bg-bg-elevated p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{step.workflowStep.name}</p>
                    <p className="text-xs text-muted">
                      {step.workflowStep.type} • attempt {step.attempts}
                    </p>
                  </div>
                  <StepBadge status={step.status} />
                </div>

                {step.error && (
                  <div className="mt-3 rounded border border-danger/30 bg-danger-soft p-2 text-xs text-danger">
                    <strong>{step.failureType}</strong>: {step.error}
                  </div>
                )}

                {step.incidents && step.incidents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted">Recovery Attempts</p>
                    {step.incidents.flatMap((inc) =>
                      inc.recoveryAttempts.map((ra) => (
                        <div key={ra.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <StrategyBadge strategy={ra.strategy} success={ra.success} />
                            {ra.error && <span className="text-muted">{ra.error}</span>}
                          </div>
                          <span className="text-muted">{ra.durationMs}ms</span>
                        </div>
                      )),
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Audit log */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Audit Log
        </h3>
        <div className="space-y-2">
          {audit.data?.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <Clock size={14} className="mt-0.5 shrink-0 text-muted" />
              <div className="flex-1">
                <span className="font-mono text-xs text-accent">{log.action}</span>
                <span className="ml-2">{log.message}</span>
                <p className="text-xs text-muted">{formatRelative(log.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
