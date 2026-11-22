import type { Page } from '@playwright/test';

import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';

// BB-434/BB-437: kortenes flydende knapper flytter sig, når de virker. Andet klik i et dobbeltklik ramte derfor en
// anden knap («Tilføj» → nabokortets «Flyt op») eller et andet kort (C's «Flyt op» → A's «Flyt op»). Andet klik
// i samme dobbeltklik er nu tavst. Basisbanen er nok: `MouseEvent.detail` er fælles for motorerne.
//
// Dobbeltklikket er selve adfærden under test, ikke en genvej til at redigere et felt. Det udløses derfor som
// `click({ clickCount: 2 })` – to klik på samme punkt med `detail` 1 og 2, præcis som et menneskeligt dobbeltklik.

const navne = (page: Page): Promise<string[]> =>
  page.locator('input[name$=":navnPaaArbejdssted"]').evaluateAll((inputs) =>
    inputs.map((input) => (input instanceof HTMLInputElement ? input.value : '')));

const tilfoejKort = async (page: Page, navn: string): Promise<void> => {
  const antal = await page.locator('input[name$=":navnPaaArbejdssted"]').count();
  await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
  const felter = page.locator('input[name$=":navnPaaArbejdssted"]');
  await expect(felter).toHaveCount(antal + 1);
  await setFieldValueAndSettle(felter.last(), navn);
};

const aabnLoenindkomst = async (page: Page): Promise<void> => {
  await login(page);
  await openPage(page, 'Erstatningsopgørelse');
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
  await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
};

test.describe('Lønindkomst – dobbeltklik på kortenes flydende knapper', () => {
  test('dobbeltklik på «Tilføj» tilføjer ét kort og flytter ikke et eksisterende (BB-434)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await aabnLoenindkomst(page);
    await tilfoejKort(page, 'A');
    await tilfoejKort(page, 'B');

    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click({ clickCount: 2 });

    await expect(page.locator('input[name$=":navnPaaArbejdssted"]')).toHaveCount(3);
    await expect.poll(() => navne(page)).toEqual(['A', 'B', '']);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('dobbeltklik på det sidste korts «Flyt op» flytter kun det kort én plads (BB-437)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await aabnLoenindkomst(page);
    await tilfoejKort(page, 'B');
    await tilfoejKort(page, 'A');
    await tilfoejKort(page, 'C');

    await page.getByRole('button', { name: 'Flyt ansættelsesforhold op', exact: true }).last().click({ clickCount: 2 });

    await expect.poll(() => navne(page)).toEqual(['B', 'C', 'A']);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
