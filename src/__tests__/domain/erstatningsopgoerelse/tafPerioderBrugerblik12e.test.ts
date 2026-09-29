// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildFerieFeriedageById, resolveTafFerieRamme } from '../../../domain/erstatningsopgoerelse/helpers/tafRowDerived';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeLoseFeriedageField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

// Brugerblik 12e (TAF-perioden), udviklerafgørelser 2026-09-25. Testene går gennem den rigtige reader, så
// celleissues, «Fejl og advarsler» og blokeringen læser samme tilstand som skærmen.

const catalog = getProductionInputCatalog();
const iso = (value: string) => toISODateString(value);

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'T',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2018-06-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const dagsloenSag = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  eoNummer: '1',
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  kravPaaOevrigeErstatningskrav: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-12-31'),
  opgørelseLavetDen: iso('2025-02-01'),
  beregnesUdFra: 'Angivet dagsløn',
  dagsloenenUdgoer: { kind: 'number', value: 1500 },
  ...patch,
});

const project = (eo: ErstatningsopgoerelseValues, stamdataPatch: Partial<StamdataValues> = {}) => {
  const currentStamdata = { ...stamdata, ...stamdataPatch };
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: currentStamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
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
  const tafLinjer = (list: typeof rows.errors) => list
    .filter((row) => row.id.startsWith('taf.periode.') || row.id.startsWith('taf.ferie.') || row.id.startsWith('taf.ingenArbejdsdage.'))
    .map((row) => row.summaryText ?? row.message);
  return { projection, evaluation, rows, errorLinjer: tafLinjer(rows.errors), warningLinjer: tafLinjer(rows.warnings) };
};

const cellMessage = <T,>(projection: ReturnType<typeof project>['projection'], field: FieldRef<T>) =>
  projection.tafCellIssues.get(serializeFieldAddress(field.address))?.message;

const taf = (id: string, fra: string | undefined, til: string | undefined, loseFeriedage?: number) =>
  ({ id, fra: fra === undefined ? undefined : iso(fra), til: til === undefined ? undefined : iso(til), loseFeriedage });
const ferie = (id: string, fra: string | undefined, til: string | undefined) =>
  ({ id, fra: fra === undefined ? undefined : iso(fra), til: til === undefined ? undefined : iso(til) });

describe('BB-247 – løse feriedage i måneder', () => {
  it('er skjulte i måneder: ingen celle, ingen linje og ingen spærring – værdien bevares', () => {
    const { projection, evaluation, errorLinjer } = project(dagsloenSag({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: { kind: 'number', value: 30000 },
      tafPerioder: [taf('t1', '2024-01-01', '2024-01-31', 999)],
    }));

    expect(evaluation.reader.read(eoTafPeriodeLoseFeriedageField.bind('t1'))).toEqual({ status: 'usable', value: undefined });
    expect(projection.eoValues.tafPerioder[0]?.loseFeriedage).toBeUndefined();
    expect(cellMessage(projection, eoTafPeriodeLoseFeriedageField.bind('t1'))).toBeUndefined();
    expect(errorLinjer).toEqual([]);
  });
});

describe('BB-248 – en ferieperiode uden for sit vindue', () => {
  it.each([
    [
      'før skadedatoen',
      ferie('f1', '2017-07-01', '2017-07-14'),
      {},
      'Ferien ligger før skadedatoen (01-06-2018)',
      'Ferieperioden 01-07-2017 - 14-07-2017',
    ],
    [
      'efter differencekravet',
      ferie('f1', '2024-07-01', '2024-07-12'),
      { differencekravDato: iso('2024-07-01') },
      'Ferien ligger efter den dato, differencekravet er opgjort pr. (01-07-2024)',
      'Ferieperioden 01-07-2024 - 12-07-2024',
    ],
  ])('%s: rød celle med fladens ordlyd, én linje med rækkens navn, og opgørelsen spærres', (_navn, raekke, patch, besked, navn) => {
    const { projection, errorLinjer } = project(dagsloenSag({
      tafPerioder: [taf('t1', '2024-01-01', '2024-06-30')],
      ferieperioder: [raekke],
      ...patch,
    }));

    expect(cellMessage(projection, eoFerieperiodeFraField.bind('f1'))).toBe(besked);
    expect(cellMessage(projection, eoFerieperiodeTilField.bind('f1'))).toBe(besked);
    expect(errorLinjer).toEqual([`${navn}: ${besked}`]);
    expect(projection.snapshot.data).toBeNull();
  });

  it('bruger anmeldelsesdatoen som nedre grænse ved erhvervssygdom', () => {
    const { projection } = project(dagsloenSag({
      ferieperioder: [ferie('f1', '2013-05-31', '2013-06-01')],
    }), { skadestype: 'Erhvervssygdom' });
    const besked = 'Ferien ligger mere end 5 år før anmeldelsesdatoen (01-06-2018)';

    expect(cellMessage(projection, eoFerieperiodeFraField.bind('f1'))).toBe(besked);
    expect(projection.snapshot.data).toBeNull();
  });
});

describe('BB-249 – ferietabellens kolonne tæller dagene i TAF-perioden', () => {
  it('tæller fællesmængden med TAF-perioderne og 0 for en ferie helt uden for', () => {
    const values = dagsloenSag({
      tafPerioder: [taf('t1', '2024-01-01', '2024-06-30')],
      ferieperioder: [ferie('f1', '2024-06-17', '2024-07-12'), ferie('f2', '2024-10-01', '2024-10-11')],
    });
    expect(buildFerieFeriedageById(values.ferieperioder, resolveTafFerieRamme(values, stamdata.skadedato)))
      .toEqual({ f1: 10, f2: 0 });
  });

  it('tæller rækken for sig, så længe der ingen gyldig TAF-periode er', () => {
    const values = dagsloenSag({ ferieperioder: [ferie('f1', '2024-03-01', '2024-03-15')] });
    expect(buildFerieFeriedageById(values.ferieperioder, resolveTafFerieRamme(values, stamdata.skadedato)))
      .toEqual({ f1: 11 });
  });
});

