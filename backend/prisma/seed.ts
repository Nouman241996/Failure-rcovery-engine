/**
 * Seed script — provisions:
 *   1. The default admin tenant (`default`) and its bootstrap API key.
 *   2. Simulated services for the chaos-testing dashboard.
 *   3. Two demo workflows (Order Processing, Subscription Renewal).
 *
 * Idempotent: safe to re-run. The bootstrap API key is printed only on first
 * creation — store it immediately or revoke and re-issue from the API.
 */

import { PrismaClient, RecoveryStrategy, ServiceStatus, StepType } from '@prisma/client';
import { generateApiKey } from '../src/common/utils/crypto';

const prisma = new PrismaClient();
const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? 'default';

async function main() {
  console.log('🌱 Seeding…');

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_SLUG },
    update: {},
    create: { slug: DEFAULT_SLUG, name: 'Default Admin Tenant' },
  });
  console.log(`  • tenant: ${tenant.slug} (${tenant.id})`);

  const existingKey = await prisma.apiKey.findFirst({
    where: { tenantId: tenant.id, revokedAt: null },
  });
  if (!existingKey) {
    const generated = generateApiKey();
    await prisma.apiKey.create({
      data: {
        tenantId: tenant.id,
        label: 'bootstrap',
        prefix: generated.prefix,
        keyHash: generated.hash,
      },
    });
    console.log(`\n  🔑 Bootstrap API key (store now — shown ONCE):\n     ${generated.raw}\n`);
  } else {
    console.log('  • API key already exists; skipping');
  }

  // Service health (global, not per-tenant).
  const services = ['inventory', 'payment', 'email', 'invoice', 'crm', 'webhook'] as const;
  for (const name of services) {
    await prisma.serviceHealth.upsert({
      where: { name },
      update: {},
      create: { name, status: ServiceStatus.HEALTHY },
    });
  }
  console.log(`  • ${services.length} services seeded`);

  await seedOrderWorkflow(tenant.id);
  await seedSubscriptionWorkflow(tenant.id);
  await seedAiSummaryWorkflow(tenant.id);

  console.log('🌱 Done.');
}

async function seedOrderWorkflow(tenantId: string) {
  const existing = await prisma.workflow.findUnique({
    where: { tenantId_name: { tenantId, name: 'Order Processing' } },
  });
  if (existing) return console.log('  • workflow "Order Processing" exists');

  await prisma.workflow.create({
    data: {
      tenantId,
      name: 'Order Processing',
      description: 'End-to-end order fulfillment with self-healing recovery',
      steps: {
        create: [
          {
            name: 'Reserve Inventory',
            type: StepType.RESERVE_INVENTORY,
            order: 1,
            isCritical: true,
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.RETRY_WITH_DELAY,
                maxRetries: 2,
                retryDelayMs: 500,
                backoffMultiplier: 2,
                timeoutMs: 10_000,
              },
            },
          },
          {
            name: 'Process Payment',
            type: StepType.PROCESS_PAYMENT,
            order: 2,
            isCritical: true,
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.FALLBACK,
                maxRetries: 3,
                retryDelayMs: 1_000,
                backoffMultiplier: 2,
                fallbackService: 'stripe-backup',
                timeoutMs: 15_000,
              },
            },
          },
          {
            name: 'Send Confirmation Email',
            type: StepType.SEND_EMAIL,
            order: 3,
            isCritical: false,
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.RETRY_WITH_DELAY,
                maxRetries: 5,
                retryDelayMs: 2_000,
                backoffMultiplier: 1.5,
              },
            },
          },
          {
            name: 'Generate Invoice',
            type: StepType.GENERATE_INVOICE,
            order: 4,
            isCritical: true,
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.RETRY_WITH_DELAY,
                maxRetries: 3,
                retryDelayMs: 1_500,
                backoffMultiplier: 2,
              },
            },
          },
        ],
      },
    },
  });
  console.log('  • workflow "Order Processing" seeded');
}

async function seedSubscriptionWorkflow(tenantId: string) {
  const existing = await prisma.workflow.findUnique({
    where: { tenantId_name: { tenantId, name: 'Subscription Renewal' } },
  });
  if (existing) return console.log('  • workflow "Subscription Renewal" exists');

  await prisma.workflow.create({
    data: {
      tenantId,
      name: 'Subscription Renewal',
      description: 'Renew subscription with payment + CRM sync',
      steps: {
        create: [
          {
            name: 'Charge Customer',
            type: StepType.PROCESS_PAYMENT,
            order: 1,
            isCritical: true,
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.FALLBACK,
                maxRetries: 2,
                retryDelayMs: 1_000,
                fallbackService: 'paypal-backup',
              },
            },
          },
          {
            name: 'Sync CRM',
            type: StepType.SYNC_CRM,
            order: 2,
            isCritical: false,
            recoveryPolicy: {
              create: { strategy: RecoveryStrategy.SKIP, maxRetries: 2 },
            },
          },
          {
            name: 'Notify Webhook',
            type: StepType.NOTIFY_WEBHOOK,
            order: 3,
            isCritical: false,
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.RETRY_WITH_DELAY,
                maxRetries: 3,
                retryDelayMs: 1_000,
              },
            },
          },
        ],
      },
    },
  });
  console.log('  • workflow "Subscription Renewal" seeded');
}

async function seedAiSummaryWorkflow(tenantId: string) {
  const existing = await prisma.workflow.findUnique({
    where: { tenantId_name: { tenantId, name: 'AI Document Summary' } },
  });
  if (existing) return console.log('  • workflow "AI Document Summary" exists');

  await prisma.workflow.create({
    data: {
      tenantId,
      name: 'AI Document Summary',
      description:
        'Summarize a document via LLM_CALL; demonstrate SWITCH_MODEL recovery from a flaky primary model.',
      steps: {
        create: [
          {
            name: 'Summarize',
            type: StepType.LLM_CALL,
            order: 1,
            isCritical: true,
            config: {
              provider: 'mock',
              model: 'mock-flaky',
              systemPrompt: 'You are a concise technical summarizer.',
              userPromptTemplate:
                'Summarize the following in one paragraph:\n\n{{payload.text}}',
              temperature: 0.2,
              maxTokens: 256,
            },
            recoveryPolicy: {
              create: {
                strategy: RecoveryStrategy.SWITCH_MODEL,
                maxRetries: 2,
                retryDelayMs: 500,
                fallbackService: 'mock-small',
              },
            },
          },
          {
            name: 'Notify Result',
            type: StepType.NOTIFY_WEBHOOK,
            order: 2,
            isCritical: false,
            recoveryPolicy: {
              create: { strategy: RecoveryStrategy.SKIP, maxRetries: 1 },
            },
          },
        ],
      },
    },
  });
  console.log('  • workflow "AI Document Summary" seeded');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
