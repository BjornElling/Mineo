// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { selectBlockingLoenindkomstEntityIds } from '../../../../domain/erstatningsopgoerelse/eoInputIssues';
import { eoSnapshotToBeregningView } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToBeregningView';
import {
  erstatningsopgoerelseDocumentDefinition,
  tafFordeltPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
} from '../../../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  klLoenaftalerDocumentDefinition,
  krlDocumentDefinition,
  reguleringDocumentDefinition,
} from '../../../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import { createDocumentSourceContext } from '../../../../document/definition/documentSourceContext';
import { projectMineoDocumentGateSettings } from '../../../../document/definition/mineoDocumentDefinition';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../../inputCore/evaluationSource';
import { createInputEvaluation } from '../../../../inputCore/inputReader';
import { __createTestSourceSettings } from '../../../../settings/sourceSettings';
import { persistedErstatningsopgoerelseSchema, stamdataSchema } from '../../../../schemas/formSchemas';
import type { GeneratedEoCase } from './eoRuntimeInputArbitrary';

const { reportSystemIssueMock } = vi.hoisted(() => ({ reportSystemIssueMock: vi.fn() }));

vi.mock('../../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

import { buildMidlertidigtEetInsertSource } from '../../../../domain/erhvervsevnetab/eetImportPort';
import type { ErhvervsevnetabValues, FaellesAarsloenValues } from '../../../../schemas/formSchemas';
import { collectAllEoRows } from '../../../../domain/eoRowEvaluation/eoRowAggregator';
import { renderEoDagsgrundlagCsv } from '../../../../domain/erstatningsopgoerelse/snapshot/eoDagsgrundlagCsv';
import { dateRange_systemramme } from '../../../../config/dateRanges';
import { fromKroner } from '../../../../domain/money/money';
import { STANDARD_LOEN_SAMLET_LABEL } from '../../../../domain/aarsloen/standardLoenTableColumns';
import { parseDanishNumberString } from '../../../../utils/numberParsing';
import { isDeepStrictEqual } from 'node:util';

export type EoRuntimeCase = GeneratedEoCase & Readonly<{
  erhvervsevnetab?: ErhvervsevnetabValues;
  faellesAarsloen?: FaellesAarsloenValues;
}>;

const catalog = getProductionInputCatalog();
const GATE_SETTINGS = projectMineoDocumentGateSettings(__createTestSourceSettings({}));

const evaluationFor = (generated: EoRuntimeCase) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: generated.stamdata, satser: null, aarsloen: null, faellesAarsloen: generated.faellesAarsloen ?? null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: generated.erstatningsopgoerelse, erhvervsevnetab: generated.erhvervsevnetab ?? null,
    },
    rejectedInputs: {},
  });
  return createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
};

export const eoRuntimeStats = {
  status: {} as Record<string, number>,
  checks: { reordered: 0, outside: 0, csv: 0 },
};

export type Failure = Readonly<{ seed: number; stage: string; message: string }>;

const describeError = (error: unknown) => (error instanceof Error
  ? `${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(1, 5).join('\n')}`
  : String(error));

const csvCells = (line: string) => line.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/)
  .map((cell) => cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell);

/**
 * Kører hele den kæde, Erstatningsopgørelse-siden kører på en afsluttet revision: reader-projektion (inkl.
 * snapshot, feltissues og dependency-gating), Beregning-visningen og alle syv dokumenter, siden
 * kan downloade. Hver stage skal enten lykkes eller afvise kontrolleret; en exception, et `runtime_exception`-
 * snapshot eller en indberettet systemfejl er et fund.
 */
