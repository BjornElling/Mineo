import { type Page } from '@playwright/test';

import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';

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

const BLINK_CLASS = 'mineo-field-attention-blink';

/** Den ENE feltidentitet i DOM (§3.2). Bruges til at skrive blinkmålets identitet ned. */
const FIELD_ADDRESS_ATTRIBUTE = 'data-mineo-field-address';

/** `--color-status-error` er #ef4444; markeringen er 20 % af den farve blandet ind i baggrunden. */
const ERROR_RED_SRGB = '0.937255 0.266667 0.266667';

/** Den røde komponent fra `--color-status-error`, uanset browserens farveserialisering. */
const ERROR_RED_SRGB_COMPONENTS = [0.937255, 0.266667, 0.266667] as const;

const FORM_FIELD_SELECTOR =
  '[data-mineo-field-address=\'{"section":"stamdata","path":[],"field":"journalnr"}\']';

/** Grid-cellerne bærer en entitets-sti i feltadressen; det skelner dem fra formularfelterne. */
const GRID_CELL_SELECTOR = '[data-mineo-field-address*="entityId"]';

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
 *
 * **Observationen er samtidig testens ENESTE kilde til HVILKET element der blinkede.** Blinket er en
 * transient tilstand: klassen står i 1,5 s og fjernes så af `fieldAttentionBlink.ts`. En påstand, der
 * spørger den LEVENDE DOM «bærer feltet klassen?», er derfor et kapløb mod den timer — grøn på en hurtig
 * maskine, og på en langsom maskine et 30 s-loft brugt på at vente på en tilstand, der aldrig kommer
 * tilbage. Sampleren skriver derfor målets identitet ned, mens klassen er der, og
 * påstandene læser den nedskrevne observation bagefter — uafhængigt af hvornår testprocessen når frem.
 */
const startBlinkSampling = (page: Page): Promise<void> => page.evaluate(
  ([className, addressAttribute]) => {
    type BlinkSamplingState = {
      samples: string[];
      complete: boolean;
      /** Feltadressen på det element, der faktisk blinkede — nedskrevet mens klassen stod der. */
      targetAddress: string | null;
      /** `name`-attributten på målets eget input, så en påstand kan pege på det konkrete felt. */
      targetInputName: string | null;
      /** Målets klasseliste på observationstidspunktet. */
      targetClassName: string | null;
      /** Sandt hvis dropdownpilen lå inden for målets rektangel, da blinket blev malet. */
      arrowInsideSurface: boolean | null;
      /** Sandt når de spolede prøver af animationens top og bund er taget (kun én gang). */
      seekedSamplesTaken: boolean;
    };
    const windowWithBlinkSampling = window as Window & { mineoBlinkSampling?: BlinkSamplingState };
    const state: BlinkSamplingState = {
      samples: [],
      complete: false,
      targetAddress: null,
      targetInputName: null,
      targetClassName: null,
      arrowInsideSurface: null,
      seekedSamplesTaken: false,
    };
    windowWithBlinkSampling.mineoBlinkSampling = state;

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains(className)) continue;

        observer.disconnect();

        // Skriv målets identitet ned MENS klassen står der. Efter 1,5 s er den væk for altid.
        state.targetClassName = target.className;
        const inner = target.matches('input')
          ? target
          : target.querySelector<HTMLElement>(`input[${addressAttribute}], input[name]`);
        state.targetAddress = (inner ?? target).getAttribute(addressAttribute)
          ?? target.getAttribute(addressAttribute);
        state.targetInputName = inner?.getAttribute('name') ?? null;

        // Pilens dækning er også en observation af blinkøjeblikket, ikke af tiden bagefter.
        const arrow = target.parentElement?.querySelector<SVGElement>('svg');
        if (arrow) {
          const surfaceBox = target.getBoundingClientRect();
          const arrowBox = arrow.getBoundingClientRect();
          state.arrowInsideSurface = arrowBox.left >= surfaceBox.left
            && arrowBox.right <= surfaceBox.right
            && arrowBox.top >= surfaceBox.top
            && arrowBox.bottom <= surfaceBox.bottom;
        }

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
        /**
         * Aflæs animationens top og bund DETERMINISTISK i stedet for at håbe på, at en rAF-frame
         * lander der.
         *
         * rAF-sampling måler kun de øjeblikke, browseren tilfældigvis nåede at tegne. Under
         * hukommelses- og CPU-pres tegner WebKit så få frames, at samtlige prøver kan lande i
         * animationens lave faser: målt maxAlpha 0,006–0,105 mod et krav på 0,12, selv om blinket
         * FAKTISK blev malet — en måleartefakt, ikke en produktfejl.
         *
         * Web Animations API'et kender animationen uafhængigt af tegningen. Ved at spole til et
         * kendt tidspunkt (0,25 s = første pulstop, 0,5 s = bund) aflæses de to yderpunkter, som
         * kontrakten handler om, uden at afhænge af framerate. Bagefter stilles uret tilbage, så
         * animationen kører videre og fjernes normalt.
         */
        const readAtOffsets = () => {
          const animations = target.getAnimations?.() ?? [];
          const blink = animations.find((candidate) =>
            (candidate as CSSAnimation).animationName === 'mineoFieldAttentionBlink');
          if (!blink) return false;

          const resumeTime = blink.currentTime;
          for (const offsetMs of [250, 500, 750]) {
            blink.currentTime = offsetMs;
            // Tving stilberegningen frem på det spolede tidspunkt.
            state.samples.push(getComputedStyle(target).backgroundColor);
          }
          blink.currentTime = resumeTime;
          return true;
        };

        const sampleFrame = () => {
          if (!target.classList.contains(className)) {
            removalObserver.disconnect();
            state.complete = true;
            return;
          }
          if (!state.seekedSamplesTaken) {
            state.seekedSamplesTaken = readAtOffsets();
          }
          state.samples.push(getComputedStyle(target).backgroundColor);
          requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
        return;
      }
    });

    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  },
  [BLINK_CLASS, FIELD_ADDRESS_ATTRIBUTE] as const
);

