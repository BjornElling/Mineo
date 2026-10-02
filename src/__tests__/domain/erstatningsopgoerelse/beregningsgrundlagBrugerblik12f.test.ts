// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { getNavigationTargetFromRowId } from '../../../domain/eoRowEvaluation/eoRowNavigationMap';
import { selectEoSafetyNetInvariants } from '../../../domain/erstatningsopgoerelse/eoSafetyNetInvariants';
import { renderTafBeregningsgrundlag } from '../../../document/generators/eo/sections/tafBeregningsgrundlagSection';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoDagsloenenUdgoerField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoMaanedsloenenUdgoerField,
  eoOevrigeFravaersdageField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoTafPeriodeFraField,
  eoUspecificeredeFerieFridageField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { eoAngivetLoenFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { getToday } from '../../../config/dateRanges';
import { toISODateString } from '../../../types/branded';
import { getDayAfterIso } from '../../../utils/isoDateHelpers';
import type { EoInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

// Brugerblik 12f (beregningsgrundlaget for TAF), udviklerafgørelser 2026-10-02. Testene går gennem den rigtige
// reader, så felternes issues, «Fejl og advarsler» og blokeringen læser samme tilstand som skærmen.

const catalog = getProductionInputCatalog();
const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'T',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2018-06-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

/** Tolv lønrækker à 30.000 kr. (juni 2017 – maj 2018), som fundets sag. */
const loenRaekker = (fra = { maaned: 6, aar: 2017 }, antal = 12) => Array.from({ length: antal }, (_, index) => {
  const maaned0 = fra.maaned - 1 + index;
  return {
    id: `l${index}`,
    col0_maaned: String((maaned0 % 12) + 1),
    col1_maaned: String(fra.aar + Math.floor(maaned0 / 12)),
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: amount(30000),
    col3: undefined,
    col4: undefined,
    col5: undefined,
  };
});

/** «Fuld løn under ferie»: Ja giver måneder, Nej giver arbejdsdage. */
const ansaettelse = (fuldLoenUnderFerie: 'Ja' | 'Nej', patch: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]> = {}) => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  navnPaaArbejdssted: 'Arbejdsplads',
  feriePct: 12.5,
  loenperiode: 'maaned' as const,
  loenPaaHelligdage: 'Almindelig løn' as const,
  fuldLoenUnderFerie,
  loenudviklingBeregningsgrundlag: 'Ingen' as const,
  indtaegtsoplysningerTableData: loenRaekker(),
  ...patch,
});

