// @vitest-environment jsdom
import { resolveTafEfterKapitaliseringAdvarsler } from '../../../domain/erstatningsopgoerelse/validation/tafEfterKapitaliseringAdvarsel';
import {
  resolveDelvistEndeligeKapitaliseringsdatoer,
  type EetImportSource,
} from '../../../domain/erhvervsevnetab/eetImportPort';
import {
  resolveMidlertidigtEetIssueNavigation,
  TAF_EFTER_KAPITALISERING_ISSUE_ID_PREFIX,
} from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { evaluateErstatningsopgoerelseDownloadGates } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseDownloadGate';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { eoTafPeriodeFraField, eoTafPeriodeTilField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { DEFAULT_EO_ROW_POLICY } from '../../../settings/sourceSettings';
import { toISODateString } from '../../../types/branded';
import type { AslAfgoerelseRow, ErstatningsopgoerelseValues, StamdataValues, TafPeriodeRow } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const taf = (id: string, fra: string, til: string): TafPeriodeRow => ({ id, fra: iso(fra), til: iso(til), loseFeriedage: undefined });

const values = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  ...patch,
});

const afgoerelse = (id: string, patch: Partial<AslAfgoerelseRow>): AslAfgoerelseRow => ({
  id,
  afgoerelsesDato: iso('2023-01-15'),
  virkningsDato: iso('2023-01-01'),
  eetPct: 30,
  kapDato: undefined,
  kapPct: undefined,
  afgoerelseType: 'Delvist endelig',
  tidlKapDato: undefined,
  fsTilbageholdtEet: 'Nej',
  ...patch,
});

const source = (rows: readonly AslAfgoerelseRow[]): EetImportSource => ({
  revision: 'eet-r',
  eetValues: { ...ERHVERVSEVNETAB_INITIAL_VALUES, aslAfgoerelser: [...rows] },
  skadedato: iso('2022-03-01'),
});

const KAP = iso('2024-03-01');
const context = { skadedatoISO: iso('2022-03-01'), kapitaliseringsdatoer: [KAP] };

describe('resolveTafEfterKapitaliseringAdvarsler', () => {
  it('advarer gult på til-datoen, når TAF fortsætter forbi kapitaliseringen', () => {
    const advarsler = resolveTafEfterKapitaliseringAdvarsler(
      values({ tafPerioder: [taf('t1', '2023-06-01', '2024-12-31')] }),
      context,
    );
    expect(advarsler).toHaveLength(1);
    const [advarsel] = advarsler;
    expect(advarsel?.issue).toEqual({
      id: `${TAF_EFTER_KAPITALISERING_ISSUE_ID_PREFIX}:t1`,
      severity: 'warning',
      message: 'TAF-perioden 01-06-2023 - 31-12-2024 fortsætter på eller efter kapitaliseringsdatoen for den delvist '
        + 'endelige afgørelse om erhvervsevnetab på Erhvervsevnetab-siden (01-03-2024) – TAF ophører som udgangspunkt '
        + 'ved kapitaliseringen',
      focusTarget: { kind: 'fieldAddress', address: eoTafPeriodeTilField.bind('t1').address },
    });
    expect(advarsel?.cellWarnings.flatMap((warning) => warning.cells.map((cell) => serializeFieldAddress(cell.address))))
      .toEqual([serializeFieldAddress(eoTafPeriodeTilField.bind('t1').address)]);
  });

  it('markerer begge datoer og linker til fra-datoen, når hele perioden ligger efter kapitaliseringen', () => {
    const [advarsel] = resolveTafEfterKapitaliseringAdvarsler(
      values({ tafPerioder: [taf('t1', '2024-04-01', '2024-06-30')] }),
      context,
    );
    expect(advarsel?.issue.message).toContain('TAF-perioden 01-04-2024 - 30-06-2024 ligger på eller efter');
    expect(advarsel?.issue.focusTarget).toEqual({ kind: 'fieldAddress', address: eoTafPeriodeFraField.bind('t1').address });
    expect(advarsel?.cellWarnings.map((warning) => warning.cellMessage)).toEqual([
      expect.stringMatching(/^Hele perioden ligger på eller efter kapitaliseringsdatoen/),
      expect.stringMatching(/^Der er angivet tabt arbejdsfortjeneste på eller efter kapitaliseringsdatoen/),
    ]);
  });

  it('er inklusiv: TAF på selve kapitaliseringsdagen advares, dagen før ikke', () => {
    expect(resolveTafEfterKapitaliseringAdvarsler(values({ tafPerioder: [taf('t1', '2023-06-01', '2024-03-01')] }), context))
      .toHaveLength(1);
    expect(resolveTafEfterKapitaliseringAdvarsler(values({ tafPerioder: [taf('t1', '2023-06-01', '2024-02-29')] }), context))
      .toEqual([]);
  });

  it('bruger den tidligste kapitaliseringsdato ved flere delvist endelige afgørelser', () => {
    const [advarsel] = resolveTafEfterKapitaliseringAdvarsler(
      values({ tafPerioder: [taf('t1', '2023-06-01', '2024-06-30')] }),
      { ...context, kapitaliseringsdatoer: [iso('2024-05-01'), KAP] },
    );
    expect(advarsel?.issue.message).toContain('(01-03-2024)');
  });

  it('tier uden kapitalisering, uden TAF-krav og for en periode, motoren allerede afskærer før kapitaliseringen', () => {
    const rows = [taf('t1', '2023-06-01', '2024-12-31')];
    expect(resolveTafEfterKapitaliseringAdvarsler(values({ tafPerioder: rows }), { ...context, kapitaliseringsdatoer: [] }))
      .toEqual([]);
    expect(resolveTafEfterKapitaliseringAdvarsler(values({ tafPerioder: rows, kravPaaTabtArbejdsfortjeneste: 'Nej' }), context))
      .toEqual([]);
    // EO-perioden slutter før kapitaliseringen: de dage efter den regnes ikke, så der er intet at advare om.
    expect(resolveTafEfterKapitaliseringAdvarsler(
      values({ tafPerioder: rows, vedroererPeriodeFra: iso('2023-01-01'), vedroererPeriodeTil: iso('2024-01-31') }),
      context,
    )).toEqual([]);
  });

  it('advarer også under en verserende EET-klage – reglen er en besked, ikke en afskæring', () => {
    expect(resolveTafEfterKapitaliseringAdvarsler(
      values({ tafPerioder: [taf('t1', '2023-06-01', '2024-12-31')], verserendeKlageEet: 'Ja' }),
      context,
    )).toHaveLength(1);
  });
});

