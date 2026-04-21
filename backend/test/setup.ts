// Forces development-friendly defaults so e2e tests don't require a real
// API key. AppModule still validates env via zod on startup.
process.env.NODE_ENV ??= 'test';
process.env.AUTH_ENABLED = 'false';
process.env.LOG_LEVEL ??= 'warn';
process.env.DEFAULT_TENANT_SLUG ??= 'default';
process.env.DATABASE_URL ??= 'postgresql://fre:fre_secret@localhost:5432/failure_recovery';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
