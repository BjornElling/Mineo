import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';
import type { Page } from '@playwright/test';

/**
 * Forsørgertabets to halvdele skal tælle de allerede udbetalte måneder PÅ SAMME MÅDE.
 *
 * Den dagbaserede optjeningstælling er den rigtige (bevidst valg), og begge halvdele bruger den. To
 * mulige læsninger giver ellers to forskellige tal for de samme udbetalinger:
 *
 * - dag for dag (tabellen «Løbende ydelse») giver ca. 60,7323 måneder,
 * - hele kalendermåneder inklusive begge ender giver 62 måneder og dermed «Resterende periode 4 år
 *   og 10 måneder» i stedet for 4 år og 11.
 *
 * Specen måler en sag, hvor de to læsninger giver hver sit resultat – forskellen er 9.360 kr. i
 * kapitalbeløbet.
 *
 * Tallene er BEREGNINGSRESULTATER og skal kun ændres, hvis tællemetoden ændres bevidst igen.
 */

const SKADEDATO = '10-06-2020';
const SKADELIDTES_FOEDSELSDATO = '15-03-1975';
const EFTERLADTES_FOEDSELSDATO = '20-08-1978';
const BEREGNINGSDATO = '01-07-2025';
const VIRKNINGSDATO = '10-06-2020';

const row = (page: Page, label: string) =>
  page.locator('.row--label-right-hover').filter({ hasText: label });

/**
 * Indtaster hele den målte sag – stamdata først, fordi fladens grænser og den efterladtes alder
 * hviler på den. Felterne adresseres ved deres `name`, ikke ved etiketten: etiketterne kan
 * ændres, mens `name` er stabil.
 */
const fillMaaltSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadelidteFodselsdato"]'),
    SKADELIDTES_FOEDSELSDATO,
  );
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), SKADEDATO);

  await openPage(page, 'Forsørgertab');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="efterladteFodselsdato"]'),
    EFTERLADTES_FOEDSELSDATO,
  );
  await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), BEREGNINGSDATO);
  await setVerbatimFieldValueAndSettle(page.locator('input[name="virkningsdato"]'), VIRKNINGSDATO);
  await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');
  await setFieldValueAndSettle(page.locator('input[name="tilkendtForPeriodeAar"]'), '10');
};

test.describe('Forsørgertabets resterende periode', () => {
  test('tæller de udbetalte måneder dagbaseret i BEGGE halvdele af opgørelsen', async ({ page, runtimeErrors }) => {
    await login(page);
    await fillMaaltSag(page);

    // Halvdel 1 – tabellen: summen af de seks delperioder er ca. 60,7323 måneder. Den sidste række er
    // brøkmåneden, der gjorde de to læsninger uenige: 1.-31. juli findes ikke, kun 1. juli.
    const sidsteTabelraekke = page.locator('tbody tr').last();
    await expect(sidsteTabelraekke).toContainText('6,03226');

    // Halvdel 2 – kapitalfaktorens opslagsnøgle. 120 - 60,7323 = ca. 59,2677 måneder, som afkortet til
    // hele år og måneder er 4 år og 11 måneder. Den gamle kalendertælling gav 4 år og 10 måneder.
    const resterende = row(page, 'Resterende periode (hele år og måneder)');
    await expect(resterende).toHaveCount(1);
    await expect(resterende).toContainText('4 år og 11 måneder');
    await expect(resterende).not.toContainText('4 år og 10 måneder');

    // Og de to tal, omlægningen faktisk flytter. Kapitalbeløbet trækkes FRA kravet, så en længere
    // resterende periode giver en MINDRE forsørgertabserstatning: 429.026 kr. mod 421.731 kr. og
    // dermed 82.742 kr. mod 90.036 kr. Assertionerne står her, fordi beløbene er det eneste,
    // brugeren og modparten læser.
    //
    // Rækken adresseres på sin EGEN etiket (`getByText(..., { exact: true })`), ikke på `hasText`:
    // ordet «Forsørgertabserstatning» går igen i EAL-halvdelens forklarende prosa, så et
    // delstrengsfilter rammer to rækker og fejler på strict mode.
    const resultatRow = (label: string) =>
      page.locator('.row--label-right-hover').filter({
        has: page.getByText(label, { exact: true }),
      });

    await expect(resultatRow('Kapitalbeløb (efter ASL)')).toContainText('429.026 kr.');
    // 82.742 kr.: månedsbrøken afrundes ikke, før de løbende ydelser summeres.
    await expect(resultatRow('Forsørgertabserstatning')).toContainText('82.742 kr.');

    expect(runtimeErrors).toEqual([]);
  });
});
