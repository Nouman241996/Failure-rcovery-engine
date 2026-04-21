import { generateApiKey, hmacSign, sha256 } from './crypto';

describe('crypto helpers', () => {
  it('generateApiKey returns a fre_-prefixed key with deterministic hash', () => {
    const k = generateApiKey();
    expect(k.raw.startsWith('fre_')).toBe(true);
    expect(k.prefix).toBe(k.raw.slice(0, 12));
    expect(k.hash).toBe(sha256(k.raw));
    expect(k.hash).toHaveLength(64);
  });

  it('sha256 is stable for identical inputs', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abcd'));
  });

  it('hmacSign returns 64-char hex digests', () => {
    const sig = hmacSign('secret', 'payload');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
