'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JobStats, ServiceHealth } from '@/lib/types';
import { Activity, AlertCircle, CheckCircle2, RefreshCcw, Workflow as WorkflowIcon } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { ServiceBadge } from '@/components/badges';
import { PageHeader } from '@/components/page-header';

export default function DashboardPage() {
  const stats = useQuery<JobStats>({
    queryKey: ['job-stats'],
    queryFn: async () => (await api.get('/jobs/stats')).data,
  });

  const incidents = useQuery({
    queryKey: ['incident-stats'],
    queryFn: async () => (await api.get('/incidents/stats')).data,
  });

  const services = useQuery<ServiceHealth[]>({
    queryKey: ['services'],
    queryFn: async () => (await api.get('/health')).data,
  });

  const recovery = useQuery({
    queryKey: ['recovery-stats'],
    queryFn: async () => (await api.get('/recovery/stats')).data,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of workflow execution and recovery performance"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Jobs"
          value={stats.data?.total ?? '—'}
          icon={WorkflowIcon}
          accent="accent"
        />
        <StatCard
          label="Completed"
          value={stats.data?.completed ?? '—'}
          icon={CheckCircle2}
          accent="success"
          hint={stats.data ? `${stats.data.successRate}% success rate` : undefined}
        />
        <StatCard
          label="Failed"
          value={stats.data?.failed ?? '—'}
          icon={AlertCircle}
          accent="danger"
        />
        <StatCard
          label="Retrying"
          value={stats.data?.retrying ?? '—'}
          icon={RefreshCcw}
          accent="warning"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Recovery Engine
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted">Total Attempts</p>
              <p className="mt-1 text-2xl font-semibold">{recovery.data?.total ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Succeeded</p>
              <p className="mt-1 text-2xl font-semibold text-success">
                {recovery.data?.succeeded ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Failed</p>
              <p className="mt-1 text-2xl font-semibold text-danger">
                {recovery.data?.failed ?? '—'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Activity size={14} />
            Auto-refresh every 10s
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Incidents
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted">Open</p>
              <p className="mt-1 text-2xl font-semibold text-warning">
                {incidents.data?.open ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Resolved</p>
              <p className="mt-1 text-2xl font-semibold text-success">
                {incidents.data?.resolved ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Escalated</p>
              <p className="mt-1 text-2xl font-semibold text-danger">
                {incidents.data?.escalated ?? '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Service Health
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {services.data?.map((svc) => (
            <div
              key={svc.id}
              className="rounded-lg border border-border bg-bg-elevated p-3"
            >
              <p className="font-mono text-xs text-muted">{svc.name}</p>
              <div className="mt-2">
                <ServiceBadge status={svc.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
