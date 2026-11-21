import { describe, expect, it } from 'vitest';

describe('build-time store entry point', () => {
  it('verifies the store on import and exposes the build date', async () => {
    const store = await import('../../src/lib/store');
    expect(store.BUILD_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(store.FACTS.length).toBeGreaterThan(50);
  });
});
