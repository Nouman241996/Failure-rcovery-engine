import { calcBackoff, classifyFailure } from './recovery.utils';
import { FailureType } from '@prisma/client';

describe('classifyFailure', () => {
  it.each<[string, FailureType]>([
    ['Request timed out', FailureType.TIMEOUT],
    ['Payment gateway timeout', FailureType.TIMEOUT],
    ['ECONNREFUSED', FailureType.NETWORK_ERROR],
    ['Service unavailable', FailureType.EXTERNAL_SERVICE_FAILURE],
    ['HTTP 503 returned', FailureType.EXTERNAL_SERVICE_FAILURE],
    ['Validation failed: email is required', FailureType.VALIDATION_ERROR],
    ['Something weird happened', FailureType.UNKNOWN],
  ])('classifies "%s" as %s', (msg, expected) => {
    expect(classifyFailure(new Error(msg))).toBe(expected);
  });

  it('uses error.name as a fallback signal', () => {
    const err = new Error('boom');
    err.name = 'TimeoutError';
    expect(classifyFailure(err)).toBe(FailureType.TIMEOUT);
  });
});

describe('calcBackoff', () => {
  it('grows with attempt × multiplier within ±10% jitter', () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = calcBackoff(attempt, 1000, 2);
      const base = 1000 * Math.pow(2, attempt - 1);
      expect(delay).toBeGreaterThanOrEqual(Math.floor(base * 0.9));
      expect(delay).toBeLessThanOrEqual(Math.ceil(base * 1.1));
    }
  });

  it('caps at the provided maximum', () => {
    expect(calcBackoff(20, 1000, 2, 5_000)).toBeLessThanOrEqual(5_000);
  });
});
