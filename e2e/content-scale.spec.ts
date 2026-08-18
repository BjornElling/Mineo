import { stat } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

// Pladsregnskabet fra CONTENT_UI_SCALE_POLICY gentaget uafhængigt: HELE fladen skaleres under ét —
// sidemenu (250) + gutter 24 + indrykning 50 + indholdsboks 1200 + gutter 24 — plus scrollbar (20).
const SCALED_SHELL_WIDTH = 250 + 24 + 50 + 1200 + 24;
const SCROLLBAR_RESERVE = 20;
const MINIMUM_SCALE = 0.75;
const CONTENT_GUTTER = 24;
const CONTENT_INDENT = 50;

const expectedScaleForWidth = (width: number): string => {
  const exactFit = (width - SCROLLBAR_RESERVE) / SCALED_SHELL_WIDTH;
  return String(Math.min(1, Math.max(MINIMUM_SCALE, Math.floor(exactFit * 100 + 1e-9) / 100)));
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
      const menuContent = document.querySelector<HTMLElement>('[data-mineo-menu-content-scale-root="true"]');
      // Hamburgerens wrapper ligger under indholdsroden. Find derfor sidemenuen via den
      // autoritative markerede rod i stedet for at afhænge af menuens interne nesting.
      const menu = menuContent?.parentElement ?? null;
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
        contentScrollPaddingTop: container ? getComputedStyle(container).paddingTop : null,
        contentScrollPaddingLeft: container ? getComputedStyle(container).paddingLeft : null,
        contentScrollPaddingRight: container ? getComputedStyle(container).paddingRight : null,
        contentScrollPaddingBottom: container ? getComputedStyle(container).paddingBottom : null,
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
    // Menuen bliver aldrig større end arbejdsfladen — det er hele pointen med den ene skala.
    expect(Number(geometry.menuContentScale)).toBeLessThanOrEqual(Number(geometry.scale) + 0.001);
    expect(geometry.menuWidth).toBeCloseTo(250 * Number(geometry.menuContentScale ?? '1'), 1);
    expect(geometry.menuLabelsFit).toBe(true);
    // Arbejdsfladen har samme luft HELE VEJEN RUNDT. Den lodrette luft var før låst til 24 px og
    // stod dermed dobbelt så høj som luften i siderne ved mindste skala.
    const expectedGutter = CONTENT_GUTTER * Number(geometry.scale);
    for (const padding of [
      geometry.contentScrollPaddingTop,
      geometry.contentScrollPaddingRight,
      geometry.contentScrollPaddingBottom,
      geometry.contentScrollPaddingLeft,
    ]) {
      expect(Number.parseFloat(padding ?? '')).toBeCloseTo(expectedGutter, 1);
    }
    // Indrykningen ligger INDEN i zoom-roden og skaleres af den; den må derfor ikke være
    // forhåndsskaleret i sin egen værdi.
    expect(Number.parseFloat(geometry.contentMainPaddingLeft)).toBeCloseTo(CONTENT_INDENT, 1);
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
    )).toBe(expectedScaleForWidth(1536));
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
    )).toBe(String(MINIMUM_SCALE));

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

    expect(geometry.scale).toBe(String(MINIMUM_SCALE));
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

    const mainScale = Number(await page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    ));

    // Zoom sidder på LISTEN, ikke på papiret: papiret bærer MUI's inline forankring, som zoom
    // ville gange med, så menuen ville vandre mod vinduets øverste venstre hjørne. Skalaen læses
    // som `zoom` og ikke som rect ÷ layoutbredde: Popover'ens åbne-animation er en `transform`,
    // der indgår i rect'en, så et forhold målt for tidligt måler animationen frem for skalaen.
    expect(Number(await listbox.evaluate((element) => getComputedStyle(element).zoom)))
      .toBeCloseTo(mainScale, 2);

    // Ankeret måles først, når Popover'ens åbne-animation er faldet til ro.
    await expect.poll(() => listbox.evaluate((listboxElement) => {
      const paper = listboxElement.closest<HTMLElement>('.MuiPaper-root');
      const input = document.querySelector<HTMLElement>('[aria-label="Download-format for dokumenter"]');
      if (paper === null || input === null) return Number.POSITIVE_INFINITY;
      // Firefox afrunder portalens position til hel CSS-pixel ved delvis zoom.
      return Math.abs(paper.getBoundingClientRect().left - input.getBoundingClientRect().left);
    })).toBeLessThanOrEqual(1);

    const dropdownGeometry = await listbox.evaluate((listboxElement) => ({
      listboxClientHeight: listboxElement.clientHeight,
      listboxScrollHeight: listboxElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(dropdownGeometry.listboxClientHeight).toBeLessThanOrEqual(dropdownGeometry.viewportHeight - 32);
    // Den ene px dækker browsernes afrunding af et højdeloft udtrykt i skaleret `vh`; WebKit
    // runder `clientHeight` op, så en kort liste kan måle én px mere end sit eget scrollindhold.
    expect(dropdownGeometry.listboxScrollHeight).toBeGreaterThanOrEqual(dropdownGeometry.listboxClientHeight - 1);

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
    expect(longListGeometry.scrollHeight).toBeGreaterThanOrEqual(longListGeometry.clientHeight - 1);
    expect(longListGeometry.overflowY).toBe('auto');
    expect(runtimeErrors).toEqual([]);
  });

  test('lader hele popup-laget følge arbejdsfladens skala', async ({ page }) => {
    // Hjælpebobler, dialogvinduer og den flydende knap ligger uden for zoom-roden, men oven på
    // arbejdsfladen. Stod de i fuld størrelse, ville hjælpeteksten være STØRRE end den brødtekst,
    // den forklarer, så snart vinduet er smalt nok til at skalere fladen ned.
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    // Bredden vælges eksplicit, så skalaen med sikkerhed er under 1 uanset projektets viewport —
    // ellers ville testen kunne bestå på et billede, hvor der intet er at skalere.
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.getByRole('button', { name: 'Erstatningsopgørelse', exact: true }).click();
    await expect(page.locator('.content-box').first()).toBeVisible();
    await expect.poll(() => page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    )).toBe(expectedScaleForWidth(1300));

    const mainScale = Number(expectedScaleForWidth(1300));
    expect(mainScale).toBeLessThan(1);

    // Hjælpeboble forankret i arbejdsfladen.
    await page.locator('main [role="img"]').first().hover();
    const tooltip = page.locator('.MuiTooltip-tooltip').first();
    await expect(tooltip).toBeVisible();
    expect(await tooltip.evaluate((element) => Number(getComputedStyle(element).zoom)))
      .toBeCloseTo(mainScale, 2);
    await page.mouse.move(0, 0);

    // Dialogvindue: samme skala, og stadig vandret centreret i vinduet.
    await page.getByRole('button', { name: 'Slet alt' }).click();
    const dialogPaper = page.locator('.MuiDialog-paper').first();
    await expect(dialogPaper).toBeVisible();
    const dialogGeometry = await dialogPaper.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        zoom: Number(getComputedStyle(element).zoom),
        centerOffset: (rect.left + rect.right) / 2 - window.innerWidth / 2,
      };
    });
    expect(dialogGeometry.zoom).toBeCloseTo(mainScale, 2);
    expect(Math.abs(dialogGeometry.centerOffset)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Annuller' }).click();

    // Den flydende «scroll til toppen»-knap.
    await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
      if (container !== null) container.scrollTop = 900;
    });
    const fab = page.locator('.MuiFab-sizeLarge').first();
    await expect(fab).toBeVisible();
    expect(await fab.evaluate((element) => Number(getComputedStyle(element).zoom)))
      .toBeCloseTo(mainScale, 2);

    expect(runtimeErrors).toEqual([]);
  });

  test('holder kontrolfanerne inden for indholdsboksens højrekant', async ({ page }) => {
    // Fanerne roteres 90° og rager derfor deres egen HØJDE ud til højre for deres `left`. Lå de på
    // boksens kant, ville de stikke 48 px ud over programmets bredeste element — og de 48 px indgår
    // ikke i skaleringens pladsregnskab, så højregutteren forsvandt ved den smalleste bredde.
    await login(page);
    await page.getByRole('button', { name: 'Indstillinger', exact: true }).click();
    const kontrolfaner = page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' });
    if (!(await kontrolfaner.isChecked())) await kontrolfaner.check();

    await page.getByRole('button', { name: 'Erstatningsopgørelse', exact: true }).click();
    await expect(page.getByRole('button', { name: 'EO-kontrol' })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const contentBox = document.querySelector<HTMLElement>('.content-box');
      const container = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
      if (contentBox === null || container === null) throw new Error('Mangler indholdsboks eller Container.');
      const sideTabs = Array.from(document.querySelectorAll<HTMLElement>('.side-tab'));
      return {
        contentBoxRight: contentBox.getBoundingClientRect().right,
        sideTabRights: sideTabs.map((tab) => tab.getBoundingClientRect().right),
        overflowPx: container.scrollWidth - container.clientWidth,
      };
    });

    expect(geometry.sideTabRights.length).toBe(2);
    for (const right of geometry.sideTabRights) {
      // Den ekstra pixel dækker browsernes afrunding af CSS zoom.
      expect(right).toBeLessThanOrEqual(geometry.contentBoxRight + 1);
    }
    expect(geometry.overflowPx).toBeLessThanOrEqual(1);
  });

  test('viser hele arbejdsfladen uden vandret rul ved 1280 CSS-px', async ({ page }) => {
    // 1920×1200-skærmen ved 150 % browserzoom giver præcis 1280 CSS-px. Testen er regressionsværnet
    // for netop den opsætning: indholdet skal være der i fuld bredde — ikke klippet, ikke skjult.
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.setViewportSize({ width: 1280, height: 740 });

    for (const pageName of ['Om', 'Erstatningsopgørelse', 'Satser'] as const) {
      await page.getByRole('button', { name: pageName, exact: true }).click();
      await expect(page.locator('.content-box').first()).toBeVisible();
      await expect.poll(() => page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
        (element) => getComputedStyle(element).zoom,
      )).toBe(expectedScaleForWidth(1280));

      const geometry = await page.evaluate(() => {
        const container = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
        const main = document.querySelector<HTMLElement>('main[data-mineo-content-scale-root="true"]');
        if (container === null || main === null) throw new Error('Mangler Container eller skaleringsrod.');
        const containerRect = container.getBoundingClientRect();

        return {
          scale: Number(getComputedStyle(main).zoom),
          clientWidth: container.clientWidth,
          scrollWidth: container.scrollWidth,
          containerLeft: containerRect.left,
          contentBoxes: Array.from(document.querySelectorAll<HTMLElement>('.content-box')).map((box) => {
            const rect = box.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          }),
        };
      });

      // Den ekstra pixel dækker browsernes afrunding af CSS zoom uden at maskere reel beskæring.
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.contentBoxes.length).toBeGreaterThan(0);
      for (const box of geometry.contentBoxes) {
        // Fuld bredde, ikke en beskåret rest: boksen måler sin egen bredde gange arbejdsfladens skala.
        expect(box.width).toBeCloseTo(1200 * geometry.scale, 0);
        expect(box.left).toBeGreaterThan(geometry.containerLeft);
        expect(box.right).toBeLessThanOrEqual(geometry.containerLeft + geometry.clientWidth + 1);
      }
    }

    expect(runtimeErrors).toEqual([]);
  });

  // BASISBANEN ALENE — bevidst utagget, og den ene test i filen der har fået sit eget loft.
  //
  // `html2canvas` med `scale: 2` er suitens dyreste enkelthandling: den bygger en bitmap på mange
  // titusinder af pixel i bredden og holder både klonen og lærredet i hukommelsen. Alene tager den
  // under tre sekunder. Kører to eller flere kopier af den samtidig på en hukommelsesbegrænset
  // maskine, stopper capturen i stedet med at blive færdig, og testen bruger hele sit loft på at
  // vente på et download-event, der aldrig kommer. Det var netop den fælde, den tidligere
  // opsætning gik i: testen var bundet til otte projekter — fire browsere × to minimumsviewporter —
  // og kunne dermed koste op mod tyve minutter i rene, indholdsløse timeouts pr. suitekørsel.
  //
  // Én kørsel beviser det samme om produktet: at capturen neutraliserer arbejdsfladens skala og
  // gendanner den. Skal den efterkontrolleres i alle motorer, ligger den stadig i `test:e2e:full`.
  //
  // Testen sætter BEVIDST heller ikke sin egen viewport, sådan som resten af filen gør: efter et
  // `setViewportSize`-kald åbner rapportdialogen slet ikke i Chromium og Firefox.
  test('skærmprint neutraliserer kun arbejdsfladeskaleringen under capture', async ({ page }) => {
    // Loftet er rundhåndet i forhold til de målte ~3 sekunder, men lavt nok til at en stoppet
    // capture melder sig hurtigt i stedet for at æde tre minutter af kørslen.
    test.setTimeout(90_000);

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
