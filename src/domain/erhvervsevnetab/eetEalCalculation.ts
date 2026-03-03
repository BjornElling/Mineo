import type { ErhvervsevnetabValues, AslAfgoerelseRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, parseISODate } from '../../types/branded';
import type { YearlyRate } from '../../data/regulationRates';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { roundByMethod } from '../../utils/rounding';
import {
  parsePercentDraft,
  validatePercentDivisibleBy5FromDraft,
  validatePercentDivisibleBy5FromValue,
} from './eetAslAfgoerelser';

export type EetEalIssue = Readonly<{
  id: string;
  severity: 'error' | 'warning';
  message: string;
}>;

export type EetEalResolvedEetPct = Readonly<{
  value: number;
  source: 'eal' | 'asl';
  rowId?: string;
}>;

export type EetEalComputation = Readonly<{
  beregningsdato: ISODateString;
  skadesdato: ISODateString;
  fodselsdato: ISODateString;
  skadesaar: number;
  beregningsaar: number;
  aarsloen: number;
  aarsloenSource: 'eal' | 'asl';
  reguleringsaar: readonly number[];
  reguleringsPctRounded4: number;
  reguleretAarsloen: number;
  eetPct: number;
  eetPctSource: 'eal' | 'asl';
  kapitaliseringsfaktor: 10;
  eetBeregnet: number;
  eetMaks: number;
  eetAnvendt: number;
  eetReduceretTilMaks: boolean;
  alderVedSkade: number;
  aldersreduktionPct: number;
  aldersreduktionBeloeb: number;
  ealKrav: number;
}>;

export type EetEalCalculationResult = Readonly<{
  issues: readonly EetEalIssue[];
  computation: EetEalComputation | null;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabValues;
  skadesdato: ISODateString | undefined;
  fodselsdato: ISODateString | undefined;
  reguleringssats: YearlyRate;
  erhvervsevnetabMax: YearlyRate;
  aarsloenMax: YearlyRate;
}>;

const round0 = (value: number): number => roundByMethod(value, 0, 'halfAwayFromZero');
const round4 = (value: number): number => roundByMethod(value, 4, 'halfAwayFromZero');
const round500 = (value: number): number => roundByMethod(value / 500, 0, 'halfAwayFromZero') * 500;

const toIssue = (id: string, message: string): EetEalIssue => ({
  id,
  severity: 'error',
  message,
});

const toWarning = (id: string, message: string): EetEalIssue => ({
  id,
  severity: 'warning',
  message,
});

