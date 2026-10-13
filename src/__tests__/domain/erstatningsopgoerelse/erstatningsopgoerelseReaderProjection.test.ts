// @vitest-environment jsdom
import {
  buildErstatningsopgoerelseReaderProjection,
  readErstatningsopgoerelseValues,
  readStamdataValues,
} from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { omitDerivedLoenindkomstSatser, projectLoenindkomstSatser } from '../../../domain/erstatningsopgoerelse/loenindkomstSatsProjection';
import { parseInboundPersistedSection } from '../../../utils/inboundPersistedSection';
import {
  selectBlockingLoenindkomstEntityIds,
  topLevelFieldIssue,
} from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../../schemas/formSchemas';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { createSfggIngenRow } from '../../utils/sfggTestSupport';

// Erstatningsopgørelsens reader-projektion (§3.4/§5.4/§1.10): beviser at projektionen
// (a) rekonstruerer det fulde EO-/stamdata-værdiobjekt byte-identisk fra readeren (inkl. det nested løntræ), (b)
// kører den EKSISTERENDE `computeEoSnapshot` UÆNDRET på de reader-læste værdier (§5.4 hårdt stop mod talændring),
// (c) fører røde reader-feltfejl ind i eoErrors/stamdataErrors-mappene (top-level + `${afId}:loenindkomst`), og
// (d) følger Satser-doktrinen: en out-of-bounds værdi skjules af readeren og falder tilbage til sin tomværdi.

const catalog = getProductionInputCatalog();

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const validStamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'Advokat A',
  sagsbehandler: 'Sagsbehandler S',
  skadelidte: 'Test Testesen',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2022-03-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

/** Et komplet, gyldigt EO-fixture med et nested ansættelsesforhold + løntabelrækker og et par top-collections. */
const buildValidEo = (): ErstatningsopgoerelseValues => {
  const base = createErstatningsopgoerelseInitialValues();
  return {
    ...base,
    eoNummer: 'EO-42',
    // Øvrige krav-rækken er kun udfyldt, når tabellen vises; bag «Skjul» læses den som tom (BB-228).
    kravPaaOevrigeErstatningskrav: 'Ja',
    forligAnsvarsgradProcent: 50,
    forligAnsvarsgradBroek: '',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    beregnesUdFra: 'Beregningsperiode',
    tafBeregningsperiodeFra: toISODateString('2022-04-01'),
    tafBeregningsperiodeTil: toISODateString('2022-06-30'),
    // TAF-perioden ligger efter beregningsperioden: et overlap er en rød feltfejl (BB-262) og ville spærre.
    tafPerioder: [
      { id: 'taf-1', fra: toISODateString('2022-07-01'), til: toISODateString('2022-09-30'), loseFeriedage: 2 },
    ],
    oevrigeKravPerioder: [
      { id: 'ok-1', dato: toISODateString('2022-05-01'), udgiftTil: 'Medicin', beloeb: asAmount(1500) },
    ],
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-1',
        navnPaaArbejdssted: 'Arbejdsplads',
        harOverenskomst: true,
        ansatPaaSkadestidspunktet: true,
        feriePct: 12.5,
        loenperiode: 'maaned',
        tillaegAngivesSom: 'procent',
        loenudviklingBeregningsgrundlag: 'Ingen',
        loenPaaHelligdage: 'Almindelig løn',
        // Uden fuld løn under ferie og med løn i beregningsperioden opgøres TAF i arbejdsdage, så TAF-rækkens
        // løse feriedage er relevante og læses tilbage (BB-247).
        fuldLoenUnderFerie: 'Nej',
        indtaegtsoplysningerTableData: [
          {
            id: 'std-1',
            col0_maaned: '5',
            col1_maaned: '2022',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: asAmount(40000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
            fpFvShSoBeloeb: undefined,
            pensionBeloeb: undefined,
          },
        ],
        loenudviklingManuelTableData: [],
        loenudviklingManuelProcentsatsTableData: [],
        overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
      },
    ],
  };
};

const buildReader = (eo: ErstatningsopgoerelseValues | null, stamdata: StamdataValues | null) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

