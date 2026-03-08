const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer({ isPortalAdmin: false, clubRole: 'VereinsAdmin' });
  server = app.listen(3474);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3474');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Teamverwaltung View', () => {
  test('Teamverwaltung view loads and shows sports and teams', async ({ page }) => {
    await login(page);
    await page.locator('#nav-teamverwaltung-btn').click();
    await expect(page.locator('#view-teamverwaltung')).toHaveClass(/active/);
    await expect(page.locator('#view-teamverwaltung h2')).toContainText('Teamverwaltung');
    await expect(page.locator('#tv-sports-list')).toContainText('Fußball');
    await expect(page.locator('#tv-sports-list')).toContainText('A-Mannschaft');
  });

  test('Teamverwaltung view shows venues list', async ({ page }) => {
    await login(page);
    await page.locator('#nav-teamverwaltung-btn').click();
    await expect(page.locator('#view-teamverwaltung')).toHaveClass(/active/);
    await expect(page.locator('#tv-venues-list')).toContainText('Hauptstadion');
  });

  test('sports list displays all sports', async ({ page }) => {
    await login(page);
    await page.locator('#nav-teamverwaltung-btn').click();
    await expect(page.locator('#tv-sports-list')).toContainText('Fußball');
    await expect(page.locator('#tv-sports-list')).toContainText('Handball');
  });

  test('venues list shows structured address info', async ({ page }) => {
    await login(page);
    await page.locator('#nav-teamverwaltung-btn').click();
    await expect(page.locator('#tv-venues-list')).toContainText('Hauptstadion');
    await expect(page.locator('#tv-venues-list')).toContainText('Sportstr.');
    await expect(page.locator('#tv-venues-list')).toContainText('Berlin');
  });
});
