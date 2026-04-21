import { z } from 'zod';

const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : /^(1|true|yes|on)$/i.test(v.trim())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: boolFromString.default(false),

  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  // Auth
  AUTH_ENABLED: boolFromString.default(true),
  // When AUTH_ENABLED=false the engine attaches this tenant to all requests.
  DEFAULT_TENANT_SLUG: z.string().default('default'),

  // Webhooks
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Idempotency
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),
});

export type AppEnv = z.infer<typeof schema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

// Module-level cached config — load once on first import.
let cached: AppEnv | undefined;
export function env(): AppEnv {
  if (!cached) cached = loadEnv();
  return cached;
}

// NestJS @nestjs/config loader factory
export default () => loadEnv();
