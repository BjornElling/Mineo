import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  createPersistedSectionLoadAdapter,
  adaptPersistedSectionForLoad,
  type MissingPersistedFieldPolicy,
  type PersistedLoadAdapterRegistry,
} from '../../persistence/persistedLoadAdapter';
import type {
  EOAngivetLoenLoenudvikling,
  LoenindkomstAnsaettelsesforhold,
} from '../../schemas/formSchemas';

type HistoricalHolidayPay = 'Almindelig løn' | 'SH-udbetaling' | 'Ingen';

type HistoricalEmploymentFixture = Omit<LoenindkomstAnsaettelsesforhold, 'beregnStoreBededagstillaeg'>;

const historicalEmployment = (
  loenPaaHelligdage: HistoricalHolidayPay
): HistoricalEmploymentFixture => ({
  id: 'af-historisk',
  navnPaaArbejdssted: 'Historisk arbejdssted',
  harOverenskomst: true,
  overenskomstId: 'bygge-anlaeg',
  ansatPaaSkadestidspunktet: true,
  ansaettelsesforholdOphoert: false,
  sidsteArbejdsdag: undefined,
  fritvalgPct: 4,
  shSoPct: 2,
  pensionPct: 7.5,
  tillaegAngivesSom: 'procent',
  loenperiode: 'maaned',
  indtaegtsoplysningerTableData: [],
  fuldLoenUnderFerie: 'Ja',
  harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned',
  anciennitetstillaegSats: undefined,
  feriePct: 12.5,
  loenPaaHelligdage,
  saerligFraDatoRegulering: undefined,
  loenudviklingBeregningsgrundlag: 'Overenskomst',
  loenudviklingStatistikModel: undefined,
  loenudviklingKRLSatstabel: undefined,
  loenudviklingManuelNavn: undefined,
  loenudviklingManuelTableData: [],
  loenudviklingManuelProcentsatsTableData: [],
  offentligLoenType: 'Månedsløn',
  offentligLoenTrin: undefined,
  offentligLoenGruppe: undefined,
  offentligLoenEkstraGrundloen: undefined,
  overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
});

type HistoricalAngivetLoenFixture = Partial<Omit<
  EOAngivetLoenLoenudvikling,
  'loenPaaHelligdage' | 'beregnStoreBededagstillaeg'
>>;

const historicalAngivetLoenWithoutHoliday: HistoricalAngivetLoenFixture = {
  overenskomstId: 'bygge-anlaeg',
  harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegSatsAngivesPer: 'Måned',
  feriePct: 12.5,
  loenudviklingBeregningsgrundlag: 'Overenskomst',
  loenudviklingManuelTableData: [],
  loenudviklingManuelProcentsatsTableData: [],
  overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
};

