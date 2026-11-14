import { expect, test } from '@playwright/test';

test.describe('Live Usability & Error Detection Suite', () => {
  test('Audit all frontend routes for console errors and runtime exceptions', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    // 1. Public Welcome / Landing page
    await page.goto('/');
    await expect(page).toHaveTitle(/PackPlay/i);
    await expect(page.locator('body')).toBeVisible();

    // 2. Login page
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /access manifest/i })).toBeVisible();

    // 3. Register page
    await page.goto('/register');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

    // 4. Forgot password
    await page.goto('/forgot-password');
    await expect(page.getByRole('button', { name: /reset link/i })).toBeVisible();

    // 5. Resend verification
    await page.goto('/resend-verification');
    await expect(page.getByRole('button', { name: /send verification/i })).toBeVisible();

    // 6. Verify email page
    await page.goto('/verify-email?token=dummy-token');
    await page.waitForTimeout(500);

    // 7. Reset password page
    await page.goto('/reset-password?token=dummy-token');
    await page.waitForTimeout(500);

    // 8. Log in with real test user
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /access manifest/i })).toBeVisible();
    await page.getByLabel('OPERATOR EMAIL').fill('tester_usability@packplay.local');
    await page.getByLabel('ACCESS CODE').fill('TestPassword123!');
    await page.getByRole('button', { name: /access manifest/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Intercept notifications and basic mocks for protected shell so we can navigate
    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
      }),
    );

    await page.route('**/api/groups', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'group-1', name: 'Thunder Squad', sport: 'SOCCER', memberCount: 5, role: 'OWNER' },
        ]),
      }),
    );

    await page.route('**/api/groups/group-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'group-1', name: 'Thunder Squad', sport: 'SOCCER', memberCount: 5, role: 'OWNER' }),
      }),
    );

    await page.route('**/api/groups/group-1/members', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'm1', userId: 'u1', role: 'ADMIN', user: { id: 'u1', name: 'Tester', email: 'tester@example.com' } },
        ]),
      }),
    );

    await page.route('**/api/groups/group-1/activities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'act-1', name: 'Final Match', activityType: 'COMPETITION', group: { name: 'Thunder Squad' } },
        ]),
      }),
    );

    await page.route('**/api/activities/act-1/readiness', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          groupPercentage: 80,
          totalSharedItems: 5,
          coveredSharedItems: 4,
          missingSharedItems: 1,
          memberReadiness: [],
          risks: [],
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
            name: 'Soccer Ball',
            category: 'BALLS',
            requiredQuantity: 2,
            coverage: { committedQuantity: 2, uncoveredQuantity: 0, status: 'COVERED' },
            responsibilities: [],
          },
        ]),
      }),
    );

    await page.route('**/api/shared-items/item-1/coverage', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'COVERED',
          requiredQuantity: 2,
          committedQuantity: 2,
          uncoveredQuantity: 0,
          item: { id: 'item-1', name: 'Soccer Ball', category: 'BALLS' },
          responsibilities: [],
        }),
      }),
    );

    // 8. Dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Operational Dashboard')).toBeVisible();

    // 9. Groups list
    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /my groups/i })).toBeVisible();

    // 10. Create group
    await page.goto('/groups/new');
    await expect(page.getByRole('heading', { name: /new mission/i })).toBeVisible();

    // 11. Group detail
    await page.goto('/groups/group-1');
    await expect(page.getByText('Thunder Squad').first()).toBeVisible();

    // 12. Group invite
    await page.route('**/api/groups/group-1/invitations', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'inv-tok-1', expiresAt: new Date(Date.now() + 86400000).toISOString() }),
      }),
    );
    await page.goto('/groups/group-1/invite');
    await expect(page.getByText(/invite/i).first()).toBeVisible();

    // 13. Equipment manifest
    await page.goto('/groups/group-1/equipment');
    await expect(page.getByRole('heading', { name: /item manifest/i })).toBeVisible();

    // 14. Shared item page
    await page.goto('/groups/group-1/equipment/item-1');
    await expect(page.getByText('Soccer Ball').first()).toBeVisible();

    // 15. Checklists page
    await page.route('**/api/sport-profiles', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/api/checklists', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'check-1', name: 'Pre-season checklist', isTemplate: false, _count: { items: 2 } },
        ]),
      }),
    );
    await page.goto('/checklists');
    await expect(page.getByText('Pre-season checklist')).toBeVisible();

    // 16. Checklist detail page
    await page.route('**/api/checklists/check-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'check-1',
          name: 'Pre-season checklist',
          isTemplate: false,
          items: [{ id: 'ci-1', name: 'Shin guards', quantity: 1, isMandatory: true, category: 'PROTECTION' }],
        }),
      }),
    );
    await page.goto('/checklists/check-1');
    await expect(page.getByText('Pre-season checklist')).toBeVisible();
    await expect(page.getByText('Shin guards')).toBeVisible();

    // 17. General packing
    await page.goto('/packing');
    await expect(page.getByRole('heading', { name: /packing/i })).toBeVisible();

    // 18. Settings page
    await page.route('**/api/auth/sso/methods', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ type: 'PASSWORD', email: 'tester_usability@packplay.local' }]),
      }),
    );
    await page.route('**/api/auth/sso/connect-requests', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/api/equipment-catalogue/preferences/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ personalizationEnabled: false }) }),
    );
    await page.route('**/api/groups/group-1/weather-rules', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto('/settings');
    await expect(page.getByText('Account Settings')).toBeVisible();

    console.log('Console Errors captured:', consoleErrors);
    console.log('Page Errors captured:', pageErrors);
    console.log('Failed Requests captured:', failedRequests);

    expect(pageErrors, `Page threw unhandled exceptions: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
