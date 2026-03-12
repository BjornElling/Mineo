import type { AslAfgoerelseRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { aarsloenMax } from '../../data/regulationRates';
import { formatAsAmount } from '../../utils/formatUtils';
import { createRowId } from '../rowId';
import { isUnderOrEqualTwoYearsToFpByBekendtgoerelse } from './eetKapitaliseringOpslag';

export const EET_ASL_MIN_VISIBLE_ROWS = 2;

export const createAslAfgoerelseRowId = (): string => createRowId('eet_asl');

export const createEmptyAslAfgoerelseRow = (): AslAfgoerelseRow => ({
  id: createAslAfgoerelseRowId(),
  afgoerelsesDato: undefined,
  virkningsDato: undefined,
  eetPct: undefined,
  kapDato: undefined,
  kapPct: undefined,
  afgoerelseType: undefined,
  tidlKapDato: undefined,
});

export const isAslAfgoerelseRowEmpty = (row: AslAfgoerelseRow): boolean =>
  !row.afgoerelsesDato &&
  !row.virkningsDato &&
  !row.eetPct &&
  !row.kapDato &&
  !row.kapPct &&
  !row.afgoerelseType &&
  !row.tidlKapDato;

export const parsePercentDraft = (raw: string | undefined): number | undefined => {
  if (!raw || raw.trim() === '') return undefined;
  const cleaned = raw.trim().replace(/\s*%$/, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
};

export const hasTextValue = (raw: string | undefined): boolean =>
  typeof raw === 'string' && raw.trim() !== '';

const DUPLICATE_AFGOERELSE_MESSAGE = 'Der er angivet to identiske afgørelser';

const assertNeverAfgoerelsestype = (_value: never): undefined => undefined;

const sumPriorKapPct = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[]
): number => {
  const currentAfgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
  if (currentAfgoerelsesdatoIso === undefined) return 0;

  return allRows.reduce((sum, candidate) => {
    if (candidate.id === row.id) return sum;
    const candidateAfgoerelsesdatoIso = coerceToISODateString(candidate.afgoerelsesDato);
    if (candidateAfgoerelsesdatoIso === undefined) return sum;
    if (candidateAfgoerelsesdatoIso >= currentAfgoerelsesdatoIso) return sum;
    const candidateKapPct = parsePercentDraft(candidate.kapPct);
    if (candidateKapPct === undefined) return sum;
    return sum + candidateKapPct;
  }, 0);
};

export const validateEetPctByPriorKapPct = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row]
): string | undefined => {
  const eetPct = parsePercentDraft(row.eetPct);
  if (eetPct === undefined || eetPct === 0) return undefined;

  const priorKapPctSum = sumPriorKapPct(row, allRows);
  if (priorKapPctSum <= 0) return undefined;

  if (eetPct <= priorKapPctSum) {
    return 'EET % skal være større end summen af kapitaliseringsprocenter fra tidligere afgørelser';
  }

  return undefined;
};

export const validateDuplicateAfgoerelseTriplet = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row]
): string | undefined => {
  const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
  const virkningsdatoIso = coerceToISODateString(row.virkningsDato);
  const afgoerelsestype = row.afgoerelseType;

  if (!afgoerelsesdatoIso || !virkningsdatoIso || !afgoerelsestype) return undefined;

  const rowIndex = allRows.findIndex((candidate) => candidate.id === row.id);
  if (rowIndex <= 0) return undefined;

  for (let i = 0; i < rowIndex; i += 1) {
    const candidate = allRows[i];
    const candidateAfgoerelsesdatoIso = coerceToISODateString(candidate.afgoerelsesDato);
    const candidateVirkningsdatoIso = coerceToISODateString(candidate.virkningsDato);

    if (
      candidateAfgoerelsesdatoIso === afgoerelsesdatoIso &&
      candidateVirkningsdatoIso === virkningsdatoIso &&
      candidate.afgoerelseType === afgoerelsestype
    ) {
      return DUPLICATE_AFGOERELSE_MESSAGE;
    }
  }

  return undefined;
};

