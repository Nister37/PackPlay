import { expect, test } from '@playwright/test';

test.describe('Live Full End-to-End Usability Journey', () => {
  test('Complete live user journey across all app features', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    // 1. Visit Welcome / Landing Page
    await page.goto('/');
    await expect(page).toHaveTitle(/PackPlay/i);

    // 2. Visit Login Page and log in with the real database user
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /access manifest/i })).toBeVisible();

    await page.getByLabel('OPERATOR EMAIL').fill('tester_usability@packplay.local');
    await page.getByLabel('ACCESS CODE').fill('TestPassword123!');
    await page.getByRole('button', { name: /access manifest/i }).click();

    // 3. Land on Dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.getByText('Operational Dashboard')).toBeVisible();

    // 4. Create a new Squad via UI
    await page.getByRole('button', { name: /\+ New Squad/i }).click();
    await page.waitForURL('**/groups/new', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'NEW MISSION' })).toBeVisible();

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const groupName = `Hawks FC ${uniqueId}`;
    await page.getByLabel('MISSION NAME').fill(groupName);
    await page.getByRole('button', { name: /TOURNAMENT/i }).click();
    await page.getByRole('button', { name: /CONTINUE →/i }).click();

    // Step 2: ITEM MANIFEST
    await expect(page.getByRole('heading', { name: 'ITEM MANIFEST' })).toBeVisible();

    // Add custom gear item via "+ ADD GEAR ITEM"
    await page.getByRole('button', { name: /\+ ADD GEAR ITEM/i }).click();
    await page.getByPlaceholder(/Item name/i).fill('Official Match Ball');
    await page.getByRole('button', { name: /^ADD$/ }).click();
    await expect(page.getByText('OFFICIAL MATCH BALL')).toBeVisible();

    // Finish & Invite
    await page.getByRole('button', { name: /FINISH & INVITE/i }).click();

    // Step 3: Access Pass / Join Mission
    await expect(page.getByRole('heading', { name: 'JOIN MISSION' })).toBeVisible();
    await expect(page.getByText('VARSITY ACCESS PASS', { exact: true })).toBeVisible();

    // Enter Mission
    await page.getByRole('button', { name: /ENTER MISSION/i }).click();

    // 5. Group Detail Page
    await page.waitForURL(/\/groups\/[a-z0-9-]+/, { timeout: 10000 });
    await expect(page.getByText(groupName).first()).toBeVisible();
    await expect(page.getByText('GEAR READINESS')).toBeVisible();

    // Wait for the manifest item to finish loading
    await expect(page.getByText('OFFICIAL MATCH BALL').first()).toBeVisible({ timeout: 10000 });

    // Dismiss critical availability alert if shown
    const cannotHelpBtn = page.getByRole('button', { name: /Cannot Help/i });
    if (await cannotHelpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cannotHelpBtn.click();
      await expect(cannotHelpBtn).toBeHidden({ timeout: 3000 });
    }

    // Click Open event to visit EventDetailPage
    await page.getByRole('link', { name: 'Open' }).first().click();
    await page.waitForURL(/\/groups\/.*\/activities\/.*/, { timeout: 10000 });

    // 6. Event Detail Page
    await expect(page.getByText('EVENT SPECIFICATION')).toBeVisible();
    await expect(page.getByRole('button', { name: /Item Manifest/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /weather/i })).toBeVisible();

    // Click Weather tab
    await page.getByRole('button', { name: /weather/i }).click();
    await expect(page.getByText(/Event Location & Weather Check Settings/i)).toBeVisible();

    // Return to Manifest tab and click Manage / Claim to go to SharedItemPage
    await page.getByRole('button', { name: /Item Manifest/i }).click();
    await page.getByRole('link', { name: /Manage \/ Claim/i }).first().click();
    await page.waitForURL(/\/groups\/.*\/equipment\/.*/, { timeout: 10000 });

    // 7. Shared Item Page
    await expect(page.getByText('OFFICIAL MATCH BALL').first()).toBeVisible();
    // Verify 3D canvas is present
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    // Claim the item if not already claimed
    const claimBtn = page.getByRole('button', { name: /CLAIM/i });
    if (await claimBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await claimBtn.click();
      const confirmClaim = page.getByRole('button', { name: /CONFIRM CLAIM/i });
      if (await confirmClaim.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmClaim.click();
      }
    }

    // Mark as packed
    const packBtn = page.getByRole('button', { name: /MARK AS PACKED/i });
    if (await packBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await packBtn.click();
      await expect(page.getByText('PACKED').first()).toBeVisible({ timeout: 5000 });
    }

    // 8. Checklists Page
    await page.goto('/checklists');
    await expect(page.getByRole('heading', { name: /checklists/i })).toBeVisible();

    const profileName = `Running ${uniqueId}`;
    await page.getByLabel('Sport name').fill(profileName);
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByLabel('Sport profile')).not.toHaveValue('', { timeout: 5000 });

    const checklistName = `Marathon Kit ${uniqueId}`;
    await page.getByLabel('Checklist name').fill(checklistName);
    await page.getByRole('button', { name: 'Create checklist' }).click();
    await expect(page.getByText(checklistName)).toBeVisible({ timeout: 5000 });

    // Click into ChecklistDetailPage
    await page.getByText(checklistName).click();
    await page.waitForURL(/\/checklists\/[a-z0-9-]+/, { timeout: 5000 });
    await expect(page.getByText(checklistName).first()).toBeVisible();

    // Add item to checklist
    await page.getByLabel('Item name').fill('Energy Gels');
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByText('Energy Gels')).toBeVisible();

    // 9. General Packing Page
    await page.goto('/packing');
    await expect(page.getByRole('heading', { name: /packing/i })).toBeVisible();

    // 10. Settings Page
    await page.goto('/settings');
    await expect(page.getByText('Account Settings')).toBeVisible();

    console.log('--- TEST AUDIT RESULTS ---');
    console.log('Console errors count:', consoleErrors.length, consoleErrors);
    console.log('Page errors count:', pageErrors.length, pageErrors);
    console.log('Failed requests count:', failedRequests.length, failedRequests);

    expect(pageErrors, `Page errors occurred: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
