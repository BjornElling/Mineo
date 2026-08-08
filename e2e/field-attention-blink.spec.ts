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
  await addBlinkClass(page, selector);
  const samples: string[] = [];
  // Starten af en CSS-animation kan ligge mellem to browserframes. Et lidt tættere og længere
  // sample-vindue gør testen robust på Firefox/WebKit uden at ændre produktets timing.
  await page.waitForTimeout(50);
  for (let index = 0; index < 24; index += 1) {
    samples.push(await readBackground(page, selector));
    await page.waitForTimeout(75);
  }
  return samples;
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
  const painted = samples.filter((sample) => alphaOf(sample) > 0.02);
  // En enkelt tydelig painted sample er tilstrækkelig; WebKit kan samle flere CSS-frames i samme
  // sample, så antallet af observerede mellemframes er ikke en stabil browserkontrakt.
  expect(painted.length).toBeGreaterThan(0);
  for (const sample of painted) expect(containsErrorRed(sample)).toBe(true);

  const alphas = samples.map(alphaOf);
  expect(Math.max(...alphas)).toBeGreaterThan(0.12);
  expect(Math.min(...alphas)).toBeLessThan(0.02);
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
});