export const validateKapPctByAfgoerelsestype = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row],
  skadesdato: ISODateString | undefined = undefined,
  fodselsdato: ISODateString | undefined = undefined
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.kapPct)) {
      return 'Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype';
    }
    return undefined;
  }

  const kapPct = parsePercentDraft(row.kapPct);
  if (afgoerelsestype === 'Delvist endelig' && kapPct === undefined) {
    return 'Kapitaliseringsprocent er påkrævet ved delvist endelig afgørelse';
  }
  if (kapPct === undefined) return undefined;
  const priorKapPctSum = sumPriorKapPct(row, allRows);
  const kapPctMedTidligere = kapPct + priorKapPctSum;

  const eetPctRaw = parsePercentDraft(row.eetPct);
  const eetPct = eetPctRaw === 0 ? undefined : eetPctRaw;
  const controlDateIso = coerceToISODateString(row.tidlKapDato) ?? coerceToISODateString(row.afgoerelsesDato);
  const isWithinTwoYearsRuleActive =
    afgoerelsestype === 'Endelig' &&
    skadesdato !== undefined &&
    fodselsdato !== undefined &&
    isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadesdato, fodselsdato, controlDateIso);

  if (afgoerelsestype === 'Endelig') {
    if (isWithinTwoYearsRuleActive) {
      if (eetPct !== undefined && kapPctMedTidligere !== eetPct) {
        return 'Ved < 2 år til folkepension kapitaliseres hele EET';
      }
      return undefined;
    }

    if (kapPctMedTidligere > 50) {
      return 'Kapitaliseringsprocent kan ikke overstige 50 % (inkl. tidligere kapitaliseringsprocenter)';
    }

    if (eetPct !== undefined && kapPctMedTidligere > eetPct) {
      return 'Kapitaliseringsprocent kan ikke være højere end EET % ved endelig afgørelse (inkl. tidligere kapitaliseringsprocenter)';
    }
    if (eetPct !== undefined && eetPct < 50 && kapPctMedTidligere < eetPct) {
      return 'Ved endelig afgørelse under 50 % skal samlet kapitaliseringsprocent (inkl. tidligere kapitaliseringsprocenter) svare til EET %';
    }
    return undefined;
  }

  if (afgoerelsestype === 'Delvist endelig') {
    if (kapPct < 5) {
      return 'Mindste kapitaliserbare andel er 5 %';
    }
    if (eetPct !== undefined) {
      const maxKapPct = Math.min(eetPct - 5, 50);
      if (kapPctMedTidligere > maxKapPct) {
        return 'Kapitaliseret andel overstiger tilladt maksimum (der skal restere mindst 5 % som midlertidig, og kapitalisering kan højst udgøre 50 %)';
      }
      if (kapPctMedTidligere > eetPct) {
        return 'Kapitaliseringsprocent kan ikke overstige EET %';
      }
    }
    return undefined;
  }

  return assertNeverAfgoerelsestype(afgoerelsestype);
};

export const validateKapDatoByAfgoerelsestype = (
  row: AslAfgoerelseRow,
  skadesdato: ISODateString | undefined = undefined,
  fodselsdato: ISODateString | undefined = undefined
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  const virkningsdatoIso = coerceToISODateString(row.virkningsDato);
  const kapDatoIso = coerceToISODateString(row.kapDato);
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.kapDato)) {
      return 'Kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype';
    }
  }

  if (kapDatoIso !== undefined && virkningsdatoIso !== undefined && kapDatoIso < virkningsdatoIso) {
    return 'Kapitaliseringsdato er før virkningsdato';
  }

  if (hasTextValue(row.tidlKapDato)) {
    const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
    if (
      afgoerelsesdatoIso !== undefined &&
      afgoerelsesdatoIso >= '2024-07-01' &&
      kapDatoIso !== undefined &&
      kapDatoIso !== afgoerelsesdatoIso
    ) {
      return 'Fra 1. juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse';
    }
  }

  const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
  const controlDateIso = coerceToISODateString(row.tidlKapDato) ?? afgoerelsesdatoIso;
  const isWithinTwoYearsRuleActive =
    afgoerelsestype === 'Endelig' &&
    kapDatoIso !== undefined &&
    skadesdato !== undefined &&
    fodselsdato !== undefined &&
    isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadesdato, fodselsdato, controlDateIso);

  if (isWithinTwoYearsRuleActive && kapDatoIso !== afgoerelsesdatoIso) {
    return 'Ved < 2 år til folkepension sker kapitalisering fra afgørelsesdagen';
  }

  return undefined;
};

