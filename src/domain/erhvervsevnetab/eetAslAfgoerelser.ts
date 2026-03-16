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

const DUPLICATE_AFGOERELSE_MESSAGE = 'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato.';

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
    return 'EET % skal være større end summen af kapitaliseringsprocenter fra tidligere afgørelser.';
  }

  return undefined;
};

export const validateDuplicateAfgoerelse = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row]
): string | undefined => {
  const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
  const virkningsdatoIso = coerceToISODateString(row.virkningsDato);

  if (!afgoerelsesdatoIso || !virkningsdatoIso) return undefined;

  const rowIndex = allRows.findIndex((candidate) => candidate.id === row.id);
  if (rowIndex <= 0) return undefined;

  for (let i = 0; i < rowIndex; i += 1) {
    const candidate = allRows[i];
    const candidateAfgoerelsesdatoIso = coerceToISODateString(candidate.afgoerelsesDato);
    const candidateVirkningsdatoIso = coerceToISODateString(candidate.virkningsDato);

    if (
      candidateAfgoerelsesdatoIso === afgoerelsesdatoIso &&
      candidateVirkningsdatoIso === virkningsdatoIso
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
      return 'Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.';
    }
    return undefined;
  }

  const kapPct = parsePercentDraft(row.kapPct);
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
        return 'Ved < 2 år til folkepension kapitaliseres hele EET.';
      }
      return undefined;
    }

    if (kapPctMedTidligere > 50) {
      return 'Kapitaliseringsprocent kan ikke overstige 50 % (inkl. tidligere kapitaliseringsprocenter).';
    }

    if (eetPct !== undefined && kapPctMedTidligere > eetPct) {
      return priorKapPctSum > 0
        ? 'Angivelse af Kap. % skal ske med fradrag for tidligere kapitalisering.'
        : 'Der kan ikke kapitaliseres mere end det samlede EET.';
    }
    if (eetPct !== undefined && eetPct < 50 && kapPctMedTidligere < eetPct) {
      return 'Ved endelig afgørelse under 50 % skal samlet kapitaliseringsprocent (inkl. tidligere kapitaliseringsprocenter) svare til EET %.';
    }
    return undefined;
  }

  if (afgoerelsestype === 'Delvist endelig') {
    // Bemærk: krav om at kap. % skal udfyldes ved "Delvist endelig" håndhæves ikke her
    // (feltniveau), men via collectIncompleteRowIssues (faneniveau). Det er en bevidst
    // trade-off: brugeren kan midlertidigt gemme en delvist udfyldt rækkeindtastning
    // uden at blive blokeret på feltet, men kan ikke downloade PDF'en.
    if (kapPct < 5) {
      return 'Mindste kapitaliserbare andel er 5 %.';
    }
    if (eetPct !== undefined) {
      if (kapPctMedTidligere > 50) {
        return 'Kapitaliseringsprocent kan ikke overstige 50 % (inkl. tidligere kapitaliseringsprocenter).';
      }
      if (kapPctMedTidligere === eetPct) {
        return 'Ved delvist endelig afgørelse kan det fulde EET ikke kapitaliseres.';
      }
      if (kapPctMedTidligere > eetPct) {
        return priorKapPctSum > 0
          ? 'Angivelse af Kap. % skal ske med fradrag for tidligere kapitalisering.'
          : 'Der kan ikke kapitaliseres mere end det samlede EET.';
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
      return 'Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.';
    }
  }

  if (kapDatoIso !== undefined && virkningsdatoIso !== undefined && kapDatoIso < virkningsdatoIso) {
    return 'Kapitaliseringsdato er før virkningsdato.';
  }

  if (hasTextValue(row.tidlKapDato)) {
    const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
    if (
      afgoerelsesdatoIso !== undefined &&
      afgoerelsesdatoIso >= '2024-07-01' &&
      kapDatoIso !== undefined &&
      kapDatoIso !== afgoerelsesdatoIso
    ) {
      return 'Fra 1. juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse.';
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
    return 'Ved < 2 år til folkepension sker kapitalisering fra afgørelsesdagen.';
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

const validateDateNotBeforeSkadesdato = (
  dateRaw: string | undefined,
  fieldLabel: string,
  skadesdato: ISODateString | undefined
): string | undefined => {
  if (!skadesdato) return undefined;
  const dateIso = coerceToISODateString(dateRaw);
  if (dateIso === undefined) return undefined;
  if (dateIso < skadesdato) return `Der er indtastet en ${fieldLabel} før skadesdatoen.`;
  return undefined;
};

export const collectEetAslAfgoerelseValidationIssues = (
  rows: readonly AslAfgoerelseRow[],
  skadesdato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined
): EetAslAfgoerelseValidationIssue[] => {
  const issues: EetAslAfgoerelseValidationIssue[] = [];

  for (const row of rows) {
    const duplicateError = validateDuplicateAfgoerelse(row, rows);
    if (duplicateError) {
      issues.push({ rowId: row.id, field: 'afgoerelsesDato', message: duplicateError });
      issues.push({ rowId: row.id, field: 'virkningsDato', message: duplicateError });
    }

    const afgoerelsesDatoBeforeSkadesdatoError = validateDateNotBeforeSkadesdato(row.afgoerelsesDato, 'afgørelsesdato', skadesdato);
    if (afgoerelsesDatoBeforeSkadesdatoError) {
      issues.push({ rowId: row.id, field: 'afgoerelsesDato', message: afgoerelsesDatoBeforeSkadesdatoError });
    }

    const virkningsDatoBeforeSkadesdatoError = validateDateNotBeforeSkadesdato(row.virkningsDato, 'virkningsdato', skadesdato);
    const virkningsDatoAfterTidlKapDatoError = validateVirkningsDatoByTidlKapDato(row);
    const virkningsDatoError = virkningsDatoBeforeSkadesdatoError ?? virkningsDatoAfterTidlKapDatoError;
    if (virkningsDatoError) {
      issues.push({ rowId: row.id, field: 'virkningsDato', message: virkningsDatoError });
    }

    const eetPctError =
      validatePercentNotZeroFromDraft(row.eetPct, 'EET %') ??
      validatePercentDivisibleBy5FromDraft(row.eetPct, 'EET %') ??
      validateEetPctByPriorKapPct(row, rows);
    if (eetPctError) {
      issues.push({ rowId: row.id, field: 'eetPct', message: eetPctError });
    }

    const kapDatoBeforeSkadesdatoError = validateDateNotBeforeSkadesdato(row.kapDato, 'kapitaliseringsdato', skadesdato);
    const kapDatoError =
      kapDatoBeforeSkadesdatoError ??
      validateKapDatoByAfgoerelsestype(row, skadesdato, fodselsdato) ??
      validateKapDatoByTidlKapDato(row);
    if (kapDatoError) {
      issues.push({ rowId: row.id, field: 'kapDato', message: kapDatoError });
    }

    const kapPctError =
      validatePercentNotZeroFromDraft(row.kapPct, 'Kapitaliseringsprocent') ??
      validatePercentDivisibleBy5FromDraft(row.kapPct, 'Kapitaliseringsprocent') ??
      validateKapPctByAfgoerelsestype(row, rows, skadesdato, fodselsdato);
    if (kapPctError) {
      issues.push({ rowId: row.id, field: 'kapPct', message: kapPctError });
    }

    const tidlKapDatoBeforeSkadesdatoError = validateDateNotBeforeSkadesdato(row.tidlKapDato, 'genoptagelsesdato', skadesdato);
    const tidlKapDatoError = tidlKapDatoBeforeSkadesdatoError ?? validateTidlKapDatoByAfgoerelsestype(row);
    if (tidlKapDatoError) {
      issues.push({ rowId: row.id, field: 'tidlKapDato', message: tidlKapDatoError });
    }
  }

  return issues;
};

export const validateVirkningsDatoByTidlKapDato = (
  row: AslAfgoerelseRow
): string | undefined => {
  const tidlKapDatoIso = coerceToISODateString(row.tidlKapDato);
  if (tidlKapDatoIso === undefined) return undefined;
  const virkningsdatoIso = coerceToISODateString(row.virkningsDato);
  if (virkningsdatoIso === undefined) return undefined;
  if (virkningsdatoIso > tidlKapDatoIso) {
    return 'Ved genoptagelse af en tidligere afgørelse skal den oprindelige virkningsdato angives.';
  }
  return undefined;
};

export const validateKapDatoByTidlKapDato = (
  row: AslAfgoerelseRow
): string | undefined => {
  const tidlKapDatoIso = coerceToISODateString(row.tidlKapDato);
  if (tidlKapDatoIso === undefined) return undefined;
  const kapDatoIso = coerceToISODateString(row.kapDato);
  if (kapDatoIso === undefined) return undefined;
  if (kapDatoIso <= tidlKapDatoIso) {
    return 'Ved genoptagne afgørelser skal den nye kapitaliseringsdato angives.';
  }
  return undefined;
};

export const validateTidlKapDatoByAfgoerelsestype = (
  row: AslAfgoerelseRow
): string | undefined => {
  if (hasTextValue(row.tidlKapDato) && !hasTextValue(row.kapDato)) {
    return 'Kun relevant ved tidligere kapitalisering.';
  }

  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.tidlKapDato)) {
      return 'Tidligere kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.';
    }
  }

  if (hasTextValue(row.tidlKapDato)) {
    const tidlKapDatoIso = coerceToISODateString(row.tidlKapDato);
    const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
    if (tidlKapDatoIso !== undefined && afgoerelsesdatoIso !== undefined && afgoerelsesdatoIso <= tidlKapDatoIso) {
      return 'Datoen for den tidligere afgørelse skal være før afgørelsesdatoen.';
    }
  }

  return undefined;
};

