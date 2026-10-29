// The API base: the same origin on the web build (served under /mobile/ next to /api), or EXPO_PUBLIC_API_URL on a device.
const base = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) throw new ApiError(response.status, `${response.status} ${response.statusText}`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
