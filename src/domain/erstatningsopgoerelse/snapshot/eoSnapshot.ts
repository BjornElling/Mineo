import { TODAY } from '../../../config/dateRanges';
import { erstatningsopgoerelseSchema, stamdataSchema, type ErstatningsopgoerelseValues, type StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { erstatningsopgoerelseValidator } from '../../../validators/erstatningsopgoerelseValidator';
import { buildEOInspektionSnapshot, type EOInspektionSnapshot } from '../../eoInspektion/eoInspektionSnapshot';
import { parseForligsgrad } from '../engines/forligsgrad';
import type { MidlertidigtEetAfgoerelseGroup } from '../helpers/midlertidigtEetInsertRows';
import type { EetImportContext } from '../../erhvervsevnetab/eetImportPort';
import {
  buildEoValuesWithTransientMidlertidigtEet,
  buildMidlertidigtEetSourceResult,
} from '../helpers/midlertidigtEetTransientInjection';
import { neutralizeIrrelevantEoInputs } from '../helpers/eoInputRelevance';
import { buildOevrigeKravModel, buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPresentationSectionBuilders';
import { buildEoPdfPresentation, buildErstatningsopgoerelsePdfModelFromComputed, type EoPdfPresentation } from './eoPresentationModel';
import { zeroMoneyOre, type MoneyOre } from '../../money/money';
import type { EoModel } from '../shared/eoTypes';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from '../engines/svieSmerteEngine';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from '../engines/tafNettoBeregning';
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
  buildControlMismatchInvariant,
  buildMidlertidigtEetSourceInvariants,
  buildTafPerYearAfrundingInvariant,
  buildTafPerYearOpreguleretManglendeReguleringssatsInvariant,
  buildTafPerYearUnavailableInvariant,
  buildReaderFieldIssueInvariants,
  buildStructuralFieldIssueInvariants,
  buildValidationInvariants,
  hasAnyErrorInvariant,
  hasAnyWarningInvariant,
  hasAuthoritativeBlockingInvariant,
  type EoInvariant,
} from './eoSnapshotInvariants';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { collectSammentaellingControlMismatchMessages } from '../control/eoControlMismatch';
import { resolveStamdataDateOrder } from '../../stamdata/stamdataDateOrder';
import { type EoInputIssues, type EoStamdataInputIssues } from '../eoInputIssues';
import { resolveEoBlockedDependencies, type EoBlockedDependencies } from './eoDependencyGroups';
import type { FieldIssue } from '../../../inputCore/inputIssue';

export type EoSnapshotComputedData = Readonly<{
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
   *  SFGG-result), så UI'et kun skal surface listen — ikke genberegne SFGG. */
  sfggSixMonthWarningEmploymentIds: readonly string[];
  /** Færdigbygget PDF-dokumentmodel. Caches i snapshot for at undgå dobbeltkald
   *  fra eoSnapshotToEoDocument og eoSnapshotToTafPerYearDocument. */
  pdfModel: EoModel;
}>;

/**
 * En uafhængig grens resultat på den blokerede sti: `undefined` betyder "grenen er blokeret af sin EGEN
 * røde afhængighed" — ikke "ingen data". Bevidst ikke en diskrimineret union: `undefined` er allerede den
 * entydige "ikke beregnet"-repræsentation gennem hele EO-snapshottet (jf. `svieSmerteEngine` i
 * `inspektionSnapshot`), og en parallel wrapper-form ville give to måder at udtrykke det samme.
 */
