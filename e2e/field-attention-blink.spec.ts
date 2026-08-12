import { expect, test, type Page } from '@playwright/test';

/**
 * Browser-verifikation af den delte «peg på dette felt»-blinkmarkering (BF-020/BF-021).
 *
 * **Hvorfor denne test findes ud over integrationstestene.** Suitens integrationstests beviser, at
 * blink-KLASSEN lander på det rigtige element. Det er en anden påstand end den, brugeren mærker:
 * at markeringen faktisk MALES — i den rigtige farve, med den rigtige rytme, og på begge de flader
 * markeringen skal kunne bruges på. jsdom har hverken layout- eller animationsmotor og kan derfor
 * ikke se forskel på en klasse, der virker, og en, hvis CSS aldrig blev indlæst eller blev slået af
 * MUI's egne baggrundsregler. Den strid er præcis dét, `!important` i `sharedApp.css` findes for at
 * afgøre — og kun en rigtig browser kan afgøre, om den vandt.
 *
 * Testen måler den BEREGNEDE baggrund over tid frem for at sammenligne screenshots. En pixel-baseline
 * ville knække på enhver urelateret layout- eller temaændring og sige intet om hvorfor; en farve- og
 * rytmemåling udtrykker selve kontrakten: rød, pulserende, forbi igen.
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';
const BLINK_CLASS = 'mineo-field-attention-blink';

/** `--color-status-error` er #ef4444; markeringen er 20 % af den farve blandet ind i baggrunden. */
const ERROR_RED_SRGB = '0.937255 0.266667 0.266667';

/** Den røde komponent fra `--color-status-error`, uanset browserens farveserialisering. */
const ERROR_RED_SRGB_COMPONENTS = [0.937255, 0.266667, 0.266667] as const;

const FORM_FIELD_SELECTOR =
  '[data-mineo-field-address=\'{"section":"stamdata","path":[],"field":"journalnr"}\']';

/** Grid-cellerne bærer en entitets-sti i feltadressen; det skelner dem fra formularfelterne. */
const GRID_CELL_SELECTOR = '[data-mineo-field-address*="entityId"]';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

/** Aflæs den FAKTISK beregnede — animerede — baggrund, ikke den erklærede regel. */
const readBackground = (page: Page, selector: string): Promise<string> =>
  page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel) as HTMLElement).backgroundColor,
    selector
  );

/**
 * Browserne serialiserer `color-mix()` forskelligt: Chromium bruger typisk `oklab`, mens Firefox
 * bruger `color(srgb)`, og WebKit kan variere afrundingen. Testen skal hævde den røde blanding og
 * animationens kontrakt — ikke én motors interne tekstformat.
 */
const containsErrorRed = (color: string): boolean => {
  const numbers = color.match(/-?\d*\.\d+|-?\d+/g)?.map(Number) ?? [];
  if (color.includes('color(srgb')) {
    const [red, green, blue] = numbers;
    return [red, green, blue].every((value, index) =>
      value !== undefined && Math.abs(value - ERROR_RED_SRGB_COMPONENTS[index]) < 0.002
    );
  }

  // WebKit og Chromium rapporterer lejlighedsvis oklab-koordinater med lidt forskellig afrunding.
  return color.includes('oklab(') && numbers.length >= 3
    && Math.abs(numbers[0]! - 0.636841) < 0.001
    && Math.abs(numbers[1]! - 0.187884) < 0.001
    && Math.abs(numbers[2]! - 0.088943) < 0.001;
};

const addBlinkClass = (page: Page, selector: string): Promise<void> =>
  page.evaluate(
    ([sel, cls]) => {
      (document.querySelector(sel) as HTMLElement).classList.add(cls);
    },
    [selector, BLINK_CLASS] as const
  );

