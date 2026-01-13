import { formatDate, sleep } from './utils';

describe('utils', () => {
  describe('formatDate', () => {
    it('should format a date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(formatDate(date)).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('sleep', () => {
    it('should wait for the specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(100);
    });
  });
});
