const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer({ isPortalAdmin: true, clubRole: 'PortalAdmin' });
  server = app.listen(3461);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3461');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Team & Player Management UI', () => {
  test('club view shows sports list with teams', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#view-club')).toHaveClass(/active/);
    await expect(page.locator('#sports-list')).toBeVisible();
  });

  test('team view shows trainers and players lists', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    // Wait for sports to load, then click first team's open button
    const openBtn = page.locator('#sports-list [data-team]').first();
    // Ensure at least one team is present; fail if none are rendered
    await expect(openBtn).toHaveCount(1);
    await openBtn.click();
    await expect(page.locator('#view-team')).toHaveClass(/active/);
    await expect(page.locator('#team-trainers')).toBeVisible();
    await expect(page.locator('#team-players')).toBeVisible();
    await expect(page.locator('#team-games')).toBeVisible();
    await expect(page.locator('#team-trainings')).toBeVisible();
  });

  test('add player button is visible on team view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    await expect(openBtn).toHaveCount(1);
    await openBtn.click();
    await expect(page.locator('#view-team')).toHaveClass(/active/);
    await expect(page.locator('#btn-add-player')).toBeVisible();
  });

  test('add trainer button is visible for admin on team view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    await expect(openBtn).toHaveCount(1);
    await openBtn.click();
    await expect(page.locator('#view-team')).toHaveClass(/active/);
    await expect(page.locator('#btn-add-trainer')).toBeVisible();
  });

  test('add player modal shows form fields', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    await expect(openBtn).toHaveCount(1);
    await openBtn.click();
    await expect(page.locator('#view-team')).toHaveClass(/active/);
    await page.locator('#btn-add-player').click();
    await expect(page.locator('#modal-player-name')).toBeVisible();
    await expect(page.locator('#modal-player-jersey')).toBeVisible();
  });

  test('add trainer modal shows form fields', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    await expect(openBtn).toHaveCount(1);
    await openBtn.click();
    await expect(page.locator('#view-team')).toHaveClass(/active/);
    await page.locator('#btn-add-trainer').click();
    await expect(page.locator('#modal-trainer-name')).toBeVisible();
  });
});