export const validatePercentNotZeroFromDraft = (
  raw: string | undefined,
  label: string
): string | undefined => {
  const parsed = parsePercentDraft(raw);
  if (parsed === undefined) return undefined;
  if (parsed === 0) return `${label} må ikke være 0 %.`;
  return undefined;
};

export const validatePercentDivisibleBy5FromDraft = (
  raw: string | undefined,
  label: string
): string | undefined => {
  const parsed = parsePercentDraft(raw);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed)) return `${label} skal være et heltal.`;
  if (parsed % 5 !== 0) return `${label} skal være deleligt med 5.`;
  return undefined;
};

export const validatePercentDivisibleBy5FromValue = (
  value: number | undefined,
  label: string
): string | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value)) return `${label} skal være et heltal.`;
  if (value % 5 !== 0) return `${label} skal være deleligt med 5.`;
  return undefined;
};

/**
 * Returnerer fejlmeddelelser for en ufuldstændig men påbegyndt afgørelsesrække.
 * Bruges af alle tre beregnere (løbende, kapitalisering, differencekrav) for
 * at sikre konsistente fejlmeddelelser på tværs af faner.
 *
 * En række er "påbegyndt" hvis mindst ét felt er udfyldt. For sådanne rækker
 * håndhæves følgende invarianter:
 *   1. Afgørelsesdato skal være udfyldt
 *   2. EET % skal være udfyldt
 *   3. Afgørelsestype skal være valgt
 *   4. Endelig afgørelse med EET % < 50 kræver både kap.dato og kap. %
 *   5. Kap.dato uden kap. % er ikke tilladt
 *   6. Kap. % uden kap.dato er ikke tilladt
 *
 * IDs er stabile konstanter — brug dem i filter-sæt fremfor at generere fra message-tekst.
 *
 * Bemærkning: 'delvist-endelig-missing-kapitalisering' er bevidst ikke inkluderet her.
 * Den emitteres selvstændigt af eetKapitaliseringCalculation og eetLoebendeYdelserCalculation,
 * fordi de to beregninger har forskellig forforståelse af hvornår delvist endelig kræver
 * kapitalisering (F2 beregner løbende uafhængigt af kapitalisering).
 */
