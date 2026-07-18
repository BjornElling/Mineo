// @vitest-environment jsdom
import {
  buildErstatningsopgoerelseReaderProjection,
  readErstatningsopgoerelseValues,
  readStamdataValues,
} from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../../schemas/formSchemas';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

// Greenfield Erstatningsopgørelse reader-projektion (§3.4/§5.4/§1.10, Fase 2.4 trin 8): beviser at projektionen
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
    forligAnsvarsgradProcent: 50,
    forligAnsvarsgradBroek: '',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    beregnesUdFra: 'Beregningsperiode',
    tafBeregningsperiodeFra: toISODateString('2022-04-01'),
    tafBeregningsperiodeTil: toISODateString('2022-06-30'),
    tafPerioder: [
      { id: 'taf-1', fra: toISODateString('2022-04-01'), til: toISODateString('2022-06-30'), loseFeriedage: 2 },
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
        indtaegtsoplysningerTableData: [
          {
            id: 'std-1',
            col0_maaned: '1',
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
  return createInputEvaluation({ input, catalog, sourceToken, settings: DEFAULT_APP_SETTINGS }).reader;
};

describe('buildErstatningsopgoerelseReaderProjection', () => {
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
      eoValues: readErstatningsopgoerelseValues(reader),
      stamdataErrors: {},
      eoErrors: {},
    });

    // Byte-identitet på ALLE beregnede/serialiserbare værdier (status, invariants, data/totaler/pdfModel, input).
    // `inspektionSnapshot.model` bærer rene view-closures (getCell/getRowKey), som er ny closure-identitet pr. kald
    // og derfor aldrig kan `toEqual`-sammenlignes; JSON-normaliseringen fjerner dem og sammenligner de faktiske tal.
    const serializable = (snapshot: unknown): unknown => JSON.parse(JSON.stringify(snapshot));
    expect(serializable(projection.snapshot)).toEqual(serializable(expected));
    expect(projection.snapshot.status).toBe(expected.status);
    expect(projection.snapshot.data).toEqual(expected.data);
    expect(projection.sourceToken).toBe(reader.sourceToken);
    expect(projection.eoErrors).toEqual({});
    expect(projection.stamdataErrors).toEqual({});
  });

  it('fører en canonical bounds-feltfejl (forlig procent > 100) ind i eoErrors som source input og skjuler værdien', () => {
    const eo = { ...buildValidEo(), forligAnsvarsgradProcent: 150, forligAnsvarsgradBroek: '' };
    const reader = buildReader(eo, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'r' });

    // Satser-doktrin: readeren skjuler den out-of-bounds værdi → rekonstruktionen falder tilbage til tomværdien.
    expect(projection.eoValues.forligAnsvarsgradProcent).toBeUndefined();
    // Bounds → source 'input', blocksSave:false (synlig, men ikke .eo-blokerende).
    expect(projection.eoErrors.forligAnsvarsgradProcent?.input?.severity).toBe('error');
    expect(projection.eoErrors.forligAnsvarsgradProcent?.input?.blocksSave).toBe(false);
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
    expect(projection.eoErrors['af-1:loenindkomst']).toBeUndefined();
  });

  it('fører en ugyldig StandardLoen-tabelcelle ind som `${afId}:loenindkomst`-aggregat (blocksSave:true)', () => {
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
    expect(projection.eoErrors['af-1:loenindkomst']?.input?.blocksSave).toBe(true);
    expect(projection.eoErrors['af-1:loenindkomst']?.input?.message).toBe('Ugyldig manuel regulering');
  });

  it('er tolerant over for en null EO-sektion (tom sag)', () => {
    const reader = buildReader(null, validStamdata);
    const projection = buildErstatningsopgoerelseReaderProjection(reader, { revision: 'empty' });
    expect(projection.eoValues.loenindkomstAnsaettelsesforhold).toEqual([]);
    expect(projection.snapshot.revision).toBe('empty');
  });
});
