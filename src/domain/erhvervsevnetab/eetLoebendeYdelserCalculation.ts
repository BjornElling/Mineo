import {
  activeKapitaliseringPctAt, activeKapitaliseringPctAtExcluding, restEetPctAt,
  buildKapitaliseringEvents, buildLoebendePeriodeplan, eetLoebendeDelperiodeSchema, eetLoebendeOphoerAarsagSchema,
  type ResolvedAfgoerelse,
} from './eetLoebendePerioder';
export { firstOfMonthAfter, hasOverlapPeriod } from './eetLoebendePerioder';
import type { AslAfgoerelseRow, ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { EetIssue } from './eetTypes';
import {
  EET_TITRIN_FRA_2024_WARNING,
  EET_UNDER_15_WARNING,
  formatDatoEfterBeregningsdatoWarning,
  harEetTitrinAfvigelse,
} from './eetFieldWarnings';
import {
  EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID,
  MISSING_BEREGNINGSDATO_ISSUE,
} from './eetIssueCatalog';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import {
  getDayAfterIso,
  isoYear,
} from '../../utils/isoDateHelpers';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/lovbestemteRates';
import {
  formatAslAarsloensmaksimumMissing,
  resolveAslAarsloensmaksimumForAar,
} from '../satser/aslAarsloensmaksimum';
import { validateAslAarsloenBySkadesaarMax } from '../aslEalAarsloen/aarsloenValidators';
import { SKADELIDTES_AARSLOEN_ASL_LABEL } from '../aslEalAarsloen/aarsloenLabels';
import { amountValueToNumber } from '../../utils/expressionAmount';
// Direkte fra utils, ikke via eetFormatUtils: den facade importerer hele descriptor-kataloget,
// og en beregningsmodul-import derfra ville lukke en cyklus mellem domæne og inputCore.
import { formatAsAmountTrimmed, formatPercentRounded4 as formatPct } from '../../utils/formatUtils';
import { formatISOToDanish } from '../../utils/dateFormatting';
import { dedupeIssuesByIdentity } from '../../utils/issueUtils';
import { ceilNearest12, round0, round2, round4, roundNearest1000 } from '../../utils/roundingShortcuts';
import { SKAERING_2011_01_01, SKAERING_2024_01_01, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { resolveAslReguleringRateForSatsAar } from './eetReguleringRater';
import { sumMaanedsbroekForInterval } from '../dates/maanedsbroek';
import {
  ASL_IDENTICAL_AFGOERELSER_ID,
  collectIncompleteRowIssues,
  hasIdenticalAfgoerelser,
  hasTextValue,
  isAslAfgoerelseRowEmpty,
  isKnownAfgoerelseType,
  NON_ENDELIG_AFTER_ENDELIG_WARNING_ID,
  parseCommittedPercent,
  resolveNonEndeligAfterEndeligWarning,
} from './eetAslAfgoerelser';
import {
  fromKroner,
  moneyOreSchema,
  sumMoneyOre,
  toKroner,
} from '../money/money';
import { z } from 'zod';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import { eetIssueSchema } from './eetTypes';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';

export const eetLoebendePeriodeRowSchema = z.object({
  fra: isoDateString,
  til: isoDateString,
  satsAar: z.number().int(),
  maanederPraecis: z.number().finite(),
  grundydelseAfrundetOre: moneyOreSchema,
  reguleringPct: z.number().finite(),
  maanedligYdelseOre: moneyOreSchema,
  beregnetEetOre: moneyOreSchema,
}).strict().readonly();
export type EetLoebendePeriodeRow = z.infer<typeof eetLoebendePeriodeRowSchema>;

export const eetLoebendeAfgoerelseComputationSchema = z.object({
  rowId: z.string(),
  afgoerelsesdato: isoDateString,
  virkningsdato: isoDateString,
  kapitaliseringsdato: isoDateString.nullable(),
  skaeringsDato: isoDateString.nullable(),
  harOverlap: z.boolean(),
  beregningsperioder: z.array(eetLoebendeDelperiodeSchema).readonly(),
  afgoerelseType: z.enum(['Midlertidig', 'Delvist endelig', 'Endelig']),
  eetPct: z.number().finite(),
  priorKapPct: z.number().finite(),
  eetPctFoerAktuelKap: z.number().finite(),
  kapPctAktuel: z.number().finite(),
  kapPctKumulativ: z.number().finite(),
  restEetPct: z.number().finite(),
  harKapitalisering: z.boolean(),
  harRestSektion: z.boolean(),
  tilbagevirkendeKraft: z.boolean(),
  ophoerDato: isoDateString,
  ophoerAarsag: eetLoebendeOphoerAarsagSchema,
  grundydelseFuldOre: moneyOreSchema,
  grundydelseRestOre: moneyOreSchema.nullable(),
  grundydelse2024FuldOre: moneyOreSchema,
  grundydelse2024RestOre: moneyOreSchema.nullable(),
  // Visningsrækker for faktiske krav. Perioder med 0 kr. udelades bevidst.
  perioder: z.array(eetLoebendePeriodeRowSchema).readonly(),
  iAltBeregnetEetOre: moneyOreSchema,
}).strict().readonly();
export type EetLoebendeAfgoerelseComputation = z.infer<typeof eetLoebendeAfgoerelseComputationSchema>;

export const eetLoebendeAarsydelseReguleringStepSchema = z.object({
  satsAar: z.number().int(),
  reguleringPct: z.number().finite(),
  reguleringsfaktor: z.number().finite(),
  aarsydelseFuldFoerAfrundingOre: moneyOreSchema,
  aarsydelseRestFoerAfrundingOre: moneyOreSchema.nullable(),
}).strict().readonly();
export type EetLoebendeAarsydelseReguleringStep = z.infer<typeof eetLoebendeAarsydelseReguleringStepSchema>;

export const eetLoebendeComputationSchema = z.object({
  beregningsdato: isoDateString,
  skadedato: isoDateString,
  fodselsdato: isoDateString,
  skadesaar: z.number().int(),
  aslAarsloenAfrundet1000Ore: moneyOreSchema,
  maxAarsloenISkadesaarOre: moneyOreSchema,
  benyttetAarsloenOre: moneyOreSchema,
  grundloenNiveau: z.enum(['2003', '2024']),
  grundloenOre: moneyOreSchema,
  erstatningsniveauPct: z.union([z.literal(80), z.literal(83)]),
  amBidragPct: z.union([z.literal(0), z.literal(8)]),
  reguleringFoer2024Pct: z.number().finite(),
  afgoerelser: z.array(eetLoebendeAfgoerelseComputationSchema).readonly(),
}).strict().readonly();
export type EetLoebendeComputation = z.infer<typeof eetLoebendeComputationSchema>;

export const eetLoebendeCalculationResultSchema = z.object({
  issues: z.array(eetIssueSchema).readonly(),
  computation: eetLoebendeComputationSchema.nullable(),
}).strict().readonly();
export type EetLoebendeCalculationResult = z.infer<typeof eetLoebendeCalculationResultSchema>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
  skadestype?: Skadestype;
  skadelidteFodselsdato: ISODateString | undefined;
  context: Readonly<
    | { kind: 'eet_page' }
    | { kind: 'eo_import'; slutdato: ISODateString }
  >;
}>;

const toIssue = (id: string, message: string): EetIssue => ({ id, severity: 'error', message });
const toWarning = (id: string, message: string): EetIssue => ({ id, severity: 'warning', message });

const parsePct = (raw: number | undefined): number | undefined => {
  const parsed = parseCommittedPercent(raw);
  // 0 % giver ingen løbende ydelse og behandles derfor som ikke-deltagende række.
  if (parsed === undefined || parsed === 0) return undefined;
  return parsed;
};
const formatPctForWarning = (value: number): string =>
  formatAsAmountTrimmed(value, 2);

const sortResolvedAfgoerelser = (rows: readonly ResolvedAfgoerelse[]): ResolvedAfgoerelse[] => {
  return [...rows].sort((a, b) => {
    if (a.afgoerelsesdato !== b.afgoerelsesdato) return a.afgoerelsesdato < b.afgoerelsesdato ? -1 : 1;
    if (a.virkningsdato !== b.virkningsdato) return a.virkningsdato < b.virkningsdato ? -1 : 1;
    return a.sortKey < b.sortKey ? -1 : 1;
  });
};

const collectResolvedAfgoerelser = (
  rows: readonly AslAfgoerelseRow[]
): ResolvedAfgoerelse[] => {
  const resolved: ResolvedAfgoerelse[] = [];

  for (const row of rows) {
    const eetPct = parsePct(row.eetPct);
    if (eetPct === undefined) continue;
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const virkningsdato = coerceToISODateString(row.virkningsDato);
    if (!afgoerelsesdato || !virkningsdato || !row.afgoerelseType) continue;

    resolved.push({
      rowId: row.id,
      afgoerelsesdato,
      virkningsdato,
      afgoerelseType: row.afgoerelseType,
      eetPct,
      kapDato: coerceToISODateString(row.kapDato),
      kapPct: parsePct(row.kapPct) ?? 0,
      fsTilbageholdtEet: row.fsTilbageholdtEet ?? 'Nej',
      sortKey: row.id,
    });
  }

  return sortResolvedAfgoerelser(resolved);
};

/**
 * EET-løbende-ydelser-advarsler der sammenligner en afgørelses datoer mod beregningsdatoen.
 *
 * De er kun meningsfulde på erhvervsevnetab-siden, hvor beregningsdatoen er den dato, brugeren
 * bevidst beregner EET *til*. I erstatningsopgørelsens midlertidigt EET-import er "beregningsdatoen"
 * blot TAF-slutdatoen, og en EET-afgørelse med virkning efter erstatningsperiodens udløb er helt
 * normal (fx en opgørelse lavet – evt. revideret – før EET-afgørelsen er truffet). Derfor
 * undertrykkes netop disse advarsler i EO-import-konteksten. Filtreringen sker ved EO-import-grænsen
 * (`buildMidlertidigtEetSourceResult`), så erhvervsevnetab-sidens egen visning er upåvirket.
 * Se `eo-snapshot-contract.md` §13.
 */
export const EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS: ReadonlySet<string> = new Set([
  EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID,
]);

const collectWarnings = (
  skadedato: ISODateString,
  beregningsdato: ISODateString,
  afgoerelser: readonly ResolvedAfgoerelse[],
  issues: EetIssue[]
): void => {
  if (afgoerelser.some((row) => row.eetPct < 15)) {
    issues.push(toWarning('warn-asl-eet-under-15', EET_UNDER_15_WARNING));
  }

  // Samme prædikat som feltadvarslen på EET %-cellen, så boksen og cellen ikke kan drive fra
  // hinanden. Ordlyden siger nu, at beregningen ikke er lovmæssig, i stedet for at kalde værdien
  // «ugyldig» – programmet accepterer den, regner på den og trykker den (BB-158).
  const firstInvalidPctAfter2024 = afgoerelser.find((row) => harEetTitrinAfvigelse(row.eetPct, skadedato));
  if (firstInvalidPctAfter2024) {
    issues.push(
      toWarning(
        'warn-invalid-eet-pct-after-2024-07-01',
        `${EET_TITRIN_FRA_2024_WARNING} (indtastet ${formatPctForWarning(firstInvalidPctAfter2024.eetPct)} %).`
      )
    );
  }

  // Reglen ejes af afgørelsestabellen, ikke af denne motor (BB-178): EET efter EAL læser samme
  // rækker og skal give samme advarsel.
  const nonEndeligAfterEndelig = resolveNonEndeligAfterEndeligWarning(afgoerelser);
  if (nonEndeligAfterEndelig !== undefined) {
    issues.push(toWarning(NON_ENDELIG_AFTER_ENDELIG_WARNING_ID, nonEndeligAfterEndelig));
  }

  // Tre linjer om ÉN årsag læses som tre problemer, hvor der er ét: beregningsdatoen ligger før
  // sagens afgørelser (BB-159). Boksen navngiver derfor årsagen i én linje, og de enkelte datoer
  // markeres i stedet ved deres egen celle med `resolveDatoEfterBeregningsdatoWarning`.
  const harDatoEfterBeregningsdato = afgoerelser.some((row) =>
    row.afgoerelsesdato > beregningsdato ||
    row.virkningsdato > beregningsdato ||
    (row.kapDato !== undefined && row.kapDato > beregningsdato)
  );
  if (harDatoEfterBeregningsdato) {
    issues.push(toWarning(
      EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID,
      formatDatoEfterBeregningsdatoWarning(beregningsdato)
    ));
  }
};

const collectBlockingInputIssues = (rows: readonly AslAfgoerelseRow[], issues: EetIssue[]): void => {
  for (const issue of collectIncompleteRowIssues(rows)) {
    if (issue.id === 'endelig-under-50-missing-kapitalisering') continue;
    issues.push(toIssue(issue.id, issue.message));
  }

  const hasDelvistEndeligWithoutKapInfo = rows.some((row) => {
    if (row.afgoerelseType !== 'Delvist endelig') return false;
    return !hasTextValue(row.kapDato) && !hasTextValue(row.kapPct);
  });
  if (hasDelvistEndeligWithoutKapInfo) {
    issues.push(
      toIssue(
        'delvist-endelig-missing-kapitalisering',
        'Der er angivet en delvist endelig afgørelse uden kapitalisering'
      )
    );
  }

  if (hasIdenticalAfgoerelser(rows)) {
    issues.push(toIssue(
      ASL_IDENTICAL_AFGOERELSER_ID,
      'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato'
    ));
  }
};

const toAfgoerelseLabel = (
  afgoerelseType: ResolvedAfgoerelse['afgoerelseType'],
  hasRestSektion: boolean,
  hasKapitalisering: boolean
): string => {
  if (afgoerelseType === 'Midlertidig') return 'Midlertidig afgørelse';
  if (afgoerelseType === 'Delvist endelig') return 'Delvist endelig afgørelse';
  if (hasRestSektion) return 'Endelig afgørelse (delvist kap.)';
  if (hasKapitalisering) return 'Endelig afgørelse (kapitaliseret)';
  return 'Endelig afgørelse';
};

type LoebendeYdelsesInterval = Omit<EetLoebendePeriodeRow, 'maanederPraecis' | 'beregnetEetOre'>;

/**
 * Samler identiske ydelsesintervaller FØR beløbsafrunding. En kapitalisering kan ændre
 * både gammel og ny rest lige meget, så merkravet er uændret. To halve måneder må da
 * ikke afrundes hver for sig og blive til 2.662 kr. ved en månedsydelse på 2.661 kr.
 * De tekniske grænser bevares særskilt i beregningsperioder til overlap og forklaringer.
 */
const buildLoebendeYdelsesRows = (
  rows: readonly LoebendeYdelsesInterval[]
): EetLoebendePeriodeRow[] => {
  const merged: LoebendeYdelsesInterval[] = [];
  for (const row of rows) {
    const previous = merged.at(-1);
    if (previous && getDayAfterIso(previous.til) === row.fra &&
      previous.satsAar === row.satsAar &&
      previous.grundydelseAfrundetOre === row.grundydelseAfrundetOre &&
      previous.reguleringPct === row.reguleringPct &&
      previous.maanedligYdelseOre === row.maanedligYdelseOre) {
      merged[merged.length - 1] = { ...previous, til: row.til };
    } else {
      merged.push(row);
    }
  }
  return merged.flatMap((row) => {
    const maanederPraecis = sumMaanedsbroekForInterval(row.fra, row.til);
    const beregnetEetOre = fromKroner(round0(maanederPraecis * toKroner(row.maanedligYdelseOre)));
    return beregnetEetOre === 0 ? [] : [{ ...row, maanederPraecis, beregnetEetOre }];
  });
};

const computeEetLoebendeYdelserForContext = (input: Input): EetLoebendeCalculationResult => {
  const issues: EetIssue[] = [];

  const beregningsdatoInput = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  // EO-importen har sin egen eksplicitte port, så TAF-slutdatoen ikke kan sive ind i
  // EET-sidens beregning som en skjult optional override.
  const beregningsdato = beregningsdatoInput
    ?? (input.context.kind === 'eo_import' ? input.context.slutdato : undefined);
  const skadedato = input.skadedato;
  const stamdataDatoReference = resolveStamdataDatoReference(input.skadestype);
  const fodselsdato = input.skadelidteFodselsdato;

  const aslAarsloenRaw = amountValueToNumber(input.erhvervsevnetab.aslAarsloen);

  if (aslAarsloenRaw === undefined || !Number.isFinite(aslAarsloenRaw)) {
    issues.push(toIssue('aarsloen-missing', `${SKADELIDTES_AARSLOEN_ASL_LABEL} er ikke udfyldt`));
  } else if (aslAarsloenRaw <= 0) {
    // Fortegn valideres her som et afledt domæneissue, så også canonical
    // negative værdier fra persistence blokerer beregningen.
    issues.push(toIssue('aarsloen-zero', `${SKADELIDTES_AARSLOEN_ASL_LABEL} skal være større end 0 kr`));
  }
  if (!fodselsdato) {
    issues.push(toIssue('skadelidte-fodselsdato-missing', 'Fødselsdato er ikke udfyldt'));
  }
  if (!beregningsdato) {
    issues.push(MISSING_BEREGNINGSDATO_ISSUE);
  }
  if (!skadedato) {
    issues.push(toIssue('skadedato-missing', `${stamdataDatoReference.label} er ikke udfyldt`));
  }

  collectBlockingInputIssues(input.erhvervsevnetab.aslAfgoerelser, issues);

  const hasUnknownAfgoerelseType = input.erhvervsevnetab.aslAfgoerelser.some(
    (row) => row.afgoerelseType !== undefined && !isKnownAfgoerelseType(row.afgoerelseType)
  );
  if (hasUnknownAfgoerelseType) {
    // Schemavalideringen afviser normalt ukendte enumværdier. Domæne-entrypointet kan dog også
    // kaldes direkte fra runtime-kode; et ukendt typefelt må ikke glide videre som en delvist
    // fortolket afgørelse og derefter producere et output, som ikke passer til output-schemaet.
    issues.push(toIssue(
      'invalid-afgoerelse-type',
      'En afgørelse har en ukendt afgørelsestype og kan derfor ikke beregnes sikkert.'
    ));
  }

  const resolvedAfgoerelser = collectResolvedAfgoerelser(input.erhvervsevnetab.aslAfgoerelser);
  const allRowsEmpty = input.erhvervsevnetab.aslAfgoerelser.every((row) => isAslAfgoerelseRowEmpty(row));
  if (allRowsEmpty) {
    issues.push(toIssue('asl-afgoerelser-empty', 'Ingen ASL-afgørelser er indtastet'));
  }

  if (
    issues.some((issue) => issue.severity === 'error') ||
    !Number.isFinite(aslAarsloenRaw) ||
    !beregningsdato ||
    !skadedato ||
    !fodselsdato
  ) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const skadesaar = isoYear(skadedato);
  const maxAarsloenISkadesaar = resolveAslAarsloensmaksimumForAar(skadesaar);
  if (maxAarsloenISkadesaar === undefined) {
    issues.push(toIssue('aarsloen-max-missing', formatAslAarsloensmaksimumMissing(skadesaar)));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const aslAarsloen = aslAarsloenRaw as number;
  const aslAarsloenMaxIssue = validateAslAarsloenBySkadesaarMax(aslAarsloen, skadedato);
  if (aslAarsloenMaxIssue !== undefined) {
    // En direkte motorbruger kan komme uden om readerens felt-gate. Værdien må
    // derfor stoppes her; en defensiv min()-afskæring ville ellers give et
    // resultat for en inputværdi, som domænet har afvist.
    issues.push(toIssue('aarsloen-over-max', aslAarsloenMaxIssue));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }
  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = aslAarsloenAfrundet1000;

  collectWarnings(skadedato, beregningsdato, resolvedAfgoerelser, issues);

  const before2024Skade = skadedato < SKAERING_2024_07_01;
  const from2011 = skadedato >= SKAERING_2011_01_01;
  const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
  if (before2024Skade && !Number.isFinite(reguleringFoer2024)) {
    issues.push(toIssue('reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const grundloen = before2024Skade
    ? round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2003 / maxAarsloenISkadesaar))
    : round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2024 / maxAarsloenISkadesaar));

  const erstatningsniveau = from2011 ? 0.83 : 0.8;
  const amFaktor = from2011 ? 0.92 : 1;
  const erstatningsniveauPct = from2011 ? 83 : 80;
  const amBidragPct = from2011 ? 8 : 0;

  const { resolvedRows: resolvedAfgoerelserWithKapitalisering, events: kapitaliseringEvents } =
    buildKapitaliseringEvents(resolvedAfgoerelser, skadedato, fodselsdato);

  const loebendeYdelserSlutdato = input.context.kind === 'eo_import'
    ? input.context.slutdato
    : beregningsdato;

  const periodeplan = buildLoebendePeriodeplan(resolvedAfgoerelserWithKapitalisering, kapitaliseringEvents, fodselsdato, loebendeYdelserSlutdato);

  const computations: EetLoebendeAfgoerelseComputation[] = [];

  for (const { current, transition: currentTransition, ophoer, perioder: allPeriods } of periodeplan) {
    const priorKapPct = activeKapitaliseringPctAtExcluding(kapitaliseringEvents, current.virkningsdato, current.rowId);
    const hasKapitalisering = !!current.effectiveKapDato && current.effectiveKapPct > 0;
    const kapPctKumulativ = current.effectiveKapDato
      ? activeKapitaliseringPctAt(kapitaliseringEvents, current.effectiveKapDato)
      : priorKapPct;
    const kapPctFoerAktuelKap = current.effectiveKapDato
      ? activeKapitaliseringPctAtExcluding(kapitaliseringEvents, current.effectiveKapDato, current.rowId)
      : priorKapPct;
    const eetPctFoerAktuelKap = Math.max(0, current.eetPct - kapPctFoerAktuelKap);
    const restEetPct = hasKapitalisering && current.effectiveKapDato
      ? restEetPctAt(current, kapitaliseringEvents, current.effectiveKapDato)
      : restEetPctAt(current, kapitaliseringEvents, current.virkningsdato);
    const hasRestSection = hasKapitalisering && restEetPct > 0;

    const fullPctFactor = eetPctFoerAktuelKap / 100;
    const restPctFactor = restEetPct / 100;
    const grundydelseFuldKroner = round2(grundloen * fullPctFactor * erstatningsniveau * amFaktor);
    const grundydelseRestKroner = hasRestSection
      ? round2(grundloen * restPctFactor * erstatningsniveau * amFaktor)
      : null;

    const grundydelse2024FuldKroner = before2024Skade
      ? round2(grundydelseFuldKroner * (1 + reguleringFoer2024 / 100))
      : grundydelseFuldKroner;
    const grundydelse2024RestKroner =
      before2024Skade && grundydelseRestKroner !== null
        ? round2(grundydelseRestKroner * (1 + reguleringFoer2024 / 100))
        : grundydelseRestKroner;

    const computedRows: LoebendeYdelsesInterval[] = [];

    for (const sectionRow of allPeriods) {
      const rateInfo = resolveAslReguleringRateForSatsAar(sectionRow.satsAar, before2024Skade, issues);
      if (rateInfo === null) continue;

      const sectionGrundydelse = round2(grundloen * (sectionRow.eetPct / 100) * erstatningsniveau * amFaktor);
      const sectionGrundydelse2024 = before2024Skade
        ? round2(sectionGrundydelse * (1 + reguleringFoer2024 / 100))
        : sectionGrundydelse;
      const effektivGrundydelseBase =
        before2024Skade && sectionRow.satsAar >= 2024 ? sectionGrundydelse2024 : sectionGrundydelse;

      const grundydelseAfrundetKroner = effektivGrundydelseBase;
      const aarsydelseKroner = ceilNearest12(effektivGrundydelseBase * rateInfo.factor);
      const maanedligYdelseKroner = aarsydelseKroner / 12;

      computedRows.push({
        fra: sectionRow.fra,
        til: sectionRow.til,
        satsAar: sectionRow.satsAar,
        grundydelseAfrundetOre: fromKroner(grundydelseAfrundetKroner),
        reguleringPct: rateInfo.reguleringPct,
        maanedligYdelseOre: fromKroner(maanedligYdelseKroner),
      });
    }

    const visningsRows = buildLoebendeYdelsesRows(computedRows);
    const iAltBeregnetEetOre = sumMoneyOre(visningsRows.map((row) => row.beregnetEetOre));
    computations.push({
      rowId: current.rowId,
      afgoerelsesdato: current.afgoerelsesdato,
      virkningsdato: current.virkningsdato,
      kapitaliseringsdato: hasKapitalisering && current.effectiveKapDato ? current.effectiveKapDato : null,
      skaeringsDato: currentTransition.skaeringsDato,
      harOverlap: currentTransition.useOverlap,
      beregningsperioder: allPeriods,
      afgoerelseType: current.afgoerelseType,
      eetPct: current.eetPct,
      priorKapPct,
      eetPctFoerAktuelKap,
      kapPctAktuel: current.effectiveKapPct,
      kapPctKumulativ,
      restEetPct,
      harKapitalisering: hasKapitalisering,
      harRestSektion: hasRestSection,
      tilbagevirkendeKraft: current.virkningsdato < current.afgoerelsesdato,
      ophoerDato: ophoer.date,
      ophoerAarsag: ophoer.cause,
      grundydelseFuldOre: fromKroner(grundydelseFuldKroner),
      grundydelseRestOre: grundydelseRestKroner === null ? null : fromKroner(grundydelseRestKroner),
      grundydelse2024FuldOre: fromKroner(grundydelse2024FuldKroner),
      grundydelse2024RestOre: grundydelse2024RestKroner === null ? null : fromKroner(grundydelse2024RestKroner),
      perioder: visningsRows,
      iAltBeregnetEetOre,
    });
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { issues: dedupeIssuesByIdentity(issues), computation: null };
  }

  const computation: EetLoebendeComputation = {
    beregningsdato,
    skadedato,
    fodselsdato,
    skadesaar,
    aslAarsloenAfrundet1000Ore: fromKroner(aslAarsloenAfrundet1000),
    maxAarsloenISkadesaarOre: fromKroner(maxAarsloenISkadesaar),
    benyttetAarsloenOre: fromKroner(benyttetAarsloen),
    grundloenNiveau: before2024Skade ? '2003' : '2024',
    grundloenOre: fromKroner(grundloen),
    erstatningsniveauPct,
    amBidragPct,
    reguleringFoer2024Pct: before2024Skade ? (reguleringFoer2024 ?? 0) : 0,
    afgoerelser: computations,
  };

  return {
    issues: dedupeIssuesByIdentity(issues),
    computation,
  };
};

type EetLoebendeInput = Omit<Input, 'context'>;

export const computeEetLoebendeYdelser = (
  input: EetLoebendeInput
): EetLoebendeCalculationResult => computeEetLoebendeYdelserForContext({
  ...input,
  context: { kind: 'eet_page' },
});

export const computeEetLoebendeYdelserForEoImport = (
  input: EetLoebendeInput & Readonly<{ slutdato: ISODateString }>
): EetLoebendeCalculationResult => {
  const { slutdato, ...baseInput } = input;
  return computeEetLoebendeYdelserForContext({
    ...baseInput,
    context: { kind: 'eo_import', slutdato },
  });
};

export const buildLoebendeAarsydelseReguleringSteps = (
  afgoerelse: EetLoebendeAfgoerelseComputation
): readonly EetLoebendeAarsydelseReguleringStep[] => {
  const periodYears = [...new Set(afgoerelse.perioder
    .filter((row) => row.satsAar > 2024)
    .map((row) => row.satsAar))]
    .sort((a, b) => a - b);
  const fallbackYear = isoYear(afgoerelse.afgoerelsesdato);
  const uniqueYears = periodYears.length > 0
    ? periodYears
    : fallbackYear > 2024
      ? [fallbackYear]
      : [];

  const restGrundydelse2024Ore = afgoerelse.grundydelse2024RestOre;

  return uniqueYears.map((satsAar) => {
    const reguleringPct = afgoerelse.perioder.find((row) => row.satsAar === satsAar)?.reguleringPct ?? 0;
    const reguleringsfaktor = round4(1 + reguleringPct / 100);
    return {
      satsAar,
      reguleringPct,
      reguleringsfaktor,
      aarsydelseFuldFoerAfrundingOre: fromKroner(
        round2(toKroner(afgoerelse.grundydelse2024FuldOre) * reguleringsfaktor)
      ),
      aarsydelseRestFoerAfrundingOre: restGrundydelse2024Ore === null
        ? null
        : fromKroner(round2(toKroner(restGrundydelse2024Ore) * reguleringsfaktor)),
    };
  }).filter((step) => step.reguleringPct !== 0);
};

export const shouldShowLoebende2024ConversionBlock = (
  afgoerelse: EetLoebendeAfgoerelseComputation
): boolean => {
  return afgoerelse.perioder.some((row) => row.satsAar >= 2024);
};

/**
 * Afledte visningsflag for én løbende-ydelse-afgørelses rest-/2024-sektioner.
 *
 * Kanonisk kilde for hvilke under-afsnit der vises (2003-niveau vs. 2024-niveau, rest-sektion),
 * så UI-fanen (`EetLoebendeYdelserTab`) og PDF/Word-generatoren (`loebendeYdelserDocument`) ikke
 * kan drive fra hinanden – samme visningssemantik ét sted, jf. konvergens-/periodiseringsreglerne.
 */
export type LoebendeAfgoerelseRestVisning = Readonly<{
  show2024ConversionBlock: boolean;
  hasRestSection: boolean;
  kapitaliseringFra2024: boolean;
  hasRestAfterKapBefore2024: boolean;
  showRest2003: boolean;
  showRest2024: boolean;
}>;

export const resolveLoebendeAfgoerelseRestVisning = (
  afgoerelse: EetLoebendeAfgoerelseComputation,
  grundloenNiveau: EetLoebendeComputation['grundloenNiveau']
): LoebendeAfgoerelseRestVisning => {
  const show2024ConversionBlock =
    grundloenNiveau === '2003' && shouldShowLoebende2024ConversionBlock(afgoerelse);
  const hasKapitaliseringsdato = afgoerelse.kapitaliseringsdato !== null;
  const hasRestSection = afgoerelse.harRestSektion && hasKapitaliseringsdato;
  const kapitaliseringFra2024 =
    afgoerelse.kapitaliseringsdato !== null &&
    afgoerelse.kapitaliseringsdato >= SKAERING_2024_01_01;
  const hasRestAfterKapBefore2024 = Boolean(
    hasRestSection &&
    afgoerelse.kapitaliseringsdato &&
    afgoerelse.kapitaliseringsdato < SKAERING_2024_01_01
  );
  const showRest2003 = hasRestSection && (!show2024ConversionBlock || !kapitaliseringFra2024);
  const showRest2024 = show2024ConversionBlock && hasRestSection && kapitaliseringFra2024;
  return {
    show2024ConversionBlock,
    hasRestSection,
    kapitaliseringFra2024,
    hasRestAfterKapBefore2024,
    showRest2003,
    showRest2024,
  };
};

/**
 * Restlinjens tekst i den udvidede specifikation: hele kæden fra afgørelsens egen procent til resten.
 *
 * Skærm og dokument skrev hver sit regnestykke for samme linje, og dokumentets gik ikke op:
 * generatoren brugte `eetPct` (30) i et udtryk, hvis facit var regnet af `eetPctFoerAktuelKap` (15),
 * så der stod «30 - 5 % = 10 %» (BB-160). Rettelsen er ikke blot at vælge det ene tal: linjen viser
 * nu hele kæden fra den procentsats, brugeren selv tastede, over fradraget for tidligere
 * kapitalisering til fradraget for den aktuelle – så regnestykket kan følges hele vejen.
 */
export const formatLoebendeRestEetLinje = (
  afgoerelse: Pick<
    EetLoebendeAfgoerelseComputation,
    'eetPct' | 'priorKapPct' | 'kapPctAktuel' | 'restEetPct' | 'kapitaliseringsdato'
  >
): string => {
  const led = [`${formatPct(afgoerelse.eetPct)}`];
  if (afgoerelse.priorKapPct > 0) {
    led.push(`- ${formatPct(afgoerelse.priorKapPct)} tidl. kap.`);
  }
  led.push(`- ${formatPct(afgoerelse.kapPctAktuel)} kap.`);
  const regnestykke = `${led.join(' ')} = ${formatPct(afgoerelse.restEetPct)}`;

  return afgoerelse.kapitaliseringsdato !== null
    ? `Resterende EET (${regnestykke}) efter kapitalisering ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}`
    : `Resterende EET (${regnestykke}) efter kapitalisering`;
};

export const toAfgoerelseTypeLabel = (
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig',
  hasRestSektion: boolean,
  hasKapitalisering: boolean
): string => toAfgoerelseLabel(afgoerelseType, hasRestSektion, hasKapitalisering);

export const toOphoerAarsagLabel = (
  cause: EetLoebendeAfgoerelseComputation['ophoerAarsag']
): string => {
  switch (cause) {
    case 'beregningsdato':
      return 'Beregningsdatoen';
    case 'senere-afgoerelse':
      return 'Senere afgørelse';
    case 'kapitalisering':
      return 'Kapitalisering';
    case 'folkepensionsdato':
      return 'Folkepensionsdato';
    default:
      return cause;
  }
};

/**
 * Periodeafgrænsningens to sidste linjer, som de skal vises.
 *
 * To forhold gør en rå «Løbende ydelse ophører»-linje forkert:
 *
 * 1. **Beregningsdatoen er ikke en ophørsgrund** (BB-155). Ydelsen ophører ikke dér; beregningen
 *    stopper. De tre øvrige årsager er ægte begivenheder i sagen, og en modpart, der læser
 *    «ophører», kan med rimelighed læse det som en oplysning om ydelsen frem for om opgørelsen.
 * 2. **Ophørsdatoen kan ligge før virkningsdatoen** (BB-154). `finalStop` er det tidligste af fire
 *    kandidater uden gulv ved virkningsdatoen, så en beregningsdato eller folkepensionsdato før
 *    afgørelsens virkning giver et interval, der slutter før det begynder. Det er ikke en
 *    oplysning, men en selvmodsigelse, brugeren skal bruge tid på at afvise – og i
 *    beregningsdato-tilfældet peger den på afgørelsen, hvor fejlen sidder i beregningsdatoen.
 *
 * Ejes af domænet, så fanen og dokumentgeneratoren viser samme linjer.
 */
export type LoebendeOphoerVisning =
  | Readonly<{ kind: 'interval'; ophoerLabel: string; ophoerDato: ISODateString; aarsagLabel: string }>
  | Readonly<{ kind: 'ingen-periode'; forklaring: string }>;

export const resolveLoebendeOphoerVisning = (
  afgoerelse: Pick<EetLoebendeAfgoerelseComputation, 'ophoerDato' | 'ophoerAarsag' | 'virkningsdato'>
): LoebendeOphoerVisning => {
  if (afgoerelse.ophoerDato < afgoerelse.virkningsdato) {
    const datoTekst = formatISOToDanish(afgoerelse.ophoerDato);
    switch (afgoerelse.ophoerAarsag) {
      case 'beregningsdato':
        return {
          kind: 'ingen-periode',
          forklaring: `Afgørelsen ligger helt efter beregningsdatoen (${datoTekst}).`,
        };
      case 'folkepensionsdato':
        return {
          kind: 'ingen-periode',
          forklaring: `Virkningsdatoen ligger efter folkepensionsdatoen (${formatISOToDanish(afgoerelse.virkningsdato)} er efter ${datoTekst}).`,
        };
      case 'senere-afgoerelse':
        return {
          kind: 'ingen-periode',
          forklaring: 'Afgørelsen er afløst af en senere afgørelse, før den fik virkning.',
        };
      case 'kapitalisering':
        return {
          kind: 'ingen-periode',
          forklaring: `Afgørelsen er kapitaliseret, før den fik virkning (${datoTekst}).`,
        };
    }
  }

  // Beregningsdatoen afgrænser opgørelsen; den bringer ikke ydelsen til ophør.
  const erKunstigAfgraensning = afgoerelse.ophoerAarsag === 'beregningsdato';
  return {
    kind: 'interval',
    ophoerLabel: erKunstigAfgraensning ? 'Løbende ydelse opgjort til og med' : 'Løbende ydelse ophører',
    ophoerDato: afgoerelse.ophoerDato,
    aarsagLabel: toOphoerAarsagLabel(afgoerelse.ophoerAarsag),
  };
};

/**
 * Visnings-semantik delt af UI-fanen (EetLoebendeYdelserTab) og dokument-generatoren
 * (loebendeYdelserDocument): grundydelsen skifter fra 2003- til 2024-niveau midt i en
 * afgørelse, når grundløns-niveauet er 2003 OG afgørelsen har perioder på begge sider af
 * 1. januar 2024. Ejes af domænelaget, så fane og generator ikke holder hver sin kopi.
 */
export const visGrundydelseNiveauSkift = (
  afgoerelse: Pick<EetLoebendeAfgoerelseComputation, 'perioder'>,
  grundloenNiveau: EetLoebendeComputation['grundloenNiveau']
): boolean => {
  const hasRowsBefore2024 = afgoerelse.perioder.some((row) => row.satsAar <= 2023);
  const hasRowsFrom2024 = afgoerelse.perioder.some((row) => row.satsAar >= 2024);
  return grundloenNiveau === '2003' && hasRowsBefore2024 && hasRowsFrom2024;
};

/** Forklarer hver faktisk overlapdel, også når den giver nul og derfor ikke står i tabellen. */
export const resolveLoebendeSkaeringsNote = (
  afgoerelse: Pick<EetLoebendeAfgoerelseComputation, 'beregningsperioder'>
): string | null => {
  const grupper: Array<EetLoebendeAfgoerelseComputation['beregningsperioder'][number]> = [];
  for (const periode of afgoerelse.beregningsperioder) {
    if (!periode.overlap) continue;
    const previous = grupper.at(-1);
    if (previous && getDayAfterIso(previous.til) === periode.fra &&
      previous.restEetPct === periode.restEetPct &&
      previous.tidligereYdelsePct === periode.tidligereYdelsePct &&
      previous.kapitaliseretPct === periode.kapitaliseretPct) {
      grupper[grupper.length - 1] = { ...previous, til: periode.til };
    } else {
      grupper.push(periode);
    }
  }
  if (grupper.length === 0) return null;
  return grupper.map((periode) => {
    const interval = `${formatISOToDanish(periode.fra)} – ${formatISOToDanish(periode.til)}`;
    const kapitalisering = periode.kapitaliseretPct > 0
      ? ` Efter kapitalisering på i alt ${formatPct(periode.kapitaliseretPct)} er den løbende EET ${formatPct(periode.restEetPct)}.`
      : ` Den løbende EET er ${formatPct(periode.restEetPct)}.`;
    const tidligere = ` Tidligere afgørelser dækker ${formatPct(periode.tidligereYdelsePct)}.`;
    const krav = periode.eetPct > 0
      ? ` Denne afgørelse giver derfor ${formatPct(periode.eetPct)} yderligere.`
      : ' Denne afgørelse giver derfor intet yderligere krav for perioden.';
    return `${interval}:${kapitalisering}${tidligere}${krav}`;
  }).join(' ');
};

/**
 * Noten under «Beregnede ydelser», der gør tabellens rækker efterregnelige.
 *
 * To skridt mellem «Grundydelse pr. år» og «Ydelse/md.» stod ingen steder: grundydelsen er et
 * ÅRSbeløb, og den regulerede årsydelse oprundes til nærmeste 12 kr., før den divideres med 12
 * (`ceilNearest12`). Uden dem giver `grundydelse x regulering / 12` et andet tal end det viste, og
 * den, der efterregner, må gætte på, om det er en afrunding eller en fejl (BB-156).
 *
 * Bevidst ÉN note frem for et mellemtrin pr. satsår: tabellen er i forvejen lang, og en ekstra
 * talkolonne eller to linjer pr. år ville lægge mere visuelt rod til end den forklarer.
 *
 * Noten står i den UDVIDEDE SPECIFIKATION, ikke over hver afgørelses tabel. Reglen er den samme for
 * alle tabeller, og gentaget pr. afgørelse ville den lægge sig oven i skærings- og 2024-noterne, som
 * er sagsspecifikke og derfor hører ved deres egen tabel.
 */
export const LOEBENDE_YDELSE_AFRUNDING_NOTE =
  'Ydelse/md. beregnes som grundydelsen pr. år gange reguleringen, oprundet til nærmeste 12 kr. og divideret med 12.';

export const formatSkadedatoCompact = (iso: ISODateString): string => {
  const [year, month, day] = iso.split('-');
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10);
  return `${d}/${m}-${year}`;
};