const sag = (patch: Partial<ErstatningsopgoerelseValues>, enhed: 'Ja' | 'Nej' = 'Ja'): ErstatningsopgoerelseValues => withSfggIngenForEmployments({
  ...createErstatningsopgoerelseInitialValues(),
  tafArbejdsstatus: 'Uarbejdsdygtig',
  eoNummer: '1',
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  kravPaaOevrigeErstatningskrav: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-12-31'),
  opgørelseLavetDen: iso('2025-02-01'),
  tafPerioder: [{ id: 't1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: iso('2017-06-01'),
  tafBeregningsperiodeTil: iso('2018-05-31'),
  loenindkomstAnsaettelsesforhold: [ansaettelse(enhed)],
  ...patch,
  eoAngivetLoenLoenudvikling: {
    ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'Ingen',
    ...patch.eoAngivetLoenLoenudvikling,
  },
});

const project = (eo: ErstatningsopgoerelseValues, stamdataPatch: Partial<StamdataValues> = {}) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: { ...stamdata, ...stamdataPatch }, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
  const rows = collectAllEoRows(
    projection.stamdataValues,
    projection.stamdataErrors,
    projection.eoValues,
    projection.eoErrors,
    {},
    undefined,
    projection.snapshot.data?.canonicalOutput,
    projection.snapshot.data?.pdfModel,
  );
  const linjer = (list: typeof rows.errors) => list.map((row) => row.summaryText ?? row.message ?? row.displayValue);
  return { projection, evaluation, rows, errorLinjer: linjer(rows.errors), warningLinjer: linjer(rows.warnings) };
};

/** Feltets aktive issue, som skærmen viser det: descriptorens eget eller det projekterede. */
const issueOf = <T,>(result: ReturnType<typeof project>, field: FieldRef<T>) => {
  const key = serializeFieldAddress(field.address);
  return result.evaluation.issues.get(key) ?? result.projection.tafCellIssues.get(key);
};

const ferie = (id: string, fra: string, til: string) => ({ id, fra: iso(fra), til: iso(til) });

describe('BB-258 – en lovlig indtastning må aldrig nå en intern undtagelse', () => {
  it('300 fraværsdage i 12 måneder: rød ring med grænsen 249, ingen intern fejl', () => {
    const result = project(sag({ oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 300, oevrigeFravaersdageBeskrivelse: 'Barsel' }));

    expect(issueOf(result, eoOevrigeFravaersdageField.bind())?.message)
      .toBe('Fraværet overstiger beregningsperioden (højst 249 fraværsdage)');
    expect(result.projection.snapshot.status).not.toBe('fail_closed');
    expect(result.errorLinjer).toContain('Antal fraværsdage: Fraværet overstiger beregningsperioden (højst 249 fraværsdage)');
  });

  it('249 fraværsdage er lovligt og beregner', () => {
    const result = project(sag({ oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 249, oevrigeFravaersdageBeskrivelse: 'Barsel' }));

    expect(issueOf(result, eoOevrigeFravaersdageField.bind())).toBeUndefined();
    expect(result.projection.snapshot.status).toBe('ok');
  });

  it('251 løse dage i en periode med 251 arbejdsdage: rød ring med grænsen 250', () => {
    const result = project(sag({ uspecificeredeFerieFridage: 251 }, 'Nej'));

    expect(issueOf(result, eoUspecificeredeFerieFridageField.bind())?.message)
      .toBe('Der skal være mindst én arbejdsdag tilbage i beregningsperioden (højst 250 løse ferie-/feriefridage)');
    expect(result.projection.snapshot.status).not.toBe('fail_closed');
  });

  it('løse dage og fravær, der tilsammen æder perioden, markerer begge med hver sin grænse', () => {
    const result = project(sag({
      uspecificeredeFerieFridage: 200, oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 60, oevrigeFravaersdageBeskrivelse: 'Orlov',
    }, 'Nej'));

    expect(issueOf(result, eoUspecificeredeFerieFridageField.bind())?.message)
      .toBe('Der skal være mindst én arbejdsdag tilbage i beregningsperioden (højst 190 løse ferie-/feriefridage)');
    expect(issueOf(result, eoOevrigeFravaersdageField.bind())?.message)
      .toBe('Der skal være mindst én arbejdsdag tilbage i beregningsperioden (højst 50 fraværsdage)');
  });

  it('markerer kun det fradrag, der selv er for stort', () => {
    const result = project(sag({
      uspecificeredeFerieFridage: 10, oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 300, oevrigeFravaersdageBeskrivelse: 'Orlov',
    }, 'Nej'));

    expect(issueOf(result, eoUspecificeredeFerieFridageField.bind())).toBeUndefined();
    expect(issueOf(result, eoOevrigeFravaersdageField.bind())?.message)
      .toBe('Der skal være mindst én arbejdsdag tilbage i beregningsperioden (højst 240 fraværsdage)');
  });

  it('ferie over hele perioden farver ferien', () => {
    const result = project(sag({ fravaerPerioder: [ferie('f1', '2017-06-01', '2018-05-31')] }, 'Nej'));

    expect(issueOf(result, eoFravaerPeriodeFraField.bind('f1'))?.message).toBe('Ferien dækker alle arbejdsdage i beregningsperioden');
    expect(result.projection.snapshot.status).not.toBe('fail_closed');
  });

  it.each([
    ['Månedslønnen udgør', 'Angivet månedsløn' as const, eoMaanedsloenenUdgoerField, { maanedsloenenUdgoer: amount(0) }, 'Månedslønnen skal være større end 0 kr.'],
    ['Dagslønnen udgør', 'Angivet dagsløn' as const, eoDagsloenenUdgoerField, { dagsloenenUdgoer: amount(0) }, 'Dagslønnen skal være større end 0 kr.'],
  ])('%s 0 kr. får rød ring (udviklerafgørelse a)', (_label, beregnesUdFra, field, patch, message) => {
    const result = project(sag({ beregnesUdFra, ...patch }));

    expect(issueOf(result, field.bind())?.message).toBe(message);
    expect(result.projection.snapshot.status).not.toBe('fail_closed');
  });

  it('en periode uden indtægt med en lønudvikling at regulere standser før motoren', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse('Ja', {
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
        indtaegtsoplysningerTableData: loenRaekker().map((row) => ({ ...row, col2: amount(0) })),
      })],
    }));

    expect(result.projection.snapshot.status).not.toBe('fail_closed');
    expect(result.errorLinjer.some((linje) => linje.startsWith('Ingen indkomst i beregningsperioden'))).toBe(true);
  });
});

