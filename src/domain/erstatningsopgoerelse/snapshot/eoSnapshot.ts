import { TODAY } from '../../../config/dateRanges';
import { erstatningsopgoerelseSchema, stamdataSchema, type ErstatningsopgoerelseValues, type StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { FieldErrorsForSection } from '../../../types/fieldErrors';
import { erstatningsopgoerelseValidator } from '../../../validators/erstatningsopgoerelseValidator';
import { buildEODebugSnapshot, type EODebugSnapshot } from '../../debug/eoDebugSnapshot';
import { parseForligsgrad } from '../engines/forligsgrad';
import type { MidlertidigtEetAfgoerelseGroup, MidlertidigtEetInsertSource } from '../helpers/midlertidigtEetInsertRows';
import {
  buildEoValuesWithTransientMidlertidigtEet,
  buildMidlertidigtEetSourceResult,
} from '../helpers/midlertidigtEetTransientInjection';
import { buildOevrigeKravModel, buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPresentationSectionBuilders';
import { buildEoPdfPresentation, buildErstatningsopgoerelsePdfModelFromComputed, type EoPdfPresentation } from './eoPresentationModel';
import type { MoneyOre } from './eoPresentationModel';
import type { EoModel } from '../shared/eoTypes';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from '../engines/svieSmerteEngine';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from '../engines/tafNettoBeregning';
import { buildTafPerYearBuildOutcome, buildTafPerYearSourceFromComputed, type TafPerYearResult } from '../engines/tafPerYearDerived';
import {
  buildEoCanonicalOutputFromComputed,
  buildEoComputedTotals,
  type EoCanonicalOutput,
} from './eoCanonicalOutput';
import { buildTafRanges } from '../helpers/indtaegtPerioder';
import { reportSystemIssue } from '../../../utils/systemIssueReporter';
import { asError } from '../../../utils/typeGuards';
import {
  buildControlMismatchInvariant,
  buildMidlertidigtEetSourceInvariants,
  buildTafPerYearAfrundingInvariant,
  buildTafPerYearUnavailableInvariant,
  buildValidationInvariants,
  hasAnyErrorInvariant,
  hasAnyWarningInvariant,
  hasAuthoritativeBlockingInvariant,
  type EoInvariant,
} from './eoSnapshotInvariants';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { collectSammentaellingControlMismatchMessages } from '../../debug/eoDebugSammentaelling';

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
  midlertidigtEetGroups: readonly MidlertidigtEetAfgoerelseGroup[];
  /** Færdigbygget PDF-dokumentmodel. Caches i snapshot for at undgå dobbeltkald
   *  fra eoSnapshotToEoPdfDocument og eoSnapshotToTafPerYearPdfDocument. */
  pdfModel: EoModel;
}>;

export type EoSnapshot = Readonly<{
  revision: string;
  status: 'ok' | 'warning' | 'error' | 'fail_closed';
  invariants: readonly EoInvariant[];
  data: EoSnapshotComputedData | null;
  debugSnapshot: EODebugSnapshot | null;
  input: Readonly<{
    stamdata: StamdataValues | null;
    erstatningsopgoerelse: ErstatningsopgoerelseValues | null;
  }>;
  failClosedReason?: 'schema_guard' | 'invariant_guard' | 'runtime_exception';
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
  // Den nuværende snapshot-kontrakt materialiserer kun `data` for ikke-fail-closed beregnede snapshots.
  // Denne guard narrower bevidst på data/input-tilstedeværelse i stedet for `status`, fordi projektioner
  // afhænger af det beregnede payload frem for en bestemt status-streng.
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
  tafRanges?: readonly IsoRange[];
  svieSmerteEngine?: SvieSmerteEngineOutput;
  canonicalOutput?: EoCanonicalOutput;
  sfggResult?: TafNettoBeregningResult['sygeferiegodtgoerelse'];
}>): EODebugSnapshot => {
  return buildEODebugSnapshot({
    revision: args.revision,
    stamdataValues: args.stamdata,
    eoValues: args.eoValues,
    stamdataErrors: args.stamdataErrors,
    eoErrors: args.eoErrors,
    tafRanges: args.tafRanges,
    svieSmerteEngine: args.svieSmerteEngine,
    canonicalOutput: args.canonicalOutput,
    sfggResult: args.sfggResult,
  });
};

