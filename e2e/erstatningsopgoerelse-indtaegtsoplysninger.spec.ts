import type { Locator, Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const setDate = setVerbatimFieldValueAndSettle;

const fillSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12H');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
  const skadestype = page.getByRole('combobox', { name: 'Skadestype' });
  await skadestype.click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '01-06-2018');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), '1');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '01-02-2025');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2024');
  const tafRaekke = page.locator('[data-section-id="taf"] table').first()
    .locator('tbody tr[data-mineo-row-id]').first().locator('input[data-mineo-field-address]');
  await setDate(tafRaekke.nth(0), '01-01-2024');
  await setDate(tafRaekke.nth(1), '31-12-2024');
  await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
  await page.getByRole('option', { name: 'Beregningsperiode', exact: true }).click();
  await setDate(page.locator("input[name='tafBeregningsperiodeFra']"), '01-06-2017');
  await setDate(page.locator("input[name='tafBeregningsperiodeTil']"), '31-05-2018');
};

/** Indtægtstabellens række nr. `index` (0-baseret) – også en tom indtastningsrække. */
const loenRaekke = (page: Page, index: number): Locator =>
  page.locator('table').filter({ hasText: 'ATP og anden' }).first()
    .locator('tbody tr[data-mineo-row-id]').nth(index);

const tastRaekke = async (page: Page, index: number, maaned: string, aar: string, loen: string): Promise<void> => {
  await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(0), maaned);
  await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(1), aar);
  await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(2), loen);
};

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

/** Feltadresserne på de elementer, der begynder at blinke – målt gennem `animationstart`, som brugeren ser det. */
const startBlinkRecording = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const blinks: string[] = [];
    (window as unknown as { __mineoBlinks: string[] }).__mineoBlinks = blinks;
    document.addEventListener('animationstart', (event) => {
      if (event.animationName !== 'mineoFieldAttentionBlink' || !(event.target instanceof HTMLElement)) return;
      const inner = event.target.matches('input')
        ? event.target
        : event.target.querySelector<HTMLElement>('input[data-mineo-field-address]');
      blinks.push((inner ?? event.target).getAttribute('data-mineo-field-address') ?? event.target.className);
    }, true);
  });
};

const recordedBlinks = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __mineoBlinks: string[] }).__mineoBlinks);

// Flade 12h (BB-289–BB-299): indtægtstabellens rækker. Basisbanen er nok – intet her afhænger af motor eller
// viewport.
test.describe('Erstatningsopgørelse – indtægtsoplysninger', () => {
  test('en identisk række får gul ring, og en rød række får sin egen linje, hvis link blinker cellen', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
    await setFieldValueAndSettle(page.locator('input[name$=":feriePct"]'), '12,5');

    await tastRaekke(page, 0, '6', '2017', '30000');
    await tastRaekke(page, 1, '7', '2017', '30000');
    await tastRaekke(page, 2, '6', '2017', '30000');
    await tastRaekke(page, 3, '13', '2017', '30000');

    // BB-289: den gentagne række er gul, ikke rød, og tooltippen beder om et blik.
    const dublettensLoen = loenRaekke(page, 2).locator('input[data-mineo-field-address]').nth(2);
    await expect(dublettensLoen).toHaveAttribute('aria-invalid', 'false');
    await expect(dublettensLoen).toHaveAccessibleDescription(/identisk med en tidligere række/);
    await page.locator('table').filter({ hasText: 'ATP og anden' }).first().screenshot({ path: testInfo.outputPath('indtaegtstabel.png') });

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Lønrækken 06-2017 er identisk med en tidligere række');
    // BB-291: rækken navngives, cellens egen tekst står i linjen, og der er ingen «ikke angivet» om en rød værdi.
    const roedLinje = page.locator('.row--label-right-hover').filter({ hasText: 'Række 4: Måned –' });
    await expect(roedLinje).toBeVisible();
    await expect(errorBox(page)).not.toContainText('Måned er ikke angivet');
    await errorBox(page).screenshot({ path: testInfo.outputPath('fejl-og-advarsler.png') });

    await startBlinkRecording(page);
    await roedLinje.getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    const maanedsCelle = loenRaekke(page, 3).locator('input[data-mineo-field-address]').nth(0);
    const maanedsAdresse = await maanedsCelle.getAttribute('data-mineo-field-address');
    await expect.poll(() => recordedBlinks(page)).toContain(maanedsAdresse);
    // Kun cellen blinker – ikke hele kortet.
    expect((await recordedBlinks(page)).every((adresse) => adresse === maanedsAdresse)).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