export const ASL_IDENTICAL_AFGOERELSER_ID = 'asl-identiske-afgoerelser';

export const INCOMPLETE_ROW_ISSUE_IDS = {
  missingAfgoerelsesdato: 'missing-afgoerelsesdato',
  missingEetPct: 'missing-eet-pct',
  missingAfgoerelseType: 'missing-afgoerelseType',
  endeligUnder50MissingKap: 'endelig-under-50-missing-kapitalisering',
  kapDatoWithoutKapPct: 'kap-dato-without-kap-pct',
  kapPctWithoutKapDato: 'kap-pct-without-kap-dato',
  virkningsdatoAfterTidlKapDato: 'virkningsdato-after-tidlkap-dato',
  kapDatoNotAfterTidlKapDato: 'kap-dato-not-after-tidlkap-dato',
} as const;

export type IncompleteRowIssue = Readonly<{
  id: string;
  message: string;
}>;

export const collectIncompleteRowIssues = (
  rows: readonly AslAfgoerelseRow[]
): IncompleteRowIssue[] => {
  const issues: IncompleteRowIssue[] = [];
  const startedRows = rows.filter((row) => !isAslAfgoerelseRowEmpty(row));

  const hasMissingAfgoerelsesdato = startedRows.some((row) => !coerceToISODateString(row.afgoerelsesDato));
  if (hasMissingAfgoerelsesdato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.missingAfgoerelsesdato, message: 'Der er en afgørelse uden afgørelsesdato.' });
  }

  const hasMissingEetPct = startedRows.some((row) => {
    const pct = parsePercentDraft(row.eetPct);
    return pct === undefined || pct === 0;
  });
  if (hasMissingEetPct) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.missingEetPct, message: 'Der er en afgørelse uden EET %.' });
  }

  const hasMissingAfgoerelseType = startedRows.some((row) => !row.afgoerelseType);
  if (hasMissingAfgoerelseType) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.missingAfgoerelseType, message: 'Der er en afgørelse uden afgørelsestype.' });
  }

  const hasEndeligUnder50MissingKap = startedRows.some((row) => {
    if (row.afgoerelseType !== 'Endelig') return false;
    const eetPct = parsePercentDraft(row.eetPct);
    if (eetPct === undefined || eetPct === 0 || eetPct >= 50) return false;
    return !hasTextValue(row.kapDato) && !hasTextValue(row.kapPct);
  });
  if (hasEndeligUnder50MissingKap) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.endeligUnder50MissingKap, message: 'Endelig afgørelse under 50 % mangler oplysninger om kapitalisering.' });
  }

  const hasVirkningsdatoAfterTidlKapDato = startedRows.some(
    (row) => validateVirkningsDatoByTidlKapDato(row) !== undefined
  );
  if (hasVirkningsdatoAfterTidlKapDato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.virkningsdatoAfterTidlKapDato, message: 'Ved genoptagelse af en tidligere afgørelse skal den oprindelige virkningsdato angives.' });
  }

  const hasKapDatoNotAfterTidlKapDato = startedRows.some(
    (row) => validateKapDatoByTidlKapDato(row) !== undefined
  );
  if (hasKapDatoNotAfterTidlKapDato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.kapDatoNotAfterTidlKapDato, message: 'Ved genoptagne afgørelser skal den nye kapitaliseringsdato angives.' });
  }

  const hasKapDatoWithoutKapPct = startedRows.some(
    (row) =>
      hasTextValue(row.kapDato) &&
      !hasTextValue(row.kapPct) &&
      row.afgoerelseType !== undefined &&
      row.afgoerelseType !== 'Midlertidig'
  );
  if (hasKapDatoWithoutKapPct) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.kapDatoWithoutKapPct, message: 'Der er indtastet kapitaliseringsdato men ikke -procent.' });
  }

  const hasKapPctWithoutKapDato = startedRows.some(
    (row) =>
      hasTextValue(row.kapPct) &&
      !hasTextValue(row.kapDato) &&
      row.afgoerelseType !== undefined &&
      row.afgoerelseType !== 'Midlertidig'
  );
  if (hasKapPctWithoutKapDato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.kapPctWithoutKapDato, message: 'Der er indtastet kapitaliseringsprocent men ikke -dato.' });
  }

  return issues;
};

// To rækker er identiske når afgørelsesdato og virkningsdato begge er ens.
export const hasIdenticalAfgoerelser = (rows: readonly AslAfgoerelseRow[]): boolean =>
  rows.some((row) => validateDuplicateAfgoerelse(row, rows) !== undefined);

export const validateAslAarsloenDivisibleBy1000 = (
  aarsloen: number | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (aarsloen % 1000 !== 0) return 'Årsløn skal være deleligt med 1.000.';
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
