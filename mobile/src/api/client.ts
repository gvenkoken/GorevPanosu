import { request } from './transport';
export { ApiError } from './transport';
export type { Fetch } from './transport';

// Kept narrowly scoped for the existing scaffold's readiness screen.
export function api<T>(path: '/health/ready'): Promise<T> {
  if (path !== '/health/ready') throw new Error('Unsupported readiness endpoint');
  return request<T>(path);
}

