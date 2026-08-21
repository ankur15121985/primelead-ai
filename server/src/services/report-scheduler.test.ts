import { describe, it, expect } from 'vitest';
import { calculateNextRun } from './report-scheduler';

describe('calculateNextRun', () => {
  describe('DAILY schedule', () => {
    it('always returns a future date', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'DAILY', hour: 0 }, now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    });

    it('defaults to 9 AM when hour is not specified', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'DAILY' }, now);
      expect(next.getHours()).toBe(9);
    });

    it('sets minutes/seconds/ms to zero', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'DAILY', hour: 14 }, now);
      expect(next.getMinutes()).toBe(0);
      expect(next.getSeconds()).toBe(0);
      expect(next.getMilliseconds()).toBe(0);
    });

    it('returns at most ~25 hours ahead', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'DAILY', hour: 0 }, now);
      const diffHours = (next.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeLessThanOrEqual(25);
    });
  });

  describe('WEEKLY schedule', () => {
    it('always returns a future date', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'WEEKLY', dayOfWeek: 3, hour: 10 }, now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    });

    it('returns at most ~8 days ahead', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'WEEKLY', dayOfWeek: now.getDay(), hour: now.getHours() + 1 }, now);
      const diffDays = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('sets hour correctly', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'WEEKLY', dayOfWeek: 2, hour: 15 }, now);
      expect(next.getHours()).toBe(15);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('MONTHLY schedule', () => {
    it('always returns a future date', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'MONTHLY', dayOfMonth: 1, hour: 8 }, now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    });

    it('returns at most ~32 days ahead', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'MONTHLY', dayOfMonth: 1, hour: 0 }, now);
      const diffDays = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeLessThanOrEqual(32);
    });

    it('sets hour correctly', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'MONTHLY', dayOfMonth: 15, hour: 12 }, now);
      expect(next.getHours()).toBe(12);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('never returns a time in the past for any schedule type', () => {
      const now = new Date();
      const schedules = [
        { frequency: 'DAILY' as const, hour: 0 },
        { frequency: 'WEEKLY' as const, dayOfWeek: 6, hour: 23 },
        { frequency: 'MONTHLY' as const, dayOfMonth: 1, hour: 0 },
      ];

      for (const schedule of schedules) {
        const next = calculateNextRun(schedule, now);
        expect(next.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    it('defaults hour to 9 when not provided', () => {
      const now = new Date();
      const next = calculateNextRun({ frequency: 'DAILY' }, now);
      expect(next.getHours()).toBe(9);
    });
  });
});
