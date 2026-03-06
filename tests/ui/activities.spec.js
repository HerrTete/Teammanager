const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer({ isPortalAdmin: false, clubRole: 'Trainer' });
  server = app.listen(3462);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3462');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Aktivitätsverwaltung View', () => {
  test('activities view shows team selector dropdown', async ({ page }) => {
    await login(page);
    await page.locator('#nav-activities-btn').click();
    await expect(page.locator('#view-activities')).toHaveClass(/active/);
    await expect(page.locator('#activities-team-select')).toBeVisible();
  });

  test('selecting a team loads games and trainings lists', async ({ page }) => {
    await login(page);
    await page.locator('#nav-activities-btn').click();
    await expect(page.locator('#view-activities')).toHaveClass(/active/);

    // Wait for sport/team options to populate
    await expect(page.locator('#activities-team-select option')).not.toHaveCount(1);

    await page.locator('#activities-team-select').selectOption({ index: 1 });
    await expect(page.locator('#activities-content')).toBeVisible();
    await expect(page.locator('#activities-games-list')).toBeVisible();
    await expect(page.locator('#activities-trainings-list')).toBeVisible();
  });

  test('games are displayed with opponent', async ({ page }) => {
    await login(page);
    await page.locator('#nav-activities-btn').click();
    await expect(page.locator('#activities-team-select option')).not.toHaveCount(1);

    await page.locator('#activities-team-select').selectOption({ index: 1 });
    await expect(page.locator('#activities-games-list')).toContainText('FC Gegner');
    await expect(page.locator('#activities-games-list')).toContainText('SV Rival');
  });

  test('trainings are displayed with title', async ({ page }) => {
    await login(page);
    await page.locator('#nav-activities-btn').click();
    await expect(page.locator('#activities-team-select option')).not.toHaveCount(1);

    await page.locator('#activities-team-select').selectOption({ index: 1 });
    await expect(page.locator('#activities-trainings-list')).toContainText('Dienstags-Training');
    await expect(page.locator('#activities-trainings-list')).toContainText('Wochenend-Training');
  });
});
