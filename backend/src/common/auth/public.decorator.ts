import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Marks a route as publicly accessible (skips API key auth).
 * Use sparingly — health/metrics/swagger only.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