describe('BB-259 – næsten intet tilbage giver en gul advarsel', () => {
  it('250 løse dage efterlader 1 af 251 arbejdsdage', () => {
    const result = project(sag({ uspecificeredeFerieFridage: 250 }, 'Nej'));

    expect(issueOf(result, eoUspecificeredeFerieFridageField.bind())).toBeUndefined();
    expect(result.warningLinjer).toContain('Fradragene efterlader kun 1 af 251 arbejdsdage i beregningsperioden');
    expect(result.errorLinjer).toEqual([]);
  });

  it('240 fraværsdage efterlader 0,48 af 12 måneder', () => {
    const result = project(sag({ oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 240, oevrigeFravaersdageBeskrivelse: 'Barsel' }));

    expect(result.warningLinjer).toContain('Fraværet efterlader kun 0,48 af 12 måneder i beregningsperioden');
  });

  it('advarer ikke, når mindst en fjerdedel er tilbage', () => {
    const result = project(sag({ uspecificeredeFerieFridage: 25 }, 'Nej'));

    expect(result.warningLinjer.some((linje) => linje.startsWith('Fradragene efterlader'))).toBe(false);
  });
});

describe('BB-260 – helt tomme huller i lønoplysningerne', () => {
  it('advarer gult om en periode uden både løn og offentlige ydelser og linker til Lønindkomst', () => {
    const result = project(sag({ tafBeregningsperiodeFra: iso('2016-06-01') }));
    const row = result.rows.warnings.find((warning) => warning.id === 'loenindkomst.af-1.indkomstHuller');

    expect(row?.message).toBe('Der er hverken angivet løn eller offentlige ydelser for 01-06-2016 - 31-05-2017 i beregningsperioden');
    expect(row?.navigation).toMatchObject({ tabId: 'loenindkomst' });
  });

  it('advarer ikke, når hullet er dækket af en offentlig ydelse som dagpenge', () => {
    const result = project(sag({
      tafBeregningsperiodeFra: iso('2016-06-01'),
      offentligeYdelserRows: [{
        id: 'y1', fraDato: iso('2016-06-01'), tilDato: iso('2017-05-31'),
        ydelse: amount(100000), tillaeg: undefined, ydelsestype: 'dagpenge',
      }],
    }));

    expect(result.rows.warnings.some((warning) => warning.id.endsWith('.indkomstHuller'))).toBe(false);
  });
});

describe('BB-261 – datoen for det angivne beløb kan ikke ligge efter dags dato', () => {
  it('giver rød ring dagen efter dags dato', () => {
    const imorgen = getDayAfterIso(getToday());
    const result = project(sag({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: amount(30000),
      angivetMaanedsloenOpreguleresFraDato: imorgen,
    }));

    expect(issueOf(result, eoAngivetMaanedsloenOpreguleresFraDatoField.bind())?.reason).toBe('bounds');
  });
});

