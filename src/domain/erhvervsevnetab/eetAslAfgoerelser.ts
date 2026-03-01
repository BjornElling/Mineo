import type { AslAfgoerelseRow } from '../../schemas/formSchemas';
import { coerceToISODateString } from '../../types/branded';
import { createRowId } from '../rowId';

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

const parsePercentDraft = (raw: string | undefined): number | undefined => {
  if (!raw || raw.trim() === '') return undefined;
  const cleaned = raw.trim().replace(/\s*%$/, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
};

const hasValue = (raw: string | undefined): boolean =>
  typeof raw === 'string' && raw.trim() !== '';

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

export const validateKapPctByAfgoerelsestype = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row]
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasValue(row.kapPct)) {
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

  // Hard cap gælder altid, også hvis data kommer fra load/import.
  if (kapPctMedTidligere > 50) {
    return 'Kapitaliseringsprocent kan ikke overstige 50 % (inkl. tidligere kapitaliseringsprocenter)';
  }

  const eetPctRaw = parsePercentDraft(row.eetPct);
  const eetPct = eetPctRaw === 0 ? undefined : eetPctRaw;

  if (afgoerelsestype === 'Endelig') {
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
  row: AslAfgoerelseRow
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasValue(row.kapDato)) {
      return 'Kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype';
    }
  }
  return undefined;
};

export const validateTidlKapDatoByAfgoerelsestype = (
  row: AslAfgoerelseRow
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasValue(row.tidlKapDato)) {
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

