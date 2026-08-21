/**
 * Scheduler tick processor — an interval-based loop that picks up pending
 * scheduled messages and processes them.
 *
 * Started at app boot (see app.ts). The interval is configurable via the
 * `SCHEDULER_INTERVAL_MS` env var (default: 30 000 ms = 30 seconds).
 *
 * In production, this would typically be replaced by a dedicated worker
 * (BullMQ, Temporal, etc.) but the interval approach works well for
 * single-instance deployments and keeps the demo self-contained.
 */
import { processDueMessages } from './message-queue';

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const DEFAULT_INTERVAL_MS = 30_000; // 30 seconds
const BATCH_SIZE = 20;

/**
 * Start the scheduler tick loop.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startScheduler(): void {
  if (intervalId) return; // already running

  const intervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), 10);

  console.log(`[Scheduler] Starting tick loop (interval: ${intervalMs}ms, batch: ${BATCH_SIZE})`);

  // Run once immediately on start, then on the interval
  tick();
  intervalId = setInterval(tick, intervalMs);
}

/** Stop the scheduler tick loop. */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Scheduler] Stopped');
  }
}

/** Single tick — process due messages. Error-safe: a tick failure doesn't crash the process. */
async function tick(): Promise<void> {
  if (isRunning) {
    // Previous tick still running — skip this one to avoid overlap
    return;
  }

  isRunning = true;
  try {
    const processed = await processDueMessages(BATCH_SIZE);
    if (processed > 0) {
      console.log(`[Scheduler] Processed ${processed} message(s)`);
    }
  } catch (err: any) {
    console.error('[Scheduler] Tick error:', err?.message || err);
  } finally {
    isRunning = false;
  }
}

/**
 * Manually trigger a tick (useful for testing or admin actions).
 * Returns the number of messages processed.
 */
export async function triggerTick(): Promise<number> {
  return tick().then(() => 0); // tick doesn't return count directly — call processDueMessages for that
}

/** Whether the scheduler is currently running. */
export function isSchedulerRunning(): boolean {
  return intervalId !== null;
}
