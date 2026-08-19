import { stat } from 'node:fs/promises';
import { BROWSER_LANE_TAG } from './support/lanes';
import { expect, login, openPage, test } from './support/mineoTest';

// Pladsregnskabet fra CONTENT_UI_SCALE_POLICY gentaget uafhængigt: HELE fladen skaleres under ét –
// sidemenu (250) + gutter 24 + indrykning 50 + indholdsboks 1200 + gutter 24 – plus scrollbar (20).
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
  test('skalerer arbejdsfladen og frigiver tekstsikker bredde fra sidemenuen', async ({ page, runtimeErrors }) => {
    await login(page);
    // Om-siden har repræsentative 1200-px-indholdsbokse. Den vælges eksplicit, fordi brugerens
    // gemte startsideindstilling ellers må afgøre den første rute i en ny browserkontekst.
    await openPage(page, 'Om');
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
    // Menuen bliver aldrig større end arbejdsfladen – det er hele pointen med den ene skala.
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
    await openPage(page, 'Satser');

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

  test('bevarer den vandrette Container-scroll som fallback under minimumsbredden', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Om');
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

  test('holder faneindikator og dropdown-popover på arbejdsfladens skala', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');
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

    await openPage(page, 'Indstillinger');
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

  test('lader hele popup-laget følge arbejdsfladens skala', async ({ page, runtimeErrors }) => {
    // Hjælpebobler, dialogvinduer og den flydende knap ligger uden for zoom-roden, men oven på
    // arbejdsfladen. Stod de i fuld størrelse, ville hjælpeteksten være STØRRE end den brødtekst,
    // den forklarer, så snart vinduet er smalt nok til at skalere fladen ned.
    await login(page);
    // Bredden vælges eksplicit, så skalaen med sikkerhed er under 1 uanset projektets viewport –
    // ellers ville testen kunne bestå på et billede, hvor der intet er at skalere.
    await page.setViewportSize({ width: 1300, height: 800 });
    await openPage(page, 'Erstatningsopgørelse');
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

  test('lader kontrolfanerne hænge uden for indholdsboksen uden at give vandret rul', { tag: BROWSER_LANE_TAG }, async ({ page, runtimeErrors }) => {
    // Fanerne roteres 90° og rager deres egen HØJDE (48 px) ud til højre for deres `left`, som ER
    // indholdsboksens kant. De 48 px indgår BEVIDST ikke i skaleringens pladsregnskab: to valgfrie
    // kontrolfaner må ikke kunne skrumpe hele arbejdsfladen. Til gengæld må udhænget så heller ikke
    // kunne give vandret rul, og det er `SideTabRail`s vandrette klipning, der holder den påstand.
    //
    // Testen ligger i browserbanen, fordi mekanismen ER motorafhængig: klipningen er
    // `overflow-x: clip` sammen med `overflow-y: visible`, og den roterede fane rager 265 px nedad.
    // En motor, der blokificerer den visible akse, ville klippe fanen på tværs i stedet.
    await login(page);
    await openPage(page, 'Indstillinger');
    const kontrolfaner = page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' });
    if (!(await kontrolfaner.isChecked())) await kontrolfaner.check();

    await openPage(page, 'Erstatningsopgørelse');
    await expect(page.getByRole('button', { name: 'EO-kontrol' })).toBeVisible();

    const readGeometry = async () => page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
      const rail = document.querySelector<HTMLElement>('[data-mineo-side-tab-rail="true"]');
      if (container === null || rail === null) {
        throw new Error('Mangler Container eller kontrolfanernes skinne.');
      }
      const railStyle = getComputedStyle(rail);
      const sideTabs = Array.from(document.querySelectorAll<HTMLElement>('.side-tab'));
      return {
        // Boksen i den AKTIVE fane er den synlige; skjulte faner måler nul.
        contentBoxRight: Math.max(
          ...Array.from(document.querySelectorAll<HTMLElement>('.content-box'))
            .map((box) => box.getBoundingClientRect().right),
        ),
        scrollportRight: container.getBoundingClientRect().left + container.clientWidth,
        railOverflowX: railStyle.overflowX,
        railOverflowY: railStyle.overflowY,
        railHeight: railStyle.height,
        // Skinnens højrekant ER klipperkanten: intet af udhænget males eller tælles med længere ude.
        railRight: rail.getBoundingClientRect().right,
        sideTabs: sideTabs.map((tab) => {
          const rect = tab.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
        }),
        overflowPx: container.scrollWidth - container.clientWidth,
      };
    });

    const geometry = await readGeometry();
    expect(geometry.sideTabs.length).toBe(2);
    // Klipningen er vandret ALENE. Var den lodret med, ville fanen – der rager nedad efter
    // rotationen – blive skåret over på tværs.
    expect(geometry.railOverflowX).toBe('clip');
    expect(geometry.railOverflowY).toBe('visible');
    // Skinnen må ikke selv flytte noget i flowet.
    expect(Number.parseFloat(geometry.railHeight)).toBe(0);

    // Bredderne dækker hele policyens spænd: fuld skala med rigelig plads, fuld skala med kun
    // scrollbar-reserven tilbage, to skalerede trin og den smalleste dækkede bredde.
    for (const width of [1920, 1568, 1366, 1181] as const) {
      await page.setViewportSize({ width, height: 800 });
      await expect.poll(() => page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
        (element) => getComputedStyle(element).zoom,
      )).toBe(expectedScaleForWidth(width));
      const measured = await readGeometry();

      for (const tab of measured.sideTabs) {
        // Fanen står PÅ boksens kant og rager udad – den ligger ikke inde i boksen længere.
        expect(Math.abs(tab.left - measured.contentBoxRight)).toBeLessThanOrEqual(1);
        expect(tab.right).toBeGreaterThan(measured.contentBoxRight + 1);
        // Rotationen gør fanens HØJDE til dens synlige bredde; etiketlængden er den lange side.
        expect(tab.height).toBeGreaterThan(tab.width);
      }
      // Kernen: klipperkanten ligger ved arbejdsfladens synlige højrekant, aldrig uden for den.
      // Hvor meget af udhænget der er plads til, afhænger af sidemenuens aktuelle bredde og af
      // browserens scrollbar – men uanset svaret må udhænget ikke give vandret rul.
      //
      // Kanten aflæses som en SETTLET værdi: sidemenuen sætter sin egen bredde i sin egen
      // layout-effect, så skinnen måler færdigt et frame efter, at zoomen er på plads.
      await expect.poll(async () => {
        const settled = await readGeometry();
        return settled.railRight <= settled.scrollportRight + 1 && settled.overflowPx <= 1;
      }, {
        message: `Skinnen skal klippe ved arbejdsfladens synlige højrekant ved ${width} CSS-px.`,
      }).toBe(true);
    }

    // Under den dækkede minimumsbredde er `Container`s vandrette rul den bevidste fallback, og
    // indholdet overflyder selv. Fanerne må ikke lægge en eneste pixel oveni: skinnen klemmes til
    // indholdsboksen, og fanerne forsvinder tavst.
    //
    // Kanten aflæses SETTLET, ligesom i løkken ovenfor – og her er det ikke til at undvære: skalaen
    // er ALLEREDE på minimum ved 1181 px, så zoom-værdien er uændret hen over vinduesskiftet og kan
    // ikke tjene som ventepunkt. En enkelt aflæsning ville derfor kunne ramme frame'et FØR skinnen
    // har målt sin nye kant og se den forrige bredes kant i stedet.
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect.poll(() => page.locator('main[data-mineo-content-scale-root="true"]').evaluate(
      (element) => getComputedStyle(element).zoom,
    )).toBe(String(MINIMUM_SCALE));
    await expect.poll(async () => {
      const settled = await readGeometry();
      return settled.overflowPx > 1 && settled.railRight <= settled.contentBoxRight + 1;
    }, {
      message: 'Under minimumsbredden skal skinnen klippes til indholdsboksen, mens Container selv ruller vandret.',
    }).toBe(true);
    expect(runtimeErrors).toEqual([]);
  });

  test('giver kontrolfanerne samme signatur som de vandrette faner – også i mørkt tema', async ({ page, runtimeErrors }) => {
    // «Nøjagtig samme formatering som de øvrige fane-labels» er kravet, og den fælles
    // `.tab-item`-regel er mekanismen. Målingen sammenholder de to fanefamiliers FAKTISKE
    // beregnede signatur i browseren – det er den eneste måling, der kan se, om en `sx`-værdi har
    // overtrumfet klassen igen. Netop det skete: `color: inherit` gjorde etiketten usynlig i mørkt
    // tema, og `border: none` slettede den blå streg.
    await login(page);
    await openPage(page, 'Indstillinger');
    const kontrolfaner = page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' });
    if (!(await kontrolfaner.isChecked())) await kontrolfaner.check();

    for (const theme of ['Lyst', 'Mørkt'] as const) {
      await openPage(page, 'Indstillinger');
      await page.getByRole('radio', { name: theme }).check();
      await openPage(page, 'Erstatningsopgørelse');
      await expect(page.getByRole('button', { name: 'Kontroltabel' })).toBeVisible();

      // Signaturen læses i TO pas, fordi de to tilstande per design ikke kan være der samtidig: er
      // en side-fane aktiv, står `PageTabs` med `value === false` og har ingen valgt fane.
      const readSignatures = async () => page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (element === null) throw new Error(`Mangler ${selector}.`);
          const style = getComputedStyle(element);
          return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textTransform: style.textTransform,
            color: style.color,
            opacity: style.opacity,
          };
        };
        const indicator = document.querySelector<HTMLElement>('.MuiTabs-indicator');
        const activeSideTab = document.querySelector<HTMLElement>('.side-tab.active');
        const activeLine = activeSideTab === null ? null : getComputedStyle(activeSideTab, '::after');

        return {
          inactiveSideTab: read('.side-tab:not(.active)'),
          inactiveMuiTab: document.querySelector('.MuiTab-root.tab-item:not(.Mui-selected)') === null
            ? null
            : read('.MuiTab-root.tab-item:not(.Mui-selected)'),
          activeSideTab: activeSideTab === null ? null : read('.side-tab.active'),
          selectedMuiTab: document.querySelector('.MuiTab-root.tab-item.Mui-selected') === null
            ? null
            : read('.MuiTab-root.tab-item.Mui-selected'),
          indicator: indicator === null ? null : {
            color: getComputedStyle(indicator).backgroundColor,
            height: getComputedStyle(indicator).height,
          },
          activeLine: activeLine === null ? null : {
            color: activeLine.backgroundColor,
            height: activeLine.height,
          },
          // Stregen ligger på fanens bund, som efter rotationen vender ind mod indholdsboksen –
          // altså præcis ved fanens venstrekant.
          activeSideTabLeft: activeSideTab?.getBoundingClientRect().left ?? null,
          contentBoxRight: Math.max(
            ...Array.from(document.querySelectorAll<HTMLElement>('.content-box'))
              .map((box) => box.getBoundingClientRect().right),
          ),
        };
      });

      // Fane-signaturen har en 0,2 s overgang på farve og gennemsigtighed – den delte `.tab-item`
      // giver begge familier den. Måles der midt i overgangen, sammenlignes en halvfærdig farve med
      // en færdig. Ventepunktet er den observerbare slutværdi, ikke en fast ventetid.
      const waitForSettledOpacity = async (selector: string, expected: string) => {
        await expect.poll(() => page.evaluate((target) => {
          const element = document.querySelector<HTMLElement>(target);
          return element === null ? null : getComputedStyle(element).opacity;
        }, selector)).toBe(expected);
      };

      // Pas 1 – ingen side-fane aktiv: de inaktive side-faner mod de inaktive vandrette faner, og
      // den valgte vandrette fanes signatur + indikatoren gemmes til pas 2. Den aktive fane er
      // gemt på tværs af sidebesøg, så udgangspunktet sættes eksplicit frem for at blive arvet fra
      // forrige gennemløb.
      await page.getByRole('tab', { name: 'EO oplysninger' }).click();
      await expect(page.getByRole('tab', { name: 'EO oplysninger' })).toHaveAttribute('aria-selected', 'true');
      await waitForSettledOpacity('.side-tab:not(.active)', '0.7');
      const resting = await readSignatures();
      expect(resting.inactiveSideTab).toEqual(resting.inactiveMuiTab);
      // Selve dark-mode-fejlen: en etiket, der arver sin farve, ender sort på mørk flade.
      expect(resting.inactiveSideTab.color).not.toBe('rgb(0, 0, 0)');
      expect(resting.selectedMuiTab).not.toBeNull();
      expect(resting.indicator).not.toBeNull();

      // Pas 2 – EO-kontrol aktiv.
      await page.getByRole('button', { name: 'EO-kontrol' }).click();
      await expect(page.getByRole('button', { name: 'EO-kontrol' })).toHaveAttribute('aria-pressed', 'true');
      await waitForSettledOpacity('.side-tab.active', '1');
      const active = await readSignatures();

      expect(active.activeSideTab).toEqual(resting.selectedMuiTab);
      // Den blå streg: samme farve OG samme mekanisme som de vandrette faners indikator – en 2 px
      // malet kasse. Højden læses uzoomet, netop fordi en `border` her ville blive afrundet til 1 px
      // ved delvis zoom, mens indikatoren forbliver 2 px × skala.
      expect(active.activeLine?.color).toBe(resting.indicator?.color);
      expect(active.activeLine?.height).toBe(resting.indicator?.height);
      // Placeringen: stregen står på indholdsboksens højrekant – også når fladen er skaleret ned.
      expect(Math.abs((active.activeSideTabLeft ?? 0) - active.contentBoxRight)).toBeLessThanOrEqual(1);
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('viser hele arbejdsfladen uden vandret rul ved 1280 CSS-px', async ({ page, runtimeErrors }) => {
    // 1920×1200-skærmen ved 150 % browserzoom giver præcis 1280 CSS-px. Testen er regressionsværnet
    // for netop den opsætning: indholdet skal være der i fuld bredde – ikke klippet, ikke skjult.
    await login(page);
    await page.setViewportSize({ width: 1280, height: 740 });

    for (const pageName of ['Om', 'Erstatningsopgørelse', 'Satser'] as const) {
      await openPage(page, pageName);
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

  // BASISBANEN ALENE – bevidst utagget. `html2canvas` med `scale: 2` er suitens dyreste
  // enkelthandling: den bygger en bitmap på mange titusinder af pixel i bredden og holder både
  // klonen og lærredet i hukommelsen. Én kørsel beviser det samme om produktet – at capturen
  // neutraliserer arbejdsfladens skala og gendanner den – og skal den efterkontrolleres i alle
  // motorer, ligger den stadig i `test:e2e:full`.
  //
  // HISTORIK, fordi symptomet var vildledende: testen hang i sit fulde loft med «venter på
  // Download skærmprint», hver gang den kørte samtidig med noget andet, og var grøn alene. Det
  // lignede – og blev først forklaret som – at capturen ikke blev færdig under hukommelsespres.
  // Målingen viste noget andet: rapportdialogen ÅBNEDE, og forsvandt så igen et kvart sekund efter.
  // Klikket ramte rapportknappen på den STADIG viste Indstillinger-side, fordi navigationen til
  // Erstatningsopgørelse kun havde skiftet URL; da EO-chunken landede, blev Indstillinger unmountet
  // og dialogen med. Se `openPage` i `support/mineoTest.ts`, som nu lukker hele den fældeklasse.
  test('skærmprint neutraliserer kun arbejdsfladeskaleringen under capture', async ({ page, runtimeErrors }) => {
    // Capturen måler ~3 sekunder. Loftet er rundhåndet i forhold til det, men lavt nok til at en
    // stoppet capture melder sig hurtigt i stedet for at æde suitens fulde loft.
    test.setTimeout(60_000);

    await login(page);
    await openPage(page, 'Indstillinger');
    const reportSetting = page.getByRole('checkbox', {
      name: 'Vis knap til at rapportere fejl og forbedringsønsker på indholdsbokse',
    });
    if (!(await reportSetting.isChecked())) await reportSetting.check();

    await openPage(page, 'Erstatningsopgørelse');
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
