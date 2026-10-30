import { readFile } from 'node:fs/promises';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const CRLF = String.fromCharCode(13, 10);

// Flade 12m: tom-tilstanden siger, hvad tabellen dannes af (BB-380); CSV-filen hedder efter sagen (BB-382) og har
// navne uden linjeskift (BB-381); dagtabellen siger «SH-dag» og «Svie/smerte-dag» (BB-387) og har ingen
// ansættelsesforholdskolonner uden TAF (BB-388).
test.describe('Kontroltabel – brugerblik 12m', () => {
  test('forklarer tom-tilstanden og henter en CSV-fil med sagens navn', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);

    await openPage(page, 'Indstillinger');
    await page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' }).click();

    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12M');

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    const panel = page.locator('[role="tabpanel"]:visible');
    await expect(panel.getByText('Kontroltabellen dannes af sagens perioder.', { exact: false })).toBeVisible();
    await expect(panel.getByText('Kan ikke oprette kontroltabel')).toHaveCount(0);

    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Nej']").check();
    await setVerbatimFieldValueAndSettle(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
    await setVerbatimFieldValueAndSettle(page.locator("input[name='vedroererPeriodeTil']"), '31-01-2024');

    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    await expect(panel.getByText('Sagens første og sidste dato')).toBeVisible();
    await expect(panel.getByText('Tabellen viser (hele måneder)')).toBeVisible();
    await expect(panel.getByText('Kontroltabellen dannes af sagens perioder.', { exact: false })).toHaveCount(0);

    const shHeader = panel.getByText('SH-dag', { exact: true });
    const ssHeader = panel.getByText(/^Svie\/smerte-\s*dag$/);
    await expect(shHeader).toBeVisible();
    await expect(ssHeader).toBeVisible();
    await expect(panel.getByText('TAF-regulering', { exact: true })).toHaveCount(0);
    // Overskriften skal kunne stå i kolonnens 120 px uden at blive skåret over.
    const overflow = await ssHeader.evaluate((element) => {
      const cell = element.closest('th, [role="columnheader"]') ?? element;
      return cell.scrollWidth - cell.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);

    await ssHeader.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('kontroltabel-12m.png'), fullPage: true });

    const downloaded = page.waitForEvent('download');
    await panel.locator('.row--label-right-hover').filter({ hasText: 'Download tabel (CSV-format)' })
      .getByRole('button').click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe('BB-12M - Kontroltabel.csv');
    const csvPath = await download.path();
    const csv = await readFile(csvPath, 'utf-8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header] = csv.slice(1).split(CRLF);
    expect(header).toContain('SH-dag');
    expect(header).toContain('Svie/smerte-dag');
    expect(header).not.toContain('\n');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
