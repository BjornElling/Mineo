import { type Locator } from '@playwright/test';
import { expect, login, openPage, test } from './support/mineoTest';

import { BROWSER_LANE_TAG } from './support/lanes';

const LONG_TOOLTIP_TEXT = 'Juridisk omtvistet, men nyere retspraksis hælder mod fuld sats';
const TAF_UNAVAILABLE_TOOLTIP = 'Der er ingen TAF-perioder i EO-perioden';

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
});
