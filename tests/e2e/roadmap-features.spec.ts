import { expect, test } from '@playwright/test';

test.describe('Roadmap Features E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 'u1', name: 'Tester', email: 'test@example.com' }),
      );
    });

    // Fallback handler for unmocked API routes so nothing triggers 401 redirects
    await page.route('**/api/**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }),
    );
  });

  test('Team Inventory catalogue displays stock and supports custody return', async ({ page }) => {
    let custodyReturned = false;

    await page.route('**/api/groups/group-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'group-1', name: 'Thunder FC', role: 'ADMIN' }),
      }),
    );

    await page.route('**/api/groups/group-1/members', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'm1', userId: 'u1', role: 'ADMIN', user: { id: 'u1', name: 'Tester', email: 'test@example.com' } },
        ]),
      }),
    );

    await page.route('**/api/groups/group-1/inventory*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'inv-1',
              name: 'Match Soccer Ball',
              category: 'EQUIPMENT',
              trackingType: 'BULK',
              totalQuantity: 10,
              availableQuantity: 8,
              checkedOutQuantity: 2,
              unit: 'balls',
            },
          ],
          meta: { total: 1 },
        }),
      }),
    );

    await page.route('**/api/groups/group-1/inventory/locations/all', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.route('**/api/groups/group-1/inventory-overdue', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          custodyReturned
            ? []
            : [
                {
                  id: 'cust-1',
                  quantity: 2,
                  checkedOutAt: new Date().toISOString(),
                  expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
                  item: { name: 'Match Soccer Ball' },
                  user: { name: 'Alex Johnson', email: 'alex@example.com' },
                },
              ],
        ),
      }),
    );

    await page.route('**/api/groups/group-1/inventory-operations/custodies/cust-1/return', async (route) => {
      custodyReturned = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/groups/group-1/inventory');

    // Catalogue renders item and stock counts
    await expect(page.getByRole('heading', { name: 'Team Inventory' })).toBeVisible();
    await expect(page.getByText('Match Soccer Ball')).toBeVisible();
    await expect(page.getByText('8 / 10')).toBeVisible();

    // Switch to Custody & Returns tab
    await page.getByRole('button', { name: 'Custody & Returns' }).click();

    // Check active custody list
    await expect(page.getByText('Alex Johnson', { exact: true })).toBeVisible();

    // Click Return button and submit return modal
    await page.getByRole('button', { name: 'Return', exact: true }).click();
    await expect(page.getByText('Return Equipment')).toBeVisible();
    await page.getByRole('button', { name: 'Complete Return' }).click();

    // Custody section shows all items returned
    await expect(page.getByText('No active custody records')).toBeVisible();
    expect(custodyReturned).toBe(true);
  });

  test('Inventory QR resolution page allows one-tap custody return', async ({ page }) => {
    let returnCalled = false;

    await page.route('**/api/inventory-qr/qr-tok-999', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'qr-tok-999',
          targetType: 'ITEM',
          item: {
            id: 'inv-1',
            name: 'Agility Ladders',
            category: 'TRAINING',
            totalQuantity: 5,
            availableQuantity: 2,
            groupId: 'group-1',
            unit: 'pcs',
          },
          activeCustody: {
            id: 'cust-1',
            quantity: 3,
            checkedOutAt: new Date().toISOString(),
            user: { name: 'Sam Player', email: 'sam@example.com' },
          },
        }),
      }),
    );

    await page.route('**/api/groups/group-1/inventory-operations/custodies/cust-1/return', async (route) => {
      returnCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/inventory-qr/qr-tok-999');

    await expect(page.getByText('QR Equipment Scan')).toBeVisible();
    await expect(page.getByText('Agility Ladders')).toBeVisible();
    await expect(page.getByText('Sam Player')).toBeVisible();

    // Return custody
    await page.getByRole('button', { name: /Return to Inventory Now/i }).click();
    await expect(page.getByText('Equipment returned successfully!')).toBeVisible();
    expect(returnCalled).toBe(true);
  });

  test('Event details page renders readiness meter, weather suggestion accept, and smart entry', async ({
    page,
  }) => {
    let suggestionAccepted = false;
    let smartDraftAccepted = false;

    await page.route('**/api/groups/group-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'group-1', name: 'Thunder FC', role: 'ADMIN' }),
      }),
    );

    await page.route('**/api/groups/group-1/members', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'm1', userId: 'u1', role: 'ADMIN', user: { id: 'u1', name: 'Tester', email: 'test@example.com' } },
        ]),
      }),
    );

    await page.route('**/api/groups/group-1/activities/act-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'act-1',
          name: 'Spring Cup Quarterfinals',
          groupId: 'group-1',
          sportProfileId: null,
          startTime: new Date().toISOString(),
          endTime: null,
          location: 'Meadow Park Field 3',
          status: 'ACTIVE',
        }),
      }),
    );

    await page.route('**/api/activities/act-1/readiness', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activityId: 'act-1',
          groupPercentage: 67,
          coveredSharedItems: 2,
          totalSharedItems: 3,
          totalPersonalItems: 0,
          packedPersonalItems: 0,
          personalPercentage: 0,
          memberReadiness: [],
        }),
      }),
    );

    await page.route('**/api/activities/act-1/shared-items', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'item-1',
            name: 'First Aid Kit',
            requiredQuantity: 1,
            coverage: { committedQuantity: 1, uncoveredQuantity: 0 },
            responsibilities: [
              { id: 'r1', quantity: 1, status: 'COMMITTED', user: { id: 'u1', name: 'Tester' } },
            ],
          },
        ]),
      }),
    );

    await page.route('**/api/groups/group-1/activities/act-1/weather', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activityId: 'act-1',
          location: 'Meadow Park Field 3',
          weather: {
            temperatureC: 12.0,
            precipitationProbability: 85,
            windSpeedKmh: 15,
            description: 'Rain shower',
          },
          suggestions: suggestionAccepted
            ? []
            : [
                {
                  id: 'sug-1',
                  ruleName: 'Rain Gear Alert',
                  equipmentName: 'Weather Ponchos',
                  quantity: 4,
                  category: 'EQUIPMENT',
                  reason: 'High rain probability (85%)',
                  status: 'PENDING',
                },
              ],
        }),
      }),
    );

    await page.route('**/api/groups/group-1/activities/act-1/weather-suggestions/sug-1/accept', async (route) => {
      suggestionAccepted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/activities/act-1/smart-drafts/accept', async (route) => {
      smartDraftAccepted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 2 }),
      });
    });

    await page.goto('/groups/group-1/activities/act-1');

    // Readiness meter renders
    await expect(page.getByText('Spring Cup Quarterfinals')).toBeVisible();
    await expect(page.getByText('67%')).toBeVisible();

    // Weather suggestion appears and can be accepted on Weather tab
    await page.getByRole('button', { name: /Weather & Suggestions/i }).click();
    await expect(page.getByText('Weather Ponchos ×4')).toBeVisible();
    await expect(page.getByText('High rain probability (85%)')).toBeVisible();
    await page.getByRole('button', { name: 'Accept to Manifest' }).click();
    await expect.poll(() => suggestionAccepted).toBe(true);

    // Switch back to Item Manifest tab
    await page.getByRole('button', { name: /Item Manifest/i }).click();

    // Natural Language Smart Add
    await page.getByRole('button', { name: /Smart Add \(Natural Language\)/i }).click();
    await page.getByPlaceholder(/e\.g\. 2 match balls/i).fill('3 practice cones and 2 water bottles');
    await expect(page.getByText('Parsed Draft Items (2)')).toBeVisible();

    await page.getByRole('button', { name: /Accept & Add Items \(2\)/i }).click();
    await expect.poll(() => smartDraftAccepted).toBe(true);
  });

  test('Calendar feeds page previews external schedule and links subscription', async ({ page }) => {
    let feedCreated = false;

    await page.route('**/api/groups/group-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'group-1', name: 'Thunder FC', role: 'ADMIN' }),
      }),
    );

    await page.route('**/api/groups/group-1/members', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'm1', userId: 'u1', role: 'ADMIN', user: { id: 'u1', name: 'Tester', email: 'test@example.com' } },
        ]),
      }),
    );

    await page.route('**/api/groups/group-1/calendar-feeds/preview-url', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [
            {
              title: 'Thunder FC vs Galaxy',
              startDate: new Date().toISOString(),
              location: 'City Stadium',
            },
          ],
        }),
      }),
    );

    await page.route('**/api/groups/group-1/calendar-feeds', async (route) => {
      if (route.request().method() === 'POST') {
        feedCreated = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'feed-1',
            name: 'TeamSnap League Schedule',
            feedUrlMasked: 'https://example.com/teamsnap.ics',
            syncStatus: 'ACTIVE',
            lastSyncedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            feedCreated
              ? [
                  {
                    id: 'feed-1',
                    name: 'TeamSnap League Schedule',
                    feedUrlMasked: 'https://example.com/teamsnap.ics',
                    syncStatus: 'ACTIVE',
                    lastSyncedAt: new Date().toISOString(),
                  },
                ]
              : [],
          ),
        });
      }
    });

    await page.goto('/groups/group-1/calendar');

    await expect(page.getByText('Calendar & Schedule Feeds')).toBeVisible();

    // Enter feed URL and preview
    await page.getByLabel('Feed Name').fill('TeamSnap League Schedule');
    await page.getByLabel('HTTPS iCalendar / WebCal URL').fill('https://example.com/teamsnap.ics');
    await page.getByRole('button', { name: 'Preview Feed' }).click();

    // Verify preview card
    await expect(page.getByText('Thunder FC vs Galaxy')).toBeVisible();
    await expect(page.getByText('City Stadium')).toBeVisible();

    // Connect feed
    await page.getByRole('button', { name: 'Connect & Sync' }).click();
    await expect(page.getByText('TeamSnap League Schedule')).toBeVisible();
    expect(feedCreated).toBe(true);
  });

  test('Settings page shows connected SSO methods and suggestion personalization toggle', async ({
    page,
  }) => {
    let toggledPersonalization = false;

    await page.route('**/api/auth/sso/methods', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { type: 'PASSWORD', email: 'test@example.com' },
          { type: 'SSO', provider: 'GOOGLE', email: 'test@gmail.com' },
        ]),
      }),
    );

    await page.route('**/api/equipment-catalogue/preferences/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ personalizationEnabled: true }),
      }),
    );

    await page.route('**/api/equipment-catalogue/preferences/me/personalization', async (route) => {
      if (route.request().method() === 'DELETE') {
        toggledPersonalization = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ personalizationEnabled: false }),
        });
      }
    });

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
    await expect(page.getByText('Email & Password')).toBeVisible();
    await expect(page.getByText('Google Account')).toBeVisible();

    // Personalization toggle checkbox
    const checkbox = page.getByRole('checkbox', { name: /Personalized gear suggestions/i });
    await expect(checkbox).toBeVisible();
    await checkbox.click();
    await expect.poll(() => toggledPersonalization).toBe(true);
  });
});