/** Sæt markeringen og følg baggrunden gennem animationens løbetid. */
const sampleBlink = async (page: Page, selector: string): Promise<readonly string[]> => {
  // Brug samme rAF-observation som de navigerbare fejl-links. Faste Playwright-timere kan i WebKit
  // blive afviklet efter den korte animation og dermed kun se den statiske sluttilstand, selv om
  // markeringen faktisk blev malet. Browserens egne frames er den observerbare kontrakt.
  await startBlinkSampling(page);
  await page.evaluate(
    ([sel, cls]) => {
      const target = document.querySelector(sel);
      if (!(target instanceof HTMLElement)) throw new Error(`Blinkmål findes ikke: ${sel}`);
      const removeClass = () => target.classList.remove(cls);
      target.addEventListener('animationend', removeClass, { once: true });
      target.classList.add(cls);
      // Fallback for motorer, der ikke sender animationend ved en dynamisk classList-ændring.
      window.setTimeout(removeClass, 2000);
    },
    [selector, BLINK_CLASS] as const
  );
  return readBlinkSamples(page);
};

/**
 * Start browserens egen rAF-sampling FØR et rigtigt fejllink klikkes.
 *
 * På en stor WebKit-viewport kan en Playwright-rundtur nå at komme sent ind i den korte 1,5 s-animation.
 * Sampling må derfor følge browserens frames fra klasseændringen, ikke fra testprocessens næste await.
 */
const startBlinkSampling = (page: Page): Promise<void> => page.evaluate((className) => {
  type BlinkSamplingState = { samples: string[]; complete: boolean };
  const windowWithBlinkSampling = window as Window & { mineoBlinkSampling?: BlinkSamplingState };
  windowWithBlinkSampling.mineoBlinkSampling = { samples: [], complete: false };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains(className)) continue;

      observer.disconnect();
      const state = windowWithBlinkSampling.mineoBlinkSampling;
      if (!state) return;
      const removalObserver = new MutationObserver((removalRecords) => {
        if (removalRecords.some((removalRecord) =>
          removalRecord.target instanceof HTMLElement
          && !removalRecord.target.classList.contains(className))) {
          removalObserver.disconnect();
          state.complete = true;
        }
      });
      removalObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class'],
      });
      const sampleFrame = () => {
        if (!target.classList.contains(className)) {
          removalObserver.disconnect();
          state.complete = true;
          return;
        }
        state.samples.push(getComputedStyle(target).backgroundColor);
        requestAnimationFrame(sampleFrame);
      };
      requestAnimationFrame(sampleFrame);
      return;
    }
  });

  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}, BLINK_CLASS);

const readBlinkSamples = async (page: Page): Promise<readonly string[]> => {
  await page.waitForFunction(() => {
    const state = (window as Window & { mineoBlinkSampling?: { complete: boolean } }).mineoBlinkSampling;
    return state?.complete === true;
  });
  return page.evaluate(() => {
    const state = (window as Window & { mineoBlinkSampling?: { samples: string[] } }).mineoBlinkSampling;
    return state?.samples ?? [];
  });
};

/**
 * Læs alfa ud af en beregnet farve. Chromium rapporterer den animerede blanding som `oklab(... / a)`
 * og den statiske som `color(srgb ... / a)`, så alfa tages fra `/ a`-suffikset i begge former.
 */
const alphaOf = (color: string): number => {
  const match = /\/\s*([0-9.]+)\s*\)/.exec(color);
  if (match !== null) return Number.parseFloat(match[1]);
  return color === 'rgba(0, 0, 0, 0)' ? 0 : 1;
};

/**
 * Fælles påstand for begge flader: markeringen males i fejlrød, når en tydelig top, og er nede igen
 * imellem — altså et BLINK og ikke en konstant baggrund.
 */
const expectRedPulse = (samples: readonly string[]): void => {
  // Nogle motorer afleverer MUI-skallens hvide normalbaggrund i den FØRSTE rAF efter klasseændringen.
  // Den er ikke en animationframe og må ikke kunne skjule eller afvise de efterfølgende røde frames.
  const redAnimationSamples = samples.filter(containsErrorRed);
  expect(redAnimationSamples.length).toBeGreaterThan(0);

  const alphas = redAnimationSamples.map(alphaOf);
  const maximumAlpha = Math.max(...alphas);
  const minimumAlpha = Math.min(...alphas);
  expect(maximumAlpha).toBeGreaterThan(0.12);
  // WebKit kan springe helt over animationens eksakte 0-frame ved route-skift. Kravet er den
  // observerbare puls (klar top og tydeligt fald), ikke at måleren får netop denne ene frame.
  expect(maximumAlpha - minimumAlpha).toBeGreaterThan(0.1);
};

