import { expect, login, openPage, setFieldValue, setFieldValueAndSettle, test } from './support/mineoTest';

// Shellens tre browser-afhængige forhold.
//
// De ligger i e2e og ikke i jsdom, fordi de hver især kræver noget, jsdom ikke har:
//
//  - **Fortrydelse i et åbent felt** frigiver BROWSERENS egen tekstfortrydelse i et åbent felt. jsdom har ingen
//    tekstfortrydelse, så den eneste måde at se virkningen er en rigtig browser.
//  - **Overlayets Ctrl+Z** er dækket af mutationstestede jsdom-værn, men netop tastatur-ejerskab er det, kontrakten
//    kræver målt i en rigtig browser (`keyboard-navigation.md`: tab-fangst kan jsdom ikke se). Den
//    fulde brugerrejse – felt, dialog, tastetryk – hører derfor også her.
//  - **404-siden** er en side, der først findes efter login og kun på desktop. Rejsen dertil kan kun gås
//    igennem gaten.

test.describe('Shellens genveje og 404-siden', () => {
  test('overlayet ejer Ctrl+Z, så sagen bag dialogen ikke ændrer sig', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Renteberegning');

    const date = page.locator("input[name='beregningsdato']");
    const deleteAll = page.getByRole('button', { name: 'Slet alle indtastninger' });
    await setFieldValueAndSettle(date, '01-01-2026');
    await expect(date).toHaveValue('01-01-2026');

    // Åbn bekræftelsen. Nu ejer overlayet tastaturet.
    await deleteAll.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Control+z');

    // Dialogen står uændret, OG feltet bagved er urørt – feltet må ikke ryddes bag en dialog, der
    // står og spørger om noget andet.
    await expect(dialog).toBeVisible();
    await expect(date).toHaveValue('01-01-2026');

    // Modprøven: uden overlay virker genvejen. Ellers kunne en død genvej bestå prøven ovenfor.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.keyboard.press('Control+z');
    await expect(date).toHaveValue('');

    expect(runtimeErrors).toEqual([]);
  });

  test('browserens egen fortrydelse virker i et åbent felt', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Renteberegning');

    const date = page.locator("input[name='beregningsdato']");

    // Feltet er ÅBENT for redigering (setFieldValue afslutter ikke), og teksten er ikke settlet.
    await setFieldValue(date, '02-02-2026');
    await expect(date).toHaveValue('02-02-2026');

    await page.keyboard.press('Control+z');

    // Programmets egen fortrydelse er bevidst uvirksom her – den har præcis én funktion, at føre den
    // seneste AFSLUTTEDE feltændring tilbage. Men tasten SPÆRRES ikke, så browseren kan bruge den
    // til det, den bruges til i ethvert andet tekstfelt: at fortryde tegnene i feltet. Ellers står
    // brugeren med en tast, der ikke gør noget.
    await expect(date).not.toHaveValue('02-02-2026');

    expect(runtimeErrors).toEqual([]);
  });

  test('404-siden beholder sidemenuen og oplyser, at sagen er uændret', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    // Skriv noget i sagen, så påstanden «din sag er uændret» kan efterprøves og ikke blot læses.
    const journalnr = page.locator("input[name='journalnr']");
    await setFieldValueAndSettle(journalnr, 'SAG-4711');

    await page.goto('/stamdaat');

    await expect(page.getByText('Siden findes ikke')).toBeVisible();
    await expect(page.getByText(/Din sag er uændret/)).toBeVisible();

    // Sidemenuen ER vejen videre – den skal stå der, og den skal virke.
    await expect(page.getByRole('button', { name: 'Om', exact: true })).toBeVisible();
    await openPage(page, 'Stamdata');

    // Og sagen var faktisk uændret, som siden lovede. En 404 må ikke koste brugeren sit arbejde.
    await expect(page.locator("input[name='journalnr']")).toHaveValue('SAG-4711');

    expect(runtimeErrors).toEqual([]);
  });

  test('en ukendt adresse kommer ikke ind bag login', async ({ page }) => {
    // Brugerens betingelse for at acceptere en dedikeret 404-side. Rutetræet ligger inde i den gatede
    // `App`, så catch-all'en rammer login-siden præcis som en kendt adresse gør.
    //
    // Login-flaget ligger i localStorage (ikke i en cookie), så det er DEN, der skal være tom. Konteksten
    // er frisk pr. test, men prøven rydder eksplicit for at være uafhængig af rækkefølgen: står flaget
    // fra en tidligere test i samme kontekst, ville prøven ellers kunne bestå af den forkerte grund.
    await page.goto('/');
    await page.evaluate(() => { window.localStorage.clear(); });

    await page.goto('/stamdaat');

    await expect(page.getByLabel('Adgangskode')).toBeVisible();
    await expect(page.getByText('Siden findes ikke')).toBeHidden();
  });
});