export type EetAslAfgoerelseValidationField =
  | 'afgoerelsesDato'
  | 'virkningsDato'
  | 'eetPct'
  | 'afgoerelseType'
  | 'kapDato'
  | 'kapPct'
  | 'tidlKapDato';

export type EetAslAfgoerelseValidationIssue = Readonly<{
  rowId: string;
  field: EetAslAfgoerelseValidationField;
  message: string;
}>;

export const collectEetAslAfgoerelseValidationIssues = (
  rows: readonly AslAfgoerelseRow[],
  skadesdato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined
): EetAslAfgoerelseValidationIssue[] => {
  const issues: EetAslAfgoerelseValidationIssue[] = [];

  for (const row of rows) {
    const duplicateTripletError = validateDuplicateAfgoerelseTriplet(row, rows);
    if (duplicateTripletError) {
      issues.push({ rowId: row.id, field: 'afgoerelsesDato', message: duplicateTripletError });
      issues.push({ rowId: row.id, field: 'virkningsDato', message: duplicateTripletError });
      issues.push({ rowId: row.id, field: 'afgoerelseType', message: duplicateTripletError });
    }

    const eetPctError =
      validatePercentDivisibleBy5FromDraft(row.eetPct, 'EET %') ??
      validateEetPctByPriorKapPct(row, rows);
    if (eetPctError) {
      issues.push({ rowId: row.id, field: 'eetPct', message: eetPctError });
    }

    const kapDatoError = validateKapDatoByAfgoerelsestype(row, skadesdato, fodselsdato);
    if (kapDatoError) {
      issues.push({ rowId: row.id, field: 'kapDato', message: kapDatoError });
    }

    const kapPctError =
      validatePercentDivisibleBy5FromDraft(row.kapPct, 'Kapitaliseringsprocent') ??
      validateKapPctByAfgoerelsestype(row, rows, skadesdato, fodselsdato);
    if (kapPctError) {
      issues.push({ rowId: row.id, field: 'kapPct', message: kapPctError });
    }

    const tidlKapDatoError = validateTidlKapDatoByAfgoerelsestype(row);
    if (tidlKapDatoError) {
      issues.push({ rowId: row.id, field: 'tidlKapDato', message: tidlKapDatoError });
    }
  }

  return issues;
};

export const validateTidlKapDatoByAfgoerelsestype = (
  row: AslAfgoerelseRow
): string | undefined => {
  if (hasTextValue(row.tidlKapDato) && !hasTextValue(row.kapDato)) {
    return 'Kun relevant ved tidligere kapitalisering';
  }

  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.tidlKapDato)) {
      return 'Tidligere kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype';
    }
  }
  return undefined;
};

export const validatePercentDivisibleBy5FromDraft = (
  raw: string | undefined,
  label: string
): string | undefined => {
  const parsed = parsePercentDraft(raw);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed)) return `${label} skal være et heltal`;
  if (parsed % 5 !== 0) return `${label} skal være deleligt med 5`;
  return undefined;
};

export const validatePercentDivisibleBy5FromValue = (
  value: number | undefined,
  label: string
): string | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value)) return `${label} skal være et heltal`;
  if (value % 5 !== 0) return `${label} skal være deleligt med 5`;
  return undefined;
};

export const validateAslAarsloenDivisibleBy1000 = (
  aarsloen: number | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (aarsloen % 1000 !== 0) return 'Årsløn skal være delelig med 1000';
  return undefined;
};

export const validateAslAarsloenBySkadesaarMax = (
  aarsloen: number | undefined,
  skadesdatoIso: ISODateString | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (skadesdatoIso === undefined) return undefined;

  const skadesaar = Number.parseInt(skadesdatoIso.slice(0, 4), 10);
  if (!Number.isFinite(skadesaar)) return undefined;

  const maxAarsloen = aarsloenMax[skadesaar];
  if (!Number.isFinite(maxAarsloen)) return undefined;
  if (aarsloen <= maxAarsloen) return undefined;

  return `Årsløn kan ikke overstige maks årslønnen i skadesåret (${formatAsAmount(maxAarsloen, 0)} kr.)`;
};
