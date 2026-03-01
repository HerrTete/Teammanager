const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer();
  server = app.listen(3459);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3459');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Responsive Design', () => {
  test('layout works on mobile viewport (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await expect(page.locator('#app-nav')).toBeVisible();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('.container')).toBeVisible();
  });

  test('layout works on tablet viewport (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await expect(page.locator('#app-nav')).toBeVisible();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('.container')).toBeVisible();
  });

  test('layout works on desktop viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await expect(page.locator('#app-nav')).toBeVisible();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('.container')).toBeVisible();
  });

  test('navigation is visible on all viewports', async ({ page }) => {
    await login(page);
    const viewports = [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ];
    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await expect(page.locator('#app-nav')).toBeVisible();
      const navButtons = page.locator('#app-nav .nav-btn');
      await expect(navButtons.first()).toBeVisible();
    }
  });
});
