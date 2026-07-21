import { expect, test } from '@playwright/test';

test('password recovery submits and shows privacy-safe confirmation', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('person@example.com');
  await page.getByRole('button', { name: /email reset link/i }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
});

test('authenticated user creates a sport profile and checklist', async ({ page }) => {
  const profiles: Array<Record<string, unknown>> = [];
  const checklists: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'test-token');
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
  await page.route('**/api/sport-profiles', async (route) => {
    if (route.request().method() === 'POST') {
      const profile = { id: 'profile-1', ...route.request().postDataJSON() };
      profiles.push(profile);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      });
    } else
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profiles),
      });
  });
  await page.route('**/api/checklists', async (route) => {
    if (route.request().method() === 'POST') {
      const checklist = {
        id: 'check-1',
        isTemplate: false,
        _count: { items: 0 },
        ...route.request().postDataJSON(),
      };
      checklists.push(checklist);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(checklist),
      });
    } else
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(checklists),
      });
  });
  await page.goto('/checklists');
  await page.getByLabel('Sport name').fill('Volleyball');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByLabel('Sport profile')).toHaveValue('profile-1');
  await page.getByLabel('Checklist name').fill('Match day gear');
  await page.getByRole('button', { name: 'Create checklist' }).click();
  await expect(page.getByText('Match day gear')).toBeVisible();
});

test('stored HTML in API data remains inert and notifications render the paginated contract', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u1', name: 'Tester', email: 'test@example.com' }),
    );
  });
  const attack = '<img src=x onerror="globalThis.__xss=1"><script>alert(1)</script>';
  await page.route('**/api/groups', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'group-1',
          name: 'Security group',
          description: attack,
          sportType: 'test',
          memberCount: 1,
          role: 'OWNER',
        },
      ]),
    }),
  );
  await page.route('**/api/notifications', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'notification-1',
            userId: 'u1',
            type: 'ITEM_MISSING',
            isRead: false,
            createdAt: new Date().toISOString(),
            payload: { sharedItemName: attack, reason: 'FORGOT' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
    }),
  );

  await page.goto('/groups');
  await expect(page.getByText(attack, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /notifications \(1 unread\)/i }).click();
  await expect(page.getByText(`${attack}: forgot`, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (globalThis as typeof globalThis & { __xss?: number }).__xss),
  ).toBeUndefined();
  expect(runtimeErrors).toEqual([]);
});
