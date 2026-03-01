const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer();
  server = app.listen(3458);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3458');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Navigation UI', () => {
  test('navigation bar shows when logged in', async ({ page }) => {
    await login(page);
    await expect(page.locator('#app-nav')).toBeVisible();
  });

  test('can navigate to Dashboard view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="dashboard"]').click();
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#view-dashboard h2')).toContainText('Dashboard');
  });

  test('can navigate to Club Management view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#view-club')).toHaveClass(/active/);
    await expect(page.locator('#view-club h3').filter({ hasText: 'Sportarten' })).toBeVisible();
  });

  test('can navigate to Messages view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="messages"]').click();
    await expect(page.locator('#view-messages')).toHaveClass(/active/);
    await expect(page.locator('#view-messages h2')).toContainText('Nachrichten');
  });

  test('can navigate to Notifications view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="notifications"]').click();
    await expect(page.locator('#view-notifications')).toHaveClass(/active/);
    await expect(page.locator('#view-notifications h2')).toContainText('Benachrichtigungen');
  });

  test('views show correct content headers', async ({ page }) => {
    await login(page);

    await page.locator('.nav-btn[data-view="dashboard"]').click();
    await expect(page.locator('#view-dashboard h2')).toContainText('Dashboard');

    await page.locator('.nav-btn[data-view="messages"]').click();
    await expect(page.locator('#view-messages h2')).toContainText('Nachrichten');

    await page.locator('.nav-btn[data-view="notifications"]').click();
    await expect(page.locator('#view-notifications h2')).toContainText('Benachrichtigungen');
  });
});