describe('BB-262 – overlap mellem beregningsperioden og en TAF-periode', () => {
  it('farver begge sider, navngiver modparten og linker til beregningsperiodens fra-dato', () => {
    const result = project(sag({
      tafBeregningsperiodeFra: iso('2017-07-01'),
      tafBeregningsperiodeTil: iso('2018-06-30'),
      tafPerioder: [{ id: 't1', fra: iso('2018-06-01'), til: iso('2018-06-30'), loseFeriedage: undefined }],
      vedroererPeriodeFra: iso('2018-06-01'),
    }));

    expect(issueOf(result, eoTafBeregningsperiodeFraField.bind())?.message).toBe('Perioden overlapper TAF-perioden 01-06-2018 - 30-06-2018');
    expect(issueOf(result, eoTafBeregningsperiodeTilField.bind())?.message).toBe('Perioden overlapper TAF-perioden 01-06-2018 - 30-06-2018');
    expect(issueOf(result, eoTafPeriodeFraField.bind('t1'))?.message).toBe('Perioden overlapper beregningsperioden 01-07-2017 - 30-06-2018');
    const row = result.rows.errors.find((error) => error.id === 'taf.beregningsgrundlag.beregningsperiode');
    expect(row?.message).toBe('Der er overlap mellem beregningsperioden (01-07-2017 - 30-06-2018) og en TAF-periode (01-06-2018 - 30-06-2018)');
    expect(row?.focusTarget).toEqual({ kind: 'fieldAddress', address: eoTafBeregningsperiodeFraField.bind().address });
    // Overlappet siges én gang – ikke også én gang pr. dato i samme linje.
    expect(result.errorLinjer.filter((linje) => linje.includes('overlap'))).toHaveLength(1);
  });
});

describe('BB-263 – ferie og løse dage i måneder', () => {
  it('er skjulte i måneder: ingen issues, ingen linjer, ingen spærring', () => {
    const result = project(sag({
      fravaerPerioder: [ferie('f1', '2016-07-01', '2016-07-14'), ferie('f2', '2017-07-03', '2017-07-21'), ferie('f3', '2017-07-10', '2017-07-28')],
      uspecificeredeFerieFridage: 300,
    }));

    expect(result.evaluation.reader.read(eoUspecificeredeFerieFridageField.bind())).toEqual({ status: 'usable', value: undefined });
    expect(issueOf(result, eoFravaerPeriodeFraField.bind('f1'))).toBeUndefined();
    expect(result.errorLinjer).toEqual([]);
    expect(result.projection.snapshot.status).toBe('ok');
  });

  it('kommer tilbage, når enheden bliver arbejdsdage', () => {
    const result = project(sag({ uspecificeredeFerieFridage: 5 }, 'Nej'));

    expect(result.evaluation.reader.read(eoUspecificeredeFerieFridageField.bind())).toEqual({ status: 'usable', value: 5 });
  });
});

describe('BB-264 – ferie i beregningsperioden farver cellen', () => {
  it('en ferie før perioden: rød celle og én linje med rækkens navn', () => {
    const result = project(sag({ fravaerPerioder: [ferie('f1', '2016-07-01', '2016-07-14')] }, 'Nej'));

    expect(issueOf(result, eoFravaerPeriodeFraField.bind('f1'))?.message).toBe('Ferien ligger før beregningsperioden (01-06-2017)');
    expect(issueOf(result, eoFravaerPeriodeTilField.bind('f1'))?.message).toBe('Ferien ligger før beregningsperioden (01-06-2017)');
    expect(result.errorLinjer).toEqual(['Ferieperioden 01-07-2016 - 14-07-2016: Ferien ligger før beregningsperioden (01-06-2017)']);
  });

  it('overlappende ferie: røde celler og én linje for tabellen', () => {
    const result = project(sag({
      fravaerPerioder: [ferie('f1', '2017-07-03', '2017-07-21'), ferie('f2', '2017-07-10', '2017-07-28')],
    }, 'Nej'));

    expect(issueOf(result, eoFravaerPeriodeFraField.bind('f1'))?.message).toBe('Perioden overlapper perioden 10-07-2017 - 28-07-2017');
    expect(new Set(result.errorLinjer)).toEqual(new Set(['Der er overlappende ferieperioder i beregningsperioden']));
  });

  it('en omvendt ferierække har rækkens navn, også når TAF-afsnittet har en anden fejl', () => {
    const result = project(sag({
      fravaerPerioder: [ferie('f1', '2017-07-21', '2017-07-03')],
      ferieperioder: [{ id: 'tf1', fra: iso('2024-07-01'), til: undefined }],
    }, 'Nej'));

    expect(result.errorLinjer.some((linje) => linje.startsWith('Ferieperioden 21-07-2017 - 03-07-2017:'))).toBe(true);
  });

  it('400 løse dage giver én linje – feltets eget loft', () => {
    const result = project(sag({ uspecificeredeFerieFridage: 400 }, 'Nej'));

    expect(issueOf(result, eoUspecificeredeFerieFridageField.bind())?.message).toBe('Antal dage skal være mellem 0 og 366');
    expect(result.errorLinjer).toEqual(['Løse ferie-/feriefridage: Antal dage skal være mellem 0 og 366']);
  });

  it('dato-orden i ferien i arbejdsdage er rød på begge celler', () => {
    const result = project(sag({ fravaerPerioder: [ferie('f1', '2017-07-21', '2017-07-03')] }, 'Nej'));

    expect(issueOf(result, eoFravaerPeriodeFraField.bind('f1'))?.reason).toBe('rule');
    expect(issueOf(result, eoFravaerPeriodeTilField.bind('f1'))?.reason).toBe('rule');
  });
});

