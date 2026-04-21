'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ServiceHealth, ServiceStatus } from '@/lib/types';
import { ServiceBadge } from '@/components/badges';
import { PageHeader } from '@/components/page-header';

const allStatuses: ServiceStatus[] = ['HEALTHY', 'DEGRADED', 'DOWN'];

export default function ServicesPage() {
  const qc = useQueryClient();

  const services = useQuery<ServiceHealth[]>({
    queryKey: ['services'],
    queryFn: async () => (await api.get('/health')).data,
  });

  const update = useMutation({
    mutationFn: async ({ name, status }: { name: string; status: ServiceStatus }) =>
      api.patch(`/health/${name}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });

  return (
    <div>
      <PageHeader
        title="Service Health"
        description="Simulate external service outages to trigger recovery flows"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.data?.map((svc) => (
          <div key={svc.id} className="card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{svc.name}</p>
                <p className="text-xs text-muted">External service</p>
              </div>
              <ServiceBadge status={svc.status} />
            </div>
            <div className="flex gap-2">
              {allStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => update.mutate({ name: svc.name, status: s })}
                  disabled={svc.status === s || update.isPending}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                    svc.status === s
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-muted hover:bg-bg-elevated'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
