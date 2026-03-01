const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer();
  server = app.listen(3457);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3457');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Dashboard UI', () => {
  test('dashboard shows after login', async ({ page }) => {
    await login(page);
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);
  });

  test('dashboard shows club tabs', async ({ page }) => {
    await login(page);
    await expect(page.locator('#club-tabs')).toBeVisible();
    await expect(page.locator('#club-tabs button').first()).toBeVisible();
  });

  test('dashboard shows upcoming events section', async ({ page }) => {
    await login(page);
    await expect(page.locator('#view-dashboard h3').filter({ hasText: 'Kommende Termine' })).toBeVisible();
  });

  test('dashboard shows notifications section', async ({ page }) => {
    await login(page);
    await expect(page.locator('#view-dashboard h3').filter({ hasText: 'Benachrichtigungen' })).toBeVisible();
  });

  test('can switch between clubs', async ({ page }) => {
    await login(page);
    const clubButtons = page.locator('#club-tabs button');
    const count = await clubButtons.count();
    if (count >= 2) {
      await clubButtons.nth(1).click();
      await expect(clubButtons.nth(1)).toHaveClass(/active/);
    }
  });

  test('navigation works for all main views', async ({ page }) => {
    await login(page);

    // Dashboard
    await page.locator('.nav-btn[data-view="dashboard"]').click();
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);

    // Club Management
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#view-club')).toHaveClass(/active/);

    // Messages
    await page.locator('.nav-btn[data-view="messages"]').click();
    await expect(page.locator('#view-messages')).toHaveClass(/active/);

    // Notifications
    await page.locator('.nav-btn[data-view="notifications"]').click();
    await expect(page.locator('#view-notifications')).toHaveClass(/active/);
  });
});
