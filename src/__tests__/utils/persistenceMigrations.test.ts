import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  createPersistenceMigrator,
  migratePersistedSectionValue,
  type PersistenceMigrationRegistry,
} from '../../utils/persistenceMigrations';

describe('migratePersistedSectionValue', () => {
  it('normaliserer null -> undefined dybt før migrator-trinnet (schema-evolution §3.1a)', () => {
    const input = {
      a: null,
      b: { c: null, d: 1 },
      e: [null, { f: null }],
    };

    const { value } = migratePersistedSectionValue('stamdata', input, PERSISTED_DATA_VERSION);

    // Kontrakt-rækkefølge: nullToUndefinedDeep (trin 1) skal være anvendt på input,
    // så en fremtidig sektion-migrator (trin 2) altid ser undefined frem for null.
    expect(value).toEqual({
      a: undefined,
      b: { c: undefined, d: 1 },
      e: [undefined, { f: undefined }],
    });
  });

  it('bevarer ikke-null-værdier uændret', () => {
    const input = { aargang: 2025, navn: 'Test', flag: false, tom: '' };
    const { value } = migratePersistedSectionValue('satser', input, PERSISTED_DATA_VERSION);
    expect(value).toEqual(input);
  });

  it('kører den eksakte sektionsmigration fra kildeversion til current-version', () => {
    const registry = {
      stamdata: {
        '1.0': {
          toVersion: PERSISTED_DATA_VERSION,
          migrate: (value: unknown) => ({ value: { previous: value, current: true } }),
        },
      },
    } satisfies PersistenceMigrationRegistry;

    const migrate = createPersistenceMigrator(registry);
    const result = migrate('stamdata', { journalnr: 'J-1', tidligere: null }, '1.0');

    expect(result.value).toEqual({
      previous: { journalnr: 'J-1', tidligere: undefined },
      current: true,
    });
  });

  it('bevarer historiske EO-felter og ignorerer gamle udviklingsfelter', () => {
    const legacySection = {
      beregnesSvieSmerteGodtgoerelse: 'Nej',
      beregnesTabtArbejdsfortjeneste: 'Nej',
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
      allowReguleringMedUdloebMedMaaneder: 9,
      opsagtFraStilling: 'Ja',
      sfggSygeperioderFoer2015: [{ id: 'sfg-1', fra: '2014-01-01', til: '2014-01-15' }],
      periodeTilBeregningFra: '2024-01-01',
      periodeTilBeregningTil: '2024-12-31',
      midlertidigtEetAfgorelse: 'Ja',
      endeligtEetAfgorelse: 'Nej',
      midlertidigtEetAfgoerelseGrupper: [{ afgoerelsesdato: '2024-01-01', rowIds: ['taf-1'] }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        beregnesUdFra: 'Ferieloven',
        referenceperiodeFra: '2023-01-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 2,
        manuelDagssats: 100,
        manuelBeloebIHenholdTil: 'Aftale',
        manuelFoerstEfterSygeloen: 'Ja',
        satsvalg: 'Faglaert-Koebenhavn',
        alleredeBetaltBeloeb: 50,
      }],
    };

    const { value } = migratePersistedSectionValue('erstatningsopgoerelse', legacySection, '1.0.4');
    expect(value).toEqual({
      kravPaaSvieSmerteGodtgoerelse: 'Nej',
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      tafBeregningsperiodeFra: '2024-01-01',
      tafBeregningsperiodeTil: '2024-12-31',
      midlertidigtEETAfgorelse: 'Ja',
      endeligtEETAfgorelse: 'Nej',
      midlertidigtEETAfgoerelseGrupper: [{ afgoerelsesdato: '2024-01-01', rowIds: ['taf-1'] }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggReferenceperiodeFra: '2023-01-01',
        sfggReferenceperiodeTil: '2023-12-31',
        sfggReferenceperiodeFravaersdageUdenLoen: 2,
        sfggManuelDagssats: 100,
        sfggManuelBeloebIHenholdTil: 'Aftale',
        sfggManuelFoerstEfterSygeloen: 'Ja',
        sfggSatsvalg: 'Faglaert-Koebenhavn',
        sfggAlleredeBetaltBeloeb: 50,
      }],
    });
  });

  it('lader en konflikt mellem gammelt og nyt feltnavn gå til preflight i stedet for at vælge tavst', () => {
    const { value } = migratePersistedSectionValue('erstatningsopgoerelse', {
      beregnesSvieSmerteGodtgoerelse: 'Nej',
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
    }, '1.0.4');

    expect(value).toEqual({
      beregnesSvieSmerteGodtgoerelse: 'Nej',
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
    });
  });

  // Den LEVENDE registrerede migration – ikke en fixture-registry. Slås entryen fra, bliver slottet i
  // stedet et strippet ukendt felt, og preflight ville rapportere en genudledt sats som tabt indtastning.
  describe('et afledt Store Bededag-slot i en ældre .eo tælles ikke som tabt indtastning', () => {
    const employment = (extra: Record<string, unknown> = {}) => ({
      id: 'af-1', pensionPct: 7.5, storeBededagPct: 0.45, ...extra,
    });

    it('fjerner slottet for hver kildeversion, der bar det', () => {
      for (const sourceVersion of ['legacy-unversioned', '3.0', '3.5', '3.10']) {
        const { value } = migratePersistedSectionValue(
          'erstatningsopgoerelse',
          { loenindkomstAnsaettelsesforhold: [employment()] },
          sourceVersion
        );
        const rows = (value as { loenindkomstAnsaettelsesforhold: Record<string, unknown>[] })
          .loenindkomstAnsaettelsesforhold;
        expect(Object.hasOwn(rows[0] ?? {}, 'storeBededagPct'), sourceVersion).toBe(false);
        // Brugerens egne satser må ikke røres af migrationen.
        expect(rows[0]?.pensionPct, sourceVersion).toBe(7.5);
      }
    });

    it('rører intet andet end slottet – også når sektionen har flere ansættelsesforhold', () => {
      const { value } = migratePersistedSectionValue(
        'erstatningsopgoerelse',
        {
          vedroererPeriodeFra: '2024-01-01',
          loenindkomstAnsaettelsesforhold: [employment(), employment({ id: 'af-2', pensionPct: 3 })],
        },
        '3.10'
      );

      expect(value).toEqual({
        vedroererPeriodeFra: '2024-01-01',
        loenindkomstAnsaettelsesforhold: [
          { id: 'af-1', pensionPct: 7.5 },
          { id: 'af-2', pensionPct: 3 },
        ],
      });
    });

    it('er identity for en ukendt kildeversion (§3.1a: intet versions-gæt)', () => {
      const section = { loenindkomstAnsaettelsesforhold: [employment()] };
      const { value } = migratePersistedSectionValue('erstatningsopgoerelse', section, '2.9');
      const rows = (value as { loenindkomstAnsaettelsesforhold: Record<string, unknown>[] })
        .loenindkomstAnsaettelsesforhold;
      // Slottet står stadig – det fjernes senere af strip-trinnet, som rapporterer det.
      expect(Object.hasOwn(rows[0] ?? {}, 'storeBededagPct')).toBe(true);
    });

    it('tåler en sektion, hvor collectionen mangler eller har et forkert element', () => {
      expect(migratePersistedSectionValue('erstatningsopgoerelse', {}, '3.10').value).toEqual({});
      const { value } = migratePersistedSectionValue(
        'erstatningsopgoerelse',
        { loenindkomstAnsaettelsesforhold: ['ikke-et-objekt'] },
        '3.10'
      );
      expect(value).toEqual({ loenindkomstAnsaettelsesforhold: ['ikke-et-objekt'] });
    });
  });

  it('anvender kun migratorer for den konkrete sektion og kildeversion', () => {
    const registry = {
      stamdata: {
        '1.0': {
          toVersion: PERSISTED_DATA_VERSION,
          migrate: () => ({ value: { journalnr: 'migreret' } }),
        },
      },
    } satisfies PersistenceMigrationRegistry;
    const migrate = createPersistenceMigrator(registry);

    expect(migrate('satser', { aargang: 2025 }, '1.0').value).toEqual({ aargang: 2025 });
    expect(migrate('stamdata', { journalnr: 'J-1' }, '2.0').value).toEqual({ journalnr: 'J-1' });
  });
});