export const runEoPage = (generated: EoRuntimeCase): Failure[] => {
  const failures: Failure[] = [];
  const stage = <T,>(name: string, run: () => T): T | undefined => {
    try {
      return run();
    } catch (error) {
      failures.push({ seed: generated.seed, stage: name, message: describeError(error) });
      return undefined;
    }
  };

  reportSystemIssueMock.mockClear();
  if (!persistedErstatningsopgoerelseSchema.safeParse(generated.erstatningsopgoerelse).success
    || !stamdataSchema.safeParse(generated.stamdata).success) {
    return [{ seed: generated.seed, stage: 'schema', message: 'Generatoren skal levere schema-gyldigt input' }];
  }
  const evaluation = stage('evaluation', () => evaluationFor(generated));
  if (evaluation === undefined) return failures;

  const projection = stage('projection', () => buildErstatningsopgoerelseReaderProjection(evaluation.reader, {
    midlertidigtEetInsertSource: buildMidlertidigtEetInsertSource(evaluation),
  }));
  if (projection !== undefined) {
    const { snapshot } = projection;
    const canonical = snapshot.data?.canonicalOutput;
    if (canonical?.taf.harTafPerioder && (snapshot.status === 'ok' || snapshot.status === 'warning')) {
      const values = generated.erstatningsopgoerelse;
      const compare = (kind: 'reordered' | 'outside', variant: GeneratedEoCase['erstatningsopgoerelse']) => {
        stage(kind, () => {
          const variantEvaluation = evaluationFor({ ...generated, erstatningsopgoerelse: variant });
          const variantSnapshot = buildErstatningsopgoerelseReaderProjection(variantEvaluation.reader, {
            midlertidigtEetInsertSource: buildMidlertidigtEetInsertSource(variantEvaluation),
          }).snapshot;
          if (!isDeepStrictEqual(variantSnapshot.data?.canonicalOutput, canonical)) {
            const details = variantSnapshot.invariants.map((invariant) => invariant.message).join(' | ');
            throw new Error(`Den samme beregning gav et andet kanonisk resultat (${details})`);
          }
          eoRuntimeStats.checks[kind] += 1;
        });
      };
      if (values.loenindkomstAnsaettelsesforhold.some((employment) => employment.indtaegtsoplysningerTableData.length > 1)) {
        compare('reordered', {
          ...values,
          loenindkomstAnsaettelsesforhold: values.loenindkomstAnsaettelsesforhold.map((employment) => ({
            ...employment, indtaegtsoplysningerTableData: [...employment.indtaegtsoplysningerTableData].reverse(),
          })),
        });
      }

      const outside = dateRange_systemramme.min;
      if (outside && ![values.tafBeregningsperiodeFra, values.vedroererPeriodeFra, ...canonical.periodiseringer.tafPerioder.map(({ fra }) => fra)]
        .some((date) => date !== undefined && date <= outside)) {
        compare('outside', {
          ...values,
          offentligeYdelserRows: [...values.offentligeYdelserRows, {
            id: 'fuzz-ydelse-uden-for-perioder', fraDato: outside, tilDato: outside,
            ydelsestype: 'andet', ydelse: { kind: 'number', value: 100 },
          }],
        });
      }

      const entries = snapshot.data?.engines.tafNetto.indkomstDagsgrundlag?.taf?.entries ?? [];
      const dagsgrundlag = snapshot.dagsgrundlag;
      const reference = snapshot.data?.engines.tafNetto.indkomstSkadestidspunkt;
      const referenceColumns = [
        ...(reference?.arbejdssteder ?? []).map(({ navn, breakdown }) => ({
          name: `${navn} – ${STANDARD_LOEN_SAMLET_LABEL} (beregningsperiode)`,
          amountOre: breakdown.samletOre,
        })),
        ...(reference?.offentligeYdelser ?? []).map(({ label, amountOre }) => ({
          name: `${label} (beregningsperiode)`, amountOre,
        })),
      ];
      const amounts = [...referenceColumns, ...entries.map((entry) => ({
        name: entry.kind === 'loen' ? `${entry.label} – ${STANDARD_LOEN_SAMLET_LABEL}` : entry.label,
        amountOre: entry.amountOre,
      }))];
      if (amounts.length > 0) {
        stage('csv', () => {
          if (!dagsgrundlag) throw new Error('Dagsgrundlaget mangler trods gyldig indkomst');
          const [header, ...rows] = renderEoDagsgrundlagCsv(dagsgrundlag).slice(1).split('\r\n').map(csvCells);
          for (const { name, amountOre } of amounts) {
            const column = header.findIndex((cell) => cell === name || cell === `'${name}`);
            const totalOre = rows.reduce((sum, row) => sum + fromKroner(parseDanishNumberString(row[column] ?? '') ?? 0), 0);
            if (column === -1 || totalOre !== amountOre) {
              throw new Error(`CSV-kolonnen «${name}» summerer til ${totalOre} øre, forventede ${amountOre}`);
            }
          }
          eoRuntimeStats.checks.csv += 1;
        });
      }
    }
    const statusKey = snapshot.status === 'error'
      ? `error:${snapshot.invariants.filter((invariant) => invariant.severity === 'error').map((invariant) => invariant.id.split(':').slice(0, 2).join(':')).sort().join(',').slice(0, 120)}`
      : snapshot.status;
    eoRuntimeStats.status[statusKey] = (eoRuntimeStats.status[statusKey] ?? 0) + 1;
    if (snapshot.failClosedReason === 'runtime_exception' || snapshot.failClosedReason === 'schema_guard') {
      failures.push({
        seed: generated.seed,
        stage: `snapshot:${snapshot.failClosedReason}`,
        message: snapshot.invariants.map((invariant) => invariant.evidence?.join(' | ') ?? invariant.message).join(' || '),
      });
    }
    stage('beregningView', () => eoSnapshotToBeregningView(snapshot));
    stage('collectAllEoRows', () => collectAllEoRows(
      projection.stamdataValues, projection.stamdataErrors, projection.eoValues, projection.eoErrors,
      selectBlockingLoenindkomstEntityIds(projection.eoErrors), undefined,
      snapshot.data?.canonicalOutput, snapshot.data?.pdfModel,
    ));
  }

  // Flere dokumentoutputs deler samme revisionskontekst og dens memo, som på den faktiske side.
  const context = createDocumentSourceContext(evaluation, GATE_SETTINGS);
  stage('document:erstatningsopgoerelse', () => erstatningsopgoerelseDocumentDefinition.project(context, undefined));
  stage('document:taf-fordelt-paa-aar', () => tafFordeltPaaAarDocumentDefinition.project(context, undefined));
  stage('document:taf-opreguleret-paa-aar', () => tafOpreguleretPaaAarDocumentDefinition.project(context, undefined));
  stage('document:taf-krav-graf', () => tafKravGrafDocumentDefinition.project(context, undefined));
  const requests = [
    { scope: 'case' } as const,
    ...generated.erstatningsopgoerelse.loenindkomstAnsaettelsesforhold.map((employment) => ({
      scope: 'employment' as const,
      employmentId: employment.id,
    })),
  ];
  for (const request of requests) {
    const suffix = request.scope === 'case' ? 'case' : request.employmentId;
    stage(`document:regulering:${suffix}`, () => reguleringDocumentDefinition.project(context, request));
    stage(`document:krl:${suffix}`, () => krlDocumentDefinition.project(context, request));
    stage(`document:kl-loenaftaler:${suffix}`, () => klLoenaftalerDocumentDefinition.project(context, request));
  }

  for (const call of reportSystemIssueMock.mock.calls) {
    const [issue] = call as [Readonly<{ code: string; error?: unknown }>];
    failures.push({
      seed: generated.seed,
      stage: `systemIssue:${issue.code}`,
      message: issue.error === undefined ? '' : describeError(issue.error),
    });
  }
  return failures;
};