/** Den nedskrevne observation af ét blink. Læses efter animationen; ingen levende DOM-opslag. */
type BlinkObservation = Readonly<{
  samples: readonly string[];
  targetAddress: string | null;
  targetInputName: string | null;
  targetClassName: string | null;
  arrowInsideSurface: boolean | null;
}>;

/**
 * Vent på, at blinket er kørt HELT færdigt, og aflever den nedskrevne observation.
 *
 * Ventetiden er bundet til at animationen er slut — ikke til at en klasse tilfældigvis stadig står.
 * Derfor er den lige robust på en hurtig og en langsom maskine.
 */
const readBlinkObservation = async (page: Page): Promise<BlinkObservation> => {
  await page.waitForFunction(() => {
    const state = (window as Window & { mineoBlinkSampling?: { complete: boolean } }).mineoBlinkSampling;
    return state?.complete === true;
  });
  return page.evaluate(() => {
    const state = (window as Window & { mineoBlinkSampling?: BlinkObservation }).mineoBlinkSampling;
    return {
      samples: state?.samples ?? [],
      targetAddress: state?.targetAddress ?? null,
      targetInputName: state?.targetInputName ?? null,
      targetClassName: state?.targetClassName ?? null,
      arrowInsideSurface: state?.arrowInsideSurface ?? null,
    };
  });
};

const readBlinkSamples = async (page: Page): Promise<readonly string[]> =>
  (await readBlinkObservation(page)).samples;

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
  await openPage(page, 'Erstatningsopgørelse');
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
  observation: Promise<BlinkObservation>
): Promise<void> => {
  await expect(page.locator(`input[name="${inputName}"]`)).toBeVisible();

  const observed = await observation;
  // Blinket ramte netop dette felt — aflæst da klassen stod der, ikke gættet på bagefter.
  expect(observed.targetInputName).toBe(inputName);
  expect(observed.targetClassName).toContain(BLINK_CLASS);
  // Pilen lå inden for den blinkende flade, så markeringen dækkede også dropdownens pileområde.
  expect(observed.arrowInsideSurface).toBe(true);
  expectRedPulse(observed.samples);
};

/** Samme visuelle kontrakt for tekst-, dato- og procentfelter uden dropdown-pil. */
const expectLinkedInputToPulse = async (
  page: Page,
  inputName: string,
  observation: Promise<BlinkObservation>
): Promise<void> => {
  await expect(page.locator(`input[name="${inputName}"]`)).toBeVisible();

  const observed = await observation;
  expect(observed.targetInputName).toBe(inputName);
  expect(observed.targetClassName).toContain(BLINK_CLASS);
  expectRedPulse(observed.samples);
};

