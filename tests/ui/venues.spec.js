const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer();
  server = app.listen(3460);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

async function login(page) {
  await page.goto('http://localhost:3460');
  await page.locator('#login-user').fill('testuser');
  await page.locator('#login-pw').fill('Test1234!');
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator('#app-main')).toBeVisible();
}

test.describe('Venues Management UI', () => {
  test('club management view shows venues section', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#view-club')).toHaveClass(/active/);
    await expect(page.locator('#venues-list')).toBeVisible();
  });

  test('venues list displays venue with structured address', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#venues-list')).toBeVisible();
    // Wait for venues to load
    await expect(page.locator('#venues-list li').first()).toBeVisible();
    const venueText = await page.locator('#venues-list li span').first().textContent();
    expect(venueText).toContain('Hauptstadion');
  });

  test('add venue button is visible for admin', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    // Wait for club data to load and button to become visible
    await expect(page.locator('#btn-add-venue')).toBeVisible({ timeout: 10000 });
  });

  test('add venue modal has structured address fields', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#btn-add-venue')).toBeVisible({ timeout: 10000 });
    await page.locator('#btn-add-venue').click();
    await expect(page.locator('#modal-venue-name')).toBeVisible();
    await expect(page.locator('#modal-venue-street')).toBeVisible();
    await expect(page.locator('#modal-venue-house-number')).toBeVisible();
    await expect(page.locator('#modal-venue-zip')).toBeVisible();
    await expect(page.locator('#modal-venue-city')).toBeVisible();
    await expect(page.locator('#modal-venue-link')).toBeVisible();
    await expect(page.locator('#modal-venue-gmaps')).toBeVisible();
  });

  test('can create a new venue via modal', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#btn-add-venue')).toBeVisible({ timeout: 10000 });
    await page.locator('#btn-add-venue').click();
    await page.locator('#modal-venue-name').fill('Neues Stadion');
    await page.locator('#modal-venue-street').fill('Musterstraße');
    await page.locator('#modal-venue-house-number').fill('5');
    await page.locator('#modal-venue-zip').fill('54321');
    await page.locator('#modal-venue-city').fill('Hamburg');
    await page.locator('#modal-venue-submit').click();
    // Modal should close after successful create
    await expect(page.locator('#modal-overlay')).not.toBeVisible();
  });

  test('edit venue modal pre-fills structured fields', async ({ page }) => {
    await login(page);
    await page.locator('.nav-btn[data-view="club"]').click();
    await expect(page.locator('#venues-list li').first()).toBeVisible();
    // Click the edit button on first venue
    await page.locator('#venues-list li .btn-secondary').first().click();
    await expect(page.locator('#modal-venue-name')).toBeVisible();
    // Check pre-filled values
    await expect(page.locator('#modal-venue-name')).toHaveValue('Hauptstadion');
    await expect(page.locator('#modal-venue-street')).toHaveValue('Sportstr.');
    await expect(page.locator('#modal-venue-house-number')).toHaveValue('1');
    await expect(page.locator('#modal-venue-zip')).toHaveValue('12345');
    await expect(page.locator('#modal-venue-city')).toHaveValue('Berlin');
  });
});