describe('BB-251 – overlap', () => {
  it('farver de overlappende rækkers celler og giver én linje pr. tabel', () => {
    const { projection, errorLinjer } = project(dagsloenSag({
      tafPerioder: [taf('t1', '2024-01-01', '2024-06-30'), taf('t2', '2024-06-01', '2024-12-31')],
      ferieperioder: [ferie('f1', '2024-03-01', '2024-03-15'), ferie('f2', '2024-03-10', '2024-03-20')],
    }));

    expect(cellMessage(projection, eoTafPeriodeFraField.bind('t1'))).toBe('Perioden overlapper perioden 01-06-2024 - 31-12-2024');
    expect(cellMessage(projection, eoFerieperiodeTilField.bind('f2'))).toBe('Perioden overlapper perioden 01-03-2024 - 15-03-2024');
    expect([...new Set(errorLinjer)]).toEqual(['Der er overlappende TAF-perioder', 'Der er overlappende ferieperioder']);
  });
});

describe('BB-252 – for mange løse feriedage', () => {
  it('farver cellen, og linjen linker til den', () => {
    const { projection, rows, errorLinjer } = project(dagsloenSag({ tafPerioder: [taf('t1', '2024-01-01', '2024-01-31', 999)] }));
    const besked = 'Løse ferie-/feriefridage overstiger mulige arbejdsdage i perioden (maksimalt 22)';

    expect(cellMessage(projection, eoTafPeriodeLoseFeriedageField.bind('t1'))).toBe(besked);
    expect(errorLinjer).toEqual([`TAF-perioden 01-01-2024 - 31-01-2024: ${besked}`]);
    expect(rows.errors.find((row) => row.id === 'taf.periode.t1')?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoTafPeriodeLoseFeriedageField.bind('t1').address,
    });
  });
});

describe('BB-253 – én vurdering pr. række', () => {
  it('melder en række med kun løse feriedage som én mangel med link', () => {
    const { rows, errorLinjer } = project(dagsloenSag({
      tafPerioder: [taf('t1', '2024-01-01', '2024-12-31'), taf('t2', undefined, undefined, 3)],
    }));

    expect(errorLinjer).toEqual(['TAF-perioden med 3 løse ferie-/feriefridage: Fra- og til-dato er ikke angivet']);
    expect(rows.errors.find((row) => row.id === 'taf.periode.t2')?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoTafPeriodeFraField.bind('t2').address,
    });
  });

  it('holder TAF-rækkens og ferierækkens ens mangel i hver sin linje', () => {
    const { errorLinjer } = project(dagsloenSag({
      tafPerioder: [taf('t1', '2024-01-01', undefined)],
      ferieperioder: [ferie('f1', '2024-03-01', undefined)],
    }));

    expect(errorLinjer).toEqual([
      'TAF-perioden fra 01-01-2024: Til-dato er ikke angivet',
      'Ferieperioden fra 01-03-2024: Til-dato er ikke angivet',
    ]);
  });

  it('nævner cellens afskæring, når periodens samlede besked ikke kan dannes', () => {
    const { errorLinjer } = project(dagsloenSag({
      differencekravDato: iso('2024-07-01'),
      tafPerioder: [taf('t1', '2024-08-01', undefined)],
    }));
    expect(errorLinjer).toEqual([
      'TAF-perioden fra 01-08-2024: Der er angivet tabt arbejdsfortjeneste efter den dato, differencekravet er opgjort pr. (01-07-2024); Til-dato er ikke angivet',
    ]);
  });

  it('melder en rød celle med sin egen tekst, ikke som manglende', () => {
    const { errorLinjer } = project(dagsloenSag({ tafPerioder: [taf('t1', '2017-01-01', '2024-06-30')] }));
    expect(errorLinjer).toEqual(['TAF-perioden til 30-06-2024: Datoen kan ikke være før skadedatoen (01-06-2018)']);
  });
});

describe('BB-257 – en TAF-periode uden arbejdsdage', () => {
  it('advarer også, når rækken har en anden fejl', () => {
    const { warningLinjer } = project(dagsloenSag({ tafPerioder: [taf('t1', '2024-11-23', '2024-11-24', 1)] }));
    expect(warningLinjer).toEqual(['TAF-perioden 23-11-2024 - 24-11-2024: Perioden indeholder ingen arbejdsdage']);
  });

  it('giver en ikke-blokerende advarsel og «0 arbejdsdage» i papirets periodeliste', () => {
    const { projection, errorLinjer, warningLinjer } = project(dagsloenSag({
      tafArbejdsstatus: 'Uarbejdsdygtig',
      tafPerioder: [taf('t1', '2024-01-01', '2024-10-31'), taf('t2', '2024-11-23', '2024-11-24')],
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    }));

    expect(errorLinjer).toEqual([]);
    expect(warningLinjer).toEqual(['TAF-perioden 23-11-2024 - 24-11-2024: Perioden indeholder ingen arbejdsdage']);
    expect(projection.snapshot.data?.pdfModel.tabtArbejdsfortjeneste.tafPerioderLinjer).toEqual([
      '01-01-2024 - 31-10-2024',
      '23-11-2024 - 24-11-2024 (0 arbejdsdage)',
    ]);
  });
});
