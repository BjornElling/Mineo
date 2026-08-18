import { type Locator } from '@playwright/test';
import { expect, test } from './support/mineoTest';

/**
 * Tegn- og længdeværnet må ikke afhænge af, HVORDAN tegnet kom ind i feltet
 * (`input-field-behavior-contract.md` §1.2).
 *
 * **Fejlen testen er skrevet efter (brugerfund, mobil).** Værnet var udelukkende et `keydown`-filter:
 * `filterDateLikeKeyDown` beregnede den kommende draft ud fra `e.key` og kaldte `preventDefault()`. Det
 * forudsætter en tast med et brugbart `key` — og et mobilt skærmtastatur leverer ikke det. Det skriver
 * tegnet direkte i `<input>` og fyrer et `input`-event; den `keydown`, der eventuelt følger, bærer
 * `key === 'Unidentified'`, som filteret med vilje lader passere for ikke at forstyrre IME/composition.
 * Hele værnet var derfor fraværende på mobil, og `21-1111111-2026` kunne stå i et datofelt, selv om
 * desktop afviste præcis samme form.
 *
 * Rettelsen flyttede værnet til `onDraftChange` — den ene kanal, ENHVER modalitet passerer — med
 * feltfamiliernes prædikater i `src/components/inputs/draftAdmission.ts` som fælles kilde for både
 * draft-værnet og det afledte keydown-filter.
 *
 * **Testen kører bevidst i de ordinære desktop-projekter.** Det, der skal måles, er ikke en viewport
 * eller en enhed, men en INDTASTNINGSMODALITET: at et tegn, som når `<input>` uden en brugbar `keydown`,
 * afvises på lige fod med et tastet tegn. `typeLikeMobileKeyboard` fremstiller netop den modalitet, og
 * den er lige gyldig i enhver browser. Kører den her, dækkes fejlen af den suite, der faktisk køres.
 */
const typeLikeMobileKeyboard = async (input: Locator, text: string): Promise<void> => {
  for (const char of text) {
    await input.evaluate((element, value) => {
      const el = element as HTMLInputElement;
      // Den native value-setter omgår Reacts egen property-descriptor, så `input`-eventet ser den nye
      // tekst — præcis som når browseren selv skriver tegnet efter et tryk på skærmtastaturet.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const next = el.value.slice(0, start) + value + el.value.slice(end);
      setter?.call(el, next);
      el.setSelectionRange(start + value.length, start + value.length);
      // BEVIDST ingen `keydown`: det er hele fejlformen, testen dækker.
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, char);
  }
};

const openEditor = async (input: Locator): Promise<void> => {
  await input.click();
  await expect(input).toBeFocused();
  await input.click();
  await expect(input).toBeEditable();
};

/** Lukker editoren og venter, til feltet FAKTISK er lukket, før det åbnes igen. */
const reopenEditor = async (input: Locator): Promise<void> => {
  await input.press('Escape');
  await expect(input).toHaveAttribute('readonly', '');
  await openEditor(input);
};

test.describe('indtastning uden brugbar keydown (skærmtastatur)', () => {
  test('dato- og talfelter håndhæver tegn- og længdegrænser på både formular og grid', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/minprocesrente.html');
    const formDate = page.locator('input[name="beregningsdato"]');
    await expect(formDate).toBeVisible();

    // 1. Brugerfundet: gentagne specialtegn mellem dag, måned og år. Kun den FØRSTE separator i hver
    //    stribe åbner et nyt segment; resten afvises (§2.1).
    await openEditor(formDate);
    await typeLikeMobileKeyboard(formDate, '21--------11--------2026');
    await expect(formDate).toHaveValue('21-11-2026');

    // 2. Blandede separatortegn følger samme regel — separatorsættet er ethvert ikke-alfanumerisk tegn.
    await reopenEditor(formDate);
    await typeLikeMobileKeyboard(formDate, '5.,/@3...8');
    await expect(formDate).toHaveValue('5.3.8');

    // 3. Segmenternes ciffergrænser (2-2-4) håndhæves også uden keydown: et tredje dag-ciffer kommer
    //    aldrig ind, så resten af strengen har intet segment at lande i.
    await reopenEditor(formDate);
    await typeLikeMobileKeyboard(formDate, '123456789');
    await expect(formDate).toHaveValue('12');

    // 4. Bogstaver kommer aldrig ind i et datofelt.
    await reopenEditor(formDate);
    await typeLikeMobileKeyboard(formDate, '1a2b-3c4d-2e0f2g6');
    await expect(formDate).toHaveValue('12-34-2026');

    // 5. Draften committer korrekt bagefter. Værnet må ikke have efterladt DOM og motor uenige om
    //    indholdet — ellers ville feltet vise ét og gemme noget andet.
    await formDate.press('Enter');
    await expect(formDate).toHaveValue('12-34-2026');
    await expect(formDate).toHaveAttribute('aria-invalid', 'true');

    // 6. Grid-cellerne går gennem `useGridCellSurface`, ikke formular-surfacen, og skal have samme værn.
    const cellDate = page.locator('input[data-mineo-field-address*="renterFra"]').first();
    await expect(cellDate).toBeVisible();
    await openEditor(cellDate);
    await typeLikeMobileKeyboard(cellDate, '21--------11--------2026');
    await expect(cellDate).toHaveValue('21-11-2026');

    // Kun én editor må være åben ad gangen (§3.5) — luk datocellen, før beløbscellen åbnes.
    await cellDate.press('Escape');
    await expect(cellDate).toHaveAttribute('readonly', '');

    // 7. Beløbscellen: bogstaver og punktum som decimaltegn hører ikke til tegnsættet (§2.2).
    const cellAmount = page.locator('input[data-mineo-field-address*="belob"]').first();
    await expect(cellAmount).toBeVisible();
    await openEditor(cellAmount);
    await typeLikeMobileKeyboard(cellAmount, '12a34.56b7');
    await expect(cellAmount).toHaveValue('1234567');

    expect(pageErrors).toEqual([]);
  });
});
