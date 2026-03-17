import type { ErhvervsevnetabValues, AslAfgoerelseRow } from '../../schemas/formSchemas';
import type { EetIssue } from './eetTypes';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, parseISODate } from '../../types/branded';
import type { YearlyRate } from '../../data/regulationRates';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatIsoDateShort } from '../../utils/dateFormatting';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { roundByMethod } from '../../utils/rounding';
import {
  ASL_IDENTICAL_AFGOERELSER_ID,
  hasIdenticalAfgoerelser,
  parsePercentDraft,
  validatePercentDivisibleBy5FromDraft,
  validatePercentDivisibleBy5FromValue,
} from './eetAslAfgoerelser';
import { round0, round4 } from './eetRounding';

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
  // Alder brugt i aldersreduktionsformlen — capped til 69 ved > 69 år
  alderVedSkadeCapped: number;
  aldersreduktionPct: number;
  aldersreduktionBeloeb: number;
  ealKrav: number;
}>;

export type EetEalCalculationResult = Readonly<{
  issues: readonly EetIssue[];
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

const round500 = (value: number): number => roundByMethod(value / 500, 0, 'halfAwayFromZero') * 500;

const toIssue = (id: string, message: string): EetIssue => ({
  id,
  severity: 'error',
  message,
});

const toWarning = (id: string, message: string): EetIssue => ({
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

export const buildAldersreduktionFormelTekst = (alderVedSkade: number, alderVedSkadeCapped: number): string => {
  if (alderVedSkade <= 29) return '0 =';
  if (alderVedSkade > 54) return `(${alderVedSkadeCapped} - 29) + (${alderVedSkadeCapped} - 54) x 2 =`;
  return `(${alderVedSkade} - 29) =`;
};


const resolveEetPctFromAslRows = (
  rows: readonly AslAfgoerelseRow[]
): { resolved: EetEalResolvedEetPct | null; issues: EetIssue[] } => {
  const issues: EetIssue[] = [];
  const rowsWithAfgoerelsesdato = rows
    .map((row) => ({ row, afgoerelsesdato: coerceToISODateString(row.afgoerelsesDato) }))
    .filter((entry): entry is { row: AslAfgoerelseRow; afgoerelsesdato: ISODateString } => entry.afgoerelsesdato !== undefined);

  if (rowsWithAfgoerelsesdato.length === 0) {
    return { resolved: null, issues };
  }

  const latestAfgoerelsesdato = rowsWithAfgoerelsesdato.reduce((latest, current) => {
    return current.afgoerelsesdato > latest ? current.afgoerelsesdato : latest;
  }, rowsWithAfgoerelsesdato[0].afgoerelsesdato);

  const sameAfgoerelsesdato = rowsWithAfgoerelsesdato.filter(
    (entry) => entry.afgoerelsesdato === latestAfgoerelsesdato
  );

  const withVirkningsdato = sameAfgoerelsesdato
    .map((entry) => ({ ...entry, virkningsdato: coerceToISODateString(entry.row.virkningsDato) }))
    .filter(
      (entry): entry is { row: AslAfgoerelseRow; afgoerelsesdato: ISODateString; virkningsdato: ISODateString } =>
        entry.virkningsdato !== undefined
    );

  const maxVirkningsdato = withVirkningsdato.length > 0
    ? withVirkningsdato.reduce((latest, current) => {
      return current.virkningsdato > latest ? current.virkningsdato : latest;
    }, withVirkningsdato[0].virkningsdato)
    : null;

  const tiedOnDates =
    maxVirkningsdato === null
      ? sameAfgoerelsesdato
      : withVirkningsdato.filter((entry) => entry.virkningsdato === maxVirkningsdato);

  const endelig = tiedOnDates.filter((entry) => entry.row.afgoerelseType === 'Endelig');
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
): { resolved: EetEalResolvedEetPct | null; issues: EetIssue[] } => {
  const issues: EetIssue[] = [];

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

const computeEalReguleringsfaktorFromYearlyChain = (
  skadesaar: number,
  beregningsaar: number,
  reguleringssats: YearlyRate
): Readonly<{ reguleringsaar: number[]; manglendeAar: number[]; faktor: number }> => {
  const reguleringsaar: number[] = [];
  for (let year = skadesaar + 1; year <= beregningsaar; year += 1) {
    reguleringsaar.push(year);
  }

  const manglendeAar = reguleringsaar.filter((year) => {
    const sats = reguleringssats[year];
    return !Number.isFinite(sats);
  });

  let faktor = 1;
  for (const year of reguleringsaar) {
    faktor *= 1 + reguleringssats[year] / 100;
  }

  return { reguleringsaar, manglendeAar, faktor };
};

export const computeEetEalCalculation = (input: Input): EetEalCalculationResult => {
  const issues: EetIssue[] = [];
  const values = input.erhvervsevnetab;

  const beregningsdato = coerceToISODateString(values.beregningsdato);
  const skadesdato = input.skadesdato;
  const fodselsdato = input.fodselsdato;

  const aarsloen = resolveAarsloen(values);
  // amountValueToNumber returnerer undefined for ikke-udfyldt felt og 0 for et committed 0-beløb.
  // Rækkefølgen herunder er intentionel: explicit 0 er en fejl; undefined er "mangler".
  const ealAarsloenRaw = amountValueToNumber(values.ealAarsloen);
  const aslAarsloenRaw = amountValueToNumber(values.aslAarsloen);
  if (ealAarsloenRaw === 0) {
    issues.push(toIssue('eal-aarsloen-zero', 'EAL-årsløn må ikke være 0 kr.'));
  } else if (aslAarsloenRaw === 0) {
    issues.push(toIssue('aarsloen-zero', 'Årsløn må ikke være 0 kr.'));
  } else if (aarsloen.value === null || aarsloen.source === null) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt.'));
  }

  if (hasIdenticalAfgoerelser(values.aslAfgoerelser ?? [])) {
    issues.push(toIssue(ASL_IDENTICAL_AFGOERELSER_ID, 'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato.'));
  }

  const eetPctResolution = resolveEetPct(values);
  issues.push(...eetPctResolution.issues);
  if (!eetPctResolution.resolved && eetPctResolution.issues.length === 0) {
    issues.push(toIssue('eet-pct-missing', 'Erhvervsevnetabsprocent er ikke udfyldt.'));
  }

  if (!fodselsdato) {
    issues.push(toIssue('fodselsdato-missing', 'Fødselsdato er ikke udfyldt.'));
  }
  if (!beregningsdato) {
    issues.push(toIssue('beregningsdato-missing', 'Beregningsdato er ikke udfyldt.'));
  }
  if (!skadesdato) {
    issues.push(toIssue('skadesdato-missing', 'Skadesdato er ikke udfyldt.'));
  }

  const hasBlockingIssues = issues.some((issue) => issue.severity === 'error');
  if (hasBlockingIssues || !aarsloen.value || !aarsloen.source || !eetPctResolution.resolved || !beregningsdato || !skadesdato || !fodselsdato) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = Number.parseInt(skadesdato.slice(0, 4), 10);
  const beregningsaar = Number.parseInt(beregningsdato.slice(0, 4), 10);
  const ealRegulering = computeEalReguleringsfaktorFromYearlyChain(skadesaar, beregningsaar, input.reguleringssats);
  const reguleringsaar = ealRegulering.reguleringsaar;
  const manglendeReguleringsaar = ealRegulering.manglendeAar;
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
    issues.push(toIssue('alder-unresolved', 'Alder på skadestidspunkt kan ikke beregnes.'));
  }

  const blockingIssues = issues.some((issue) => issue.severity === 'error');

  if (values.ealEetPct !== undefined && values.ealEetPct !== 0 && values.ealEetPct < 15) {
    issues.push(toWarning('warn-eal-eet-under-15', 'Der er angivet et EET efter EAL på mindre end 15 %.'));
  }

  if (
    (values.ealEetPct === undefined || values.ealEetPct === 0) &&
    eetPctResolution.resolved?.source === 'asl' &&
    eetPctResolution.resolved.value < 15
  ) {
    issues.push(toWarning('warn-asl-eet-under-15', 'Der er angivet et EET på mindre end 15 %.'));
  }

  const ealAarsloenInput = amountValueToNumber(values.ealAarsloen);
  const maxAarsloenForSkadesaar = input.aarsloenMax[skadesaar];
  const maxAarsloenWarningMessage =
    'Skadelidtes fulde årsløn skal indtastes for EAL — ikke maks. årslønnen efter ASL.';
  const isSkadeFraJuli2024EllerSenere = skadesdato >= '2024-07-01';

  if (
    isSkadeFraJuli2024EllerSenere &&
    (ealAarsloenInput === undefined || !Number.isFinite(ealAarsloenInput))
  ) {
    issues.push(
      toWarning(
        'warn-eal-aarsloen-empty-for-2024-07-01',
        'For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL.'
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
      aarsloen.source === 'asl'
    ) {
      const aslAarsloenValue = amountValueToNumber(values.aslAarsloen);
      if (typeof aslAarsloenValue === 'number' && aslAarsloenValue === maxAarsloenForSkadesaar) {
        issues.push(toWarning('warn-asl-aarsloen-is-max', maxAarsloenWarningMessage));
      }
    }
  }

  if (blockingIssues || !Number.isFinite(eetMaks) || alderVedSkade === null) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const reguleringsfaktor = ealRegulering.faktor;

  const reguleringsPctRounded4 = round4((reguleringsfaktor - 1) * 100);
  const reguleringsfaktorRounded4 = 1 + reguleringsPctRounded4 / 100;
  const reguleretAarsloen = reguleringsaar.length > 0
    ? round500(aarsloen.value * reguleringsfaktorRounded4)
    : aarsloen.value;

  const eetBeregnet = round0(reguleretAarsloen * 10 * (eetPctResolution.resolved.value / 100));
  const eetReduceretTilMaks = eetBeregnet > eetMaks;
  const eetAnvendt = eetReduceretTilMaks ? eetMaks : eetBeregnet;

  const alderVedSkadeCapped = Math.min(alderVedSkade, 69);
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
    alderVedSkadeCapped,
    aldersreduktionPct,
    aldersreduktionBeloeb,
    ealKrav,
  };

  return {
    issues: dedupeIssuesBySeverityAndMessage(issues),
    computation,
  };
};

export { formatPercentTrimmedFromRounded4 } from './eetLoebendeYdelserCalculation';

