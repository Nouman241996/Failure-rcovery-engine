import { loadEnv } from './env';

describe('loadEnv', () => {
  it('parses minimum required vars with defaults', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@h:5432/db',
    } as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.RATE_LIMIT_MAX).toBeGreaterThan(0);
    expect(env.AUTH_ENABLED).toBe(true);
  });

  it('throws on missing DATABASE_URL', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it('coerces booleans and numbers from strings', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@h:5432/db',
      AUTH_ENABLED: 'false',
      PORT: '4000',
      RATE_LIMIT_MAX: '500',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.AUTH_ENABLED).toBe(false);
    expect(env.PORT).toBe(4000);
    expect(env.RATE_LIMIT_MAX).toBe(500);
  });
});