export type EoReadyBranches = Readonly<{
  /**
   * S/S-motorens output, når S/S-grenens egne felter er grønne.
   *
   * Samme værdi føres OGSÅ ind i `inspektionSnapshot`, som Kontrol-fanen bygger sin visning af — men den
   * eksponerer den kun gennem sin færdigbyggede model, ikke som et læsbart engine-output. Feltet her er
   * derfor den ENE typede adgang til "kunne S/S beregnes trods den blokerede sti?", og det er den, gate-
   * invarianttestene måler S2's før/efter-forlig-adskillelse på.
   */
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
   * De UAFHÆNGIGE grenes resultater, som stadig kunne beregnes sikkert, selv om aggregatet er blokeret
   * (§1.10, WI-004 runde 4, model A).
   *
   * Findes KUN på den blokerede sti; på den grønne sti er `data` autoritativ og bærer alt. Formålet er
   * brugerbeslutning 2: et rødt svie/smerte-felt må ikke fjerne den GYLDIGE TAF-periodisering fra
   * Beregning-fanen. Fanen læste tidligere udelukkende `data`, som er `null` her, så de gyldige grene
   * kunne slet ikke nå frem — de levede alene i `inspektionSnapshot`, som Beregning-fanen ikke ser.
   *
   * ⚠️ Grenene er IKKE autoritative: de indgår ikke i nogen sum, intet `canonicalOutput` og ingen PDF.
   * Det krydsgående aggregat forbliver alt-eller-intet (`data: null`), fordi en samlet total eller et
   * fuldt dokument ikke kan være autoritativt uden alle led.
   */
  readyBranches?: EoReadyBranches;
  inspektionSnapshot: EOInspektionSnapshot | null;
  input: Readonly<{
    stamdata: StamdataValues | null;
    erstatningsopgoerelse: ErstatningsopgoerelseValues | null;
  }>;
  failClosedReason?: 'schema_guard' | 'invariant_guard' | 'runtime_exception';
}>;

const EMPTY_STAMDATA_ERRORS: EoStamdataInputIssues = {};
const EMPTY_EO_ERRORS: EoInputIssues = {};
const EMPTY_FIELD_ISSUES: readonly FieldIssue[] = Object.freeze([]);

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