test.describe('Blinkmarkeringen males i browseren', () => {
  test('formularfelt: pulserer rødt og forsvinder igen', async ({ page }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await expect(page.locator(FORM_FIELD_SELECTOR)).toBeVisible();

    // Udgangspunktet er umarkeret — ellers ville en altid-rød baggrund bestå testen.
    expect(alphaOf(await readBackground(page, FORM_FIELD_SELECTOR))).toBeLessThan(0.01);

    expectRedPulse(await sampleBlink(page, FORM_FIELD_SELECTOR));
  });

  test('grid-celle: samme markering på den anden flade', async ({ page }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');
    await expect(page.locator(GRID_CELL_SELECTOR).first()).toBeVisible();

    expect(alphaOf(await readBackground(page, GRID_CELL_SELECTOR))).toBeLessThan(0.01);

    expectRedPulse(await sampleBlink(page, GRID_CELL_SELECTOR));
  });

  test('reduceret bevægelse: roligt statisk felt frem for et blink', async ({ page }) => {
    await login(page);
    await openPage(page, 'Stamdata');
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
    await expectLinkedDropdownToPulse(page, 'svieSmerteHelbredsstatus', readBlinkObservation(page));
  });

  test('fejllink til en anden side blinker det konkrete dropdownfelt efter route-skift', async ({ page }) => {
    await openEoErrorOverview(page);
    await startBlinkSampling(page);

    await clickEoIssueLink(page, 'Skadestype er ikke angivet', 'Skadelidte');

    await expect(page).toHaveURL(/\/stamdata$/);
    await expectLinkedDropdownToPulse(page, 'skadestype', readBlinkObservation(page));
  });

  test('SFGG-fejllink blinker beregningskilden, ikke ansættelseskortet', async ({ page }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
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

    const observed = await readBlinkObservation(page);
    // Blinket ramte beregningskilden — ikke ansættelseskortet. Den negative påstand aflæses på den
    // NEDSKREVNE observation: kortet kan ikke «holde op med» at blinke sig fri af en levende kontrol.
    expect(observed.targetInputName).toBe(inputName);
    await expectLinkedDropdownToPulse(page, inputName!, Promise.resolve(observed));
  });

  /**
   * Advarslen om en indtastning, der IKKE FINDES ENDNU.
   *
   * «Der er ikke angivet nogen TAF-periode i EO-perioden» handler om en række, brugeren ikke har
   * oprettet. Advarslen bar tidligere et rækkeanker på sit eget synthetiske id, og da
   * `data-mineo-row-id` kun sættes på virkelige tabelrækker, kunne opslaget ikke finde noget: linket
   * skiftede fane og blinkede intet. Testen hævder den adfærd, brugeren skal opleve — at fra-cellen i
   * TAF-tabellens første (tomme) række markeres.
   */
  test('advarsel om manglende TAF-periode blinker fra-cellen i tabellens første række', async ({ page }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
    await page.getByRole('tab', { name: 'Beregning' }).click();

    await startBlinkSampling(page);
    await clickEoIssueLink(
      page,
      'Der er ikke angivet nogen TAF-periode i EO-perioden',
      'Tabt arbejdsfortjeneste'
    );

    await expect(page.getByRole('tab', { name: 'EO oplysninger' })).toHaveAttribute('aria-selected', 'true');

    // Den tomme indtastningsrækkes fra-celle: en TAF-fra-adresse med et entity-led (rækken), altså
    // netop den celle brugeren skal udfylde for at få advarslen væk.
    const fraCell = page
      .locator('[data-mineo-field-address*="tafPerioder"][data-mineo-field-address*="\\"field\\":\\"fra\\""]')
      .first();
    await expect(fraCell).toBeVisible();

    const observed = await readBlinkObservation(page);
    expect(observed.targetClassName).toContain(BLINK_CLASS);
    // Den blinkede adresse ER TAF-tabellens fra-celle — aflæst fra observationen, ikke fra en klasse,
    // der forlængst kan være fjernet igen på en langsom maskine.
    expect(observed.targetAddress).toContain('tafPerioder');
    expect(observed.targetAddress).toContain('"field":"fra"');
    expectRedPulse(observed.samples);
  });

  test('EET-fejllink blinker beregningsdatoen efter et faneskift', async ({ page }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');
    await page.getByRole('tab', { name: 'Differencekrav' }).click();
    const issue = page.locator('.row--label-right-hover').filter({
      hasText: 'Beregningsdato er ikke udfyldt',
    });
    await expect(issue).toBeVisible();

    await startBlinkSampling(page);
    await issue.getByRole('button', { name: 'Grundlæggende oplysninger', exact: true }).click();

    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expectLinkedInputToPulse(page, 'beregningsdato', readBlinkObservation(page));
  });

  test('EET-advarselslink blinker EAL-procenten efter et faneskift', async ({ page }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    for (const [name, value] of [
      ['skadelidteFodselsdato', '01-01-1980'],
      ['skadedato', '01-01-2020'],
    ] as const) {
      await setFieldValueAndSettle(page.locator(`input[name="${name}"]`), value);
    }
    await openPage(page, 'Erhvervsevnetab');
    await setFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-01-2026');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '300000');
    await setFieldValueAndSettle(page.locator('input[name="ealEetPct"]'), '10');
    await page.getByRole('tab', { name: 'EET efter EAL' }).click();
    const warning = page.locator('.row--label-right-hover').filter({
      hasText: 'Der kan ikke tilkendes erhvervsevnetab under 15 %',
    });
    await expect(warning).toBeVisible();

    await startBlinkSampling(page);
    await warning.getByRole('button', { name: 'Erstatningsansvarsloven', exact: true }).click();

    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expectLinkedInputToPulse(page, 'ealEetPct', readBlinkObservation(page));
  });
});
