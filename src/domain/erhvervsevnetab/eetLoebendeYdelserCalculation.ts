import type { AslAfgoerelseRow, ErhvervsevnetabValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO, parseISODate } from '../../types/branded';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  aarsloenMax,
  reguleringsprocentErhvervsevnetab,
  reguleringsprocentErhvervsevnetabFoer2024,
  reguleringsprocentErhvervsevnetabFra2024,
} from '../../data/regulationRates';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { addDays, addMonths } from '../../utils/dateUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { roundByMethod } from '../../utils/rounding';
import { optaelMaanederPraecis } from '../erstatningsopgoerelse/periodiseringsMotor';
import { hasTextValue, parsePercentDraft, resolveFolkepensionsalder } from './eetAslAfgoerelser';

export type EetLoebendeIssue = Readonly<{
  id: string;
  severity: 'error' | 'warning';
  message: string;
}>;

export type EetLoebendePeriodeRow = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  satsAar: number;
  maanederPraecis: number;
  grundydelseAfrundet: number;
  reguleringPct: number;
  maanedligYdelse: number;
  beregnetEet: number;
}>;

export type EetLoebendeAfgoerelseComputation = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  kapitaliseringsdato: ISODateString | null;
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  eetPct: number;
  priorKapPct: number;
  eetPctFoerAktuelKap: number;
  kapPctAktuel: number;
  kapPctKumulativ: number;
  restEetPct: number;
  harKapitalisering: boolean;
  harRestSektion: boolean;
  tilbagevirkendeKraft: boolean;
  ophoerDato: ISODateString;
  ophoerAarsag: 'beregningsdato' | 'senere-afgoerelse' | 'kapitalisering' | 'tvungen-kapitalisering';
  grundydelseFuld: number;
  grundydelseRest: number | null;
  grundydelse2024Fuld: number;
  grundydelse2024Rest: number | null;
  perioder: readonly EetLoebendePeriodeRow[];
  iAltBeregnetEet: number;
}>;

export type EetLoebendeComputation = Readonly<{
  beregningsdato: ISODateString;
  skadesdato: ISODateString;
  fodselsdato: ISODateString;
  skadesaar: number;
  aslAarsloenAfrundet1000: number;
  maxAarsloenISkadesaar: number;
  benyttetAarsloen: number;
  grundloenNiveau: '2003' | '2024';
  grundloen: number;
  erstatningsniveauPct: 80 | 83;
  amBidragPct: 0 | 8;
  afgoerelser: readonly EetLoebendeAfgoerelseComputation[];
}>;

export type EetLoebendeCalculationResult = Readonly<{
  issues: readonly EetLoebendeIssue[];
  computation: EetLoebendeComputation | null;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabValues;
  skadesdato: ISODateString | undefined;
  fodselsdato: ISODateString | undefined;
}>;

type ResolvedAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  eetPct: number;
  kapDato: ISODateString | undefined;
  kapPct: number;
  sortKey: string;
}>;

const SKAERING_2024_07_01 = '2024-07-01';
const SKAERING_2011_01_01 = '2011-01-01';

const toIssue = (id: string, message: string): EetLoebendeIssue => ({ id, severity: 'error', message });
const toWarning = (id: string, message: string): EetLoebendeIssue => ({ id, severity: 'warning', message });

const round0 = (value: number): number => roundByMethod(value, 0, 'halfAwayFromZero');
const round2 = (value: number): number => roundByMethod(value, 2, 'halfAwayFromZero');
const round4 = (value: number): number => roundByMethod(value, 4, 'halfAwayFromZero');
const roundNearest1000 = (value: number): number => roundByMethod(value / 1000, 0, 'halfAwayFromZero') * 1000;
const ceil12 = (value: number): number => Math.ceil(value / 12) * 12;

const parsePct = (raw: string | undefined): number | undefined => {
  const parsed = parsePercentDraft(raw);
  // 0 % giver ingen løbende ydelse og behandles derfor som ikke-deltagende række.
  if (parsed === undefined || parsed === 0) return undefined;
  return parsed;
};