const buildInspektionSnapshotForComputed = (args: Readonly<{
  revision: string;
  stamdata: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  stamdataErrors: EoStamdataInputIssues;
  eoErrors: EoInputIssues;
  tafRanges?: readonly IsoRange[];
  svieSmerteEngine?: SvieSmerteEngineOutput;
  canonicalOutput?: EoCanonicalOutput;
  sfggResult?: TafNettoBeregningResult['sygeferiegodtgoerelse'];
}>): EOInspektionSnapshot => {
  return buildEOInspektionSnapshot({
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

/**
 * Neutraliserer S/S-outputtets EFTER-FORLIG-felter, når forligsgrenen er blokeret (WI-004 runde 4, S2).
 *
 * `computeSvieSmerteEngine` læser selv forligsgraden (`svieSmerteEngine.ts:234`) og skalerer dagssats,
 * maksimum og total med faktoren (`:251-254`). En rød forligsprocent maskeres af readeren til `undefined`
 * og ville derfor blive regnet som "intet forlig", dvs. 100 % — et falsk tal bag en rød feltmarkering.
 *
 * Grundlaget består: brugerbeslutning 1 (2026-07-25) kræver udtrykkeligt, at "før-forlig-resultater består".
 * Vi nulstiller derfor KUN de skalerede felter og lader `satserPerDagFoerForligOre`/`satserMaxFoerForligOre`,
 * dagene og de indtastede beløb stå. `totalOre` er skaleret og bliver `null`-ækvivalenten nul, fordi typen
 * ikke er nullable — consumeren læser `forligFactor === null` sammen med `blockedDependencies.forlig`.
 *
 * ⚠️ Motorens egen operationsrækkefølge er UÆNDRET (§5.4): vi rører ikke beregningen, kun hvilke af dens
 * allerede beregnede felter der surfaces. Der beregnes intet nyt her.
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
  })
  : output;

export const computeEoSnapshot = (args: Readonly<{
  revision: string;
  stamdataValues: unknown;
  eoValues: unknown;
  dagsDatoISO?: ISODateString;
  stamdataErrors?: EoStamdataInputIssues;
  eoErrors?: EoInputIssues;
  /**
   * De STRUKTURELLE røde feltissues fra readerens issue-snapshot — autoriteten for dependency-gatingen
   * (§1.10, WI-004 runde 4). Bevidst IKKE udledt af `eoErrors`: det map indeholder kun 11 top-level
   * feltnavne plus `${afId}:loenindkomst`-aggregatet, så en rød RÆKKE-celle (svie/smerte-periode,
   * TAF-periode, ferie-/fraværsdato) ville være usynlig for gaten og motoren ville regne på readerens
   * maskerede tomværdi. `resolveEoBlockedDependencies` matcher på adressens struktur.
   *
   * Kun EO-sektionens issues hører hertil; stamdata-issues gør snapshottet globalt blokerende gennem
   * `buildReaderFieldIssueInvariants` og har ingen egen beregningsgren.
   */
  eoFieldIssues?: readonly FieldIssue[];
  /**
   * De strukturelle røde feltissues i STAMDATA-sektionen. Nødvendige for dependency-gatingen, fordi
   * `stamdata.skadedato` er en KLIPNINGSGRÆNSE for både TAF-periodiseringen og svie/smerte-perioderne
   * (WI-004 runde 4, re-review T2). En rød skadedato må ikke give en uklampet gren i `readyBranches`.
   */
  stamdataFieldIssues?: readonly FieldIssue[];
  /**
   * Optional EET-import-source. Bruges udelukkende, når toggle
   * `midlertidigtEetFraEetSiden === 'Ja'`, til at injicere virtuelle midlertidigt
   * EET-rækker transient i beregningen. Rækkerne persisteres aldrig — input
   * (`snapshot.input.erstatningsopgoerelse`) bevarer den oprindelige committed
   * form-state. Se `domain-boundary-contract.md` §9 og `eo-snapshot-contract.md`.
   */
  midlertidigtEetImportContext?: EetImportContext;
}>): EoSnapshot => {
  const dagsDatoISO = args.dagsDatoISO ?? TODAY;
  const stamdataErrors = args.stamdataErrors ?? EMPTY_STAMDATA_ERRORS;
  const eoErrors = args.eoErrors ?? EMPTY_EO_ERRORS;
  const eoFieldIssues = args.eoFieldIssues ?? EMPTY_FIELD_ISSUES;
  const stamdataFieldIssues = args.stamdataFieldIssues ?? EMPTY_FIELD_ISSUES;
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
        blocksOutputs: ['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'] as const,
      })),
      data: null,
      inspektionSnapshot: null,
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
  const midlertidigtEetSourceResult = parsedEo.data.midlertidigtEetFraEetSiden === 'Ja'
    ? buildMidlertidigtEetSourceResult(args.midlertidigtEetImportContext)
    : { groups: [], issues: [] };
  const midlertidigtEetGroups = midlertidigtEetSourceResult.groups;
  const midlertidigtEetSourceInvariants = buildMidlertidigtEetSourceInvariants(midlertidigtEetSourceResult.issues);
  // Neutralisér irrelevante (skjulte) input, så ingen motor kan se en forældet skjult værdi.
  // Den transiente midlertidigt-EET-injection sker først; neutraliseringen rører ikke
  // offentligeYdelserRows. Se eoInputRelevance.ts for relevans-reglerne og den bevidste
  // komprimerings-undtagelse. Committed input bevares uændret i snapshot.input.
  const effectiveEoValues = neutralizeIrrelevantEoInputs(
    buildEoValuesWithTransientMidlertidigtEet(parsedEo.data, midlertidigtEetGroups)
  );

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
        blocksOutputs: ['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'] as const,
      }],
      data: null,
      inspektionSnapshot: null,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
      failClosedReason: 'invariant_guard',
    };
  }

  const validationResult = erstatningsopgoerelseValidator.validateParsed(parsedEo.data, {
    skadedatoISO: parsedStamdata.data.skadedato,
    skadestype: parsedStamdata.data.skadestype,
  });
  const stamdataDateOrderErrors = resolveStamdataDateOrder(parsedStamdata.data).issues.map((issue) => ({
    path: `stamdata.${issue.field}`,
    message: issue.message,
    severity: 'error' as const,
  }));
  const validationInvariants = [
    ...buildValidationInvariants(validationResult.errors),
    ...buildValidationInvariants(stamdataDateOrderErrors),
    ...midlertidigtEetSourceInvariants,
    // F2: readerens røde feltfejl er BLOKERENDE afhængigheder, ikke kun inspektionsdata. Uden dem ville
    // motorerne nedenfor køre på readerens maskerede tomværdier og producere falske tal (fx en forligsprocent
    // på 150 regnet som 100 %).
    //
    // EO-sektionen går gennem de STRUKTURELLE issues (fund S3): `eoErrors` er en præsentations-projektion med
    // kun 11 top-level feltnavne, så en rød RÆKKECELLE ville hverken blokere beregningen eller sin egen gren.
    ...buildStructuralFieldIssueInvariants(eoFieldIssues),
    // Stamdatas fejl-map ÉR det fulde sæt for sin sektion og har ingen egen beregningsgren.
    ...buildReaderFieldIssueInvariants(stamdataErrors, 'stamdata'),
  ];
  if (hasAuthoritativeBlockingInvariant(validationInvariants)) {
    // Validerings-fejl-sti: autoritative totaler/PDF'er må ikke bygges.
    // Kontrol-snapshotten må dog stadig vise sektions-uafhængige engine-data, når de kan beregnes sikkert.
    // Vi beregner derfor svie/smerte-engine separat her, fordi den ikke afhænger af løn/TAF-validering.
    // TAF-ranges bygges fra de rækker der stadig kan parses, så kontrollaget kan vise den samme clamping
    // for gyldige rækker selv om andre TAF-rækker blokerer den autoritative beregning. Hvis alle
    // rækker er ugyldige eller clampes bort, er [] den forventede fail-closed kontrol-basis.
    //
    // BEVIDST UDELADT (brugerbeslutning, greenfield #23-review): reguleringsforløbet vises IKKE i denne
    // fejl-tilstand. Efter #23 er det viste reguleringsforløb udelukkende den kanoniske serie fra det
    // autoritative pdfModel (ingen re-derivation) — som netop ikke bygges her. Kontrolfanen fail-closer
    // derfor reguleringsafsnittet til placeholders, indtil valideringsfejlen er løst. Dette er valgt
    // frem for at genindføre en separat serie-beregning (der ville kunne vise en tabel, som ikke svarer
    // til nogen autoritativ beregning). Genindfør IKKE et fejl-tilstands-forløb uden en ny beslutning.
    // ⚠️ F2 (R1): en motor må IKKE køre, hvis en af DENS EGNE afhængigheder er rød. Readeren maskerer en rød
    // værdi til `undefined`, så et ugatet kald her viste fx et "Beregnet svie/smerte"-beløb regnet som om
    // "tidligere udbetalt" var 0 — præcis det falske tal, brugerbeslutningen 2026-07-25 kræver erstattet af `-`.
    //
    // Gaten er DEPENDENCY-SPECIFIK (§1.10, `eoDependencyGroups.ts`): en rød TAF-afhængighed rører ikke
    // S/S-visningen, og en rød S/S-afhængighed rører ikke TAF-ranges. Kun grenens egne felter gater grenen.
    // Autoriteten er de STRUKTURELLE feltissues, ikke `eoErrors`-mappet: sidstnævnte kender kun 11
    // top-level feltnavne, så en rød rækkecelle ville være usynlig her (WI-004 runde 4, fund S3).
    const blockedDependencies = resolveEoBlockedDependencies(eoFieldIssues, stamdataFieldIssues);
    // Forligsgraden skalerer S/S-satserne (`svieSmerteEngine.ts:234-254`), så en rød forligsprocent er en
    // reel S/S-afhængighed. Den blokerer dog KUN efter-forlig-resultatet: brugerbeslutning 1 kræver, at
    // før-forlig-resultater består (WI-004 runde 4, fund S2).
    const svieSmerteForInspektion = blockedDependencies.svieSmerte
      ? undefined
      : withForligGate(
        computeSvieSmerteEngine({
          erstatningsopgoerelse: effectiveEoValues,
          stamdata: {
            skadedato: parsedStamdata.data.skadedato,
            skadestype: parsedStamdata.data.skadestype,
          },
        }),
        blockedDependencies.forlig
      );
    // TAF-ranges er periodiseringen, ikke en beløbsberegning, men den læser TAF-grenens datofelter: en rød
    // TAF-dato ville ellers give en periodisering udledt af en maskeret tomværdi (brugerbeslutning 2 kræver
    // omvendt, at en GYLDIG TAF-visning overlever en S/S-fejl — ikke at en ugyldig vises).
    const tafRangesForInspektion = blockedDependencies.taf
      ? undefined
      : buildTafRanges(effectiveEoValues, { skadedatoISO: parsedStamdata.data.skadedato });
    const inspektionSnapshotForValidationError = buildInspektionSnapshotForComputed({
      revision: args.revision,
      stamdata: parsedStamdata.data,
      eoValues: effectiveEoValues,
      stamdataErrors,
      eoErrors,
      ...(tafRangesForInspektion === undefined ? {} : { tafRanges: tafRangesForInspektion }),
      svieSmerteEngine: svieSmerteForInspektion,
    });
    return {
      revision: args.revision,
      status: 'error',
      invariants: validationInvariants,
      // Det AUTORITATIVE aggregat (samlet total + canonicalOutput + pdfModel) forbliver `null`: en sum eller
      // et fuldt dokument kan ikke være autoritativt, når bare ét led er blokeret (WI-004, valgt model A).
      // De uafhængige grene, der STADIG kan beregnes, surfaces gennem `inspektionSnapshot` ovenfor — det er
      // dér brugerbeslutning 2 realiseres: en rød S/S-afhængighed fjerner ikke den gyldige TAF-visning.
      data: null,
      blockedDependencies,
      // Brugerbeslutning 2 realiseres HER, ikke kun i `inspektionSnapshot`: Beregning-fanen læser
      // udelukkende snapshottet og skal fortsat kunne vise den gyldige TAF-periodisering, når et
      // svie/smerte-felt er rødt (WI-004 runde 4, fund S1).
      readyBranches: Object.freeze({
        svieSmerte: svieSmerteForInspektion,
        tafPerioder: tafRangesForInspektion,
      }),
      inspektionSnapshot: inspektionSnapshotForValidationError,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
    };
  }

  // inspektionSnapshot deklareres her så catch-blokken har adgang til den,
  // selv hvis en fejl opstår efter at den er bygget inde i try-blokken.
  let inspektionSnapshot: EOInspektionSnapshot | null = null;

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
      midlertidigtEetGroups,
    });
    const oevrigeKrav = buildOevrigeKravModel(effectiveEoValues);
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
    inspektionSnapshot = buildInspektionSnapshotForComputed({
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
    if (tafPerYearOpreguleretOutcome.kind === 'error' && tafPerYearOpreguleretOutcome.reason === 'manglende_reguleringssats') {
      invariants.push(buildTafPerYearOpreguleretManglendeReguleringssatsInvariant(tafPerYearOpreguleretOutcome.manglendeAar));
    }

    // Denne invariant er bevidst udledt af kontroltabellens sammentælling-model.
    // Den krydstjekker autoritative engine-outputs mod den committede EO-kontrol-tabel-projektion,
    // så den afhænger af kontrol-infrastruktur efter design frem for at være et rent engine-til-engine-check.
    // Invariant: inspektionSnapshot er altid non-null her, da den sættes tidligt i try-blokken inden engine-kald.
    if (!inspektionSnapshot) throw new Error('inspektionSnapshot mangler ved kontrol-mismatch-check — invariant brudt');
    const controlMismatchMessages = collectSammentaellingControlMismatchMessages(inspektionSnapshot.sammentaellingRows);
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
    const sfggSixMonthWarningEmploymentIds = findSfggSixMonthWarningEmploymentIds({
      values: effectiveEoValues,
      result: tafNetto.sygeferiegodtgoerelse,
    });
    const data: EoSnapshotComputedData = {
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
      blockedDependencies: resolveEoBlockedDependencies(eoFieldIssues, stamdataFieldIssues),
      inspektionSnapshot,
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
        // Diagnostisk: var en (delvist bygget) kontrol-snapshot tilgængelig, da exception ramte?
        // Selve snapshot-resultatet sætter inspektionSnapshot til null i fail_closed-stien (se nedenfor).
        inspektionSnapshotAvailable: inspektionSnapshot !== null,
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
        blocksOutputs: ['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'] as const,
      }],
      data: null,
      // Kontrakt eo-snapshot-contract.md §2.4: i fail_closed-stien (uventet runtime-exception)
      // er inspektionSnapshot null. En delvist bygget kontrol-snapshot fra en kørsel der efterfølgende
      // kastede, må ikke surfaces som om den var et gyldigt beregningsgrundlag — også selvom
      // eoSnapshotToInspektionView allerede router fail_closed til en blokeret tilstand uafhængigt af
      // inspektionSnapshot. Fail-closed = ingen semi-autoritativ kontrolvisning.
      inspektionSnapshot: null,
      input: {
        stamdata: parsedStamdata.data,
        erstatningsopgoerelse: parsedEo.data,
      },
      failClosedReason: 'runtime_exception',
    };
  }
};