describe('adaptPersistedSectionForLoad', () => {
  it('normaliserer null -> undefined dybt før migrator-trinnet (schema-evolution §3.1a)', () => {
    const input = {
      a: null,
      b: { c: null, d: 1 },
      e: [null, { f: null }],
    };

    const { value } = adaptPersistedSectionForLoad('stamdata', input, PERSISTED_DATA_VERSION);

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
    const { value } = adaptPersistedSectionForLoad('satser', input, PERSISTED_DATA_VERSION);
    expect(value).toEqual(input);
  });

  it('kører den eksakte sektionsmigration fra kildeversion til current-version', () => {
    const registry = {
      stamdata: {
        '1.0': {
          toVersion: PERSISTED_DATA_VERSION,
          adapt: (value: unknown) => ({ value: { previous: value, current: true } }),
        },
      },
    } satisfies PersistedLoadAdapterRegistry;

    const adapt = createPersistedSectionLoadAdapter({ transitions: registry, missingFieldPolicies: [] });
    const result = adapt('stamdata', { journalnr: 'J-1', tidligere: null }, '1.0');

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

    const { value } = adaptPersistedSectionForLoad('erstatningsopgoerelse', legacySection, '1.0.4');
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
    const { value } = adaptPersistedSectionForLoad('erstatningsopgoerelse', {
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
        const { value } = adaptPersistedSectionForLoad(
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

    it('fjerner slottet og bevarer den tidligere automatiske beslutning – også ved flere ansættelsesforhold', () => {
      const { value } = adaptPersistedSectionForLoad(
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
          { id: 'af-1', pensionPct: 7.5, beregnStoreBededagstillaeg: false },
          { id: 'af-2', pensionPct: 3, beregnStoreBededagstillaeg: false },
        ],
      });
    });

    it('sætter den manglende toggle til true ved historisk almindelig løn på helligdage', () => {
      const { value } = adaptPersistedSectionForLoad(
        'erstatningsopgoerelse',
        { loenindkomstAnsaettelsesforhold: [employment({ loenPaaHelligdage: 'Almindelig løn' })] },
        '3.13'
      );
      const rows = (value as { loenindkomstAnsaettelsesforhold: Record<string, unknown>[] })
        .loenindkomstAnsaettelsesforhold;
      expect(rows[0]?.beregnStoreBededagstillaeg).toBe(true);
    });

    it('migrerer også Angivet månedsløn/dagsløn og bevarer en allerede gemt toggle', () => {
      const { value } = adaptPersistedSectionForLoad(
        'erstatningsopgoerelse',
        {
          eoAngivetLoenLoenudvikling: { loenPaaHelligdage: 'Almindelig løn' },
          loenindkomstAnsaettelsesforhold: [employment({
            loenPaaHelligdage: 'Almindelig løn',
            beregnStoreBededagstillaeg: false,
          })],
        },
        '3.13'
      );
      const migrated = value as {
        eoAngivetLoenLoenudvikling: Record<string, unknown>;
        loenindkomstAnsaettelsesforhold: Record<string, unknown>[];
      };

      expect(migrated.eoAngivetLoenLoenudvikling.beregnStoreBededagstillaeg).toBe(true);
      expect(migrated.loenindkomstAnsaettelsesforhold[0]?.beregnStoreBededagstillaeg).toBe(false);
    });

    it('er identity for en ukendt kildeversion (§3.1a: intet versions-gæt)', () => {
      const section = { loenindkomstAnsaettelsesforhold: [employment()] };
      const { value } = adaptPersistedSectionForLoad('erstatningsopgoerelse', section, '2.9');
      const rows = (value as { loenindkomstAnsaettelsesforhold: Record<string, unknown>[] })
        .loenindkomstAnsaettelsesforhold;
      // Slottet står stadig – det fjernes senere af strip-trinnet, som rapporterer det.
      expect(Object.hasOwn(rows[0] ?? {}, 'storeBededagPct')).toBe(true);
    });

    it('tåler en sektion, hvor collectionen mangler eller har et forkert element', () => {
      expect(adaptPersistedSectionForLoad('erstatningsopgoerelse', {}, '3.10').value).toEqual({});
      const { value } = adaptPersistedSectionForLoad(
        'erstatningsopgoerelse',
        { loenindkomstAnsaettelsesforhold: ['ikke-et-objekt'] },
        '3.10'
      );
      expect(value).toEqual({ loenindkomstAnsaettelsesforhold: ['ikke-et-objekt'] });
    });
  });

  describe('det eksplicitte Store Bededag-valg i realistiske historiske lønfelter', () => {
    const missingToggleCases = [
      { loenPaaHelligdage: 'Almindelig løn', expectedToggle: true },
      { loenPaaHelligdage: 'SH-udbetaling', expectedToggle: false },
      { loenPaaHelligdage: 'Ingen', expectedToggle: false },
    ] as const;

    it.each(missingToggleCases)('migrerer manglende toggle for $loenPaaHelligdage', ({ loenPaaHelligdage, expectedToggle }) => {
      const source = historicalEmployment(loenPaaHelligdage);
      expect(Object.hasOwn(source, 'beregnStoreBededagstillaeg')).toBe(false);

      const { value } = adaptPersistedSectionForLoad(
        'erstatningsopgoerelse',
        { loenindkomstAnsaettelsesforhold: [source] },
        '3.13'
      );
      const row = (value as { loenindkomstAnsaettelsesforhold: Record<string, unknown>[] })
        .loenindkomstAnsaettelsesforhold[0];

      expect(row).toEqual(expect.objectContaining({
        id: 'af-historisk',
        navnPaaArbejdssted: 'Historisk arbejdssted',
        loenPaaHelligdage,
        pensionPct: 7.5,
        beregnStoreBededagstillaeg: expectedToggle,
      }));
      expect(row).not.toHaveProperty('storeBededagPct');
    });

    const existingToggleCases = [
      { loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false },
      { loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true },
      { loenPaaHelligdage: 'SH-udbetaling', beregnStoreBededagstillaeg: false },
      { loenPaaHelligdage: 'SH-udbetaling', beregnStoreBededagstillaeg: true },
      { loenPaaHelligdage: 'Ingen', beregnStoreBededagstillaeg: false },
      { loenPaaHelligdage: 'Ingen', beregnStoreBededagstillaeg: true },
    ] as const;

    it.each(existingToggleCases)('bevarer eksisterende toggle ved $loenPaaHelligdage', ({ loenPaaHelligdage, beregnStoreBededagstillaeg }) => {
      const source = {
        ...historicalEmployment(loenPaaHelligdage),
        beregnStoreBededagstillaeg,
      };
      const { value } = adaptPersistedSectionForLoad(
        'erstatningsopgoerelse',
        { loenindkomstAnsaettelsesforhold: [source] },
        '3.13'
      );
      const row = (value as { loenindkomstAnsaettelsesforhold: Record<string, unknown>[] })
        .loenindkomstAnsaettelsesforhold[0];

      expect(row).toEqual(expect.objectContaining({
        loenPaaHelligdage,
        beregnStoreBededagstillaeg,
      }));
      expect(row).not.toHaveProperty('storeBededagPct');
    });

    it('migrerer ældre angivet løn uden loenPaaHelligdage med passivt togglevalg', () => {
      expect(Object.hasOwn(historicalAngivetLoenWithoutHoliday, 'loenPaaHelligdage')).toBe(false);
      expect(Object.hasOwn(historicalAngivetLoenWithoutHoliday, 'beregnStoreBededagstillaeg')).toBe(false);

      const { value } = adaptPersistedSectionForLoad(
        'erstatningsopgoerelse',
        { eoAngivetLoenLoenudvikling: historicalAngivetLoenWithoutHoliday },
        '3.13'
      );
      const migrated = value as {
        eoAngivetLoenLoenudvikling: Record<string, unknown>;
      };

      expect(migrated.eoAngivetLoenLoenudvikling).toEqual(expect.objectContaining({
        feriePct: 12.5,
        beregnStoreBededagstillaeg: false,
      }));
      expect(migrated.eoAngivetLoenLoenudvikling).not.toHaveProperty('loenPaaHelligdage');
    });
  });

  it('anvender kun migratorer for den konkrete sektion og kildeversion', () => {
    const registry = {
      stamdata: {
        '1.0': {
          toVersion: PERSISTED_DATA_VERSION,
          adapt: () => ({ value: { journalnr: 'migreret' } }),
        },
      },
    } satisfies PersistedLoadAdapterRegistry;
    const adapt = createPersistedSectionLoadAdapter({ transitions: registry, missingFieldPolicies: [] });

    expect(adapt('satser', { aargang: 2025 }, '1.0').value).toEqual({ aargang: 2025 });
    expect(adapt('stamdata', { journalnr: 'J-1' }, '2.0').value).toEqual({ journalnr: 'J-1' });
  });

  it('lader en ny felts politik vælge mellem tavs standardværdi og preflight uden at tælle feltet som filinput', () => {
    const policies = [
      {
        sectionKey: 'stamdata',
        sourceVersions: ['3.11'],
        path: ['tavsStandardværdi'],
        value: () => 'Brugerdefineret standard',
        behavior: 'silentDefault',
      },
      {
        sectionKey: 'stamdata',
        sourceVersions: ['3.11'],
        path: ['preflightStandardværdi'],
        value: () => false,
        behavior: 'preflight',
        preflightReason: 'Feltet blev indført efter den gemte fil.',
      },
    ] as const satisfies readonly MissingPersistedFieldPolicy[];
    const adapt = createPersistedSectionLoadAdapter({ transitions: {}, missingFieldPolicies: policies });

    const result = adapt('stamdata', { journalnr: 'J-1' }, '3.11');

    expect(result.value).toEqual({
      journalnr: 'J-1',
      tavsStandardværdi: 'Brugerdefineret standard',
      preflightStandardværdi: false,
    });
    expect(result.preflightMissingFields).toEqual([{
      path: ['preflightStandardværdi'],
      reason: 'Feltet blev indført efter den gemte fil.',
    }]);
  });
});