describe('BB-265 – sikkerhedsnettet', () => {
  const invariant = (id: string, path: string, message: string): EoInvariant => ({
    id, passed: false, severity: 'error', source: 'validation', message, evidence: [path],
    blocksAuthoritativeComputation: true, blocksOutputs: [],
  });
  const row = (patch: Partial<Parameters<typeof selectEoSafetyNetInvariants>[0]['displayedRows'][number]>) => ({
    label: 'L', displayValue: 'Fejl (x)', message: 'x', summaryText: 'x',
    focusTarget: { kind: 'rowId' as const, rowId: 'r' }, ...patch,
  });

  it('viser en feltregel, ingen række dækker, også når boksen har andre fejl', () => {
    const regel = invariant('validation:regulerOffentligeYdelser', 'regulerOffentligeYdelser', 'Mangler sats for 2024');

    expect(selectEoSafetyNetInvariants({
      authoritativeBlockingInvariants: [regel],
      displayedRows: [row({})],
      hasOtherErrorContent: true,
    })).toEqual([regel]);
  });

  it('gentager ikke en regel, en række peger på eller allerede siger', () => {
    const dato = invariant('validation:tafBeregningsperiodeFra', 'tafBeregningsperiodeFra', 'Der mangler indtastninger i perioden til beregning af før-løn');
    const ingen = invariant('validation:tafBeregningsperiodeTil', 'tafBeregningsperiodeTil', 'Ingen indkomst i beregningsperioden');

    expect(selectEoSafetyNetInvariants({
      authoritativeBlockingInvariants: [dato, ingen],
      displayedRows: [
        row({ focusTarget: { kind: 'fieldAddress', address: eoTafBeregningsperiodeFraField.bind().address } }),
        row({ message: 'Ingen indkomst i beregningsperioden (01-06-2017 - 31-05-2018)' }),
      ],
      hasOtherErrorContent: true,
    })).toEqual([]);
  });

  it('viser ikke rækkeformede regler eller røde felter oven i andre fejl', () => {
    expect(selectEoSafetyNetInvariants({
      authoritativeBlockingInvariants: [
        invariant('taf_perioder:overlap:tafPerioder[0].fra', 'tafPerioder[0].fra', 'Der er overlappende TAF-perioder'),
        invariant('reader_field:eo.tafPerioder.fra#t1', 'eo.tafPerioder.fra', 'Fejl'),
      ],
      displayedRows: [row({})],
      hasOtherErrorContent: true,
    })).toEqual([]);
  });
});

describe('BB-266 – en skjult værdi i en fravalgt gren spærrer ikke', () => {
  it('400 fraværsdage bag et slukket «Øvrigt fravær uden løn»', () => {
    const result = project(sag({ oevrigtFravaerUdenLoen: 'Nej', oevrigeFravaersdage: 400 }));

    expect(issueOf(result, eoOevrigeFravaersdageField.bind())).toBeUndefined();
    expect(result.errorLinjer).toEqual([]);
    expect(result.projection.snapshot.status).toBe('ok');
  });

  it('999 løse dage bag «Angivet månedsløn»', () => {
    const result = project(sag({ uspecificeredeFerieFridage: 999, beregnesUdFra: 'Angivet månedsløn', maanedsloenenUdgoer: amount(30000) }, 'Nej'));

    expect(issueOf(result, eoUspecificeredeFerieFridageField.bind())).toBeUndefined();
    expect(result.errorLinjer).toEqual([]);
  });
});

