import { type Locator, type Page } from '@playwright/test';
import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';

// Autofill-suggest i browseren (`input-field-behavior-contract.md` §1.5, `keyboard-navigation.md`
// §Enter, undtagelse 4).
//
// Basisbanen: adfærden er Mineos egen – ghostens synlighed, Enter-accept og fokusbevarelsen afhænger
// ikke af browsermotoren. Det, der IKKE kan måles i JSDOM, er kæden hele vejen igennem: at ghosten
// faktisk står i den rigtige celle på en rigtig side, at Enter-accepten går gennem grid-navigationens
// capture-fase uden også at flytte fokus, og at et NYT Enter derefter navigerer videre til den næste
// række, hvor det næste forslag så står klar.

const ydelserRows = (page: Page): Locator =>
  page
    .locator('table', { has: page.getByRole('columnheader', { name: 'Ydelsestype' }) })
    .locator('tbody tr[data-mineo-row-id]');

const cell = (page: Page, rowIndex: number, label: string): Locator =>
  ydelserRows(page).nth(rowIndex).getByLabel(label, { exact: true });

test.describe('Autofill-suggest i ydelsestabellen', () => {
  test('foreslår næste periode, indsætter den med Enter og beholder fokus i cellen', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Offentlige ydelser' }).click();
    await expect(page.getByRole('tab', { name: 'Offentlige ydelser' })).toHaveAttribute('aria-selected', 'true');

    // To måneder er nok til et mønster. Til-datoerne er begge månedens SIDSTE dag, så mønstret er
    // «sidste dag i næste måned» og ikke en dagsafstand.
    await setFieldValueAndSettle(cell(page, 0, 'Fra dato'), '01-01-2026');
    await setFieldValueAndSettle(cell(page, 0, 'Til dato'), '31-01-2026');
    await setFieldValueAndSettle(cell(page, 1, 'Fra dato'), '01-02-2026');
    await setFieldValueAndSettle(cell(page, 1, 'Til dato'), '28-02-2026');

    const fraDato = cell(page, 2, 'Fra dato');
    await expect(fraDato).toHaveAttribute('placeholder', 'dd-mm-åååå');

    // Ghosten opstår ved fokus – og kun der.
    await fraDato.click();
    await expect(fraDato).toBeFocused();
    await expect(fraDato).toHaveAttribute('placeholder', '01-03-2026');
    await expect(fraDato).toHaveValue('');
    await expect(page.getByText('Forslag: 01-03-2026. Tryk Enter for at indsætte.')).toBeAttached();

    // Enter indsætter præcis den viste tekst og bliver i cellen.
    await fraDato.press('Enter');
    await expect(fraDato).toHaveValue('01-03-2026');
    await expect(fraDato).toBeFocused();

    // Til-datoen i samme række fortsætter sidste-dag-mønstret til 31-03.
    const tilDato = cell(page, 2, 'Til dato');
    await tilDato.click();
    await expect(tilDato).toHaveAttribute('placeholder', '31-03-2026');

    // Et NYT Enter navigerer videre som sædvanligt – til den nye tomme række, hvor næste forslag står klar.
    const nextFraDato = cell(page, 3, 'Fra dato');
    await fraDato.click();
    await expect(fraDato).toBeFocused();
    await fraDato.press('Enter');
    await expect(nextFraDato).toBeFocused();
    await expect(nextFraDato).toHaveAttribute('placeholder', '01-04-2026');

    expect(runtimeErrors).toEqual([]);
  });
});
