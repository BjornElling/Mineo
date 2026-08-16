import { stat } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const expectedScaleForWidth = (width: number): string => {
  if (width >= 1544) return '1';
  if (width >= 1481.5) return '0.95';
  if (width >= 1419) return '0.9';
  return '0.85';
};

test.describe('afgrænset skalering af Mineos arbejdsflade', () => {
  test('skalerer kun den navngivne main og holder shellen i normal størrelse', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await expect(page.locator('main[data-mineo-content-scale-root="true"]')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('main[data-mineo-content-scale-root="true"]');
      const menuToggle = document.querySelector<HTMLElement>('[aria-label="Fold menuen sammen"]');
      const menu = menuToggle?.parentElement?.parentElement ?? null;
      if (!main) throw new Error('Mangler Mineos content-scale-root.');

      return {
        width: window.innerWidth,
        scale: getComputedStyle(document.documentElement).getPropertyValue('--mineo-content-scale').trim(),
        mainZoom: getComputedStyle(main).zoom,
        rootZoom: getComputedStyle(document.documentElement).zoom,
        menuZoom: menu ? getComputedStyle(menu).zoom : null,
        mainMarker: main.getAttribute('data-mineo-content-scale-root'),
      };
    });

    expect(geometry.scale).toBe(expectedScaleForWidth(geometry.width));
    expect(geometry.mainZoom).toBe(geometry.scale);
    expect(geometry.rootZoom).toBe('1');
    expect(geometry.mainMarker).toBe('true');
    expect(geometry.menuZoom).toBe('1');
    expect(runtimeErrors).toEqual([]);
  });

  test('resize ændrer ikke en åben draft eller fokus', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Satser' }).click();

    const input = page.locator('input[name="aargang"]');
    await expect(input).toBeVisible();
    await input.click();
    await expect(input).toBeFocused();
    await input.click();
    await expect(input).toBeEditable();
    await input.fill('2027');

    await page.setViewportSize({ width: 1536, height: 730 });

    await expect(input).toBeFocused();
    await expect(input).toHaveValue('2027');
    await input.press('Escape');
    await expect(input).toHaveValue('2026');
  });

  test('skærmprint neutraliserer kun arbejdsfladeskaleringen under capture', async ({ page }) => {
    const captureProjects = new Set([
      'chrome-desktop-1536x730',
      'edge-desktop-1536x730',
      'firefox-desktop-1536x730',
      'safari-webkit-desktop-1536x730',
      'chrome-desktop-1366x620',
      'edge-desktop-1366x620',
      'firefox-desktop-1366x620',
      'safari-webkit-desktop-1366x620',
    ]);
    test.skip(!captureProjects.has(test.info().project.name), 'Capture køres ved minimumsviewports.');

    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Indstillinger' }).click();
    const reportSetting = page.getByRole('checkbox', {
      name: 'Vis knap til at rapportere fejl og forbedringsønsker på indholdsbokse',
    });
    if (!(await reportSetting.isChecked())) await reportSetting.check();

    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    const reportButton = page.getByRole('button', { name: 'Rapportér fejl eller forbedringsønske' }).first();
    await expect(reportButton).toBeVisible();
    await reportButton.click();

    const scaleBefore = await page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    );
    const downloadPromise = page.waitForEvent('download');
    // Dialogen kan få en ufarlig state-opdatering, mens lazy-loaded capture-koden monteres.
    // Dispatch på den allerede fundne knap undgår, at Playwrights stabilitetscheck rammer et
    // nyt DOM-node uden at ændre den brugerrejse, der afprøves.
    await page.getByRole('button', { name: 'Download skærmprint' }).dispatchEvent('click');
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Skærmprint-downloadet mangler en midlertidig fil.');

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect((await stat(downloadPath)).size).toBeGreaterThan(1_000);
    await expect(page.locator('main[data-mineo-content-scale-root="true"]')).toHaveCSS('zoom', scaleBefore);
    expect(runtimeErrors).toEqual([]);
  });
});