describe('buildErstatningsopgoerelseReaderProjection', () => {
  it('fører offentlig referencesats for pension videre til SFGG fra samme beregningsklare input', () => {
    const initial = buildValidEo();
    const stamdata = { ...validStamdata, skadedato: toISODateString('2024-03-01') };
    const eo: ErstatningsopgoerelseValues = {
      ...initial,
      kravPaaOevrigeErstatningskrav: 'Nej',
      tafBeregningsperiodeFra: toISODateString('2024-04-01'),
      tafBeregningsperiodeTil: toISODateString('2024-06-30'),
      tafPerioder: [{ id: 'taf-public', fra: toISODateString('2024-07-01'), til: toISODateString('2024-07-31') }],
      sfggAnsaettelsesforhold: [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: asAmount(100) }],
      loenindkomstAnsaettelsesforhold: [{
        ...initial.loenindkomstAnsaettelsesforhold[0],
        overenskomstId: 'laerer-overenskomsten',
        pensionPct: undefined,
        indtaegtsoplysningerTableData: [{ ...initial.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0],
          col1_maaned: '2024' }],
      }],
    };
    const projection = buildErstatningsopgoerelseReaderProjection(buildReader(eo, stamdata));
    expect(projection.snapshot.status, JSON.stringify(projection.snapshot.invariants)).toBe('ok');
    expect(projection.eoValues.loenindkomstAnsaettelsesforhold[0].pensionPct).toBeGreaterThan(0);
    const sfgg = projection.snapshot.data?.engines.tafNetto.sygeferiegodtgoerelse;
    expect(sfgg?.totalOre).toBeGreaterThan(0);
    expect(sfgg?.perAnsaettelsesforhold[0]?.segments[0]?.agPensionPct)
      .toBe(projection.eoValues.loenindkomstAnsaettelsesforhold[0].pensionPct);
    const direct = computeEoSnapshot({
      revision: 'direct', eoValues: projection.eoValues, stamdataValues: projection.stamdataValues,
      eoErrors: EMPTY_FIELD_ISSUE_SET, stamdataErrors: EMPTY_FIELD_ISSUE_SET,
    });
    expect(projection.snapshot.data?.engines.tafNetto).toEqual(direct.data?.engines.tafNetto);
  });

  it('bruger samme manuelle basis med fritvalg og pension efter save/load som skærm og dokument', () => {
    // Kun anonymiserede, relevante tal fra regressionen. Basisrækkens tillæg er afledte og findes ikke i filen.
    const stamdata = { ...validStamdata, skadedato: toISODateString('2025-07-11') };
    const initial = buildValidEo();
    const eo: ErstatningsopgoerelseValues = {
      ...initial,
      kravPaaOevrigeErstatningskrav: 'Nej',
      sfggAnsaettelsesforhold: [createSfggIngenRow('af-1')],
      forligAnsvarsgradProcent: undefined,
      tafBeregningsperiodeFra: toISODateString('2024-07-01'),
      tafBeregningsperiodeTil: toISODateString('2025-06-30'),
      vedroererPeriodeFra: toISODateString('2025-07-11'),
      vedroererPeriodeTil: toISODateString('2026-09-20'),
      tafPerioder: [{ id: 'taf-regression', fra: toISODateString('2026-05-25'), til: toISODateString('2026-09-20') }],
      loenindkomstAnsaettelsesforhold: [{
        ...initial.loenindkomstAnsaettelsesforhold[0],
        harOverenskomst: false,
        feriePct: 15,
        fritvalgPct: 7.43,
        pensionPct: 12,
        fuldLoenUnderFerie: 'Ja',
        beregnStoreBededagstillaeg: true,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelNavn: 'Testregulering',
        indtaegtsoplysningerTableData: [{
          ...initial.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0],
          col0_maaned: '6', col1_maaned: '2025', col2: asAmount(33436.04),
        }],
        loenudviklingManuelTableData: [
          { id: 'manual-base', grundloen: asAmount(33436.04) },
          { id: 'manual-rise', dato: toISODateString('2026-03-01'), grundloen: asAmount(34197.61),
            feriepenge: 15, fritvalg: 7.43, agPension: 12, shSoSats: 0 },
        ],
      }],
    };
    const before = buildErstatningsopgoerelseReaderProjection(buildReader(eo, stamdata));
    const saved = JSON.parse(JSON.stringify(omitDerivedLoenindkomstSatser(eo, stamdata)));
    expect(saved.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelTableData[0])
      .toEqual({ id: 'manual-base', grundloen: asAmount(33436.04) });
    const loaded = parseInboundPersistedSection('erstatningsopgoerelse', saved, '1.0.0');
    expect(loaded.ok).toBe(true);
    expect(loaded.unknownPaths).toEqual([]);
    expect(loaded.invalidPaths).toEqual([]);
    expect(loaded.preflightMissingFields).toEqual([]);
    if (!loaded.ok) throw new Error('Regressionens gyldige input kunne ikke genindlæses');
    const after = buildErstatningsopgoerelseReaderProjection(buildReader(loaded.data, stamdata));
    expect(after.snapshot.status, JSON.stringify(after.snapshot.invariants)).toBe('ok');
    const engine = after.snapshot.data?.engines.tafNetto.loenudvikling;
    expect(engine).toBeDefined();
    expect(engine?.beregnedeSegmenter.length).toBeGreaterThan(0);
    expect(engine?.beregnedeSegmenter.every((segment) => segment.deltaPct === 2.28)).toBe(true);
    expect(after.snapshot.data?.engines.tafNetto).toEqual(before.snapshot.data?.engines.tafNetto);
    expect(after.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelTableData[0])
      .toMatchObject({ feriepenge: 15, fritvalg: 7.43, agPension: 12, grundloen: asAmount(33436.04) });
    const direct = computeEoSnapshot({
      revision: 'direct', eoValues: after.eoValues, stamdataValues: after.stamdataValues,
      eoErrors: EMPTY_FIELD_ISSUE_SET, stamdataErrors: EMPTY_FIELD_ISSUE_SET,
    });
    expect(after.snapshot.data?.engines.tafNetto).toEqual(direct.data?.engines.tafNetto);
  });

  it('rekonstruerer EO-værdierne byte-identisk fra readeren (inkl. nested løntræ + collections)', () => {
    const eo = buildValidEo();
    const reader = buildReader(eo, validStamdata);
    const rebuilt = readErstatningsopgoerelseValues(reader);
    // Round-trip: readeren gav præcis de committede canonical værdier tilbage. Fixturet normaliseres gennem samme
    // Zod-schema som commit-grænsen (fx `loenudviklingManuelNavn: ''` → `undefined`), så vi sammenligner mod den
    // canonical committede form, ikke den rå pre-commit-litteral.
    // JSON er den faktiske persistence-/dokumentgrænse; eksplicitte `undefined`-nøgler er semantisk fraværende.
    expect(JSON.parse(JSON.stringify(rebuilt))).toEqual(JSON.parse(JSON.stringify(erstatningsopgoerelseSchema.parse(eo))));
    expect(readStamdataValues(reader)).toEqual(stamdataSchema.parse(validStamdata));
  });

  it('kører computeEoSnapshot byte-identisk på de reader-læste værdier (§5.4)', () => {
    const eo = buildValidEo();
    const reader = buildReader(eo, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'golden' });

    const expected = computeEoSnapshot({
      revision: 'golden',
      stamdataValues: readStamdataValues(reader),
      eoValues: projectLoenindkomstSatser(
        readErstatningsopgoerelseValues(reader),
        readStamdataValues(reader)
      ),
      stamdataErrors: EMPTY_FIELD_ISSUE_SET,
      eoErrors: EMPTY_FIELD_ISSUE_SET,
    });

    // Byte-identitet på ALLE beregnede/serialiserbare værdier (status, invariants, data/totaler/pdfModel, input).
    // `inspektionSnapshot.model` bærer rene view-closures (getCell/getRowKey), som er ny closure-identitet pr. kald
    // og derfor aldrig kan `toEqual`-sammenlignes; JSON-normaliseringen fjerner dem og sammenligner de faktiske tal.
    const serializable = (snapshot: unknown): unknown => JSON.parse(JSON.stringify(snapshot));
    expect(serializable(projection.snapshot)).toEqual(serializable(expected));
    expect(projection.snapshot.status).toBe(expected.status);
    expect(projection.snapshot.data).toEqual(expected.data);
    expect(projection.sourceToken).toBe(reader.sourceToken);
    expect(projection.eoErrors.all).toEqual([]);
    expect(projection.stamdataErrors.all).toEqual([]);
  });

  it('fører en canonical bounds-feltfejl (forlig procent > 100) ind i eoErrors som source input og skjuler værdien', () => {
    const eo = { ...buildValidEo(), forligAnsvarsgradProcent: 150, forligAnsvarsgradBroek: '' };
    const reader = buildReader(eo, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });

    // Satser-doktrin: readeren skjuler den out-of-bounds værdi → rekonstruktionen falder tilbage til tomværdien.
    expect(projection.eoValues.forligAnsvarsgradProcent).toBeUndefined();
    const issue = topLevelFieldIssue(
      projection.eoErrors,
      'erstatningsopgoerelse',
      'forligAnsvarsgradProcent'
    );
    expect(issue?.severity).toBe('error');
    expect(issue?.reason).toBe('bounds');
    // `error-contract.md` §1.1: bounds blokerer IKKE `.eo`-save, men blokerer JA de AFHÆNGIGE consumers.
    // Netop dette felt er beviset for, hvorfor: en maskeret forligsprocent på 150 ville ellers blive regnet
    // som "intet forlig" (= 100 %) og vise et falsk beløb bag den røde markering.
    expect(issue).toBeDefined();
  });

  it('fører et ugyldigt (out-of-bounds) løntabel-cellefelt ind som `${afId}:loenindkomst`-aggregat', () => {
    // offentligLoenTrin=99 er uden for 1..55 → rød reader-feltfejl på en employment-celle → aggregat-fejl.
    const eo = buildValidEo();
    const withCellError: ErstatningsopgoerelseValues = {
      ...eo,
      loenindkomstAnsaettelsesforhold: [
        { ...eo.loenindkomstAnsaettelsesforhold[0], offentligLoenTrin: 99 },
        ...eo.loenindkomstAnsaettelsesforhold.slice(1),
      ],
    };
    const reader = buildReader(withCellError, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    // offentligLoenTrin er en employment-SKALAR (ikke en tabelcelle) → den tæller IKKE i loenindkomst-celleaggregatet.
    // Denne test dokumenterer bevidst afgrænsningen: kun StandardLoen-/manuel-regulerings-CELLER driver aggregatet.
    expect(selectBlockingLoenindkomstEntityIds(projection.eoErrors)['af-1']).toBeUndefined();
  });

  it('fører en ugyldig StandardLoen-tabelcelle ind som `${afId}:loenindkomst`-aggregat (blokerer afhængige)', () => {
    // col0_maaned='13' er uden for 1..12 → rød reader-feltfejl på en StandardLoen-CELLE → aggregat-fejl.
    const eo = buildValidEo();
    const first = eo.loenindkomstAnsaettelsesforhold[0];
    const withCellError: ErstatningsopgoerelseValues = {
      ...eo,
      loenindkomstAnsaettelsesforhold: [
        {
          ...first,
          indtaegtsoplysningerTableData: [
            { ...first.indtaegtsoplysningerTableData[0], col0_maaned: '13' },
          ],
        },
        ...eo.loenindkomstAnsaettelsesforhold.slice(1),
      ],
    };
    const reader = buildReader(withCellError, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });
    expect(selectBlockingLoenindkomstEntityIds(projection.eoErrors)['af-1']).toBe(true);
    const nestedIssue = projection.eoErrors.all.find((candidate) =>
      candidate.field.address.path.some((segment) =>
        segment.kind === 'entity' && segment.entityId === 'af-1'
      )
    );
    expect(nestedIssue?.reason).toBe('bounds');
  });

  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)(
    'fører dato lig basisdatoen til celle, lønaggregat og autoritativ gate for %s',
    (basis) => {
      const eo = buildValidEo();
      const first = eo.loenindkomstAnsaettelsesforhold[0];
      const invalidEmployment = {
        ...first,
        loenudviklingBeregningsgrundlag: basis,
        loenudviklingManuelTableData: [
          { id: 'base', dato: undefined, grundloen: asAmount(40_000), feriepenge: 12.5, shSoSats: 0, fritvalg: 0, agPension: 0 },
          { id: 'lig', dato: eo.tafBeregningsperiodeTil, grundloen: asAmount(41_000), feriepenge: 12.5, shSoSats: 0, fritvalg: 0, agPension: 0 },
        ],
        loenudviklingManuelProcentsatsTableData: [
          { id: 'base', dato: undefined, procent: 0 },
          { id: 'lig', dato: eo.tafBeregningsperiodeTil, procent: 2.5 },
        ],
      };
      const reader = buildReader({
        ...eo,
        loenindkomstAnsaettelsesforhold: [invalidEmployment],
      }, validStamdata);

      const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'manual-date' });

      expect(projection.manualRegulationDateIssues.all).toHaveLength(1);
      expect(projection.manualRegulationDateIssues.all[0]?.message).toBe(
        'Datoen skal være senere end datoen i den låste første række (30-06-2022)'
      );
      expect(selectBlockingLoenindkomstEntityIds(projection.eoErrors)['af-1']).toBe(true);
      expect(projection.snapshot.status).toBe('error');
      expect(projection.snapshot.data).toBeNull();
    }
  );

  it('projekterer manglende basisdato til det aktive angivne lønfelt', () => {
    const eo = buildValidEo();
    const withMissingBasisdato: ErstatningsopgoerelseValues = {
      ...eo,
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmount(1000),
      eoAngivetLoenLoenudvikling: {
        ...eo.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: 'kl-overenskomst',
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: 26,
        offentligLoenGruppe: 1,
      },
    };
    const projection = buildErstatningsopgoerelseReaderProjection(
      buildReader(withMissingBasisdato, { ...validStamdata, skadedato: undefined }),
      { revision: 'missing-loenregulering-basisdato' }
    );

    const issue = topLevelFieldIssue(
      projection.eoErrors,
      'erstatningsopgoerelse',
      'angivetDagsloenOpreguleresFraDato'
    );
    expect(issue?.reason).toBe('rule');
    expect(issue?.message).toBe(
      'Datoen for den angivne dagsløn skal udfyldes, når skadedatoen ikke er udfyldt'
    );
    expect(projection.snapshot.status).toBe('error');
    expect(projection.snapshot.failClosedReason).toBeUndefined();
  });

  it('er tolerant over for en null EO-sektion (tom sag)', () => {
    const reader = buildReader(null, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'empty' });
    expect(projection.eoValues.loenindkomstAnsaettelsesforhold).toEqual([]);
    expect(projection.snapshot.revision).toBe('empty');
  });

  it('projekterer svie/smerte-ménafgørelses-cutoff til de konkrete datofelter og den rette beregningsgren', () => {
    const eo = buildValidEo();
    const withSvieSmerteCutoff: ErstatningsopgoerelseValues = {
      ...eo,
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Nej',
      varigeMenAfgorelse: 'Ja',
      verserendeKlageMen: 'Nej',
      menAfgoerelseDato: toISODateString('2022-09-16'),
      vedroererPeriodeFra: toISODateString('2022-04-01'),
      vedroererPeriodeTil: toISODateString('2022-12-31'),
      svieSmerteSatserAar: 2022,
      svieSmerteDelvisSygemeldingSats: 'fuld',
      svieSmerteHelbredsstatus: 'Sygemeldt',
      svieSmertePerioder: [{
        id: 'ss-1',
        fra: toISODateString('2022-09-17'),
        til: toISODateString('2022-10-01'),
        tilstand: 'sygemeldt',
      }],
    };
    const reader = buildReader(withSvieSmerteCutoff, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'svie-cutoff' });

    expect(projection.svieSmerteCellIssues.all.map((issue) => issue.field.address.field).sort()).toEqual(['fra', 'til']);
    expect(projection.svieSmerteCellIssues.all[0]?.message).toBe(
      'Der er angivet svie/smerte efter datoen for en ménafgørelse (16-09-2022)'
    );
    expect(projection.eoErrors.all).toEqual(expect.arrayContaining([...projection.svieSmerteCellIssues.all]));
    expect(projection.snapshot.blockedDependencies?.svieSmerte).toBe(true);
    expect(projection.snapshot.status).toBe('error');
  });
});
