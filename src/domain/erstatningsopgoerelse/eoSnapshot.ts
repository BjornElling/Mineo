import { TODAY } from '../../config/dateRanges';
import { erstatningsopgoerelseSchema, stamdataSchema, type ErstatningsopgoerelseValues, type StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { buildEODebugSnapshot, type EODebugSnapshot } from '../debug/eoDebugSnapshot';
import { getSammentaellingControlStatus } from '../debug/eoDebugSammentaelling';
import { parseForligsgrad } from './forligsgrad';
import { buildOevrigeKravModel } from './eoPdfBuilders';
import { buildEoPdfPresentation, type EoPdfPresentation } from './eoPdfModel';
import { clampMoneyOreToZero, ensureMoneyOre, scaleMoneyOre } from './eoPdfMoneyUtils';
import type { MoneyOre } from './eoPdfModel';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from './svieSmerteEngine';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from './tafNettoBeregning';
import { buildTafPerYearBuildOutcome, buildTafPerYearSourceFromComputed, type TafPerYearResult } from './tafPerYearDerived';
import { buildEoCanonicalOutputFromComputed, type EoCanonicalOutput } from './eoCanonicalOutput';
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

const buildTotals = (args: Readonly<{
  svieSmerte: SvieSmerteEngineOutput;
  tafNetto: TafNettoBeregningResult;
  oevrigeKrav: ReturnType<typeof buildOevrigeKravModel>;
  forligFactor: number | null;
}>): EoSnapshotComputedData['totals'] => {
  const tabtArbejdsfortjenesteFoerForligOre = clampMoneyOreToZero(ensureMoneyOre(args.tafNetto.tabtArbejdsfortjenesteOre));
  const tabtArbejdsfortjenesteOre = args.forligFactor !== null
    ? clampMoneyOreToZero(scaleMoneyOre(tabtArbejdsfortjenesteFoerForligOre, args.forligFactor))
    : tabtArbejdsfortjenesteFoerForligOre;
  const oevrigeKravFoerForligOre = clampMoneyOreToZero(ensureMoneyOre(args.oevrigeKrav.totalFoerForligOre));
  const oevrigeKravOre = args.forligFactor !== null
    ? clampMoneyOreToZero(scaleMoneyOre(oevrigeKravFoerForligOre, args.forligFactor))
    : oevrigeKravFoerForligOre;
  const svieSmerteOre = clampMoneyOreToZero(ensureMoneyOre(args.svieSmerte.totalOre));
  const samletTotalOre = clampMoneyOreToZero(
    ensureMoneyOre(svieSmerteOre + tabtArbejdsfortjenesteOre + oevrigeKravOre)
  );
  const tidligereModtagetTafOre = args.tafNetto.tidligereModtagetTaf.status === 'ok'
    ? ensureMoneyOre(args.tafNetto.tidligereModtagetTaf.value)
    : ensureMoneyOre(0);

  return {
    svieSmerteOre,
    tabtArbejdsfortjenesteFoerForligOre,
    tabtArbejdsfortjenesteOre,
    oevrigeKravFoerForligOre,
    oevrigeKravOre,
    samletTotalOre,
    tidligereModtagetTafOre,
    forligFactor: args.forligFactor,
  };
};

const buildCanonicalOutput = (args: Readonly<{
  tafRanges: ReadonlyArray<{ fra: ISODateString; til: ISODateString }>;
  svieSmerte: SvieSmerteEngineOutput;
  tafNetto: TafNettoBeregningResult;
  oevrigeKrav: ReturnType<typeof buildOevrigeKravModel>;
  forligFactor: number | null;
}>): EoCanonicalOutput => {
  return buildEoCanonicalOutputFromComputed({
    tafRanges: args.tafRanges,
    svieSmerte: args.svieSmerte,
    tafNetto: args.tafNetto,
    oevrige: args.oevrigeKrav,
    forligFactor: args.forligFactor,
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
    const totals = buildTotals({
      svieSmerte,
      tafNetto,
      oevrigeKrav,
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
      forligFactor,
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

    const controlMismatchMessages = debugSnapshot.sammentaellingRows
      .filter((row) => getSammentaellingControlStatus(row.control) === 'error')
      .map((row) => `${row.label}: beregnet=${row.control.beregnetDisplay}, tabel=${row.control.tabelDisplay}`);
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
