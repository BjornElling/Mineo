import { getToday } from '../../../config/dateRanges';
import { erstatningsopgoerelseSchema, stamdataSchema, type ErstatningsopgoerelseValues, type StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { erstatningsopgoerelseValidator } from '../../../validators/erstatningsopgoerelseValidator';
import { parseForligsgrad } from '../engines/forligsgrad';
import type { MidlertidigtEetAfgoerelseGroup } from '../helpers/midlertidigtEetInsertRows';
import type { EetImportContext } from '../../erhvervsevnetab/eetImportPort';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import {
  buildEoValuesWithTransientMidlertidigtEet,
  buildMidlertidigtEetSourceResult,
  resolveMidlertidigtEetIngenYdelserIssue,
  resolveMidlertidigtEetUdenAfgoerelseIssue,
} from '../helpers/midlertidigtEetTransientInjection';
import { neutralizeIrrelevantEoInputs } from '../helpers/eoInputRelevance';
import { buildOevrigeKravModel, buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPresentationSectionBuilders';
import { buildEoPdfPresentation, buildErstatningsopgoerelsePdfModelFromComputed, type EoPdfPresentation } from './eoPresentationModel';
import { zeroMoneyOre, type MoneyOre } from '../../money/money';
import type { EoModel } from '../shared/eoTypes';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from '../engines/svieSmerteEngine';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from '../engines/tafNettoBeregning';
import type { TafCalculationValues, TafCalculationStamdata } from '../engines/tafCalculationInput';
import { findSfggSixMonthWarningEmploymentIds } from '../engines/sfggWarnings';
import { buildTafPerYearBuildOutcome, buildTafPerYearSourceFromComputed, type TafPerYearResult } from '../engines/tafPerYearDerived';
import { buildTafPerYearOpreguleretBuildOutcome, type TafPerYearOpreguleretResult } from '../engines/tafPerYearOpreguleretDerived';
import {
  buildEoCanonicalOutputFromComputed,
  buildEoComputedTotals,
  type EoCanonicalOutput,
} from './eoCanonicalOutput';
import { buildTafRanges } from '../helpers/indtaegtPerioder';
import { reportSystemIssue } from '../../../utils/systemIssueReporter';
import { asError } from '../../../utils/typeGuards';
import {
  buildMidlertidigtEetSourceInvariants,
  buildTafPerYearAfrundingInvariant,
  buildTafPerYearOpreguleretManglendeReguleringssatsInvariant,
  buildTafPerYearUnavailableInvariant,
  buildStructuralFieldIssueInvariants,
  buildValidationInvariants,
  suppressMaskedMissingInvariants,
  hasAnyErrorInvariant,
  hasAnyWarningInvariant,
  hasAuthoritativeBlockingInvariant,
  type EoInvariant,
} from './eoSnapshotInvariants';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { buildEoDagsgrundlag, type EoDagsgrundlag } from './eoDagsgrundlagCsv';
import { resolveStamdataDateOrder } from '../../stamdata/stamdataDateOrder';
import { type FieldIssue } from '../../../inputCore/inputIssue';
import { isPeriodOverlapIssue } from '../periodOverlapIssues';
import {
  EMPTY_EO_DEPENDENCY_PROJECTION,
  resolveEoBlockedDependencies,
  type EoBlockedDependencies,
  type EoDependencyProjection,
} from './eoDependencyProjection';

export type EoSnapshotComputedData = Readonly<{
  /** Samme effektive input som TAF-motoren, inklusive satsprojektion og transient EET-import.
   * Grafens periodiserede indtægtsniveau må ikke genopbygges fra det oprindelige gemmeinput. */
  tafCalculationInput: Readonly<{
    values: TafCalculationValues;
    stamdata: TafCalculationStamdata;
  }>;
  engines: Readonly<{
    svieSmerte: SvieSmerteEngineOutput;
    tafNetto: TafNettoBeregningResult;
    tafPerYear: TafPerYearResult | null;
    tafPerYearOpreguleret: TafPerYearOpreguleretResult | null;
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
  /** Id'er på de ansættelsesforhold, hvor sygeferiegodtgørelsen løber mere end 6
   *  måneder efter sidste indkomst. Beregnet her som eneste kilde (fra den autoritative
   *  SFGG-result), så UI'et kun skal surface listen – ikke genberegne SFGG. */
  sfggSixMonthWarningEmploymentIds: readonly string[];
  /** Færdigbygget PDF-dokumentmodel. Caches i snapshot for at undgå dobbeltkald
   *  fra eoSnapshotToEoDocument og eoSnapshotToTafPerYearDocument. */
  pdfModel: EoModel;
}>;

/** Resultater for de beregningsgrene, hvis egne afhængigheder er gyldige. */
export type EoReadyBranches = Readonly<{
  svieSmerte: SvieSmerteEngineOutput | undefined;
  /** TAF-periodiseringen, når TAF-grenens egne felter er grønne. Læses af `eoSnapshotToBeregningView`. */
  tafPerioder: readonly IsoRange[] | undefined;
}>;

export type EoSnapshot = Readonly<{
  revision: string;
  status: 'ok' | 'warning' | 'error' | 'fail_closed';
  invariants: readonly EoInvariant[];
  data: EoSnapshotComputedData | null;
  /**
   * Hvilke af EO's uafhængige grene er blokeret af deres EGNE røde afhængigheder (§1.10)?
   *
   * Gør blokeringen dependency-specifik og aflæselig i stedet for at reducere alt til `data === null`:
   * en consumer kan se, at fx S/S er blokeret, mens TAF stadig er gyldig. `undefined` på fail-closed-stierne,
   * hvor input ikke engang kunne parses, og der derfor ikke findes grene at udtale sig om.
   */
  blockedDependencies?: EoBlockedDependencies;
  /**
   * De UAFHÆNGIGE grenes resultater, som stadig kunne beregnes sikkert, selv om aggregatet er blokeret.
   *
   * Findes KUN på den blokerede sti; på den grønne sti er `data` autoritativ og bærer alt. Formålet er
   * den bevidste regel, at et rødt svie/smerte-felt ikke må fjerne den GYLDIGE TAF-periodisering fra
   * Beregning-fanen. `data` er `null` her,.
   *
   * ⚠️ Grenene er IKKE autoritative: de indgår ikke i nogen sum, intet `canonicalOutput` og ingen PDF.
   * Det krydsgående aggregat forbliver alt-eller-intet (`data: null`), fordi en samlet total eller et
   * fuldt dokument ikke kan være autoritativt uden alle led.
   */
  readyBranches?: EoReadyBranches;
  dagsgrundlag?: EoDagsgrundlag;
  input: Readonly<{
    stamdata: StamdataValues | null;
    erstatningsopgoerelse: ErstatningsopgoerelseValues | null;
  }>;
  failClosedReason?: 'schema_guard' | 'invariant_guard' | 'runtime_exception';
}>;

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
  totals: EoSnapshotComputedData['totals'];
}>): EoCanonicalOutput => {
  return buildEoCanonicalOutputFromComputed({
    tafRanges: args.tafRanges,
    svieSmerte: args.svieSmerte,
    tafNetto: args.tafNetto,
    totals: args.totals,
  });
};

/**
 * TAF-perioder med røde datofelter må ikke udvide den viste periodisering. Kun overlapissues bevarer rækken:
 * datoerne er læsbare, og den samlede periodisering kan vise deres forenede interval. Bounds, cutoff og
 * datoorden gør derimod rækken ugyldig som beregningsgrundlag.
 */
const getTafRowsWithUnsafeDateIssues = (issues: readonly FieldIssue[]): ReadonlySet<string> => {
  const rowIds = new Set<string>();
  for (const issue of issues) {
    const address = issue.field.address;
    if (
      address.section !== 'erstatningsopgoerelse'
      || (address.field !== 'fra' && address.field !== 'til')
      || isPeriodOverlapIssue(issue)
    ) {
      continue;
    }
    const row = address.path.find((segment) => segment.kind === 'entity' && segment.collection === 'tafPerioder');
    if (row?.kind === 'entity') rowIds.add(row.entityId);
  }
  return rowIds;
};

const buildSafeTafRangesForBeregningsvisning = (
  values: TafCalculationValues,
  skadedatoISO: ISODateString | undefined,
  issues: readonly FieldIssue[]
): readonly IsoRange[] => {
  const invalidRowIds = getTafRowsWithUnsafeDateIssues(issues);
  const safeValues: TafCalculationValues = {
    ...values,
    tafPerioder: (values.tafPerioder ?? []).filter((row) => !invalidRowIds.has(row.id)),
  };
  return buildTafRanges(safeValues, { skadedatoISO });
};

/**
 * Neutraliserer S/S-outputtets EFTER-FORLIG-felter, når forligsgrenen er blokeret.
 *
 * `computeSvieSmerteEngine` læser selv forligsgraden (`svieSmerteEngine.ts:234`) og skalerer dagssats,
 * maksimum og total med faktoren (`:251-254`). En rød forligsprocent maskeres af readeren til `undefined`
 * og ville derfor blive regnet som "intet forlig", dvs. 100 % – et falsk tal bag en rød feltmarkering.
 *
 * Grundlaget består: det er en bevidst regel, at "før-forlig-resultater består" (eo-snapshot-contract.md).
 * Vi nulstiller derfor KUN de skalerede felter og lader `satserPerDagFoerForligOre`/`satserMaxFoerForligOre`,
 * dagene og de indtastede beløb stå. `totalOre` er skaleret og bliver `null`-ækvivalenten nul, fordi typen
 * ikke er nullable – consumeren læser `forligFactor === null` sammen med `blockedDependencies.forlig`.
 *
 * ⚠️ Motorens egen operationsrækkefølge er UÆNDRET (§5.4): vi rører ikke beregningen, kun hvilke af dens
 * allerede beregnede felter der eksponeres. Der beregnes intet nyt her.
 */
const withForligGate = (
  output: SvieSmerteEngineOutput,
  forligBlocked: boolean
): SvieSmerteEngineOutput => forligBlocked
  ? Object.freeze({
    ...output,
    satserPerDagOre: null,
    satserMaxOre: null,
    forligLabel: null,
    forligSatserSuffix: null,
    forligFactor: null,
    totalOre: zeroMoneyOre(),
    maxApplied: false,
    // Loftet er skaleret af forligsgraden og derfor ukendt, når forliget er blokeret. Så kan vi
    // heller ikke påstå, at maksimum var opbrugt – papiret ville ellers skrive en konklusion om en
    // ramme, ingen kender.
    maksimumOpbrugtFoerPerioden: false,
    maksimumNaaet: false,
  })
  : output;

/**
 * Den kontrollerede fail-closed-tilstand for en uventet undtagelse et sted i EO-afledningen: fejlen indberettes,
 * og siden viser «intern beregningsfejl» med alle outputs blokeret i stedet for at vælte. Delt af selve
 * snapshot-beregningen og reader-projektionens feltissue-led, som kører før den.
 */
export const buildEoRuntimeExceptionSnapshot = (args: Readonly<{
  revision: string;
  error: unknown;
  context: string;
  input: EoSnapshot['input'];
}>): EoSnapshot => {
  const normalizedError = asError(args.error);
  reportSystemIssue({
    code: 'eo_snapshot:runtime_exception',
    area: 'eo',
    context: args.context,
    userMessage: 'Uventet runtimefejl i EO-snapshot',
    revision: args.revision,
    error: normalizedError,
    diagnostics: {
      errorName: normalizedError.name,
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
      blocksOutputs: ['beregning', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'] as const,
    }],
    data: null,
    input: args.input,
    failClosedReason: 'runtime_exception',
  };
};

export const computeEoSnapshot = (args: Readonly<{
  revision: string;
  stamdataValues: unknown;
  eoValues: unknown;
  dagsDatoISO?: ISODateString;
  /** Issues opsamlet af de konkrete typed inputprojektioner for hver beregningsgren. */
  dependencyProjection?: EoDependencyProjection;
  /**
   * Optional EET-import-source. Bruges udelukkende, når toggle
   * `midlertidigtEetFraEetSiden === 'Ja'`, til at injicere virtuelle midlertidigt
   * EET-rækker transient i beregningen. Rækkerne persisteres aldrig – input
   * (`snapshot.input.erstatningsopgoerelse`) bevarer den oprindelige committed
   * form-state. Se `domain-boundary-contract.md` §9 og `eo-snapshot-contract.md`.
   */
  midlertidigtEetImportContext?: EetImportContext;
  /**
   * Gule advarsler om TAF efter kapitaliseringen af en delvist endelig EET-afgørelse, dannet af
   * `resolveTafEfterKapitaliseringAdvarsler` i reader-projektionen. Uafhængige af togglen ovenfor og uden
   * virkning på beregningen; se `domain-boundary-contract.md` §9 pkt. 11.
   */
  tafEfterKapitaliseringIssues?: readonly EetIssue[];
  /**
   * Gule advarsler om datoer for EET-afgørelserne på EO oplysninger, der ikke genfindes på Erhvervsevnetab-siden,
   * dannet af `resolveEetAfgoerelseDatoAdvarsler` i reader-projektionen. Kun mens togglen er «Ja» og uden virkning
   * på beregningen; se `domain-boundary-contract.md` §9 pkt. 12.
   */
  eetAfgoerelseDatoIssues?: readonly EetIssue[];
}>): EoSnapshot => {
  const dagsDatoISO = args.dagsDatoISO ?? getToday();
  const dependencyProjection = args.dependencyProjection ?? EMPTY_EO_DEPENDENCY_PROJECTION;
  const blockedDependencies = resolveEoBlockedDependencies(dependencyProjection);
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
        blocksOutputs: ['beregning', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'] as const,
      })),
      data: null,
      input: {
        stamdata: parsedStamdata.success ? parsedStamdata.data : null,
        erstatningsopgoerelse: parsedEo.success ? parsedEo.data : null,
      },
      failClosedReason: 'schema_guard',
    };
  }

  try {
    // Transient EET-injection: når togglen er 'Ja', erstattes offentligeYdelserRows med en
    // effektiv version, hvor manuelle midlertidigt_eet-rækker er filtreret væk og virtuelle
    // rækker fra EET-siden er tilføjet. Original committed input bevares uændret i
    // snapshot.input.erstatningsopgoerelse – kontraktundtagelsen i domain-boundary-contract.md §9
    // dækker den read-only kobling.
    const midlertidigtEetSourceResult = parsedEo.data.midlertidigtEetFraEetSiden === 'Ja'
      ? buildMidlertidigtEetSourceResult(args.midlertidigtEetImportContext)
      : { groups: [], issues: [] };
    const midlertidigtEetGroups = midlertidigtEetSourceResult.groups;
    // Samme TAF-perioder, som importens slutdato udledes af (`erstatningsopgoerelseReaderProjection`).
    const midlertidigtEetIngenYdelserIssue = resolveMidlertidigtEetIngenYdelserIssue({
      values: parsedEo.data,
      tafRanges: buildTafRanges(parsedEo.data, { skadedatoISO: parsedStamdata.data.skadedato }),
      result: midlertidigtEetSourceResult,
    });
    const midlertidigtEetUdenAfgoerelseIssue = resolveMidlertidigtEetUdenAfgoerelseIssue({
      values: parsedEo.data,
      result: midlertidigtEetSourceResult,
    });
    const midlertidigtEetSourceInvariants = buildMidlertidigtEetSourceInvariants([
      ...midlertidigtEetSourceResult.issues,
      ...(midlertidigtEetIngenYdelserIssue === undefined ? [] : [midlertidigtEetIngenYdelserIssue]),
      ...(midlertidigtEetUdenAfgoerelseIssue === undefined ? [] : [midlertidigtEetUdenAfgoerelseIssue]),
      // Samme EET-kanal som importens linjer, men aldrig blokerende: kun `warning` slipper igennem, så en fejl her
      // ikke kan blive en ny spærring, ingen har godkendt.
      ...(args.tafEfterKapitaliseringIssues ?? []).filter((issue) => issue.severity === 'warning'),
      ...(parsedEo.data.midlertidigtEetFraEetSiden === 'Ja' ? args.eetAfgoerelseDatoIssues ?? [] : [])
        .filter((issue) => issue.severity === 'warning'),
    ]);
    // Neutralisér irrelevante (skjulte) input, så ingen motor kan se en forældet skjult værdi.
    // Den transiente midlertidigt-EET-injection sker først; neutraliseringen rører ikke
    // offentligeYdelserRows. Se eoInputRelevance.ts for relevans-reglerne og den bevidste
    // komprimerings-undtagelse. Committed input bevares uændret i snapshot.input.
    const effectiveEoValues = neutralizeIrrelevantEoInputs(
      buildEoValuesWithTransientMidlertidigtEet(parsedEo.data, midlertidigtEetGroups)
    );
    const projectedForligInput = dependencyProjection.forligInput ?? effectiveEoValues;
    const projectedSvieSmerteInput = dependencyProjection.svieSmerteInput === undefined
      ? {
        erstatningsopgoerelse: effectiveEoValues,
        stamdata: {
          skadedato: parsedStamdata.data.skadedato,
          skadestype: parsedStamdata.data.skadestype,
        },
      }
      : {
        ...dependencyProjection.svieSmerteInput,
        erstatningsopgoerelse: {
          ...dependencyProjection.svieSmerteInput.erstatningsopgoerelse,
          ...projectedForligInput,
        },
      };
    const projectedTafValuesWithTransient = dependencyProjection.tafInput === undefined
      ? effectiveEoValues
      : buildEoValuesWithTransientMidlertidigtEet(
        dependencyProjection.tafInput.values,
        midlertidigtEetGroups
      );
    const projectedTafValues = projectedTafValuesWithTransient.kravPaaTabtArbejdsfortjeneste === 'Ja'
      ? projectedTafValuesWithTransient
      : {
        ...projectedTafValuesWithTransient,
        tafPerioder: [],
        ferieperioder: [],
        tidligereModtagetTaf: undefined,
      };
    const projectedTafStamdata = dependencyProjection.tafInput?.stamdata ?? parsedStamdata.data;
    const projectedOevrigeKravValues = dependencyProjection.oevrigeKravInput ?? effectiveEoValues;

    // Her stod tidligere en `invariant_guard` for `eoAngivetLoenLoenudvikling.loenPaaHelligdage === undefined`
    // (systemfejl `eo_snapshot:hidden_angivet_loen_state_invalid`). Den er fjernet, fordi tilstanden ikke
    // længere kan repræsenteres: feltet er required-with-default i BÅDE schemaet og descriptoren, så hverken
    // en nyoprettet sektion, en ældre `.eo` eller readerens tomværdi kan give `undefined` –
    // gaten var ikke et værn mod en umulig tilstand, men den eneste udgang fra den tilstand, en HELT NY sag
    // altid startede i. Genindfør den ikke; genindfør i stedet ikke den valgfrihed, den vogtede over.

    const validationResult = erstatningsopgoerelseValidator.validateParsed(parsedEo.data, {
      skadedatoISO: parsedStamdata.data.skadedato,
      skadestype: parsedStamdata.data.skadestype,
      stamdataContext: {
        skadedato: parsedStamdata.data.skadedato,
        skadestype: parsedStamdata.data.skadestype,
      },
    });
    const stamdataDateOrderErrors = resolveStamdataDateOrder(parsedStamdata.data).issues.map((issue) => ({
      path: `stamdata.${issue.field}`,
      message: issue.message,
      severity: 'error' as const,
    }));
    const validationInvariants = [
      // Readerens maskering gør en rødmarkeret værdi `undefined` for legacy-validatoren, som da melder feltet
      // TOMT oveni den ægte feltfejl. Undertrykkelsen fjerner netop den usande halvdel; se
      // `suppressMaskedMissingInvariants`.
      ...suppressMaskedMissingInvariants(
        buildValidationInvariants(validationResult.errors),
        dependencyProjection.aggregateIssues,
        parsedEo.data
      ),
      ...buildValidationInvariants(stamdataDateOrderErrors),
      ...midlertidigtEetSourceInvariants,
      // F2: readerens røde feltfejl er BLOKERENDE afhængigheder, ikke kun inspektionsdata. Uden dem ville
      // motorerne nedenfor køre på readerens maskerede tomværdier og producere falske tal (fx en forligsprocent
      // på 150 regnet som 100 %).
      //
      // EO-sektionen går gennem de STRUKTURELLE issues (problemet): `eoErrors` er en præsentations-projektion med
      // kun 11 top-level feltnavne, så en rød RÆKKECELLE ville hverken blokere beregningen eller sin egen gren.
      ...buildStructuralFieldIssueInvariants(dependencyProjection.aggregateIssues),
    ];
    const computeTaf = (tafRanges: readonly IsoRange[]) => computeTafNettoBeregning(
      projectedTafValues,
      { ...parsedStamdata.data, ...projectedTafStamdata },
      { tafRanges, midlertidigtEetGroups, medDagsgrundlag: true },
    );
    if (hasAuthoritativeBlockingInvariant(validationInvariants)) {
      const svieSmerteForBeregningsvisning = blockedDependencies.svieSmerte
        ? undefined
        : withForligGate(
          computeSvieSmerteEngine(projectedSvieSmerteInput),
          blockedDependencies.forlig
        );
      const tafRangesForBeregningsvisning = buildSafeTafRangesForBeregningsvisning(
        projectedTafValues,
        projectedTafStamdata.skadedato,
        dependencyProjection.tafIssues,
      );
      // Kun fejl med et kendt uafhængigt tilhørsforhold må give en delvis CSV-eksport.
      // Også valideringsfejl uden et rødt felt kan spærre TAF, fx en negativ samlet indtægtskilde.
      const blocking = validationInvariants.filter((invariant) => invariant.blocksAuthoritativeComputation);
      const safeTaf = !blockedDependencies.taf && blocking.every(
        (invariant) => /^(?:eo\.)?(?:svieSmerte|oevrigeKrav)/.test(invariant.evidence?.[0] ?? ''),
      );
      const safeSvieSmerte = !blockedDependencies.svieSmerte && blocking.every(
        (invariant) => /^(?:eo\.)?(?:taf|loenindkomst|offentligeYdelser|sfgg|oevrigeKrav)/.test(
          invariant.evidence?.[0] ?? '',
        ),
      );
      const dagsgrundlag = buildEoDagsgrundlag({
        values: projectedTafValues,
        skadedato: projectedTafStamdata.skadedato,
        tafRanges: safeTaf ? tafRangesForBeregningsvisning : [],
        tafNetto: safeTaf && tafRangesForBeregningsvisning.length ? computeTaf(tafRangesForBeregningsvisning) : undefined,
        svieSmertePeriods: safeSvieSmerte ? svieSmerteForBeregningsvisning?.constrainedPeriods : undefined,
        partial: true,
      });
      return {
        revision: args.revision,
        status: 'error',
        invariants: validationInvariants,
        // Det AUTORITATIVE aggregat (samlet total + canonicalOutput + pdfModel) forbliver `null`: en sum eller
        // et fuldt dokument kan ikke være autoritativt, når bare ét led er blokeret.
        data: null,
        blockedDependencies,
        readyBranches: Object.freeze({
          svieSmerte: svieSmerteForBeregningsvisning,
          tafPerioder: blockedDependencies.taf ? undefined : tafRangesForBeregningsvisning,
        }),
        dagsgrundlag,
        input: {
          stamdata: parsedStamdata.data,
          erstatningsopgoerelse: parsedEo.data,
        },
      };
    }

    const tafRanges = buildTafRanges(projectedTafValues, { skadedatoISO: projectedTafStamdata.skadedato });
    const forlig = parseForligsgrad(projectedForligInput);
    const forligFactor = forlig?.factor ?? null;
    const svieSmerte = computeSvieSmerteEngine(projectedSvieSmerteInput);
    const tafNetto = computeTaf(tafRanges);
    const oevrigeKrav = buildOevrigeKravModel(projectedOevrigeKravValues);
    const totals = buildEoComputedTotals({
      svieSmerte,
      tafNetto,
      oevrige: oevrigeKrav,
      forligFactor,
    });
    const presentation = buildEoPdfPresentation(parsedStamdata.data, effectiveEoValues, { dagsDatoISO });
    const tafPerYearOutcome = buildTafPerYearBuildOutcome(
      buildTafPerYearSourceFromComputed({
        tafNetto,
        tabtArbejdsfortjenesteOre: totals.tabtArbejdsfortjenesteOre,
        forligFactor,
      }),
      projectedTafValues,
      { tafRanges, midlertidigtEetGroups }
    );
    const tafPerYearResult = tafPerYearOutcome.kind === 'ok' ? tafPerYearOutcome.result : null;
    const tafPerYearOpreguleretOutcome = buildTafPerYearOpreguleretBuildOutcome(
      tafPerYearResult,
      presentation.brevhoved?.dagsDatoISO ?? dagsDatoISO
    );
    const canonicalOutput = buildCanonicalOutput({
      tafRanges,
      svieSmerte,
      tafNetto,
      totals,
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
    if (tafPerYearOpreguleretOutcome.kind === 'error' && tafPerYearOpreguleretOutcome.reason === 'manglende_reguleringssats') {
      invariants.push(buildTafPerYearOpreguleretManglendeReguleringssatsInvariant(tafPerYearOpreguleretOutcome.manglendeAar));
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
        skadestype: parsedStamdata.data.skadestype,
      }),
      oevrigeKrav,
      forlig: forligForPdf,
      tafRanges: canonicalOutput.periodiseringer.tafPerioder,
      totals,
    });
    const sfggSixMonthWarningEmploymentIds = findSfggSixMonthWarningEmploymentIds({
      values: effectiveEoValues,
      result: tafNetto.sygeferiegodtgoerelse,
    });
    const data: EoSnapshotComputedData = {
      tafCalculationInput: { values: projectedTafValues, stamdata: projectedTafStamdata },
      engines: {
        svieSmerte,
        tafNetto,
        tafPerYear: tafPerYearResult,
        tafPerYearOpreguleret: tafPerYearOpreguleretOutcome.kind === 'ok' ? tafPerYearOpreguleretOutcome.result : null,
        oevrigeKrav,
        forlig,
      },
      totals,
      presentation,
      canonicalOutput,
      midlertidigtEetGroups,
      sfggSixMonthWarningEmploymentIds,
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
      // Ingen gren er blokeret her: vi nåede kun hertil, fordi ingen invariant blokerede den autoritative
      // beregning. Feltet sættes eksplicit, så consumers ser samme form på begge veje.
      blockedDependencies,
      dagsgrundlag: buildEoDagsgrundlag({
        values: projectedTafValues,
        skadedato: projectedTafStamdata.skadedato,
        tafRanges,
        tafNetto,
        svieSmertePeriods: svieSmerte.constrainedPeriods,
      }),
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    };
  } catch (error) {
    return buildEoRuntimeExceptionSnapshot({
      revision: args.revision,
      error,
      context: 'eoSnapshot.computeEoSnapshot',
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    });
  }
};
