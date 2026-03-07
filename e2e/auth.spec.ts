import { test, expect } from '@playwright/test';

test('has title and login button', async ({ page }) => {
    await page.goto('/');

    // Revisa el título principal
    await expect(page.getByText('CitaLink', { exact: false }).first()).toBeVisible();

    // Revisa que exista un botón de iniciar sesión
    const loginButton = page.getByRole('link', { name: /iniciar sesión/i });
    await expect(loginButton).toBeVisible();
});
