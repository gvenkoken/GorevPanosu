export interface Problem {
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly fieldErrors: Record<string, string[]>
  readonly warning: string | undefined
  constructor(readonly status: number, readonly problem: Problem) {
    super(problem.detail ?? problem.title ?? `İstek başarısız (${status})`)
    this.name = 'ApiError'
    this.fieldErrors = status === 400 ? problem.errors ?? {} : {}
    this.warning = status === 409 || !Object.keys(this.fieldErrors).length ? this.message : undefined
  }
}
export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export async function api<T>(path: string, init?: RequestInit, request: Fetch = fetch): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await request(path, { ...init, headers })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw new ApiError(response.status, body && typeof body === 'object' ? body as Problem : {})
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}