describe('BB-267 – Store Bededag ved angivet dagsløn', () => {
  it('advarer ikke om et fravalgt tillæg ved angivet dagsløn', () => {
    const base = sag({ beregnesUdFra: 'Angivet dagsløn', dagsloenenUdgoer: amount(1500) });
    const result = project({
      ...base,
      eoAngivetLoenLoenudvikling: { ...base.eoAngivetLoenLoenudvikling, loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false },
    });

    expect(result.rows.warnings.some((warning) => warning.id.endsWith('storeBededagstillaegFravalgt'))).toBe(false);
  });

  it('regner aldrig tillægget ved angivet dagsløn – heller ikke med en gemt, tilvalgt knap', () => {
    const base = sag({ beregnesUdFra: 'Angivet dagsløn', dagsloenenUdgoer: amount(1500) });
    const result = project({
      ...base,
      eoAngivetLoenLoenudvikling: { ...base.eoAngivetLoenLoenudvikling, loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: true },
    });

    expect(result.evaluation.reader.read(eoAngivetLoenFields.beregnStoreBededagstillaeg.bind()))
      .toEqual({ status: 'usable', value: false });
    expect(result.projection.eoValues.eoAngivetLoenLoenudvikling.beregnStoreBededagstillaeg).toBe(false);
  });

  it('advarer fortsat ved angivet månedsløn', () => {
    const base = sag({ beregnesUdFra: 'Angivet månedsløn', maanedsloenenUdgoer: amount(30000) });
    const result = project({
      ...base,
      eoAngivetLoenLoenudvikling: { ...base.eoAngivetLoenLoenudvikling, loenPaaHelligdage: 'Almindelig løn', beregnStoreBededagstillaeg: false },
    });

    expect(result.rows.warnings.some((warning) => warning.id.endsWith('storeBededagstillaegFravalgt'))).toBe(true);
  });
});

describe('BB-268 – en lønform, der ligner den anden', () => {
  it.each([
    ['Angivet dagsløn' as const, { dagsloenenUdgoer: amount(10001) }, 'Dagslønnen er usædvanlig høj – er det en månedsløn?'],
    ['Angivet månedsløn' as const, { maanedsloenenUdgoer: amount(2499) }, 'Månedslønnen er usædvanlig lav – er det en dagsløn?'],
  ])('%s: gul advarsel', (beregnesUdFra, patch, message) => {
    expect(project(sag({ beregnesUdFra, ...patch })).warningLinjer).toContain(message);
  });

  it.each([
    ['Angivet dagsløn' as const, { dagsloenenUdgoer: amount(10000) }],
    ['Angivet månedsløn' as const, { maanedsloenenUdgoer: amount(2500) }],
  ])('%s: ingen advarsel ved selve grænsen', (beregnesUdFra, patch) => {
    expect(project(sag({ beregnesUdFra, ...patch })).warningLinjer.some((linje) => linje.includes('usædvanlig'))).toBe(false);
  });
});

describe('BB-269 – øvrigt fravær uden løn', () => {
  it('melder en tom «Antal fraværsdage» én gang', () => {
    const result = project(sag({ oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdageBeskrivelse: 'Barsel' }));

    expect(result.errorLinjer.filter((linje) => linje.includes('Antal fraværsdage er ikke angivet'))).toHaveLength(1);
  });

  it('melder en tom årsag med feltets navn', () => {
    const result = project(sag({ oevrigtFravaerUdenLoen: 'Ja', oevrigeFravaersdage: 10 }));

    expect(result.warningLinjer).toContain('Årsag til fravær er ikke udfyldt');
  });
});

