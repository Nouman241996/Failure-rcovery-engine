import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_PREFIX = 'fre_';

export interface GeneratedKey {
  raw: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedKey {
  const random = randomBytes(32).toString('base64url');
  const raw = `${KEY_PREFIX}${random}`;
  const prefix = raw.slice(0, 12);
  const hash = sha256(raw);
  return { raw, prefix, hash };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function hmacSign(secret: string, payload: string): string {
  // Webhook signing — uses HMAC-SHA256, hex digest. Caller verifies via
  // `X-FRE-Signature` header.
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  return createHmac('sha256', secret).update(payload).digest('hex');
}
