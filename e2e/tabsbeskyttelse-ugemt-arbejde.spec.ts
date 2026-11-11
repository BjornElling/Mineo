import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, login, openPage, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

// Brugerblik M-46/M-47: beskyttelsen mod tab skal have samme levetid som det synlige arbejde.
// BB-395: «ugemt» overlever F5. BB-396: åben, ændret tekst beskyttes ved exit. BB-397: Hent spørger før den
// eneste åbne indtastning erstattes.

/** Forsøger at forlade siden og returnerer, om browseren spurgte. Dialogen afvises, så siden bliver. */
const leaveAttemptIsGuarded = async (page: Page): Promise<boolean> => {
  const dialogSeen = page.waitForEvent('dialog', { timeout: 3_000 }).then(async (dialog) => {
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    return true;
  }).catch(() => false);
  const navigation = page.goto('about:blank', { waitUntil: 'commit' }).catch((error: unknown) => {
    // En afvist beforeunload-dialog annullerer navigationen og rapporteres som ERR_ABORTED.
    expect(String(error)).toContain('net::ERR_ABORTED');
  });
  const guarded = await dialogSeen;
  await navigation;
  return guarded;
};

const pickFileForHent = async (page: Page, content: string): Promise<void> => {
  await page.evaluate(async (fileContent) => {
    // Kun operativsystemets picker-resultat erstattes; indlæsningen kører som i produktet.
    const directory = await navigator.storage.getDirectory();
    const handle = await directory.getFileHandle('tabsbeskyttelse.eo', { create: true });
    const writable = await handle.createWritable();
    await writable.write(fileContent);
    await writable.close();
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: async () => [handle] });
  }, content);
};

test.describe('Beskyttelse mod tab af ugemt arbejde', () => {
  test('BB-395: en ugemt sag advarer stadig efter genindlæsning', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    const journal = page.getByRole('textbox', { name: 'Journalnr.' });
    await setVerbatimFieldValueAndSettle(journal, 'UGEMT EFTER F5');

    page.once('dialog', (dialog) => { void dialog.accept(); });
    await page.reload();
    await expect(journal).toHaveValue('UGEMT EFTER F5');

    // Et klik sikrer browserens krav om brugeraktivering; Escape lukker feltet uden ændring.
    await journal.click();
    await journal.press('Escape');
    expect(await leaveAttemptIsGuarded(page)).toBe(true);
    await expect(journal).toHaveValue('UGEMT EFTER F5');
    expect(runtimeErrors).toEqual([]);
  });

  test('BB-396: en ændret, endnu ikke afsluttet indtastning advarer ved exit', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    const journal = page.getByRole('textbox', { name: 'Journalnr.' });
    await journal.click();
    await journal.pressSequentially('IKKE AFSLUTTET JOURNAL');

    expect(await leaveAttemptIsGuarded(page)).toBe(true);
    await expect(journal).toHaveValue('IKKE AFSLUTTET JOURNAL');
    expect(runtimeErrors).toEqual([]);
  });

  test('BB-397: Hent spørger, før den eneste åbne indtastning erstattes', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    const journal = page.getByRole('textbox', { name: 'Journalnr.' });
    await pickFileForHent(page, readFileSync('src/__tests__/fixtures/persistence/legacy-unversioned-cross-section.eo', 'utf8'));
    await journal.click();
    await journal.pressSequentially('KUN ÅBEN TEKST');

    await page.getByRole('button', { name: 'Hent', exact: true }).click();
    const overwrite = page.getByRole('dialog').filter({ hasText: 'Erstat de aktuelle indtastninger?' });
    await expect(overwrite).toBeVisible();
    await overwrite.getByRole('button', { name: 'Annuller', exact: true }).click();
    await expect(overwrite).toBeHidden();
    await expect(journal).toHaveValue('KUN ÅBEN TEKST');
    expect(runtimeErrors).toEqual([]);
  });
});
