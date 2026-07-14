import { expect, test } from '@playwright/test';

test('password recovery submits and shows privacy-safe confirmation', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
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
    localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'test@example.com' }));
  });
  await page.route('**/api/sport-profiles', async (route) => {
    if (route.request().method() === 'POST') {
      const profile = { id: 'profile-1', ...route.request().postDataJSON() };
      profiles.push(profile);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(profile) });
    } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profiles) });
  });
  await page.route('**/api/checklists', async (route) => {
    if (route.request().method() === 'POST') {
      const checklist = { id: 'check-1', isTemplate: false, _count: { items: 0 }, ...route.request().postDataJSON() };
      checklists.push(checklist);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(checklist) });
    } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(checklists) });
  });
  await page.goto('/checklists');
  await page.getByLabel('Sport name').fill('Volleyball');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByLabel('Sport profile')).toHaveValue('profile-1');
  await page.getByLabel('Checklist name').fill('Match day gear');
  await page.getByRole('button', { name: 'Create checklist' }).click();
  await expect(page.getByText('Match day gear')).toBeVisible();
});
