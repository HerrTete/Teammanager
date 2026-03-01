const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./helpers/mockServer');

let server;

test.beforeAll(async () => {
  const app = createMockServer();
  server = app.listen(3456);
  await new Promise(resolve => server.on('listening', resolve));
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test.describe('Auth UI', () => {
  test('page loads with login form visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-login')).toBeVisible();
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Teammanager' })).toBeVisible();
  });

  test('login tab is active by default', async ({ page }) => {
    await page.goto('/');
    const loginTab = page.locator('.tab-btn[data-tab="login"]');
    await expect(loginTab).toHaveClass(/active/);
    const registerTab = page.locator('.tab-btn[data-tab="register"]');
    await expect(registerTab).not.toHaveClass(/active/);
  });

  test('can switch to register tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tab-btn[data-tab="register"]').click();
    await expect(page.locator('#tab-register')).toBeVisible();
    await expect(page.locator('#tab-login')).not.toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="register"]')).toHaveClass(/active/);
  });

  test('login form shows error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.locator('#login-user').fill('wronguser');
    await page.locator('#login-pw').fill('wrongpass');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-msg')).toBeVisible();
    await expect(page.locator('#login-msg')).toContainText('Ungültiger Benutzername oder Passwort');
  });

  test('successful login shows dashboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('#login-user').fill('testuser');
    await page.locator('#login-pw').fill('Test1234!');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#app-main')).toBeVisible();
    await expect(page.locator('#auth-banner-text')).toContainText('Angemeldet als: testuser');
  });

  test('logout returns to login form', async ({ page }) => {
    await page.goto('/');
    await page.locator('#login-user').fill('testuser');
    await page.locator('#login-pw').fill('Test1234!');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#app-main')).toBeVisible();
    await page.locator('#logout-btn').click();
    await expect(page.locator('#auth-forms')).toBeVisible();
    await expect(page.locator('#app-main')).not.toBeVisible();
  });

  test('register form shows captcha', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tab-btn[data-tab="register"]').click();
    await expect(page.locator('#captcha-question')).toBeVisible();
    await expect(page.locator('#captcha-question')).toContainText('2 + 3 = ?');
  });

  test('register flow shows verification code input', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tab-btn[data-tab="register"]').click();
    await expect(page.locator('#captcha-question')).toContainText('2 + 3 = ?');
    await page.locator('#reg-user').fill('newuser');
    await page.locator('#reg-email').fill('new@example.com');
    await page.locator('#reg-pw').fill('Password123!');
    await page.locator('#captcha-answer').fill('5');
    await page.locator('#register-form button[type="submit"]').click();
    await expect(page.locator('#verify-section')).toBeVisible();
    await expect(page.locator('#verify-code')).toBeVisible();
  });

  test('DB status bar shows connection status', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#db-status')).toBeVisible();
    await expect(page.locator('#db-status')).toContainText('Datenbankverbindung erfolgreich');
    await expect(page.locator('#db-status')).toHaveClass(/ok/);
  });
});
