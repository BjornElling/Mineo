// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  erIndkomstBeregningsgrundlagGyldigt,
  kanIndkomstBeregningenSkjules,
} from '../../../domain/erstatningsopgoerelse/indkomstBeregningSkjulning';
import {
  eoFravaerPeriodeFraField,
  eoForligAnsvarsgradProcentField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoAngivetLoenFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import { buildFieldIssueSet, type FieldIssue } from '../../../inputCore/inputIssue';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { DEFAULT_EO_ROW_POLICY } from '../../../settings/sourceSettings';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

// «Skjul beregning efter første opgørelse» skjuler kun et gyldigt beregningsgrundlag (udviklerafgørelse
// 2026-10-24). Testene går gennem den rigtige reader, så gyldigheden læser samme rækker og feltissues, som
// «Fejl og advarsler» og download-gaten gør.

type Ansaettelse = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

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

const loenRaekker = (): Ansaettelse['indtaegtsoplysningerTableData'] => Array.from({ length: 12 }, (_, index) => {
  const maaned0 = 5 + index;
  return {
    id: `l${index}`,
    col0_maaned: String((maaned0 % 12) + 1),
    col1_maaned: String(2017 + Math.floor(maaned0 / 12)),
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

const ansaettelse = (): Ansaettelse => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  navnPaaArbejdssted: 'Firma A',
  feriePct: 12.5,
  loenperiode: 'maaned' as const,
  loenPaaHelligdage: 'Almindelig løn' as const,
  fuldLoenUnderFerie: 'Ja',
  loenudviklingBeregningsgrundlag: 'Ingen' as const,
  indtaegtsoplysningerTableData: loenRaekker(),
});

/** Opgørelse nr. 2 med togglen slået til og et gyldigt grundlag (en beregningsperiode med tolv lønsedler). */
const sag = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => withSfggIngenForEmployments({
  ...createErstatningsopgoerelseInitialValues(),
  tafArbejdsstatus: 'Uarbejdsdygtig',
  eoNummer: '2',
  komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
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
  loenindkomstAnsaettelsesforhold: [ansaettelse()],
  ...patch,
  eoAngivetLoenLoenudvikling: {
    ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'Ingen',
    ...patch.eoAngivetLoenLoenudvikling,
  },
});

const project = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  return buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
};

const kanSkjules = (eo: ErstatningsopgoerelseValues): boolean =>
  kanIndkomstBeregningenSkjules(project(eo), DEFAULT_EO_ROW_POLICY);
const gyldigt = (eo: ErstatningsopgoerelseValues): boolean =>
  erIndkomstBeregningsgrundlagGyldigt(project(eo), DEFAULT_EO_ROW_POLICY);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2025-03-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('kanIndkomstBeregningenSkjules', () => {
  it('skjuler et gyldigt grundlag i en senere opgørelse med togglen slået til', () => {
    const values = sag();
    // Forudsætningen: sagen er fuldt beregnelig, så «gyldig» ikke hviler på et tilfælde.
    expect(project(values).snapshot.status).toBe('ok');
    expect(kanSkjules(values)).toBe(true);
  });

  it('skjuler aldrig i første opgørelse eller med togglen slået fra', () => {
    expect(kanSkjules(sag({ eoNummer: '1' }))).toBe(false);
    expect(kanSkjules(sag({ komprimerBeregningEfterFoersteOpgoerelse: 'Nej' }))).toBe(false);
  });

  it('viser et tomt grundlag – brugeren indtastede intet i opgørelse nr. 1', () => {
    expect(kanSkjules(sag({ tafBeregningsperiodeFra: undefined, tafBeregningsperiodeTil: undefined }))).toBe(false);
    expect(kanSkjules(sag({ tafBeregningsperiodeTil: undefined }))).toBe(false);
    expect(kanSkjules(sag({ beregnesUdFra: 'Angivet månedsløn', maanedsloenenUdgoer: undefined }))).toBe(false);
    expect(kanSkjules(sag({ beregnesUdFra: 'Angivet dagsløn', dagsloenenUdgoer: undefined }))).toBe(false);
  });

  it('viser en beregningsperiode uden indkomst – grundlaget kan ikke bære TAF', () => {
    expect(kanSkjules(sag({ loenindkomstAnsaettelsesforhold: [] }))).toBe(false);
  });

  it('skjuler en angivet løn, når beløbet er udfyldt', () => {
    expect(kanSkjules(sag({ beregnesUdFra: 'Angivet månedsløn', maanedsloenenUdgoer: amount(30000) }))).toBe(true);
    expect(kanSkjules(sag({ beregnesUdFra: 'Angivet dagsløn', dagsloenenUdgoer: amount(1400) }))).toBe(true);
  });

  it('viser et grundlag med en blokerende fejl i et af de skjulte felter', () => {
    // Datoerne i omvendt rækkefølge: en rød regel på et felt, sektionen ellers ville skjule.
    expect(kanSkjules(sag({
      tafBeregningsperiodeFra: iso('2018-05-31'),
      tafBeregningsperiodeTil: iso('2017-06-01'),
    }))).toBe(false);
  });

  it('viser den angivne løns lønudvikling, når den mangler et valg', () => {
    // «Overenskomst» uden valgt overenskomst: lønudviklingen ligger i sektionen og skal kunne rettes der.
    expect(kanSkjules(sag({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: amount(30000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: undefined,
      },
    }))).toBe(false);
  });

  it('lader en fejl uden for grundlaget være – den åbner ikke lønnen før skaden', () => {
    // En forligsprocent over 100 er rød og spærrer opgørelsen, men har intet med beregningsgrundlaget at gøre.
    const values = sag({ forligAnsvarsgradProcent: 150 });
    const projection = project(values);
    expect(projection.eoErrors.all.some((issue) => issue.field.address.field === 'forligAnsvarsgradProcent')).toBe(true);
    expect(projection.snapshot.status).toBe('error');
    expect(kanIndkomstBeregningenSkjules(projection, DEFAULT_EO_ROW_POLICY)).toBe(true);
  });

  it('viser et skjult felt med en rød værdi, også når ingen række i «Fejl og advarsler» melder den', () => {
    // Rækkerne fanger normalt også en rød værdi; her bærer kun feltissuet fejlen, så det er feltværnet, der måles.
    const projection = project(sag());
    const issueOn = (field: AnyFieldRef): FieldIssue => ({
      kind: 'field', code: 'test:rule', severity: 'error', field, reason: 'rule', message: 'Testfejl',
    });
    const med = (field: AnyFieldRef) => ({ ...projection, eoErrors: buildFieldIssueSet([issueOn(field)]) });

    expect(erIndkomstBeregningsgrundlagGyldigt(med(eoFravaerPeriodeFraField.bind('uden-raekke')), DEFAULT_EO_ROW_POLICY))
      .toBe(false);
    expect(erIndkomstBeregningsgrundlagGyldigt(med(eoAngivetLoenFields.overenskomstId.bind()), DEFAULT_EO_ROW_POLICY))
      .toBe(false);
    // Et rødt felt uden for sektionen tæller ikke.
    expect(erIndkomstBeregningsgrundlagGyldigt(med(eoForligAnsvarsgradProcentField.bind()), DEFAULT_EO_ROW_POLICY))
      .toBe(true);
  });

  it('bedømmer grundlaget uafhængigt af togglen', () => {
    // Gyldigheden er grundlagets egen; togglen og opgørelsens nummer afgør kun, om den spørges.
    expect(gyldigt(sag({ eoNummer: '1' }))).toBe(true);
    expect(gyldigt(sag({ eoNummer: '1', tafBeregningsperiodeTil: undefined }))).toBe(false);
  });
});