const toYear = (iso: ISODateString): number => Number.parseInt(iso.slice(0, 4), 10);

const endOfYearIso = (year: number): ISODateString => `${year}-12-31` as ISODateString;

const minIso = (a: ISODateString, b: ISODateString): ISODateString => (a < b ? a : b);

const isoDayBefore = (iso: ISODateString): ISODateString | undefined => {
  const parsed = parseISODate(iso);
  if (!parsed) return undefined;
  return dateToISO(addDays(parsed, -1));
};

const isoDayAfter = (iso: ISODateString): ISODateString | undefined => {
  const parsed = parseISODate(iso);
  if (!parsed) return undefined;
  return dateToISO(addDays(parsed, 1));
};

const buildRateInfo = (
  year: number,
  before2024Skade: boolean,
  issues: EetLoebendeIssue[]
): Readonly<{ factor: number; reguleringPct: number }> | null => {
  if (before2024Skade) {
    if (year <= 2023) {
      const pct = reguleringsprocentErhvervsevnetab[year];
      if (!Number.isFinite(pct)) {
        issues.push(toIssue(`reguleringssats-missing-${year}`, `Reguleringssats mangler for år ${year}`));
        return null;
      }
      return { factor: 1 + pct / 100, reguleringPct: pct };
    }

    if (year === 2024) {
      const pct2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
      if (!Number.isFinite(pct2024)) {
        issues.push(toIssue('reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
        return null;
      }
      return { factor: 1, reguleringPct: 0 };
    }

    const pctFrom2024 = reguleringsprocentErhvervsevnetabFra2024[year];
    if (!Number.isFinite(pctFrom2024)) {
      issues.push(toIssue(`reguleringssats-missing-${year}`, `Reguleringssats mangler for år ${year}`));
      return null;
    }
    return { factor: 1 + pctFrom2024 / 100, reguleringPct: pctFrom2024 };
  }

  const pct = reguleringsprocentErhvervsevnetabFra2024[year];
  if (!Number.isFinite(pct)) {
    issues.push(toIssue(`reguleringssats-missing-${year}`, `Reguleringssats mangler for år ${year}`));
    return null;
  }
  return { factor: 1 + pct / 100, reguleringPct: pct };
};

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
      sortKey: row.id,
    });
  }

  return sortResolvedAfgoerelser(resolved);
};

