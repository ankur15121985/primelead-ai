/**
 * In-memory server diagnostics for the admin dashboard.
 * - startedAt / uptime
 * - ring buffer of recent unhandled errors (never written to disk)
 */

export const startedAt = Date.now();

export interface LogEntry {
  at: string;
  method: string;
  path: string;
  message: string;
  status: number;
  code: string;
  requestId?: string;
}

const MAX_ENTRIES = 50;
const entries: LogEntry[] = [];

export function recordError(entry: Omit<LogEntry, 'at'>): void {
  entries.push({ at: new Date().toISOString(), ...entry });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function recentErrors(limit = 25): LogEntry[] {
  return entries.slice(-limit).reverse();
}

export function uptimeSeconds(): number {
  return Math.floor((Date.now() - startedAt) / 1000);
}

export function clearErrors(): void {
  entries.length = 0;
}
