/**
 * Typed fetch wrapper for the PRIMELEAD API.
 * - Sends the double-submit CSRF token on state-changing requests
 * - Always sends credentials (session cookie)
 * - Throws a friendly ApiError with status + code
 */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method || (opts.body !== undefined || opts.formData ? 'POST' : 'GET');
  const headers: Record<string, string> = { ...(opts.headers || {}) };

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const csrf = readCookie('pl_csrf');
  if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['x-csrf-token'] = csrf;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body,
    credentials: 'include',
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const err = (payload as { error?: { message?: string; code?: string } })?.error || {};
    if (res.status === 401 && !path.includes('/auth/me')) {
      // session expired — let the auth provider handle the redirect
      window.dispatchEvent(new CustomEvent('pl:unauthorized'));
    }
    throw new ApiError(err.message || 'Something went wrong. Please try again.', res.status, err.code || 'ERROR');
  }
  return (payload as { data: T }).data;
}

/** Download a raw endpoint (CSV) as a file. */
export async function download(path: string, filename: string): Promise<void> {
  const res = await fetch(`/api${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError('Download failed', res.status, 'ERROR');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
