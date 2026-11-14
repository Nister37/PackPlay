import { expect, test } from '@playwright/test';

test.describe('Packing Swiper, Navigation & Create Group Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 'u1', name: 'Tester', email: 'test@example.com' }),
      );
    });

    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }),
    );
  });

  test('Create Group renders desktop layout and step flow', async ({ page }) => {
    await page.route('**/api/groups', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'group-100', name: 'Thunder FC', sportType: 'COMPETITION' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/groups/group-100/activities', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'act-100', name: 'Mission Activity', activityType: 'COMPETITION' }),
      }),
    );

    await page.goto('/groups/new');

    // Verify step tracker and header
    await expect(page.getByRole('heading', { name: 'NEW MISSION' })).toBeVisible();
    await expect(page.getByLabel('MISSION NAME')).toBeVisible();

    // Verify 3 activity choices exist
    await expect(page.getByRole('button', { name: /TOURNAMENT/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /AWAY GAME/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /PRACTICE/i })).toBeVisible();

    // Fill and continue
    await page.getByLabel('MISSION NAME').fill('Thunder FC');
    await page.getByRole('button', { name: /CONTINUE →/i }).click();

    // Verify transition to Step 2
    await expect(page.getByRole('heading', { name: 'ITEM MANIFEST' })).toBeVisible();
    await expect(page.getByText('NO ITEMS YET')).toBeVisible();
  });

  test('Packing swiper persists swiped items across page navigation and supports Reset Deck', async ({ page }) => {
    const mockGroups = [{ id: 'group-1', name: 'Thunder Squad' }];
    const mockActivities = [{ id: 'act-1', name: 'Championship Final', activityType: 'COMPETITION' }];
    const mockItems = [
      {
        id: 'item-1',
        name: 'Match Soccer Ball',
        category: 'EQUIPMENT',
        isMandatory: true,
        requiredQuantity: 2,
        coverage: { committedQuantity: 0, uncoveredQuantity: 2 },
        responsibilities: [],
      },
      {
        id: 'item-2',
        name: 'First Aid Kit',
        category: 'SAFETY',
        isMandatory: true,
        requiredQuantity: 1,
        coverage: { committedQuantity: 0, uncoveredQuantity: 1 },
        responsibilities: [],
      },
    ];

    await page.route('**/api/groups', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockGroups) }),
    );

    await page.route('**/api/groups/group-1/activities', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockActivities) }),
    );

    await page.route('**/api/activities/act-1/shared-items', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockItems) }),
    );

    await page.route('**/api/shared-items/item-1/claim', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/packing');

    // First card should be Match Soccer Ball
    await expect(page.getByText('Match Soccer Ball', { exact: true })).toBeVisible();
    await expect(page.getByText('CARD 1 OF 2')).toBeVisible();

    // Swipe first card right (claim/bring it)
    await page.getByRole('button', { name: /I'LL BRING IT →/i }).click();

    // Second card should now be First Aid Kit
    await expect(page.getByText('First Aid Kit', { exact: true })).toBeVisible();
    await expect(page.getByText('CARD 2 OF 2')).toBeVisible();

    // Swipe second card left (not my job)
    await page.getByRole('button', { name: /NOT MY JOB/i }).click();

    // Deck should be finished
    await expect(page.getByText("YOU'RE ALL SET!")).toBeVisible();
    await expect(page.getByRole('button', { name: 'RESET DECK', exact: true })).toBeVisible();

    // Navigate away to Checklists
    await page.route('**/api/sport-profiles', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/api/checklists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto('/checklists');
    await expect(page.getByRole('heading', { name: /CHECKLISTS/i })).toBeVisible();

    // Return to packing page — swiped state MUST persist and not show the items again!
    await page.goto('/packing');
    await expect(page.getByText("YOU'RE ALL SET!")).toBeVisible();
    await expect(page.getByText('Match Soccer Ball', { exact: true })).not.toBeVisible();

    // Clicking RESET DECK should bring the items back
    await page.getByRole('button', { name: 'RESET DECK', exact: true }).click();
    await expect(page.getByText('Match Soccer Ball', { exact: true })).toBeVisible();
  });
});
