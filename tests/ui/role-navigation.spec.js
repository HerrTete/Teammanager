const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

function startServer(options, port) {
  return new Promise(resolve => {
    const app = createMockServer(options);
    const srv = app.listen(port, () => resolve(srv));
  });
}

async function login(page, port) {
  await page.goto('http://localhost:' + port);
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Role-based Navigation', () => {
  let servers = [];

  test.afterAll(async () => {
    for (const s of servers) {
      await new Promise(resolve => s.close(resolve));
    }
  });

  test('PortalAdmin sees Vereinsverwaltung button', async ({ page }) => {
    const port = 3470;
    const srv = await startServer({ isPortalAdmin: true, clubRole: 'PortalAdmin' }, port);
    servers.push(srv);

    await login(page, port);
    await expect(page.locator('#nav-club-btn')).toBeVisible();
    await expect(page.locator('#nav-teamverwaltung-btn')).toBeVisible();
    await expect(page.locator('#nav-activities-btn')).toBeVisible();
  });

  test('VereinsAdmin sees Teamverwaltung and Aktivitätsverwaltung but not Vereinsverwaltung', async ({ page }) => {
    const port = 3471;
    const srv = await startServer({ isPortalAdmin: false, clubRole: 'VereinsAdmin' }, port);
    servers.push(srv);

    await login(page, port);
    await expect(page.locator('#nav-club-btn')).not.toBeVisible();
    await expect(page.locator('#nav-teamverwaltung-btn')).toBeVisible();
    await expect(page.locator('#nav-activities-btn')).toBeVisible();
  });

  test('Trainer sees Aktivitätsverwaltung but not Vereinsverwaltung or Teamverwaltung', async ({ page }) => {
    const port = 3472;
    const srv = await startServer({ isPortalAdmin: false, clubRole: 'Trainer' }, port);
    servers.push(srv);

    await login(page, port);
    await expect(page.locator('#nav-club-btn')).not.toBeVisible();
    await expect(page.locator('#nav-teamverwaltung-btn')).not.toBeVisible();
    await expect(page.locator('#nav-activities-btn')).toBeVisible();
  });

  test('Regular member sees no management nav buttons', async ({ page }) => {
    const port = 3473;
    const srv = await startServer({ isPortalAdmin: false, clubRole: 'Vereinsmitglied' }, port);
    servers.push(srv);

    await login(page, port);
    await expect(page.locator('#nav-club-btn')).not.toBeVisible();
    await expect(page.locator('#nav-teamverwaltung-btn')).not.toBeVisible();
    await expect(page.locator('#nav-activities-btn')).not.toBeVisible();
  });
});