const calculateAgeInWholeYears = (fodselsdato: ISODateString, skadesdato: ISODateString): number | null => {
  const birthDate = parseISODate(fodselsdato);
  const injuryDate = parseISODate(skadesdato);
  if (!birthDate || !injuryDate) return null;

  let age = injuryDate.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    injuryDate.getUTCMonth() < birthDate.getUTCMonth() ||
    (injuryDate.getUTCMonth() === birthDate.getUTCMonth() && injuryDate.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
};

const calculateAldersreduktionPct = (ageAtInjury: number): number => {
  if (!Number.isFinite(ageAtInjury) || ageAtInjury <= 29) return 0;
  const cappedAge = Math.min(ageAtInjury, 69);
  const base = cappedAge - 29;
  const extra = ageAtInjury > 54 ? 2 * (cappedAge - 54) : 0;
  return base + extra;
};

const toIsoDate = (value: unknown): ISODateString | undefined => coerceToISODateString(value);

const compareIso = (a: ISODateString, b: ISODateString): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const resolveEetPctFromAslRows = (
  rows: readonly AslAfgoerelseRow[]
): { resolved: EetEalResolvedEetPct | null; issues: EetEalIssue[] } => {
  const issues: EetEalIssue[] = [];
  const rowsWithAfgoerelsesdato = rows
    .map((row) => ({ row, afgoerelsesdato: toIsoDate(row.afgoerelsesDato) }))
    .filter((entry): entry is { row: AslAfgoerelseRow; afgoerelsesdato: ISODateString } => entry.afgoerelsesdato !== undefined);

  if (rowsWithAfgoerelsesdato.length === 0) {
    return { resolved: null, issues };
  }

  const latestAfgoerelsesdato = rowsWithAfgoerelsesdato.reduce((latest, current) => {
    return compareIso(current.afgoerelsesdato, latest) > 0 ? current.afgoerelsesdato : latest;
  }, rowsWithAfgoerelsesdato[0].afgoerelsesdato);

  const sameAfgoerelsesdato = rowsWithAfgoerelsesdato.filter(
    (entry) => entry.afgoerelsesdato === latestAfgoerelsesdato
  );

  const withVirkningsdato = sameAfgoerelsesdato
    .map((entry) => ({ ...entry, virkningsdato: toIsoDate(entry.row.virkningsDato) }))
    .filter(
      (entry): entry is { row: AslAfgoerelseRow; afgoerelsesdato: ISODateString; virkningsdato: ISODateString } =>
        entry.virkningsdato !== undefined
    );

  const maxVirkningsdato = withVirkningsdato.length > 0
    ? withVirkningsdato.reduce((latest, current) => {
      return compareIso(current.virkningsdato, latest) > 0 ? current.virkningsdato : latest;
    }, withVirkningsdato[0].virkningsdato)
    : null;

  const tiedOnDates =
    maxVirkningsdato === null
      ? sameAfgoerelsesdato
      : withVirkningsdato.filter((entry) => entry.virkningsdato === maxVirkningsdato);

  const endelig = tiedOnDates.filter((entry) => entry.row.afgoerelseType === 'Endelig');
  if (endelig.length >= 2) {
    issues.push(
      toIssue(
        'asl-identical-endelig',
        'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato, begge markeret som Endelig'
      )
    );
    return { resolved: null, issues };
  }

  const delvist = tiedOnDates.filter((entry) => entry.row.afgoerelseType === 'Delvist endelig');
  const selected = endelig[0] ?? delvist[0] ?? tiedOnDates[0];
  if (!selected) return { resolved: null, issues };

  const eetPctDivisibleError = validatePercentDivisibleBy5FromDraft(selected.row.eetPct, 'EET %');
  if (eetPctDivisibleError) {
    issues.push(toIssue('asl-selected-eet-pct-invalid', eetPctDivisibleError));
    return { resolved: null, issues };
  }

  const parsed = parsePercentDraft(selected.row.eetPct);
  if (parsed === undefined || parsed === 0) {
    return { resolved: null, issues };
  }

  return {
    resolved: {
      value: parsed,
      source: 'asl',
      rowId: selected.row.id,
    },
    issues,
  };
};

const resolveEetPct = (
  values: ErhvervsevnetabValues
): { resolved: EetEalResolvedEetPct | null; issues: EetEalIssue[] } => {
  const issues: EetEalIssue[] = [];

  const ealDivisibleError = validatePercentDivisibleBy5FromValue(values.ealEetPct, 'EET %');
  if (ealDivisibleError) {
    issues.push(toIssue('eal-eet-pct-invalid', ealDivisibleError));
    return { resolved: null, issues };
  }

  if (values.ealEetPct !== undefined && values.ealEetPct !== 0) {
    return {
      resolved: {
        value: values.ealEetPct,
        source: 'eal',
      },
      issues,
    };
  }

  const fallback = resolveEetPctFromAslRows(values.aslAfgoerelser ?? []);
  issues.push(...fallback.issues);
  return { resolved: fallback.resolved, issues };
};

const resolveAarsloen = (values: ErhvervsevnetabValues): { value: number | null; source: 'eal' | 'asl' | null } => {
  const ealAarsloen = amountValueToNumber(values.ealAarsloen);
  if (typeof ealAarsloen === 'number' && Number.isFinite(ealAarsloen) && ealAarsloen > 0) {
    return { value: ealAarsloen, source: 'eal' };
  }
  const aslAarsloen = amountValueToNumber(values.aslAarsloen);
  if (typeof aslAarsloen === 'number' && Number.isFinite(aslAarsloen) && aslAarsloen > 0) {
    return { value: aslAarsloen, source: 'asl' };
  }
  return { value: null, source: null };
};

export const computeEetEalCalculation = (input: Input): EetEalCalculationResult => {
  const issues: EetEalIssue[] = [];
  const values = input.erhvervsevnetab;

  const beregningsdato = toIsoDate(values.beregningsdato);
  const skadesdato = input.skadesdato;
  const fodselsdato = input.fodselsdato;

  const aarsloen = resolveAarsloen(values);
  if (aarsloen.value === null || aarsloen.source === null) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt'));
  }

  const eetPctResolution = resolveEetPct(values);
  issues.push(...eetPctResolution.issues);
  if (!eetPctResolution.resolved) {
    issues.push(toIssue('eet-pct-missing', 'Erhvervsevnetabsprocent er ikke udfyldt'));
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

  const hasBlockingIssues = issues.some((issue) => issue.severity === 'error');
  if (hasBlockingIssues || !aarsloen.value || !aarsloen.source || !eetPctResolution.resolved || !beregningsdato || !skadesdato || !fodselsdato) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = Number.parseInt(skadesdato.slice(0, 4), 10);
  const beregningsaar = Number.parseInt(beregningsdato.slice(0, 4), 10);
  const reguleringsaar: number[] = [];
  for (let year = skadesaar + 1; year <= beregningsaar; year += 1) {
    reguleringsaar.push(year);
  }

  const manglendeReguleringsaar = reguleringsaar.filter((year) => {
    const sats = input.reguleringssats[year];
    return !Number.isFinite(sats);
  });
  if (manglendeReguleringsaar.length > 0) {
    issues.push(
      toIssue(
        'reguleringssats-missing',
        `Reguleringssats mangler for år ${manglendeReguleringsaar.join(', ')}`
      )
    );
  }

  const eetMaks = input.erhvervsevnetabMax[beregningsaar];
  if (!Number.isFinite(eetMaks)) {
    issues.push(toIssue('eet-max-missing', `Maksimum for erhvervsevnetab mangler for år ${beregningsaar}`));
  }

  const alderVedSkade = calculateAgeInWholeYears(fodselsdato, skadesdato);
  if (alderVedSkade === null) {
    issues.push(toIssue('alder-unresolved', 'Alder på skadestidspunkt kan ikke beregnes'));
  }

  const blockingIssues = issues.some((issue) => issue.severity === 'error');

  if (values.ealEetPct !== undefined && values.ealEetPct !== 0 && values.ealEetPct < 15) {
    issues.push(toWarning('warn-eal-eet-under-15', 'Der er angivet et EET efter EAL på mindre end 15 %'));
  }

  if (
    (values.ealEetPct === undefined || values.ealEetPct === 0) &&
    eetPctResolution.resolved?.source === 'asl' &&
    eetPctResolution.resolved.value < 15
  ) {
    issues.push(toWarning('warn-asl-eet-under-15', 'Der er angivet et EET på mindre end 15 %'));
  }

  const ealAarsloenInput = amountValueToNumber(values.ealAarsloen);
  const aslAarsloenInput = amountValueToNumber(values.aslAarsloen);
  const maxAarsloenForSkadesaar = input.aarsloenMax[skadesaar];
  const maxAarsloenWarningMessage =
    'Skadelidtes fulde årsløn skal indtastes - ikke maks årslønnen efter ASL';
  const isSkadeFraJuli2024EllerSenere = skadesdato >= '2024-07-01';

  if (
    isSkadeFraJuli2024EllerSenere &&
    (ealAarsloenInput === undefined || !Number.isFinite(ealAarsloenInput))
  ) {
    issues.push(
      toWarning(
        'warn-eal-aarsloen-empty-for-2024-07-01',
        'For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL'
      )
    );
  }

  if (Number.isFinite(maxAarsloenForSkadesaar)) {
    if (
      Number.isFinite(ealAarsloenInput) &&
      ealAarsloenInput !== undefined &&
      ealAarsloenInput === maxAarsloenForSkadesaar
    ) {
      issues.push(toWarning('warn-eal-aarsloen-is-max', maxAarsloenWarningMessage));
    } else if (
      (ealAarsloenInput === undefined || !Number.isFinite(ealAarsloenInput)) &&
      Number.isFinite(aslAarsloenInput) &&
      aslAarsloenInput !== undefined &&
      aslAarsloenInput === maxAarsloenForSkadesaar
    ) {
      issues.push(toWarning('warn-asl-aarsloen-is-max', maxAarsloenWarningMessage));
    }
  }

  if (blockingIssues || !Number.isFinite(eetMaks) || alderVedSkade === null) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  let reguleringsfaktor = 1;
  for (const year of reguleringsaar) {
    reguleringsfaktor *= 1 + input.reguleringssats[year] / 100;
  }

  const reguleringsPctRounded4 = round4((reguleringsfaktor - 1) * 100);
  const reguleringsfaktorRounded4 = 1 + reguleringsPctRounded4 / 100;
  const reguleretAarsloen = reguleringsaar.length > 0
    ? round500(aarsloen.value * reguleringsfaktorRounded4)
    : aarsloen.value;

  const eetBeregnet = round0(reguleretAarsloen * 10 * (eetPctResolution.resolved.value / 100));
  const eetReduceretTilMaks = eetBeregnet > eetMaks;
  const eetAnvendt = eetReduceretTilMaks ? eetMaks : eetBeregnet;

  const aldersreduktionPct = calculateAldersreduktionPct(alderVedSkade);
  const aldersreduktionBeloeb = round0(eetAnvendt * (aldersreduktionPct / 100));
  const ealKrav = Math.max(0, round0(eetAnvendt - aldersreduktionBeloeb));

  const computation: EetEalComputation = {
    beregningsdato,
    skadesdato,
    fodselsdato,
    skadesaar,
    beregningsaar,
    aarsloen: aarsloen.value,
    aarsloenSource: aarsloen.source,
    reguleringsaar,
    reguleringsPctRounded4,
    reguleretAarsloen,
    eetPct: eetPctResolution.resolved.value,
    eetPctSource: eetPctResolution.resolved.source,
    kapitaliseringsfaktor: 10,
    eetBeregnet,
    eetMaks,
    eetAnvendt,
    eetReduceretTilMaks,
    alderVedSkade,
    aldersreduktionPct,
    aldersreduktionBeloeb,
    ealKrav,
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

export const formatDateShortForEet = (iso: ISODateString): string => {
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year}`;
};
