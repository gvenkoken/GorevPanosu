const base = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function request<T>(path: string, init?: RequestInit, send: Fetch = fetch): Promise<T> {
  const response = await send(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new ApiError(response.status, `${response.status} ${response.statusText}`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
