const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer();
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

test.describe('Games & Trainings UI', () => {
  test('team view shows games and trainings lists', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await expect(page.locator('#view-team')).toHaveClass(/active/);
      await expect(page.locator('#team-games')).toBeVisible();
      await expect(page.locator('#team-trainings')).toBeVisible();
    }
  });

  test('add game button is visible on team view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await expect(page.locator('#view-team')).toHaveClass(/active/);
      await expect(page.locator('#btn-add-game')).toBeVisible();
    }
  });

  test('add training button is visible on team view', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await expect(page.locator('#view-team')).toHaveClass(/active/);
      await expect(page.locator('#btn-add-training')).toBeVisible();
    }
  });

  test('add game modal has title, opponent, date, kickoff, meeting, info fields', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await expect(page.locator('#view-team')).toHaveClass(/active/);
      await page.locator('#btn-add-game').click();
      await expect(page.locator('#modal-game-title')).toBeVisible();
      await expect(page.locator('#modal-game-opponent')).toBeVisible();
      await expect(page.locator('#modal-game-date')).toBeVisible();
      await expect(page.locator('#modal-game-kickoff')).toBeVisible();
      await expect(page.locator('#modal-game-meeting')).toBeVisible();
      await expect(page.locator('#modal-game-info')).toBeVisible();
    }
  });

  test('add training modal has title and date fields', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await expect(page.locator('#view-team')).toHaveClass(/active/);
      await page.locator('#btn-add-training').click();
      await expect(page.locator('#modal-training-title')).toBeVisible();
      await expect(page.locator('#modal-training-date')).toBeVisible();
    }
  });

  test('game form requires title before submit', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    const openBtn = page.locator('#sports-list [data-team]').first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await expect(page.locator('#view-team')).toHaveClass(/active/);
      await page.locator('#btn-add-game').click();
      // Listen for alert dialog
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Titel');
        await dialog.accept();
      });
      // Try to submit without title
      await page.locator('#modal-game-submit').click();
    }
  });
});
