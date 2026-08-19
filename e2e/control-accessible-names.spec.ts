import { expect, login, openPage, test } from './support/mineoTest';

/**
 * Browser-verifikation af, at interaktive kontroller kan identificeres på deres navn.
 *
 * **Hvorfor denne test findes ud over enheds- og arkitekturtestene.** De to øvrige lag beviser hver
 * sin halvdel: typerne og komponenttestene viser, at navnet SÆTTES, og arkitekturreglen viser, at
 * ingen kildefil udelader det. Ingen af dem kan se det, denne test hævder – at navnet faktisk ANKOMMER
 * i browserens accessibility-træ på den rigtige kontrol.
 *
 * Forskellen er reel. Navnet leveres på tre forskellige måder (`aria-labelledby` til en søskende-tekst,
 * `aria-label`, og en `<label htmlFor>`-binding), og hver af dem afhænger af, at `id`-parringen holder
 * gennem MUI's slot-videresendelse. En brudt parring giver stadig grønne enhedstests og en tavs
 * arkitekturregel, men en navnløs kontrol hos brugeren – nøjagtig den tilstand fladerne kom fra.
 *
 * Testen dækker de flader, hvor kontrollerne stod navnløse: sidemenuen, Indstillinger, Om-siden og EET.
 */

test.describe('Tilgængelige navne på interaktive kontroller', () => {
  test('sidemenuens kontroller kan findes på deres navn', async ({ page }) => {
    await login(page);

    // Hamburger-knappen havde hverken tekst, aria-label eller title.
    const menuToggle = page.getByRole('button', { name: 'Fold menuen sammen' });
    await expect(menuToggle).toBeVisible();

    // Navnet beskriver handlingen og skal derfor følge menuens tilstand.
    await menuToggle.click();
    await expect(page.getByRole('button', { name: 'Fold menuen ud' })).toBeVisible();

    // Navigationsknapperne mister deres tekstbarn i kollapset tilstand og skal stadig have navn.
    await expect(page.getByRole('button', { name: 'Stamdata' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Indstillinger' })).toBeVisible();
  });

  test('Om-sidens startside-toggle kan findes og betjenes på sit navn', async ({ page }) => {
    await login(page);

    const toggle = page.getByRole('checkbox', {
      name: 'Gør stamdata-siden til startside fremover',
    });
    await expect(toggle).toBeVisible();

    // Et klik på den synlige tekst skal aktivere kontrollen, som ved et almindeligt afkrydsningsfelt.
    const initial = await toggle.isChecked();
    await page.getByText('Gør stamdata-siden til startside fremover').click();
    await expect(toggle).toBeChecked({ checked: !initial });
  });

  test('Indstillinger-sidens switches kan alle findes på deres synlige tekst', async ({ page }) => {
    await login(page);
    await openPage(page, 'Indstillinger');

    for (const name of [
      'Fuld løn under ferie',
      'Udkast-stempel på nye dokumenter',
      'Bilagsnumre i erstatningsopgørelser',
      'Tillad regulering med overenskomst, der ikke dækker hele perioden',
      'Vis knap til at rapportere fejl og forbedringsønsker på indholdsbokse',
      'Vis kontrolfaner på Erstatningsopgørelse-side',
    ]) {
      await expect(page.getByRole('checkbox', { name })).toBeVisible();
    }

    // Ikon-knappen i «Placering til gemte filer» havde kun en tooltip, som ikke er et navn.
    await expect(page.getByRole('button', { name: 'Vælg mappe' })).toBeVisible();
  });

  test('EET-valgkontrollerne kan findes på deres synlige tekst', async ({ page }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');
    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    // Den fulde tekst bærer et info-ikon; navnet må være teksten uden ikonets tooltip-forklaring.
    await expect(
      page.getByRole('checkbox', {
        name: 'Endelig EET-afgørelse kan gøre tidligere udbetalt midl. EET til endeligt med tilbagevirkende kraft',
      })
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Indregn mer-erstatning ved forhøjet pensionsalder' })
    ).toBeVisible();
  });

  test('Stamdatas tekst-, dato- og dropdownfelter kan findes på deres synlige label', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    await expect(page.getByRole('textbox', { name: 'Journalnr.' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Skadelidtes navn' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Fødselsdato' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Skadestype' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Skadedato' })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