/** Opretter de fejl, der driver de rigtige navigerbare links på EO's Beregning-fane. */
const openEoErrorOverview = async (page: Page): Promise<void> => {
  await login(page);
  await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
  await page.getByRole('tab', { name: 'Beregning' }).click();
  await expect(page.getByText('Fejl og advarsler', { exact: true })).toBeVisible();
};

/** Klikker den handlingsknap, der hører til præcis den viste fejl-/advarselsrække. */
const clickEoIssueLink = async (page: Page, message: string, actionName: string): Promise<void> => {
  const issueRow = page.locator('.row--label-right-hover').filter({ hasText: message });
  await expect(issueRow).toBeVisible();
  await issueRow.getByRole('button', { name: actionName, exact: true }).click();
};

/**
 * Et StyledDropdowns synlige flade er MUI-roden, ikke det indre input med feltadressen.
 * Rodens rektangel ligger bag den absolut placerede pil, så dens pulserende baggrund beviser også
 * dækningen af pilens område.
 */
const expectLinkedDropdownToPulse = async (
  page: Page,
  inputName: string,
  samples: Promise<readonly string[]>
): Promise<void> => {
  const input = page.locator(`input[name="${inputName}"]`);
  await expect(input).toBeVisible();
  const surface = input.locator('xpath=..');
  await expect(surface).toHaveClass(new RegExp(BLINK_CLASS));

  const arrowIsInsideSurface = await input.evaluate((element) => {
    const surface = element.closest<HTMLElement>('.MuiInputBase-root');
    const arrow = surface?.parentElement?.querySelector<SVGElement>('svg');
    if (!surface || !arrow) return false;
    const surfaceBox = surface.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    return arrowBox.left >= surfaceBox.left && arrowBox.right <= surfaceBox.right
      && arrowBox.top >= surfaceBox.top && arrowBox.bottom <= surfaceBox.bottom;
  });
  expect(arrowIsInsideSurface).toBe(true);

  expectRedPulse(await samples);
};

/** Samme visuelle kontrakt for tekst-, dato- og procentfelter uden dropdown-pil. */
const expectLinkedInputToPulse = async (
  page: Page,
  inputName: string,
  samples: Promise<readonly string[]>
): Promise<void> => {
  const input = page.locator(`input[name="${inputName}"]`);
  await expect(input).toBeVisible();
  await expect(input.locator('xpath=..')).toHaveClass(new RegExp(BLINK_CLASS));
  expectRedPulse(await samples);
};

