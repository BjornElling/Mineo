import { expect, test, type Page } from '@playwright/test';

/**
 * §Popup-fokus-restore i `keyboard-navigation.md`: lukkes en popup, vender fokus tilbage til den
 * kontrol, brugeren åbnede den med — uanset lukkevej.
 *
 * Testen kører i rigtige browsere, fordi netop de fælder, reglen findes for, ikke kan måles i
 * JSDOM: WebKit fokuserer ikke `<button>` ved klik, WebKit flytter ved `Escape` fokus til
 * popupens egen container, og MUI's transition slutter før portalen unmountes. Det var derfor
 * fokus endte på `body` i alle fire browsere i AUDIT-2026-08-14-21 (Q-001).
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

/** Fanger produktfejl, så en restore ikke kan «lykkes» på bekostning af en runtimefejl. */
const collectRuntimeErrors = (page: Page): string[] => {
  const runtimeErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  return runtimeErrors;
};

test.describe('Popup-fokus-restore', () => {
  test('licens-overlayet returnerer fokus til MIT-licensen ved Escape, X og backdrop', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await login(page);

    const trigger = page.locator('button.icon-text-link', { hasText: 'MIT-licensen' });
    await expect(trigger).toBeVisible();

    // Triggeren skal kunne nås og aktiveres med tastaturet alene. Enter er med vilje den første
    // aktivering: knappen manglede `data-mineo-focusable-button`, så Enter flyttede fokus videre
    // til næste felt i stedet for at åbne popupen. Mellemrum skjulte fejlen, fordi native
    // knapsemantik dækkede den.
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Lukkevej 1: Escape.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    // Lukkevej 2: X-knappen.
    await trigger.press(' ');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Luk' }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    // Lukkevej 3: klik på backdrop. Panelet er centreret og dækker backdroppens midte, så
    // klikket lægges i øverste venstre hjørne, hvor backdroppen faktisk er blottet.
    await trigger.press(' ');
    await expect(dialog).toBeVisible();
    await page.locator('[data-testid="license-backdrop"]').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    expect(runtimeErrors).toEqual([]);
  });

  test('Download hjælpeprogram åbner på både Enter og mellemrum og returnerer fokus', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await login(page);

    const trigger = page.locator('button.icon-text-link', { hasText: 'Download hjælpeprogram' });
    await expect(trigger).toBeVisible();

    await trigger.focus();
    await trigger.press('Enter');

    // I Chromium uden installations-prompt svarer klikket med en status-dialog. Kan browseren
    // ikke afgøre status, vises «Installationsstatus kunne ikke afgøres» — begge er en popup,
    // og begge skal returnere fokus til linket.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    expect(runtimeErrors).toEqual([]);
  });
});
