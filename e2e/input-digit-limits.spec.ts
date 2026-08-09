import { expect, test, type Locator, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const openEditor = async (input: Locator): Promise<void> => {
  await input.click();
  await expect(input).toBeFocused();
  await input.click();
  await expect(input).toBeEditable();
};

const pasteText = async (input: Locator, text: string): Promise<void> => {
  await input.evaluate((element, value) => {
    // Firefox ignorerer `clipboardData` i den syntetiske ClipboardEvent-konstruktør. Den reelle
    // bruger-paste har feltet, så testeventen tilføjer det eksplicit på en almindelig bubbling-event.
    // React læser dermed præcis den clipboardData-kontrakt, som produktets onPaste-handler bruger.
    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: (format: string) => (format === 'text' || format === 'text/plain' ? value : '') },
    });
    element.dispatchEvent(pasteEvent);
  }, text);
};

/**
 * Lukker editoren med Escape og venter, indtil feltet FAKTISK er lukket igen.
 *
 * Escape annullerer draften (§1.1), og et efterfølgende paste er derfor et LUKKET-felt-paste, som
 * committer straks. Uden ventetiden her kunne pasten i Firefox ramme feltet, mens editoren stadig var
 * ved at lukke, så den blev spliced ind i en draft, der straks blev annulleret — og feltet stod tomt.
 * Assertionen på den committede værdi blev da flaky af en grund, der intet havde med ciffergrænsen at gøre.
 */
const closeEditor = async (input: Locator): Promise<void> => {
  await input.press('Escape');
  await expect(input).toHaveAttribute('readonly', '');
};

test.describe('inputgrænser for beløb og dato', () => {
  test('tastning og paste håndhæver grænser på formular og tabel uden runtimefejl', async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await login(page);

    await page.getByRole('button', { name: 'Forsørgertab' }).click();
    const formAmount = page.locator('input[name="ealAarsloen"]');
    await expect(formAmount).toBeVisible();

    await openEditor(formAmount);
    await formAmount.pressSequentially('99999999');
    await expect(formAmount).toHaveValue('9999999');
    await closeEditor(formAmount);
    await pasteText(formAmount, '99999999');
    await expect(formAmount).toHaveValue('9.999.999');

    await page.getByRole('button', { name: 'Renteberegning' }).click();
    // Den lazy-loadede destination må have erstattet den gamle side, før en locator med samme navn bruges.
    await expect(formAmount).toBeHidden();
    const formDate = page.locator('input[name="beregningsdato"]');
    await expect(formDate).toBeVisible();

    await openEditor(formDate);
    await formDate.pressSequentially('123456789');
    await expect(formDate).toHaveValue('12');
    await closeEditor(formDate);
    await pasteText(formDate, '123456789');
    await expect(formDate).toHaveValue('12-34-5678');
    await expect(formDate).toHaveAttribute('aria-invalid', 'true');

    const tableAmount = page.locator('input[data-mineo-field-address*="belob"]').first();
    const tableDate = page.locator('input[data-mineo-field-address*="renterFra"]').first();
    await expect(tableAmount).toBeVisible();
    await expect(tableDate).toBeVisible();

    await openEditor(tableAmount);
    await tableAmount.pressSequentially('99999999');
    await expect(tableAmount).toHaveValue('9999999');
    await closeEditor(tableAmount);
    await pasteText(tableAmount, '99999999');
    await expect(tableAmount).toHaveValue('9.999.999,00');

    await openEditor(tableDate);
    await tableDate.pressSequentially('123456789');
    await expect(tableDate).toHaveValue('12');
    await closeEditor(tableDate);
    await pasteText(tableDate, '123456789');
    await expect(tableDate).toHaveValue('12-34-5678');
    await expect(tableDate).toHaveAttribute('aria-invalid', 'true');

    await page.screenshot({ path: testInfo.outputPath('input-digit-limits.png'), fullPage: true });
    expect(runtimeErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
