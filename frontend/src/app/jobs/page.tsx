'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Job, JobStatus, Workflow } from '@/lib/types';
import { StatusBadge } from '@/components/badges';
import { PageHeader } from '@/components/page-header';
import { formatRelative } from '@/lib/utils';
import { Play } from 'lucide-react';

const statuses: (JobStatus | 'ALL')[] = [
  'ALL', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED',
];

export default function JobsPage() {
  const [filter, setFilter] = useState<JobStatus | 'ALL'>('ALL');
  const qc = useQueryClient();

  const jobs = useQuery<Job[]>({
    queryKey: ['jobs', filter],
    queryFn: async () => {
      const url = filter === 'ALL' ? '/jobs' : `/jobs?status=${filter}`;
      return (await api.get(url)).data;
    },
  });

  const workflows = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => (await api.get('/workflows')).data,
  });

  const submitJob = useMutation({
    mutationFn: async (workflowId: string) =>
      (await api.post('/jobs', { workflowId, payload: { source: 'dashboard' } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Workflow executions and their recovery state"
        action={
          <div className="flex gap-2">
            {workflows.data?.map((wf) => (
              <button
                key={wf.id}
                onClick={() => submitJob.mutate(wf.id)}
                disabled={submitJob.isPending}
                className="btn-primary"
                title={`Run "${wf.name}"`}
              >
                <Play size={14} /> Run &ldquo;{wf.name}&rdquo;
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === s
                ? 'bg-accent text-white'
                : 'border border-border text-muted hover:bg-bg-elevated'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">ID</th>
              <th className="th">Workflow</th>
              <th className="th">Status</th>
              <th className="th">Steps</th>
              <th className="th">Incidents</th>
              <th className="th">Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="td text-center text-muted">No jobs yet — submit one above.</td>
              </tr>
            )}
            {jobs.data?.map((job) => (
              <tr key={job.id} className="hover:bg-bg-elevated">
                <td className="td">
                  <Link href={`/jobs/${job.id}`} className="font-mono text-xs text-accent hover:underline">
                    {job.id.slice(0, 12)}…
                  </Link>
                </td>
                <td className="td">{job.workflow?.name}</td>
                <td className="td"><StatusBadge status={job.status} /></td>
                <td className="td text-xs text-muted">
                  {job.steps?.filter((s) => s.status === 'COMPLETED').length}/{job.steps?.length}
                </td>
                <td className="td text-xs text-muted">{job._count?.incidents ?? 0}</td>
                <td className="td text-xs text-muted">{formatRelative(job.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
