import { type Locator } from '@playwright/test';
import {
  expect,
  login,
  openPage,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

import { BROWSER_LANE_TAG } from './support/lanes';

const LONG_TOOLTIP_TEXT = 'Juridisk omtvistet, men nyere retspraksis hælder mod fuld sats';
const TAF_UNAVAILABLE_TOOLTIP = 'Der er ingen TAF-perioder i EO-perioden';
const EAL_MISSING_RATES_TOOLTIP = 'EAL-beregningen kan ikke gennemføres, fordi der mangler reguleringssats for 1999, 2000, 2001, 2002, 2003, 2004.';

const measureTooltip = async (tooltip: Locator) => tooltip.evaluate((element) => {
  const lines = [...element.querySelectorAll('.mineo-tooltip-line')];
  if (lines.some((line) => line.firstChild === null)) return null;

  const lineWidths = lines.map((line) => {
    const textRange = document.createRange();
    textRange.selectNodeContents(line);
    return textRange.getBoundingClientRect().width;
  });
  const tooltipRect = element.getBoundingClientRect();
  return {
    tooltipWidth: tooltipRect.width,
    widestTextLine: Math.max(...lineWidths),
    textAlign: getComputedStyle(element).textAlign,
    whiteSpace: getComputedStyle(element).whiteSpace,
  };
});

// Browserbanen: tekstmål og Poppers placering måles forskelligt af motorerne. Det gælder især
// en tooltip, hvis smalle boks skal følge dens faktiske tekstlinjer.
test.describe('fælles tooltip-ombrydning', { tag: BROWSER_LANE_TAG }, () => {
  test('fordeler lang tekst ved midterordet og lader boksen følge linjerne', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    // Tooltippen ligger i den relevante svie/smerte-sektion og bliver først vist, når kravet aktiveres.
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();

    const infoIcon = page.getByRole('img', { name: LONG_TOOLTIP_TEXT });
    await infoIcon.hover();

    const tooltip = page.getByRole('tooltip', { name: LONG_TOOLTIP_TEXT });
    await expect(tooltip).toBeVisible();
    const tooltipContent = tooltip.locator('.MuiTooltip-tooltip');
    await expect(tooltipContent).toHaveText(LONG_TOOLTIP_TEXT);
    await expect(tooltipContent.locator('.mineo-tooltip-line')).toHaveText([
      'Juridisk omtvistet, men nyere',
      'retspraksis hælder mod fuld sats',
    ]);

    const measurement = await measureTooltip(tooltipContent);
    expect(measurement).not.toBeNull();
    expect(measurement?.textAlign).toMatch(/^(left|start)$/);
    expect(measurement?.whiteSpace).toBe('normal');
    // 16 px indvendig luft (skaleret med arbejdsfladen) er den eneste plads ud over den længste linje.
    expect(measurement?.tooltipWidth).toBeGreaterThan(measurement?.widestTextLine ?? 0);
    expect(measurement?.tooltipWidth).toBeLessThan((measurement?.widestTextLine ?? 0) + 20);
    expect(runtimeErrors).toEqual([]);
  });

  test('viser TAF-checkboxens korte forklaring i en boks uden tom ekstra bredde', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Beregning' }).click();

    const disabledCheckbox = page.getByLabel(TAF_UNAVAILABLE_TOOLTIP).first();
    await expect(disabledCheckbox).toBeVisible();
    await disabledCheckbox.hover();

    const tooltip = page.getByRole('tooltip', { name: TAF_UNAVAILABLE_TOOLTIP });
    await expect(tooltip).toBeVisible();
    const tooltipContent = tooltip.locator('.MuiTooltip-tooltip');
    await expect(tooltipContent.locator('.mineo-tooltip-line')).toHaveText([TAF_UNAVAILABLE_TOOLTIP]);

    const measurement = await measureTooltip(tooltipContent);
    expect(measurement).not.toBeNull();
    expect(measurement?.tooltipWidth).toBeGreaterThan(measurement?.widestTextLine ?? 0);
    expect(measurement?.tooltipWidth).toBeLessThan((measurement?.widestTextLine ?? 0) + 20);
    expect(runtimeErrors).toEqual([]);
  });

  test('ombryder EAL-fejlen uden en enkeltstående linje på EET-beregningsdatoen', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-01-1999');

    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-01-2024');

    const fieldTooltipAnchor = page.locator('[data-mui-internal-clone-element][aria-label^="EAL-beregningen"]');
    await expect(fieldTooltipAnchor).toHaveAttribute('aria-label', EAL_MISSING_RATES_TOOLTIP);
    const anchorBox = await fieldTooltipAnchor.boundingBox();
    expect(anchorBox).not.toBeNull();
    await page.mouse.move(0, 0);
    await page.mouse.move(
      (anchorBox?.x ?? 0) + (anchorBox?.width ?? 0) / 2,
      (anchorBox?.y ?? 0) + (anchorBox?.height ?? 0) / 2,
    );

    const tooltip = page.getByRole('tooltip', { name: EAL_MISSING_RATES_TOOLTIP });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.mineo-tooltip-line')).toHaveText([
      'EAL-beregningen kan ikke gennemføres,',
      'fordi der mangler reguleringssats for',
      '1999, 2000, 2001, 2002, 2003, 2004.',
    ]);
    expect(runtimeErrors).toEqual([]);
  });
});
