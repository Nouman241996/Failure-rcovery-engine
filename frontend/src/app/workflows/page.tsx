'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Workflow } from '@/lib/types';
import { PageHeader } from '@/components/page-header';

export default function WorkflowsPage() {
  const workflows = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => (await api.get('/workflows')).data,
  });

  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Defined workflow templates and their recovery policies"
      />

      <div className="space-y-6">
        {workflows.data?.map((wf) => (
          <div key={wf.id} className="card">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{wf.name}</h3>
              {wf.description && <p className="text-sm text-muted">{wf.description}</p>}
            </div>

            <div className="space-y-2">
              {wf.steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-mono text-accent">
                      {step.order}
                    </span>
                    <div>
                      <p className="font-medium">{step.name}</p>
                      <p className="text-xs text-muted">
                        {step.type} • {step.isCritical ? 'Critical' : 'Optional'}
                      </p>
                    </div>
                  </div>

                  {step.recoveryPolicy && (
                    <div className="text-right text-xs">
                      <p>
                        <span className="text-muted">Strategy:</span>{' '}
                        <span className="font-mono text-accent">{step.recoveryPolicy.strategy}</span>
                      </p>
                      <p className="text-muted">
                        max {step.recoveryPolicy.maxRetries} retries •{' '}
                        {step.recoveryPolicy.retryDelayMs}ms delay
                        {step.recoveryPolicy.fallbackService &&
                          ` → ${step.recoveryPolicy.fallbackService}`}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
