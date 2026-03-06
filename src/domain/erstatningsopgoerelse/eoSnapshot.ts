import { TODAY } from '../../config/dateRanges';
import { erstatningsopgoerelseSchema, stamdataSchema, type ErstatningsopgoerelseValues, type StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { buildEODebugSnapshot, type EODebugSnapshot } from '../debug/eoDebugSnapshot';
import { parseForligsgrad } from './forligsgrad';
import { buildOevrigeKravModel } from './eoPdfBuilders';
import { buildEoPdfPresentation, type EoPdfPresentation } from './eoPdfModel';
import type { MoneyOre } from './eoPdfModel';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from './svieSmerteEngine';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from './tafNettoBeregning';
import { buildTafPerYearBuildOutcome, buildTafPerYearSourceFromComputed, type TafPerYearResult } from './tafPerYearDerived';
import {
  buildEoCanonicalOutputFromComputed,
  buildEoComputedTotals,
  type EoCanonicalOutput,
} from './eoCanonicalOutput';
import { buildTafRanges } from './indtaegtPerioder';
import { logError } from '../../utils/logger';
import {
  buildControlMismatchInvariant,
  buildTafPerYearAfrundingInvariant,
  buildTafPerYearUnavailableInvariant,
  buildValidationInvariants,
  hasAnyErrorInvariant,
  hasAnyWarningInvariant,
  hasAuthoritativeBlockingInvariant,
  type EoInvariant,
} from './eoSnapshotInvariants';
import { collectSammentaellingControlMismatchMessages } from '../debug/eoDebugSammentaelling';

export type EoSnapshotComputedData = Readonly<{
  engines: Readonly<{
    svieSmerte: SvieSmerteEngineOutput;
    tafNetto: TafNettoBeregningResult;
    tafPerYear: TafPerYearResult | null;
    oevrigeKrav: ReturnType<typeof buildOevrigeKravModel>;
    forlig: ReturnType<typeof parseForligsgrad>;
  }>;
  totals: Readonly<{
    svieSmerteOre: MoneyOre;
    tabtArbejdsfortjenesteFoerForligOre: MoneyOre;
    tabtArbejdsfortjenesteOre: MoneyOre;
    oevrigeKravFoerForligOre: MoneyOre;
    oevrigeKravOre: MoneyOre;
    samletTotalOre: MoneyOre;
    tidligereModtagetTafOre: MoneyOre;
    forligFactor: number | null;
  }>;
  presentation: EoPdfPresentation;
  canonicalOutput: EoCanonicalOutput;
  debugSnapshot: EODebugSnapshot;
}>;

export type EoSnapshot = Readonly<{
  revision: string;
  status: 'ok' | 'warning' | 'error' | 'fail_closed';
  invariants: readonly EoInvariant[];
  data: EoSnapshotComputedData | null;
  input: Readonly<{
    stamdata: StamdataValues | null;
    erstatningsopgoerelse: ErstatningsopgoerelseValues | null;
  }>;
  failClosedReason?: 'schema_guard' | 'runtime_exception';
}>;

const EMPTY_STAMDATA_ERRORS: FieldErrorsForSection<'stamdata'> = {};
const EMPTY_EO_ERRORS: FieldErrorsForSection<'erstatningsopgoerelse'> = {};

export type EoSnapshotWithData = Readonly<Omit<EoSnapshot, 'data' | 'input'>> & Readonly<{
  data: EoSnapshotComputedData;
  input: Readonly<{
    stamdata: StamdataValues;
    erstatningsopgoerelse: ErstatningsopgoerelseValues;
  }>;
}>;

export const hasEoSnapshotData = (
  snapshot: EoSnapshot
): snapshot is EoSnapshotWithData => {
  // Current snapshot contract only materializes `data` for non-fail-closed computed snapshots.
  // This guard intentionally narrows on data/input presence instead of `status`, because projections
  // depend on the computed payload rather than a specific status string.
  return snapshot.data !== null &&
    snapshot.input.stamdata !== null &&
    snapshot.input.erstatningsopgoerelse !== null;
};

const buildCanonicalOutput = (args: Readonly<{
  tafRanges: ReadonlyArray<{ fra: ISODateString; til: ISODateString }>;
  svieSmerte: SvieSmerteEngineOutput;
  tafNetto: TafNettoBeregningResult;
  oevrigeKrav: ReturnType<typeof buildOevrigeKravModel>;
  totals: EoSnapshotComputedData['totals'];
}>): EoCanonicalOutput => {
  return buildEoCanonicalOutputFromComputed({
    tafRanges: args.tafRanges,
    svieSmerte: args.svieSmerte,
    tafNetto: args.tafNetto,
    oevrige: args.oevrigeKrav,
    totals: args.totals,
  });
};

const buildDebugSnapshotForComputed = (args: Readonly<{
  revision: string;
  stamdata: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  stamdataErrors: FieldErrorsForSection<'stamdata'>;
  eoErrors: FieldErrorsForSection<'erstatningsopgoerelse'>;
}>): EODebugSnapshot => {
  return buildEODebugSnapshot({
    revision: args.revision,
    stamdataValues: args.stamdata,
    eoValues: args.eoValues,
    stamdataErrors: args.stamdataErrors,
    eoErrors: args.eoErrors,
  });
};

export const computeEoSnapshot = (args: Readonly<{
  revision: string;
  stamdataValues: unknown;
  eoValues: unknown;
  dagsDatoISO?: ISODateString;
  stamdataErrors?: FieldErrorsForSection<'stamdata'>;
  eoErrors?: FieldErrorsForSection<'erstatningsopgoerelse'>;
}>): EoSnapshot => {
  const dagsDatoISO = args.dagsDatoISO ?? TODAY;
  const stamdataErrors = args.stamdataErrors ?? EMPTY_STAMDATA_ERRORS;
  const eoErrors = args.eoErrors ?? EMPTY_EO_ERRORS;
  const parsedStamdata = stamdataSchema.safeParse(args.stamdataValues);
  const parsedEo = erstatningsopgoerelseSchema.safeParse(args.eoValues);

  if (!parsedStamdata.success || !parsedEo.success) {
    const schemaIssues = [
      ...(parsedStamdata.success ? [] : parsedStamdata.error.issues.map((issue) => issue.message)),
      ...(parsedEo.success ? [] : parsedEo.error.issues.map((issue) => issue.message)),
    ];
    return {
      revision: args.revision,
      status: 'fail_closed',
      invariants: schemaIssues.map((message, index) => ({
        id: `schema_guard:${index}`,
        passed: false,
        severity: 'error',
        message,
        blocksAuthoritativeComputation: true,
        blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'],
      })),
      data: null,
      input: {
        stamdata: parsedStamdata.success ? parsedStamdata.data : null,
        erstatningsopgoerelse: parsedEo.success ? parsedEo.data : null,
      },
      failClosedReason: 'schema_guard',
    };
  }

  const validationResult = erstatningsopgoerelseValidator.validateParsed(parsedEo.data);
  const validationInvariants = buildValidationInvariants(validationResult.errors);
  if (hasAuthoritativeBlockingInvariant(validationInvariants)) {
    return {
      revision: args.revision,
      status: 'error',
      invariants: validationInvariants,
      data: null,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    };
  }

  try {
    const tafRanges = buildTafRanges(parsedEo.data, { clamp: false });
    const forlig = parseForligsgrad(parsedEo.data);
    const forligFactor = forlig?.factor ?? null;
    const svieSmerte = computeSvieSmerteEngine({
      erstatningsopgoerelse: parsedEo.data,
      stamdata: {
        skadesdato: parsedStamdata.data.skadesdato,
        skadestype: parsedStamdata.data.skadestype,
      },
    });
    const tafNetto = computeTafNettoBeregning(parsedEo.data, parsedStamdata.data, {
      tafRanges,
      clampTafRows: false,
    });
    const oevrigeKrav = buildOevrigeKravModel(parsedEo.data.oevrigeKravPerioder ?? []);
    const totals = buildEoComputedTotals({
      svieSmerte,
      tafNetto,
      oevrige: oevrigeKrav,
      forligFactor,
    });
    const presentation = buildEoPdfPresentation(parsedStamdata.data, parsedEo.data, { dagsDatoISO });
    const tafPerYearOutcome = buildTafPerYearBuildOutcome(
      buildTafPerYearSourceFromComputed({
        tafNetto,
        tabtArbejdsfortjenesteOre: totals.tabtArbejdsfortjenesteOre,
        forligFactor,
      }),
      parsedEo.data,
      {
      tafRanges,
      }
    );
    const canonicalOutput = buildCanonicalOutput({
      tafRanges,
      svieSmerte,
      tafNetto,
      oevrigeKrav,
      totals,
    });
    const debugSnapshot = buildDebugSnapshotForComputed({
      revision: args.revision,
      stamdata: parsedStamdata.data,
      eoValues: parsedEo.data,
      stamdataErrors,
      eoErrors,
    });

    const invariants: EoInvariant[] = [...validationInvariants];
    if (tafPerYearOutcome.kind === 'error' && tafPerYearOutcome.reason === 'afrunding_over_100') {
      invariants.push(buildTafPerYearAfrundingInvariant({
        afrundingOre: tafPerYearOutcome.afrundingOre,
        sumYearTafOre: tafPerYearOutcome.sumYearTafOre,
        samletTafKravOre: tafPerYearOutcome.samletTafKravOre,
      }));
    }
    if (tafPerYearOutcome.kind === 'not_applicable' && tafNetto.harTafPerioder) {
      invariants.push(buildTafPerYearUnavailableInvariant(tafPerYearOutcome.reason));
    }

    // This invariant is intentionally derived from the debug-table sammentælling model.
    // It cross-checks authoritative engine outputs against the committed EO debug table projection,
    // so it depends on debug infrastructure by design rather than being a pure engine-to-engine check.
    const controlMismatchMessages = collectSammentaellingControlMismatchMessages(debugSnapshot.sammentaellingRows);
    if (controlMismatchMessages.length > 0) {
      invariants.push(buildControlMismatchInvariant(controlMismatchMessages));
    }

    const data: EoSnapshotComputedData = {
      engines: {
        svieSmerte,
        tafNetto,
        tafPerYear: tafPerYearOutcome.kind === 'ok' ? tafPerYearOutcome.result : null,
        oevrigeKrav,
        forlig,
      },
      totals,
      presentation,
      canonicalOutput,
      debugSnapshot,
    };

    const status = hasAnyErrorInvariant(invariants)
      ? 'error'
      : hasAnyWarningInvariant(invariants)
        ? 'warning'
        : 'ok';

    return {
      revision: args.revision,
      status,
      invariants,
      data,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    };
  } catch (error) {
    logError('Uventet runtimefejl i EO-snapshot', {
      context: 'eoSnapshot.computeEoSnapshot',
      error: error instanceof Error ? error : new Error(String(error)),
      data: {
        revision: args.revision,
      },
    });
    return {
      revision: args.revision,
      status: 'fail_closed',
      invariants: [{
        id: 'runtime_exception',
        passed: false,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Uventet runtimefejl i EO-snapshot',
        blocksAuthoritativeComputation: true,
        blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'],
      }],
      data: null,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
      failClosedReason: 'runtime_exception',
    };
  }
};