test.describe('Blinkmarkeringen males i browseren', () => {
  test('formularfelt: pulserer rødt og forsvinder igen', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Stamdata' }).click();
    await expect(page.locator(FORM_FIELD_SELECTOR)).toBeVisible();

    // Udgangspunktet er umarkeret — ellers ville en altid-rød baggrund bestå testen.
    expect(alphaOf(await readBackground(page, FORM_FIELD_SELECTOR))).toBeLessThan(0.01);

    expectRedPulse(await sampleBlink(page, FORM_FIELD_SELECTOR));
  });

  test('grid-celle: samme markering på den anden flade', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Årslønsberegning' }).click();
    await expect(page.locator(GRID_CELL_SELECTOR).first()).toBeVisible();

    expect(alphaOf(await readBackground(page, GRID_CELL_SELECTOR))).toBeLessThan(0.01);

    expectRedPulse(await sampleBlink(page, GRID_CELL_SELECTOR));
  });

  test('reduceret bevægelse: roligt statisk felt frem for et blink', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Stamdata' }).click();
    await expect(page.locator(FORM_FIELD_SELECTOR)).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await addBlinkClass(page, FORM_FIELD_SELECTOR);
    const animationName = await page.evaluate(
      (sel) => getComputedStyle(document.querySelector(sel) as HTMLElement).animationName,
      FORM_FIELD_SELECTOR
    );
    const background = await readBackground(page, FORM_FIELD_SELECTOR);

    // Ingen animation — men markeringen forsvinder IKKE: brugeren skal stadig kunne se hvilket felt.
    expect(animationName).toBe('none');
    expect(background).toContain(ERROR_RED_SRGB);
    expect(alphaOf(background)).toBeCloseTo(0.2, 2);
  });

  test('fejllink på samme side blinker hele dropdownen, også under pilen', async ({ page }) => {
    await openEoErrorOverview(page);
    await startBlinkSampling(page);

    await clickEoIssueLink(page, 'Helbredsforhold er ikke angivet', 'Erstatningsopgørelse');

    await expect(page.getByRole('tab', { name: 'EO oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expectLinkedDropdownToPulse(page, 'svieSmerteHelbredsstatus', readBlinkSamples(page));
  });

  test('fejllink til en anden side blinker det konkrete dropdownfelt efter route-skift', async ({ page }) => {
    await openEoErrorOverview(page);
    await startBlinkSampling(page);

    await clickEoIssueLink(page, 'Skadestype er ikke angivet', 'Skadelidte');

    await expect(page).toHaveURL(/\/stamdata$/);
    await expectLinkedDropdownToPulse(page, 'skadestype', readBlinkSamples(page));
  });

  test('SFGG-fejllink blinker beregningskilden, ikke ansættelseskortet', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    await page.getByRole('tab', { name: 'Lønindkomst' }).click();
    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ja, tilføj' }).click();
    await page.getByRole('tab', { name: 'Beregning' }).click();

    await startBlinkSampling(page);
    await clickEoIssueLink(
      page,
      'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt',
      'Ansættelsesforhold'
    );

    await expect(page.getByRole('tab', { name: 'Lønindkomst' })).toHaveAttribute('aria-selected', 'true');
    const input = page.locator('input[name$=":sfggBeregningskilde"]');
    await expect(input).toBeVisible();
    const inputName = await input.getAttribute('name');
    expect(inputName).not.toBeNull();

    const employmentCard = input.locator('xpath=ancestor::*[@data-mineo-row-id][1]');
    await expect(employmentCard).not.toHaveClass(BLINK_CLASS);
    await expectLinkedDropdownToPulse(page, inputName!, readBlinkSamples(page));
  });

  test('EET-fejllink blinker beregningsdatoen efter et faneskift', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
    await page.getByRole('tab', { name: 'Differencekrav' }).click();
    const issue = page.locator('.row--label-right-hover').filter({
      hasText: 'Beregningsdato er ikke udfyldt',
    });
    await expect(issue).toBeVisible();

    await startBlinkSampling(page);
    await issue.getByRole('button', { name: 'Grundlæggende oplysninger', exact: true }).click();

    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expectLinkedInputToPulse(page, 'beregningsdato', readBlinkSamples(page));
  });

  test('EET-advarselslink blinker EAL-procenten efter et faneskift', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Stamdata' }).click();
    for (const [name, value] of [
      ['skadelidteFodselsdato', '01-01-1980'],
      ['skadedato', '01-01-2020'],
    ] as const) {
      const input = page.locator(`input[name="${name}"]`);
      await input.dblclick();
      await input.fill(value);
      await input.press('Tab');
    }
    await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
    const beregningsdato = page.locator('input[name="beregningsdato"]');
    const ealEetPct = page.locator('input[name="ealEetPct"]');
    await beregningsdato.dblclick();
    await beregningsdato.fill('01-01-2026');
    await beregningsdato.press('Tab');
    const aslAarsloen = page.locator('input[name="aslAarsloen"]');
    await aslAarsloen.dblclick();
    await aslAarsloen.fill('300000');
    await aslAarsloen.press('Tab');
    await ealEetPct.dblclick();
    await ealEetPct.fill('10');
    await ealEetPct.press('Tab');
    await page.getByRole('tab', { name: 'EET efter EAL' }).click();
    const warning = page.locator('.row--label-right-hover').filter({
      hasText: 'Der kan ikke tilkendes erhvervsevnetab under 15 %',
    });
    await expect(warning).toBeVisible();

    await startBlinkSampling(page);
    await warning.getByRole('button', { name: 'Erstatningsansvarsloven', exact: true }).click();

    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expectLinkedInputToPulse(page, 'ealEetPct', readBlinkSamples(page));
  });
});
