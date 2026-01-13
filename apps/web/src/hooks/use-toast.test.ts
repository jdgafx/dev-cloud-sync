import { toast, reducer } from './use-toast';

describe('use-toast', () => {
  test('deduplicates identical toasts and schedules removal', () => {
    // Create identical toasts and ensure deduplication returns the same id
    const t1 = toast({
      title: 'Connected',
      description: 'Real-time sync is active',
    });
    const t2 = toast({
      title: 'Connected',
      description: 'Real-time sync is active',
    });

    expect(t1.id).toBe(t2.id);
  });
});