const isAngivetLoenHiddenStateInvalid = (
  values: ErstatningsopgoerelseValues
): boolean => {
  return (
    (values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn') &&
    values.eoAngivetLoenLoenudvikling.loenPaaHelligdage === undefined
  );
};

const resolveTafSlutdato = (tafRanges: readonly IsoRange[]): ISODateString | undefined =>
  tafRanges.reduce<ISODateString | undefined>(
    (latest, range) => (latest && latest > range.til ? latest : range.til),
    undefined
  );

export const computeEoSnapshot = (args: Readonly<{
  revision: string;
  stamdataValues: unknown;
  eoValues: unknown;
  dagsDatoISO?: ISODateString;
  stamdataErrors?: FieldErrorsForSection<'stamdata'>;
  eoErrors?: FieldErrorsForSection<'erstatningsopgoerelse'>;
  /**
   * Optional EET-import-source. Bruges udelukkende, når toggle
   * `midlertidigtEetFraEetSiden === 'Ja'`, til at injicere virtuelle midlertidigt
   * EET-rækker transient i beregningen. Rækkerne persisteres aldrig — input
   * (`snapshot.input.erstatningsopgoerelse`) bevarer den oprindelige committed
   * form-state. Se `domain-boundary-contract.md` §9 og `eo-snapshot-contract.md`.
   */
  midlertidigtEetInsertSource?: MidlertidigtEetInsertSource;
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
        severity: 'error' as const,
        source: 'system' as const,
        message,
        blocksAuthoritativeComputation: true,
        blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'] as const,
      })),
      data: null,
      debugSnapshot: null,
      input: {
        stamdata: parsedStamdata.success ? parsedStamdata.data : null,
        erstatningsopgoerelse: parsedEo.success ? parsedEo.data : null,
      },
      failClosedReason: 'schema_guard',
    };
  }

  // Transient EET-injection: når togglen er 'Ja', erstattes offentligeYdelserRows med en
  // effektiv version, hvor manuelle midlertidigt_eet-rækker er filtreret væk og virtuelle
  // rækker fra EET-siden er tilføjet. Original committed input bevares uændret i
  // snapshot.input.erstatningsopgoerelse — kontraktundtagelsen i domain-boundary-contract.md §9
  // dækker den read-only kobling.
  const tafSlutdatoForMidlertidigtEetImport = parsedEo.data.midlertidigtEetFraEetSiden === 'Ja'
    ? resolveTafSlutdato(buildTafRanges(parsedEo.data, { skadedatoISO: parsedStamdata.data.skadedato }))
    : undefined;
  const midlertidigtEetSourceResult = parsedEo.data.midlertidigtEetFraEetSiden === 'Ja'
    ? buildMidlertidigtEetSourceResult(args.midlertidigtEetInsertSource, {
      loebendeYdelserSlutdatoOverride: tafSlutdatoForMidlertidigtEetImport,
    })
    : { groups: [], issues: [] };
  const midlertidigtEetGroups = midlertidigtEetSourceResult.groups;
  const midlertidigtEetSourceInvariants = buildMidlertidigtEetSourceInvariants(midlertidigtEetSourceResult.issues);
  const effectiveEoValues = buildEoValuesWithTransientMidlertidigtEet(parsedEo.data, midlertidigtEetGroups);

  if (isAngivetLoenHiddenStateInvalid(parsedEo.data)) {
    reportSystemIssue({
      code: 'eo_snapshot:hidden_angivet_loen_state_invalid',
      area: 'eo',
      context: 'eoSnapshot.computeEoSnapshot',
      userMessage: 'EO-snapshot afvist pga. intern datainkonsistens i angivet løn',
      revision: args.revision,
      diagnostics: {
        revision: args.revision,
        beregnesUdFra: parsedEo.data.beregnesUdFra,
      },
    });
    return {
      revision: args.revision,
      status: 'fail_closed',
      invariants: [{
        id: 'invariant_guard:eo_angivet_loen_loen_paa_helligdage',
        passed: false,
        severity: 'error' as const,
        source: 'system' as const,
        message: 'EO-beregningen kan ikke gennemføres på grund af en intern datafejl i angivet løn. Genindlæs sagen eller vælg beregningsgrundlaget igen.',
        blocksAuthoritativeComputation: true,
        blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'] as const,
      }],
      data: null,
      debugSnapshot: null,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
      failClosedReason: 'invariant_guard',
    };
  }

  const validationResult = erstatningsopgoerelseValidator.validateParsed(parsedEo.data, {
    skadedatoISO: parsedStamdata.data.skadedato,
  });
  const validationInvariants = [
    ...buildValidationInvariants(validationResult.errors),
    ...midlertidigtEetSourceInvariants,
  ];
  if (hasAuthoritativeBlockingInvariant(validationInvariants)) {
    // Validerings-fejl-sti: autoritative totaler/PDF'er må ikke bygges.
    // Debug-snapshotten må dog stadig vise sektions-uafhængige engine-data, når de kan beregnes sikkert.
    // Vi beregner derfor svie/smerte-engine separat her, fordi den ikke afhænger af løn/TAF-validering.
    // TAF-ranges bygges fra de rækker der stadig kan parses, så debug kan vise den samme clamping
    // for gyldige rækker selv om andre TAF-rækker blokerer den autoritative beregning. Hvis alle
    // rækker er ugyldige eller clampes bort, er [] den forventede fail-closed debug-basis.
    const svieSmerteForDebug = computeSvieSmerteEngine({
      erstatningsopgoerelse: effectiveEoValues,
      stamdata: {
        skadedato: parsedStamdata.data.skadedato,
        skadestype: parsedStamdata.data.skadestype,
      },
    });
    const tafRangesForDebug = buildTafRanges(effectiveEoValues, { skadedatoISO: parsedStamdata.data.skadedato });
    const debugSnapshotForValidationError = buildDebugSnapshotForComputed({
      revision: args.revision,
      stamdata: parsedStamdata.data,
      eoValues: effectiveEoValues,
      stamdataErrors,
      eoErrors,
      tafRanges: tafRangesForDebug,
      svieSmerteEngine: svieSmerteForDebug,
    });
    return {
      revision: args.revision,
      status: 'error',
      invariants: validationInvariants,
      data: null,
      debugSnapshot: debugSnapshotForValidationError,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    };
  }

  // debugSnapshot deklareres her så catch-blokken har adgang til den,
  // selv hvis en fejl opstår efter at den er bygget inde i try-blokken.
  let debugSnapshot: EODebugSnapshot | null = null;

  try {
    const tafRanges = buildTafRanges(effectiveEoValues, { skadedatoISO: parsedStamdata.data.skadedato });
    const forlig = parseForligsgrad(effectiveEoValues);
    const forligFactor = forlig?.factor ?? null;
    const svieSmerte = computeSvieSmerteEngine({
      erstatningsopgoerelse: effectiveEoValues,
      stamdata: {
        skadedato: parsedStamdata.data.skadedato,
        skadestype: parsedStamdata.data.skadestype,
      },
    });
    const tafNetto = computeTafNettoBeregning(effectiveEoValues, parsedStamdata.data, {
      tafRanges,
    });
    const oevrigeKrav = buildOevrigeKravModel(effectiveEoValues.oevrigeKravPerioder ?? []);
    const totals = buildEoComputedTotals({
      svieSmerte,
      tafNetto,
      oevrige: oevrigeKrav,
      forligFactor,
    });
    const presentation = buildEoPdfPresentation(parsedStamdata.data, effectiveEoValues, { dagsDatoISO });
    const tafPerYearOutcome = buildTafPerYearBuildOutcome(
      buildTafPerYearSourceFromComputed({
        stamdataValues: parsedStamdata.data,
        tafNetto,
        tabtArbejdsfortjenesteOre: totals.tabtArbejdsfortjenesteOre,
        forligFactor,
      }),
      effectiveEoValues,
      { tafRanges }
    );
    const canonicalOutput = buildCanonicalOutput({
      tafRanges,
      svieSmerte,
      tafNetto,
      oevrigeKrav,
      totals,
    });
    debugSnapshot = buildDebugSnapshotForComputed({
      revision: args.revision,
      stamdata: parsedStamdata.data,
      eoValues: effectiveEoValues,
      stamdataErrors,
      eoErrors,
      tafRanges,
      svieSmerteEngine: svieSmerte,
      canonicalOutput,
      sfggResult: tafNetto.sygeferiegodtgoerelse,
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

    // Denne invariant er bevidst udledt af debug-tabellens sammentælling-model.
    // Den krydstjekker autoritative engine-outputs mod den committede EO-debug-tabel-projektion,
    // så den afhænger af debug-infrastruktur efter design frem for at være et rent engine-til-engine-check.
    // Invariant: debugSnapshot er altid non-null her, da den sættes tidligt i try-blokken inden engine-kald.
    if (!debugSnapshot) throw new Error('debugSnapshot mangler ved kontrol-mismatch-check — invariant brudt');
    const controlMismatchMessages = collectSammentaellingControlMismatchMessages(debugSnapshot.sammentaellingRows);
    if (controlMismatchMessages.length > 0) {
      invariants.push(buildControlMismatchInvariant(controlMismatchMessages));
    }

    const forligForPdf = forlig
      ? { erIndgaaet: true, label: forlig.label, dato: effectiveEoValues.forligDato ?? null, factor: forlig.factor } as const
      : { erIndgaaet: false, label: null, dato: null, factor: null } as const;
    const pdfModel = buildErstatningsopgoerelsePdfModelFromComputed({
      presentation,
      svieSmerte: buildSvieSmerteModel(effectiveEoValues, { engine: svieSmerte }),
      tabtArbejdsfortjeneste: buildTabtArbejdsfortjenesteModel(effectiveEoValues, {
        tafNetto,
        tafRanges: canonicalOutput.periodiseringer.tafPerioder,
        skadedatoISO: parsedStamdata.data.skadedato,
      }),
      oevrigeKrav,
      forlig: forligForPdf,
      tafRanges: canonicalOutput.periodiseringer.tafPerioder,
      totals,
    });
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
      midlertidigtEetGroups,
      pdfModel,
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
      debugSnapshot,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    };
  } catch (error) {
    const normalizedError = asError(error);
    reportSystemIssue({
      code: 'eo_snapshot:runtime_exception',
      area: 'eo',
      context: 'eoSnapshot.computeEoSnapshot',
      userMessage: 'Uventet runtimefejl i EO-snapshot',
      revision: args.revision,
      error: normalizedError,
      diagnostics: {
        errorName: normalizedError.name,
        debugSnapshotAvailable: debugSnapshot !== null,
      },
    });
    return {
      revision: args.revision,
      status: 'fail_closed',
      invariants: [{
        id: 'runtime_exception',
        passed: false,
        severity: 'error' as const,
        source: 'system' as const,
        message: 'EO-beregningen kan ikke gennemføres på grund af en intern beregningsfejl.',
        evidence: [normalizedError.message],
        blocksAuthoritativeComputation: true,
        blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'] as const,
      }],
      data: null,
      debugSnapshot,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
      failClosedReason: 'runtime_exception',
    };
  }
};
