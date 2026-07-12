import type { SharedItemWithCoverage } from '@/types';

const shownGroupAlerts = new Set<string>();

export function getTopmostMissingItem(
  items: SharedItemWithCoverage[] | undefined,
): SharedItemWithCoverage | null {
  return items?.find((item) => item.coverage.uncoveredQuantity > 0) ?? null;
}

export function claimLiveTakeoverAlert(userId: string, groupId: string): boolean {
  const key = `${userId}:${groupId}`;
  if (shownGroupAlerts.has(key)) return false;

  shownGroupAlerts.add(key);
  return true;
}

export function resetLiveTakeoverSession(): void {
  shownGroupAlerts.clear();
}
