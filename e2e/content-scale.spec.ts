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

const expectedExpandedMenuWidthForScale = (menuContentScale: string): number => {
  const scale = Math.max(0.78, Math.min(1, Number(menuContentScale)));
  return 190 + 60 * ((scale - 0.78) / 0.22);
};

const expectedContentGuttersForMenuScale = (menuContentScale: string) => {
  const scale = Math.max(0.78, Math.min(1, Number(menuContentScale)));
  const progress = (scale - 0.78) / 0.22;
  return {
    scrollPadding: 16 + 8 * progress,
    mainPadding: 25 + 25 * progress,
  };
};

test.describe('afgrænset skalering af Mineos arbejdsflade', () => {
  test('skalerer arbejdsfladen og frigiver tekstsikker bredde fra sidemenuen', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    // Om-siden har repræsentative 1200-px-indholdsbokse. Den vælges eksplicit, fordi brugerens
    // gemte startsideindstilling ellers må afgøre den første rute i en ny browserkontekst.
    await page.getByRole('button', { name: 'Om' }).click();
    await expect(page.locator('.content-box').first()).toBeVisible();
    await expect(page.locator('main[data-mineo-content-scale-root="true"]')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('main[data-mineo-content-scale-root="true"]');
      const menuToggle = document.querySelector<HTMLElement>('[aria-label="Fold menuen sammen"]');
      const menu = menuToggle?.parentElement?.parentElement ?? null;
      const menuContent = menu?.querySelector<HTMLElement>('[data-mineo-menu-content-scale-root="true"]') ?? null;
      const container = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
      if (!main) throw new Error('Mangler Mineos content-scale-root.');

      return {
        width: window.innerWidth,
        scale: getComputedStyle(document.documentElement).getPropertyValue('--mineo-content-scale').trim(),
        mainZoom: getComputedStyle(main).zoom,
        rootZoom: getComputedStyle(document.documentElement).zoom,
        menuZoom: menu ? getComputedStyle(menu).zoom : null,
        menuWidth: menu?.getBoundingClientRect().width ?? null,
        menuContentScale: menuContent ? getComputedStyle(menuContent).zoom : null,
        menuLabelsFit: menuContent === null
          ? false
          : Array.from(menuContent.querySelectorAll<HTMLButtonElement>('button[aria-label]')).every((button) => (
            button.scrollWidth <= button.clientWidth
          )),
        contentScrollPaddingLeft: container ? getComputedStyle(container).paddingLeft : null,
        contentMainPaddingLeft: getComputedStyle(main).paddingLeft,
        mainMarker: main.getAttribute('data-mineo-content-scale-root'),
        contentBoxes: Array.from(document.querySelectorAll<HTMLElement>('.content-box')).map((box) => {
          const rect = box.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        }),
      };
    });

    expect(geometry.scale).toBe(expectedScaleForWidth(geometry.width));
    expect(geometry.mainZoom).toBe(geometry.scale);
    expect(geometry.rootZoom).toBe('1');
    expect(geometry.mainMarker).toBe('true');
    expect(geometry.menuZoom).toBe('1');
    expect(geometry.menuWidth).toBeCloseTo(expectedExpandedMenuWidthForScale(geometry.menuContentScale ?? '1'), 1);
    expect(geometry.menuLabelsFit).toBe(true);
    const expectedGutters = expectedContentGuttersForMenuScale(geometry.menuContentScale ?? '1');
    expect(Number.parseFloat(geometry.contentScrollPaddingLeft ?? '')).toBeCloseTo(expectedGutters.scrollPadding, 1);
    expect(Number.parseFloat(geometry.contentMainPaddingLeft)).toBeCloseTo(expectedGutters.mainPadding, 1);
    expect(geometry.contentBoxes.length).toBeGreaterThan(0);
    expect(geometry.contentBoxes.every((box) => box.left >= 0 && box.right <= geometry.width)).toBe(true);
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

    // WebKit leverer viewportændringen asynkront til næste animation-frame. Vent på den
    // observerbare CSS-værdi frem for at gøre testen afhængig af browserens event-timing.
    await expect.poll(() => page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    )).toBe('0.95');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('2027');
    await input.press('Escape');
    await expect(input).toHaveValue('2026');
  });

  test('bevarer den vandrette Container-scroll som fallback under minimumsbredden', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Om' }).click();
    await expect(page.locator('.content-box').first()).toBeVisible();
    await page.setViewportSize({ width: 1000, height: 620 });
    await expect.poll(() => page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    )).toBe('0.85');

    const geometry = await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
      const contentBox = document.querySelector<HTMLElement>('.content-box');
      const main = document.querySelector<HTMLElement>('main[data-mineo-content-scale-root="true"]');
      if (!container || !contentBox || !main) {
        throw new Error('Mangler Container, indholdsboks eller arbejdsfladens skaleringsrod.');
      }

      const before = {
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
      };
      container.scrollLeft = container.scrollWidth;

      const containerRect = container.getBoundingClientRect();
      const contentBoxRect = contentBox.getBoundingClientRect();
      return {
        ...before,
        scale: getComputedStyle(main).zoom,
        scrollLeft: container.scrollLeft,
        containerRight: containerRect.right,
        contentBoxRight: contentBoxRect.right,
      };
    });

    expect(geometry.scale).toBe('0.85');
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    expect(geometry.scrollLeft).toBeGreaterThan(0);
    // Den ekstra pixel dækker browsernes afrunding af CSS zoom uden at maskere reel beskæring.
    expect(geometry.contentBoxRight).toBeLessThanOrEqual(geometry.containerRight + 1);
    expect(runtimeErrors).toEqual([]);
  });

  test('holder faneindikator og dropdown-popover på arbejdsfladens skala', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
    await page.getByRole('tab', { name: 'Løbende ydelser' }).click();

    // MUI skriver selv indikatorens position i et efterfølgende layout-pass. Vent på den
    // observerbare slutgeometri frem for at måle det mellemliggende første frame efter et klik.
    await expect.poll(() => page.evaluate(() => {
      const tab = document.querySelector<HTMLElement>('.MuiTab-root.Mui-selected');
      const indicator = document.querySelector<HTMLElement>('.MuiTabs-indicator');
      if (tab === null || indicator === null) return false;
      const tabRect = tab.getBoundingClientRect();
      const indicatorRect = indicator.getBoundingClientRect();
      return Math.abs(indicatorRect.left - tabRect.left) <= 0.5
        && Math.abs(indicatorRect.right - tabRect.right) <= 0.5;
    })).toBe(true);

    await page.getByRole('button', { name: 'Indstillinger' }).click();
    const dropdown = page.getByRole('combobox', { name: 'Download-format for dokumenter' });
    await dropdown.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    const dropdownGeometry = await listbox.evaluate((listboxElement) => {
      const paper = listboxElement.closest<HTMLElement>('.MuiPaper-root');
      const input = document.querySelector<HTMLElement>('[aria-label="Download-format for dokumenter"]');
      if (paper === null || input === null) throw new Error('Mangler dropdown-popover eller trigger.');
      const paperRect = paper.getBoundingClientRect();
      return {
        inputLeft: input.getBoundingClientRect().left,
        paperLeft: paperRect.left,
        paperWidth: paperRect.width,
        paperLayoutWidth: paper.offsetWidth,
        listboxClientHeight: listboxElement.clientHeight,
        listboxScrollHeight: listboxElement.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });

    const mainScale = Number(await page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    ));
    // Firefox afrunder portalens transformposition til hel CSS-pixel ved delvis zoom.
    expect(Math.abs(dropdownGeometry.paperLeft - dropdownGeometry.inputLeft)).toBeLessThanOrEqual(1);
    expect(dropdownGeometry.paperWidth / dropdownGeometry.paperLayoutWidth).toBeCloseTo(mainScale, 2);
    expect(dropdownGeometry.listboxClientHeight).toBeLessThanOrEqual(dropdownGeometry.viewportHeight - 32);
    expect(dropdownGeometry.listboxScrollHeight).toBeGreaterThanOrEqual(dropdownGeometry.listboxClientHeight);

    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Lønmodtager' }).click();
    await expect(listbox).toBeVisible();
    const longListGeometry = await listbox.evaluate((listboxElement) => ({
      clientHeight: listboxElement.clientHeight,
      scrollHeight: listboxElement.scrollHeight,
      viewportHeight: window.innerHeight,
      overflowY: getComputedStyle(listboxElement).overflowY,
    }));
    expect(longListGeometry.clientHeight).toBeLessThanOrEqual(longListGeometry.viewportHeight - 32);
    expect(longListGeometry.scrollHeight).toBeGreaterThanOrEqual(longListGeometry.clientHeight);
    expect(longListGeometry.overflowY).toBe('auto');
    expect(runtimeErrors).toEqual([]);
  });

  test('skærmprint neutraliserer kun arbejdsfladeskaleringen under capture', async ({ page }) => {
    // Canvas-capture kan bruge længere tid i Edge på batteridrift end de øvrige browserflows. Det
    // udvidede loft gælder kun denne filgenerering; eventet skal stadig indtræffe og filen valideres.
    test.setTimeout(180_000);
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
    // Kald browserens click direkte på det fundne element; Playwrights dispatchEvent venter ellers
    // på portalens erstattede DOM-node i stedet for at måle den brugeraktiverede capture-handler.
    await page.getByRole('button', { name: 'Download skærmprint' }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
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