describe('resolveDelvistEndeligeKapitaliseringsdatoer', () => {
  it('læser kun delvist endelige afgørelser med en gyldig kapitaliseringsdato – sorteret og uden dubletter', () => {
    expect(resolveDelvistEndeligeKapitaliseringsdatoer(source([
      afgoerelse('a', { kapDato: iso('2024-05-01') }),
      afgoerelse('b', { kapDato: iso('2024-03-01') }),
      afgoerelse('c', { kapDato: iso('2024-03-01') }),
      afgoerelse('d', { kapDato: iso('2024-01-01'), afgoerelseType: 'Endelig' }),
      afgoerelse('e', { kapDato: iso('2024-01-01'), afgoerelseType: 'Midlertidig' }),
      afgoerelse('f', {}),
    ]))).toEqual([iso('2024-03-01'), iso('2024-05-01')]);
    expect(resolveDelvistEndeligeKapitaliseringsdatoer(null)).toEqual([]);
  });
});

describe('resolveMidlertidigtEetIssueNavigation (TAF efter kapitalisering)', () => {
  it('fører til TAF-afsnittet på EO oplysninger med rækkens felt', () => {
    const focusTarget = { kind: 'fieldAddress' as const, address: eoTafPeriodeTilField.bind('t1').address };
    expect(resolveMidlertidigtEetIssueNavigation({ id: `${TAF_EFTER_KAPITALISERING_ISSUE_ID_PREFIX}:t1`, focusTarget }))
      .toEqual(expect.objectContaining({ kind: 'erstatningsopgoerelse-tab', sectionId: 'taf', focusTarget }));
  });
});

describe('buildErstatningsopgoerelseReaderProjection (TAF efter kapitalisering)', () => {
  const catalog = getProductionInputCatalog();
  const stamdata: StamdataValues = {
    journalnr: 'J-1', advokat: 'A', sagsbehandler: 'S', skadelidte: 'Test',
    skadestype: 'Arbejdsulykke', skadedato: iso('2022-03-01'), skadelidteFodselsdato: iso('1980-01-01'),
  };
  const buildReader = (eo: ErstatningsopgoerelseValues) => {
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
  const eo = values({
    midlertidigtEetFraEetSiden: 'Nej',
    vedroererPeriodeFra: iso('2023-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    tafPerioder: [taf('t1', '2023-06-01', '2024-12-31')],
  });
  const eetSource = source([afgoerelse('a', { kapDato: KAP, kapPct: 10 })]);

  it('giver en gul, ikke-blokerende linje og en gul ring – også når midlertidigt EET ikke hentes', () => {
    const projection = buildErstatningsopgoerelseReaderProjection(buildReader(eo), { midlertidigtEetInsertSource: eetSource });
    expect(projection.tafEfterKapitaliseringAdvarsler.map((advarsel) => advarsel.rowId)).toEqual(['t1']);
    expect(projection.snapshot.invariants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: `midlertidigt_eet_source:${TAF_EFTER_KAPITALISERING_ISSUE_ID_PREFIX}:t1`,
        severity: 'warning',
        blocksAuthoritativeComputation: false,
        blocksOutputs: [],
      }),
    ]));
  });

  it('ændrer hverken beregning eller download-gates', () => {
    const uden = buildErstatningsopgoerelseReaderProjection(buildReader(eo), { midlertidigtEetInsertSource: source([]) });
    const med = buildErstatningsopgoerelseReaderProjection(buildReader(eo), { midlertidigtEetInsertSource: eetSource });
    expect(med.snapshot.status).toBe(uden.snapshot.status);
    expect(med.snapshot.data?.canonicalOutput).toEqual(uden.snapshot.data?.canonicalOutput);
    const gate = (projection: typeof med) => Object.fromEntries(Object.entries(
      evaluateErstatningsopgoerelseDownloadGates(projection, DEFAULT_EO_ROW_POLICY),
    ).map(([key, value]) => [key, value.canDownload]));
    expect(gate(med)).toEqual(gate(uden));
  });
});
