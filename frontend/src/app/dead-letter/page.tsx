'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { DeadLetterEntry } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/badges';
import { RefreshCcw } from 'lucide-react';

export default function DeadLetterPage() {
  const qc = useQueryClient();

  const dlq = useQuery<DeadLetterEntry[]>({
    queryKey: ['dlq'],
    queryFn: async () => (await api.get('/dlq')).data,
  });

  const retry = useMutation({
    mutationFn: async (bullJobId: string) => api.post(`/dlq/${bullJobId}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dlq'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Dead Letter Queue"
        description="Jobs that exhausted their recovery options. Review and retry manually."
      />

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Job</th>
              <th className="th">Workflow</th>
              <th className="th">Status</th>
              <th className="th">Incidents</th>
              <th className="th text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {dlq.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="td text-center text-muted">
                  Dead-letter queue is empty.
                </td>
              </tr>
            )}
            {dlq.data?.map((entry) => (
              <tr key={entry.bullJobId} className="hover:bg-bg-elevated">
                <td className="td">
                  {entry.dbJob ? (
                    <Link href={`/jobs/${entry.dbJob.id}`} className="font-mono text-xs text-accent hover:underline">
                      {entry.dbJob.id.slice(0, 12)}…
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-muted">{entry.data.jobId.slice(0, 12)}…</span>
                  )}
                </td>
                <td className="td">{entry.dbJob?.workflow?.name ?? '—'}</td>
                <td className="td">
                  {entry.dbJob && <StatusBadge status={entry.dbJob.status} />}
                </td>
                <td className="td text-xs text-muted">{entry.dbJob?._count?.incidents ?? 0}</td>
                <td className="td text-right">
                  <button
                    onClick={() => retry.mutate(entry.bullJobId)}
                    className="btn-primary"
                    disabled={retry.isPending}
                  >
                    <RefreshCcw size={14} /> Retry
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