const collectWarnings = (
  skadesdato: ISODateString,
  afgoerelser: readonly ResolvedAfgoerelse[],
  indtastetAarsloen: number,
  maxAarsloen: number,
  issues: EetLoebendeIssue[]
): void => {
  if (indtastetAarsloen === maxAarsloen) {
    issues.push(toWarning('warn-asl-aarsloen-is-max', 'Skadelidtes fulde årsløn skal indtastes - ikke maks årslønnen efter ASL'));
  }

  if (afgoerelser.some((row) => row.eetPct < 15)) {
    issues.push(toWarning('warn-asl-eet-under-15', 'Der er indtastet en afgørelse med < 15 % erhvervsevnetab.'));
  }

  if (
    skadesdato >= SKAERING_2024_07_01 &&
    afgoerelser.some((row) => row.eetPct > 15 && row.eetPct % 10 !== 0)
  ) {
    issues.push(
      toWarning(
        'warn-invalid-eet-pct-after-2024-07-01',
        'Der er indtastet en ugyldig EET-procent for de nye regler fra 1. juli 2024 og frem.'
      )
    );
  }

  const endeligDates = afgoerelser
    .filter((row) => row.afgoerelseType === 'Endelig')
    .map((row) => row.afgoerelsesdato);

  if (endeligDates.length > 0) {
    const earliestEndelig = endeligDates.reduce((earliest, current) => (current < earliest ? current : earliest));
    if (
      afgoerelser.some(
        (row) =>
          (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig') &&
          row.afgoerelsesdato > earliestEndelig
      )
    ) {
      issues.push(
        toWarning(
          'warn-non-endelig-after-endelig',
          'Der er angivet en midlertidig afgørelse efter en endelig afgørelse.'
        )
      );
    }
  }
};

const collectBlockingInputIssues = (rows: readonly AslAfgoerelseRow[], issues: EetLoebendeIssue[]): void => {
  const hasKapDatoWithoutKapPct = rows.some((row) => hasTextValue(row.kapDato) && !hasTextValue(row.kapPct));
  if (hasKapDatoWithoutKapPct) {
    issues.push(toIssue('kap-dato-without-kap-pct', 'Der er indtastet kapitaliseringsdato men ikke -procent'));
  }

  const hasKapPctWithoutKapDato = rows.some((row) => hasTextValue(row.kapPct) && !hasTextValue(row.kapDato));
  if (hasKapPctWithoutKapDato) {
    issues.push(toIssue('kap-pct-without-kap-dato', 'Der er indtastet kapitaliseringsprocent men ikke -dato'));
  }

  const hasEndeligUnder50WithoutKapInfo = rows.some((row) => {
    if (row.afgoerelseType !== 'Endelig') return false;
    const eetPct = parsePct(row.eetPct);
    if (eetPct === undefined || eetPct >= 50) return false;
    return !hasTextValue(row.kapDato) || !hasTextValue(row.kapPct);
  });
  if (hasEndeligUnder50WithoutKapInfo) {
    issues.push(
      toIssue(
        'endelig-under-50-missing-kapitalisering',
        'Endelig afgørelse under 50 % mangler oplysninger om kapitalisering.'
      )
    );
  }

  const hasDelvistEndeligWithoutKapInfo = rows.some((row) => {
    if (row.afgoerelseType !== 'Delvist endelig') return false;
    return !hasTextValue(row.kapDato) || !hasTextValue(row.kapPct);
  });
  if (hasDelvistEndeligWithoutKapInfo) {
    issues.push(
      toIssue(
        'delvist-endelig-missing-kapitalisering',
        'Der er angivet delvist endelig afgørelse uden kapitalisering.'
      )
    );
  }
};

const buildFullSectionPeriods = (
  args: Readonly<{
    virkningsdato: ISODateString;
    afgoerelsesdato: ISODateString;
    slutdato: ISODateString;
  }>
): Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> => {
  if (args.virkningsdato > args.slutdato) return [];
  const result: Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> = [];
  const virkningsaar = toYear(args.virkningsdato);
  const afgoerelsesaar = toYear(args.afgoerelsesdato);

  if (virkningsaar < afgoerelsesaar) {
    const firstEnd = minIso(args.slutdato, endOfYearIso(afgoerelsesaar));
    result.push({ fra: args.virkningsdato, til: firstEnd, satsAar: afgoerelsesaar });
    const nextStart = isoDayAfter(firstEnd);
    if (!nextStart || nextStart > args.slutdato) return result;

    let cursor = nextStart;
    while (cursor <= args.slutdato) {
      const year = toYear(cursor);
      const rowEnd = minIso(args.slutdato, endOfYearIso(year));
      result.push({ fra: cursor, til: rowEnd, satsAar: year });
      const after = isoDayAfter(rowEnd);
      if (!after || after > args.slutdato) break;
      cursor = after;
    }
    return result;
  }

  const firstSatsAar = args.virkningsdato <= args.afgoerelsesdato ? afgoerelsesaar : virkningsaar;
  const firstEnd = minIso(args.slutdato, endOfYearIso(virkningsaar));
  result.push({ fra: args.virkningsdato, til: firstEnd, satsAar: firstSatsAar });

  const nextStart = isoDayAfter(firstEnd);
  if (!nextStart || nextStart > args.slutdato) return result;

  let cursor = nextStart;
  while (cursor <= args.slutdato) {
    const year = toYear(cursor);
    const rowEnd = minIso(args.slutdato, endOfYearIso(year));
    result.push({ fra: cursor, til: rowEnd, satsAar: year });
    const after = isoDayAfter(rowEnd);
    if (!after || after > args.slutdato) break;
    cursor = after;
  }
  return result;
};

const buildRestSectionPeriods = (
  args: Readonly<{
    fra: ISODateString;
    til: ISODateString;
  }>
): Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> => {
  if (args.fra > args.til) return [];
  const result: Array<Readonly<{ fra: ISODateString; til: ISODateString; satsAar: number }>> = [];
  let cursor = args.fra;
  while (cursor <= args.til) {
    const year = toYear(cursor);
    const rowEnd = minIso(args.til, endOfYearIso(year));
    result.push({ fra: cursor, til: rowEnd, satsAar: year });
    const next = isoDayAfter(rowEnd);
    if (!next || next > args.til) break;
    cursor = next;
  }
  return result;
};

const resolveTvungenStopDato = (
  afgoerelseType: ResolvedAfgoerelse['afgoerelseType'],
  fodselsdato: ISODateString
): ISODateString | undefined => {
  if (afgoerelseType === 'Midlertidig') return undefined;
  const fpAlder = resolveFolkepensionsalder(fodselsdato);
  if (fpAlder === undefined) return undefined;
  const parsedBirth = parseISODate(fodselsdato);
  if (!parsedBirth) return undefined;
  const folkepensionsdato = addMonths(parsedBirth, fpAlder * 12);
  const tvungenKapDato = addMonths(folkepensionsdato, -24);
  const tvungenKapIso = dateToISO(tvungenKapDato);
  if (!tvungenKapIso) return undefined;
  return isoDayBefore(tvungenKapIso);
};

const OPHOER_AARSAG_PRIORITY: Readonly<Record<EetLoebendeAfgoerelseComputation['ophoerAarsag'], number>> = {
  'senere-afgoerelse': 1,
  'tvungen-kapitalisering': 2,
  kapitalisering: 3,
  beregningsdato: 4,
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

export const computeEetLoebendeYdelser = (input: Input): EetLoebendeCalculationResult => {
  const issues: EetLoebendeIssue[] = [];

  const beregningsdato = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  const skadesdato = input.skadesdato;
  const fodselsdato = input.fodselsdato;

  const aslAarsloenRaw = amountValueToNumber(input.erhvervsevnetab.aslAarsloen);

  if (!Number.isFinite(aslAarsloenRaw)) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt'));
  }
  if (!fodselsdato) {
    issues.push(toIssue('fodselsdato-missing', 'Fødselsdato er ikke udfyldt'));
  }
  if (!beregningsdato) {
    issues.push(toIssue('beregningsdato-missing', 'Beregningsdato er ikke udfyldt'));
  }
  if (!skadesdato) {
    issues.push(toIssue('skadesdato-missing', 'Skadesdato er ikke udfyldt'));
  }

  collectBlockingInputIssues(input.erhvervsevnetab.aslAfgoerelser, issues);

  const resolvedAfgoerelser = collectResolvedAfgoerelser(input.erhvervsevnetab.aslAfgoerelser);
  if (resolvedAfgoerelser.length === 0) {
    issues.push(
      toIssue(
        'asl-afgoerelser-empty',
        'Ingen afgørelser med erhvervsevnetabsprocent er udfyldt'
      )
    );
  }

  if (
    issues.some((issue) => issue.severity === 'error') ||
    !Number.isFinite(aslAarsloenRaw) ||
    !beregningsdato ||
    !skadesdato ||
    !fodselsdato
  ) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = toYear(skadesdato);
  const maxAarsloenISkadesaar = aarsloenMax[skadesaar];
  if (!Number.isFinite(maxAarsloenISkadesaar)) {
    issues.push(toIssue('aarsloen-max-missing', `Maksimum årsløn mangler for år ${skadesaar}`));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const aslAarsloen = aslAarsloenRaw as number;
  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = Math.min(aslAarsloenAfrundet1000, maxAarsloenISkadesaar);

  collectWarnings(skadesdato, resolvedAfgoerelser, aslAarsloen, maxAarsloenISkadesaar, issues);

  const before2024Skade = skadesdato < SKAERING_2024_07_01;
  const from2011 = skadesdato >= SKAERING_2011_01_01;
  const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
  if (before2024Skade && !Number.isFinite(reguleringFoer2024)) {
    issues.push(toIssue('reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const grundloen = before2024Skade
    ? round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2003 / maxAarsloenISkadesaar))
    : round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2024 / maxAarsloenISkadesaar));

  const erstatningsniveau = from2011 ? 0.83 : 0.8;
  const amFaktor = from2011 ? 0.92 : 1;
  const erstatningsniveauPct = from2011 ? 83 : 80;
  const amBidragPct = from2011 ? 8 : 0;

  const computations: EetLoebendeAfgoerelseComputation[] = [];

  for (let i = 0; i < resolvedAfgoerelser.length; i += 1) {
    const current = resolvedAfgoerelser[i];
    const next = resolvedAfgoerelser[i + 1];

    const priorKapPct = resolvedAfgoerelser
      .filter((row) => row.afgoerelsesdato < current.afgoerelsesdato)
      .reduce((sum, row) => sum + row.kapPct, 0);

    const kapPctKumulativ = priorKapPct + current.kapPct;
    const eetPctFoerAktuelKapRaw = current.eetPct - priorKapPct;
    const eetPctFoerAktuelKap = eetPctFoerAktuelKapRaw > 0 ? eetPctFoerAktuelKapRaw : 0;
    const restEetPctRaw = eetPctFoerAktuelKap - current.kapPct;
    const restEetPct = restEetPctRaw > 0 ? restEetPctRaw : 0;

    const hasKapitalisering = !!current.kapDato && current.kapPct > 0;
    const hasRestSection = hasKapitalisering && restEetPct > 0;

    const dayBeforeNextVirkning = next ? isoDayBefore(next.virkningsdato) : undefined;
    const tvungenStopDato = resolveTvungenStopDato(current.afgoerelseType, fodselsdato);
    const dayBeforeKapitalisering = current.kapDato ? isoDayBefore(current.kapDato) : undefined;

    const finalCandidates: Array<Readonly<{ date: ISODateString; cause: EetLoebendeAfgoerelseComputation['ophoerAarsag'] }>> = [
      { date: beregningsdato, cause: 'beregningsdato' },
    ];
    if (dayBeforeNextVirkning) finalCandidates.push({ date: dayBeforeNextVirkning, cause: 'senere-afgoerelse' });
    if (tvungenStopDato) finalCandidates.push({ date: tvungenStopDato, cause: 'tvungen-kapitalisering' });
    if (!hasRestSection && dayBeforeKapitalisering) {
      finalCandidates.push({ date: dayBeforeKapitalisering, cause: 'kapitalisering' });
    }

    const finalStop = finalCandidates.reduce((earliest, currentCandidate) => {
      if (currentCandidate.date < earliest.date) return currentCandidate;
      if (currentCandidate.date > earliest.date) return earliest;
      // Prioritet bruges kun som deterministisk tie-break ved identiske ophørsdatoer.
      return OPHOER_AARSAG_PRIORITY[currentCandidate.cause] < OPHOER_AARSAG_PRIORITY[earliest.cause]
        ? currentCandidate
        : earliest;
    });

    const fullSectionEnd = hasKapitalisering && dayBeforeKapitalisering
      ? minIso(finalStop.date, dayBeforeKapitalisering)
      : finalStop.date;

    const fullSectionPeriods = buildFullSectionPeriods({
      virkningsdato: current.virkningsdato,
      afgoerelsesdato: current.afgoerelsesdato,
      slutdato: fullSectionEnd,
    });

    const restSectionPeriods = hasRestSection && current.kapDato && current.kapDato <= finalStop.date
      ? buildRestSectionPeriods({ fra: current.kapDato, til: finalStop.date })
      : [];

    const fullPctFactor = eetPctFoerAktuelKap / 100;
    const grundydelseFuld = round2(grundloen * fullPctFactor * erstatningsniveau * amFaktor);
    const grundydelseRest =
      hasRestSection && eetPctFoerAktuelKap > 0
        ? round2(grundydelseFuld * (restEetPct / eetPctFoerAktuelKap))
        : null;

    const grundydelse2024Fuld = before2024Skade
      ? round2(grundydelseFuld * (1 + reguleringFoer2024 / 100))
      : grundydelseFuld;
    const grundydelse2024Rest =
      before2024Skade && grundydelseRest !== null
        ? round2(grundydelseRest * (1 + reguleringFoer2024 / 100))
        : grundydelseRest;

    const allPeriods = [...fullSectionPeriods, ...restSectionPeriods];
    const computedRows: EetLoebendePeriodeRow[] = [];

    for (const sectionRow of allPeriods) {
      const rateInfo = buildRateInfo(sectionRow.satsAar, before2024Skade, issues);
      if (rateInfo === null) continue;

      const usingRest = hasRestSection && current.kapDato !== undefined && sectionRow.fra >= current.kapDato;
      const grundydelseBase = usingRest ? grundydelseRest : grundydelseFuld;
      const grundydelse2024Base = usingRest ? grundydelse2024Rest : grundydelse2024Fuld;
      const effektivGrundydelseBase =
        before2024Skade && sectionRow.satsAar >= 2024 ? grundydelse2024Base : grundydelseBase;
      if (effektivGrundydelseBase === null) continue;

      const grundydelseAfrundet = effektivGrundydelseBase;
      const aarsydelse = ceil12(effektivGrundydelseBase * rateInfo.factor);
      const maanedligYdelse = aarsydelse / 12;
      const maanederPraecis = optaelMaanederPraecis({
        fra: sectionRow.fra,
        til: sectionRow.til,
        oevrigeFravaersdage: 0,
      });
      if (maanederPraecis === null) continue;

      computedRows.push({
        fra: sectionRow.fra,
        til: sectionRow.til,
        satsAar: sectionRow.satsAar,
        maanederPraecis,
        grundydelseAfrundet,
        reguleringPct: rateInfo.reguleringPct,
        maanedligYdelse,
        beregnetEet: round0(maanederPraecis * maanedligYdelse),
      });
    }

    const iAltBeregnetEet = computedRows.reduce((sum, row) => sum + row.beregnetEet, 0);

    computations.push({
      rowId: current.rowId,
      afgoerelsesdato: current.afgoerelsesdato,
      virkningsdato: current.virkningsdato,
      kapitaliseringsdato: hasKapitalisering && current.kapDato ? current.kapDato : null,
      afgoerelseType: current.afgoerelseType,
      eetPct: current.eetPct,
      priorKapPct,
      eetPctFoerAktuelKap,
      kapPctAktuel: current.kapPct,
      kapPctKumulativ,
      restEetPct,
      harKapitalisering: hasKapitalisering,
      harRestSektion: hasRestSection,
      tilbagevirkendeKraft: toYear(current.virkningsdato) < toYear(current.afgoerelsesdato),
      ophoerDato: finalStop.date,
      ophoerAarsag: finalStop.cause,
      grundydelseFuld,
      grundydelseRest,
      grundydelse2024Fuld,
      grundydelse2024Rest,
      perioder: computedRows,
      iAltBeregnetEet,
    });
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const computation: EetLoebendeComputation = {
    beregningsdato,
    skadesdato,
    fodselsdato,
    skadesaar,
    aslAarsloenAfrundet1000,
    maxAarsloenISkadesaar,
    benyttetAarsloen,
    grundloenNiveau: before2024Skade ? '2003' : '2024',
    grundloen,
    erstatningsniveauPct,
    amBidragPct,
    afgoerelser: computations,
  };

  return {
    issues: dedupeIssuesBySeverityAndMessage(issues),
    computation,
  };
};

export const formatPercentTrimmedFromRounded4 = (value: number): string => {
  const rounded = round4(value);
  const fixed = rounded.toFixed(4).replace('.', ',');
  return fixed.replace(/,?0+$/, '');
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
      return 'Beregningsdato';
    case 'senere-afgoerelse':
      return 'Senere afgørelse';
    case 'kapitalisering':
      return 'Kapitalisering';
    case 'tvungen-kapitalisering':
      return 'Tvungen kapitalisering';
    default:
      return cause;
  }
};

export const formatSkadesdatoCompact = (iso: ISODateString): string => {
  const [year, month, day] = iso.split('-');
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10);
  return `${d}/${m}-${year}`;
};

export const formatPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;