describe('BB-270 – sektionslinket bærer skærmens overskrift', () => {
  it.each([
    ['Arbejdsulykke' as const, 'Indtægt før skadedatoen'],
    ['Erhvervssygdom' as const, 'Indtægt før anmeldelsesdatoen'],
  ])('%s', (skadestype, sectionTitle) => {
    expect(getNavigationTargetFromRowId('taf.beregningsgrundlag.indkomst', { skadestype })).toMatchObject({ sectionTitle });
  });
});

describe('BB-271/BB-272 – papirets tekst', () => {
  const papir = (eo: ErstatningsopgoerelseValues): string[] => {
    const { projection } = project(eo);
    const model = projection.snapshot.data?.pdfModel;
    if (model === undefined) throw new Error('Testsagen skal kunne beregnes');
    const linjer: string[] = [];
    renderTafBeregningsgrundlag({
      model,
      lineHeight: 1,
      rightColumnWidth: 1,
      rightMaxWidth: 1,
      renderMoneyWithKrOrError: () => 'kr',
      renderSubheader: (text) => { linjer.push(text); },
      safeAddWrappedText: (text) => { linjer.push(text); },
      safeAddLeftRightText: (left, right) => { linjer.push(`${left} | ${right}`); },
      writer: { addSectionSpacer: () => undefined, keepWithNext: () => undefined, writeUnderlinedSubheader: (text) => { linjer.push(text); } },
    });
    return linjer;
  };

  it('fjerner et indledende «baseret på» og bevarer brugerens bogstaver', () => {
    const linjer = papir(sag({
      beregnesUdFra: 'Angivet månedsløn', maanedsloenenUdgoer: amount(30000), angivetMaanedsloenBaseretPaa: 'baseret på Lønsedler for 2017',
    }));

    expect(linjer.some((linje) => linje.startsWith('På baggrund af Lønsedler for 2017 lægges en månedsløn til grund på'))).toBe(true);
  });

  it('bøjer én arbejdsdag i ental', () => {
    const linjer = papir(sag({ uspecificeredeFerieFridage: 250 }, 'Nej'));

    expect(linjer.some((linje) => linje.endsWith('| 1 arbejdsdag'))).toBe(true);
  });
});

describe('Opfølgning på BB-261 – hver ferietabel i sin egen periode', () => {
  // Beregningsperiode efter skaden (BB-261's lovlige tilfælde). TAF-afsnittets ferie i beregningsperioden må
  // hverken ændre fordelingen af beregningsperiodens løn eller give en kontroluoverensstemmelse.
  const efterSkaden = (ferieperioder: ErstatningsopgoerelseValues['ferieperioder']) => project(sag({
    vedroererPeriodeFra: iso('2018-06-01'),
    vedroererPeriodeTil: iso('2018-12-31'),
    tafPerioder: [{ id: 't1', fra: iso('2018-06-01'), til: iso('2018-12-31'), loseFeriedage: undefined }],
    tafBeregningsperiodeFra: iso('2019-01-15'),
    tafBeregningsperiodeTil: iso('2020-01-14'),
    loenindkomstAnsaettelsesforhold: [ansaettelse('Nej', { indtaegtsoplysningerTableData: loenRaekker({ maaned: 1, aar: 2019 }, 13) })],
    ferieperioder,
  }, 'Nej'));
  const dagsindkomst = (result: ReturnType<typeof project>) =>
    result.projection.snapshot.data?.pdfModel?.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.dagsloen;

  it.each([
    ['21-01-2019 – 31-01-2019', [{ id: 'f', fra: iso('2019-01-21'), til: iso('2019-01-31') }]],
    ['02-01-2019 – 11-01-2019', [{ id: 'f', fra: iso('2019-01-02'), til: iso('2019-01-11') }]],
  ])('TAF-ferie %s ændrer ikke dagsindkomsten', (_label, ferieperioder) => {
    const uden = efterSkaden([]);
    const med = efterSkaden(ferieperioder);

    expect(dagsindkomst(med)).toEqual(dagsindkomst(uden));
    expect(dagsindkomst(uden)).toEqual({ status: 'ok', value: 160714 });
    expect(med.projection.snapshot.invariants.some((i) => !i.passed && i.id === 'control:sammentaelling_mismatch')).toBe(false);
  });
});
