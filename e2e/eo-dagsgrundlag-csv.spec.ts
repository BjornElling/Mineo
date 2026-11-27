import { readFile } from 'node:fs/promises';
import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { createActiveTabStorageKey } from '../src/config/storageManifest';
import { LOCAL_STORAGE_KEY } from '../src/settings/appSettingsStorage';
import { createErstatningsopgoerelseInitialValues } from '../src/domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString as iso } from '../src/types/branded';
import { encryptToString } from '../src/utils/encryption';
import { withSfggIngenForEmployments } from '../src/__tests__/utils/sfggTestSupport';
import { expect, login, openPage, test } from './support/mineoTest';

test.describe('Beregning – dagsgrundlag som CSV', () => {
  for (const partial of [false, true]) {
    test(partial ? 'henter gyldigt TAF-grundlag ved fejl i svie/smerte' : 'henter afstemt dagsgrundlag med TAF-afskæring', async ({
      page, runtimeErrors, runtimeSignals, externalRequests,
    }, testInfo) => {
      await page.addInitScript(({ tabKey, settingsKey }) => {
        Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
        sessionStorage.setItem(tabKey, 'kontroltabel');
        localStorage.setItem(settingsKey, JSON.stringify({ showEOInspektionMenu: true }));
      }, { tabKey: createActiveTabStorageKey('erstatningsopgoerelse'), settingsKey: LOCAL_STORAGE_KEY });
      const initial = createErstatningsopgoerelseInitialValues();
      const eoValues = withSfggIngenForEmployments({
        ...initial,
        eoNummer: '1',
        opgørelseLavetDen: iso('2024-12-31'),
        kravPaaSvieSmerteGodtgoerelse: partial ? 'Ja' as const : 'Nej' as const,
        svieSmerteSatserAar: partial ? 2024 : undefined,
        svieSmertePerioder: partial ? [{ id: 'ss-1', fra: iso('2024-01-02'), tilstand: 'sygemeldt' as const }] : [],
        offentligeYdelserRows: [{
          id: 'dagpenge-1', ydelsestype: 'dagpenge', fraDato: iso('2024-01-02'), tilDato: iso('2024-01-04'),
          ydelse: { kind: 'number' as const, value: 100 },
        }],
        kravPaaOevrigeErstatningskrav: 'Nej' as const,
        kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
        tafArbejdsstatus: 'Uarbejdsdygtig' as const,
        beregnesUdFra: 'Angivet dagsløn' as const,
        dagsloenenUdgoer: { kind: 'number' as const, value: 1_000 },
        eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' as const },
        vedroererPeriodeFra: iso('2024-01-01'),
        vedroererPeriodeTil: iso('2024-01-31'),
        tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-14'), loseFeriedage: 0 }],
        midlertidigtEETAfgorelse: 'Ja' as const,
        midlertidigEETAfgoerelseDato: iso('2024-01-15'),
        midlertidigEETVirkningsdato: iso('2024-01-15'),
        verserendeKlageEet: 'Nej' as const,
      });
      const fixture = {
        ...caseFixture,
        data: {
          ...caseFixture.data,
          stamdata: { ...caseFixture.data.stamdata, journalnr: 'EET-2010-FIKTIV', skadedato: '2010-03-01' },
          erstatningsopgoerelse: eoValues,
        },
      };

      await login(page);
      await openPage(page, 'Indstillinger');
      await expect(page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' })).toHaveCount(0);
      await openPage(page, 'Stamdata');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Hent', exact: true }).click();
      await (await chooser).setFiles({
        name: 'fiktiv-eet-2010.eo', mimeType: 'application/octet-stream',
        buffer: Buffer.from(await encryptToString(fixture)),
      });
      await expect(page.locator('input[name="journalnr"]')).toHaveValue('EET-2010-FIKTIV');

      await openPage(page, 'Erstatningsopgørelse');
      await expect(page.getByRole('tab', { name: 'EO oplysninger' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('button', { name: 'Kontroltabel' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'EO-kontrol' })).toHaveCount(0);
      await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
      await expect(page.getByText('Dagsgrundlag (CSV) – tabt arbejdsfortjeneste', { exact: true })).toBeVisible();
      if (partial) {
        await expect(page.getByText('Fejl og advarsler', { exact: true })).toBeVisible();
        await expect(page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' }).getByRole('button')).toBeDisabled();
      }
      const button = page.getByRole('button', { name: 'Download dagsgrundlag som CSV-udtræk' });
      await button.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('dagsgrundlag.png') });
      const downloaded = page.waitForEvent('download');
      await button.click();
      const file = await downloaded;
      expect(file.suggestedFilename()).toBe('EET-2010-FIKTIV - Dagsgrundlag.csv');
      const csv = await readFile(await file.path(), 'utf-8');
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const [header, ...days] = csv.slice(1).split('\r\n').map((line) => line.split(';'));
      const dagpenge = header.indexOf('Dagpenge');
      const tafDay = header.indexOf('TAF-dag');
      const ssDay = header.indexOf('Svie/smerte-dag');
      expect(header).toContain('SH-dag');
      expect(days.filter((row) => row[dagpenge] === '33,33').map((row) => row[1])).toEqual([
        '02-01-2024', '03-01-2024', '04-01-2024',
      ]);
      expect(days.find((row) => row[0] === 'Afrunding')?.[dagpenge]).toBe('0,01');
      expect(days.find((row) => row[1] === '15-01-2024')?.[tafDay]).toBe('Midlertidigt EET');
      if (partial) expect(days.find((row) => row[1] === '02-01-2024')?.[ssDay]).toBe('');

      expect(runtimeErrors).toEqual([]);
      expect(runtimeSignals).toEqual([]);
      expect(externalRequests).toEqual([]);
    });
  }
});
