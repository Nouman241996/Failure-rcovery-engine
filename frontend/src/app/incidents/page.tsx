'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Incident } from '@/lib/types';
import { FailureBadge, StrategyBadge } from '@/components/badges';
import { PageHeader } from '@/components/page-header';
import { formatRelative } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

export default function IncidentsPage() {
  const qc = useQueryClient();

  const incidents = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: async () => (await api.get('/incidents')).data,
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => api.patch(`/incidents/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Failures detected during workflow execution and their recovery progress"
      />

      <div className="space-y-3">
        {incidents.data?.length === 0 && (
          <div className="card text-center text-muted">No incidents — everything is healthy.</div>
        )}
        {incidents.data?.map((inc) => (
          <div key={inc.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <FailureBadge type={inc.failureType} />
                  {inc.escalated && (
                    <span className="badge bg-warning-soft text-warning">ESCALATED</span>
                  )}
                  {inc.resolved && (
                    <span className="badge bg-success-soft text-success">RESOLVED</span>
                  )}
                </div>
                <p className="font-medium">
                  {inc.jobStep?.workflowStep?.name ?? 'Unknown step'}
                  <span className="ml-2 text-xs text-muted">
                    in {inc.job?.workflow?.name}
                  </span>
                </p>
                <p className="mt-1 text-sm text-danger">{inc.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {inc.retryCount} retries • {formatRelative(inc.createdAt)} •{' '}
                  <Link href={`/jobs/${inc.jobId}`} className="text-accent hover:underline">
                    View job
                  </Link>
                </p>

                {inc.recoveryAttempts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inc.recoveryAttempts.map((ra) => (
                      <StrategyBadge key={ra.id} strategy={ra.strategy} success={ra.success} />
                    ))}
                  </div>
                )}
              </div>

              {!inc.resolved && (
                <button
                  onClick={() => resolve.mutate(inc.id)}
                  className="btn-ghost"
                  disabled={resolve.isPending}
                >
                  <CheckCircle size={14} /> Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
