import { calculateCoverage } from './coverage.util';
import { SharedResponsibilityStatus } from '@prisma/client';

describe('shared equipment performance guard', () => {
  it('calculates coverage for 10,000 responsibilities within a bounded time', () => {
    const responsibilities = Array.from({ length: 10_000 }, (_, index) => ({
      committedQuantity: 1,
      packedQuantity: index % 2,
      extraQuantity: 0,
      status: index % 2 ? SharedResponsibilityStatus.PACKED : SharedResponsibilityStatus.COMMITTED,
    }));
    const started = performance.now();
    const result = calculateCoverage(10_000, responsibilities);
    const elapsed = performance.now() - started;
    expect(result.committedQuantity).toBe(10_000);
    expect(elapsed).toBeLessThan(250);
  });
});
