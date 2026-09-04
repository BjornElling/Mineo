import type { AslAfgoerelseRow } from '../../schemas/formSchemas';
import { afgoerelseTypeEnum, type Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { createRowId } from '../../utils/rowId';
import {
  validateAslAarsloenBySkadesaarMax,
  validateAslAarsloenDivisibleBy1000,
} from '../aslEalAarsloen/aarsloenValidators';
import { isUnderOrEqualTwoYearsToFpByBekendtgoerelse } from './eetKapitaliseringOpslag';
import { SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';

export const EET_ASL_MIN_VISIBLE_ROWS = 2;
export { validateAslAarsloenBySkadesaarMax, validateAslAarsloenDivisibleBy1000 };

export const ASL_AFGOERELSE_ROW_ID_PREFIX = 'eet_asl';

export const createAslAfgoerelseRowId = (): string => createRowId(ASL_AFGOERELSE_ROW_ID_PREFIX);

/** Tom rækkes felter UDEN id – id sættes af caller (random ved defaults, deterministisk ved normalisering). */
export const emptyAslAfgoerelseRowFields: Omit<AslAfgoerelseRow, 'id'> = {
  afgoerelsesDato: undefined,
  virkningsDato: undefined,
  eetPct: undefined,
  kapDato: undefined,
  kapPct: undefined,
  afgoerelseType: undefined,
  tidlKapDato: undefined,
  fsTilbageholdtEet: 'Nej',
};

export const createEmptyAslAfgoerelseRow = (): AslAfgoerelseRow => ({
  id: createAslAfgoerelseRowId(),
  ...emptyAslAfgoerelseRowFields,
});

/** Fælles runtime-guard for den enum, som alle EET-afgørelsesforbrugere deler. */
export const isKnownAfgoerelseType = (
  value: unknown
): value is NonNullable<AslAfgoerelseRow['afgoerelseType']> => afgoerelseTypeEnum.safeParse(value).success;

export const isAslAfgoerelseRowEmpty = (row: AslAfgoerelseRow): boolean =>
  !row.afgoerelsesDato &&
  !row.virkningsDato &&
  !hasTextValue(row.eetPct) &&
  !row.kapDato &&
  !hasTextValue(row.kapPct) &&
  !row.afgoerelseType &&
  !row.tidlKapDato;

// `FS tilbageholdt EET` er en required-choice med defaulten »Nej«. Et valg i den kan ikke alene
// gøre placeholder-rækken til brugerindhold: værdien har ingen beregningsbetydning uden en afgørelse.
export const isAslAfgoerelseRowPersistenceEmpty = (row: AslAfgoerelseRow): boolean =>
  isAslAfgoerelseRowEmpty(row);

export const parseCommittedPercent = (raw: number | undefined): number | undefined => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  return undefined;
};

export const hasTextValue = (raw: string | number | undefined): boolean =>
  typeof raw === 'number' ? Number.isFinite(raw) : typeof raw === 'string' && raw.trim() !== '';

const DUPLICATE_AFGOERELSE_MESSAGE = 'Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato';

export const KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE =
  'Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.';
export const TIDL_KAP_DATO_WITHOUT_KAPITALISERING_MESSAGE = 'Kun relevant ved tidligere kapitalisering.';
export const KAP_PCT_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE =
  'Kapitaliseringsprocent må kun udfyldes ved endelig eller delvist endelig afgørelsestype.';
/**
 * Samme regel, samme sætningsform. De tre kapitaliseringsceller står side om side, og en af dem sagde
 * reglen baglæns («må ikke udfyldes ved midlertidig …»), så brugeren skulle læse to formuleringer og
 * selv se, at det var den samme regel (BB-148).
 */
export const TIDL_KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE =
  'Tidligere kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.';

/**
 * De to celletekster ved ≤ 2 år til folkepension navngiver HANDLINGEN, ikke reglen.
 *
 * Ved en endelig afgørelse ≤ 2 år før folkepensionsalderen kapitaliseres hele erhvervsevnetabet fra
 * afgørelsesdagen, og motoren udleder selv begge værdier. De to felter skal derfor stå TOMME. De
 * tidligere tekster oplyste kun reglen («Ved ≤ 2 år til folkepension sker kapitalisering fra
 * afgørelsesdagen.»), så brugeren stod med to røde celler uden anledning til at gætte, at tomme
 * felter var svaret – og et tomt felt gav i sig selv en tredje, blokerende fejl på fanen (BB-168).
 * Sig hvad brugeren skal GØRE; reglen står som begrundelse efter kolonet.
 */
export const KAP_DATO_UNDER_TO_AAR_MESSAGE =
  'Lad kapitaliseringsdato stå tom: ved ≤ 2 år til folkepension kapitaliseres hele erhvervsevnetabet fra afgørelsesdagen.';
export const KAP_PCT_UNDER_TO_AAR_MESSAGE =
  'Lad kapitaliseringsprocent stå tom: ved ≤ 2 år til folkepension kapitaliseres hele erhvervsevnetabet fra afgørelsesdagen.';

const assertNeverAfgoerelsestype = (_value: never): undefined => undefined;

/**
 * Returnerer rækkefølge mellem to afgørelser.
 *
 * null betyder "kan ikke afgøres fail-closed", fordi mindst én afgørelsesdato mangler.
 * Kaldere skal i så fald behandle kandidaterne som ikke-dokumenteret tidligere.
 */
const compareAfgoerelseOrder = (
  left: Pick<AslAfgoerelseRow, 'afgoerelsesDato' | 'virkningsDato'>,
  right: Pick<AslAfgoerelseRow, 'afgoerelsesDato' | 'virkningsDato'>
): number | null => {
  const leftAfgoerelsesdatoIso = coerceToISODateString(left.afgoerelsesDato);
  const rightAfgoerelsesdatoIso = coerceToISODateString(right.afgoerelsesDato);
  if (leftAfgoerelsesdatoIso === undefined || rightAfgoerelsesdatoIso === undefined) return null;
  if (leftAfgoerelsesdatoIso !== rightAfgoerelsesdatoIso) {
    return leftAfgoerelsesdatoIso < rightAfgoerelsesdatoIso ? -1 : 1;
  }

  const leftVirkningsdatoIso = coerceToISODateString(left.virkningsDato);
  const rightVirkningsdatoIso = coerceToISODateString(right.virkningsDato);
  if (leftVirkningsdatoIso === undefined || rightVirkningsdatoIso === undefined) return 0;
  if (leftVirkningsdatoIso !== rightVirkningsdatoIso) {
    return leftVirkningsdatoIso < rightVirkningsdatoIso ? -1 : 1;
  }
  return 0;
};

const sumPriorKapPct = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[]
): number => {
  return allRows.reduce((sum, candidate) => {
    if (candidate.id === row.id) return sum;
    const compare = compareAfgoerelseOrder(candidate, row);
    if (compare === null || compare >= 0) return sum;
    const candidateKapPct = parseCommittedPercent(candidate.kapPct);
    if (candidateKapPct === undefined) return sum;
    return sum + candidateKapPct;
  }, 0);
};

export const validateEetPctByPriorKapPct = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row]
): string | undefined => {
  const eetPct = parseCommittedPercent(row.eetPct);
  if (eetPct === undefined || eetPct === 0) return undefined;

  const priorKapPctSum = sumPriorKapPct(row, allRows);
  if (priorKapPctSum <= 0) return undefined;

  if (eetPct < priorKapPctSum) {
    return 'EET % kan ikke være lavere end den akkumulerede kapitaliseringsprocent fra tidligere afgørelser.';
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

  for (const candidate of allRows) {
    if (candidate.id === row.id) continue;
    const candidateAfgoerelsesdatoIso = coerceToISODateString(candidate.afgoerelsesDato);
    const candidateVirkningsdatoIso = coerceToISODateString(candidate.virkningsDato);

    if (
      candidateAfgoerelsesdatoIso === afgoerelsesdatoIso &&
      candidateVirkningsdatoIso === virkningsdatoIso
    ) {
      // Begge rækker er tvetydige efter en sortering. En rækkerækkefølge er visning, ikke en stabil
      // brugeridentitet, så kun den "seneste" række kan ikke markeres pålideligt.
      return DUPLICATE_AFGOERELSE_MESSAGE;
    }
  }

  return undefined;
};

export const validateKapPctByAfgoerelsestype = (
  row: AslAfgoerelseRow,
  allRows: readonly AslAfgoerelseRow[] = [row],
  skadedato: ISODateString | undefined = undefined,
  fodselsdato: ISODateString | undefined = undefined
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.kapPct)) {
      return KAP_PCT_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE;
    }
    return undefined;
  }

  const kapPct = parseCommittedPercent(row.kapPct);
  if (kapPct === undefined) return undefined;
  const priorKapPctSum = sumPriorKapPct(row, allRows);
  const kapPctMedTidligere = kapPct + priorKapPctSum;

  const eetPctRaw = parseCommittedPercent(row.eetPct);
  const eetPct = eetPctRaw === 0 ? undefined : eetPctRaw;
  const controlDateIso = coerceToISODateString(row.tidlKapDato) ?? coerceToISODateString(row.afgoerelsesDato);
  const isWithinTwoYearsRuleActive =
    afgoerelsestype === 'Endelig' &&
    skadedato !== undefined &&
    fodselsdato !== undefined &&
    isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadedato, fodselsdato, controlDateIso);

  if (afgoerelsestype === 'Endelig') {
    if (isWithinTwoYearsRuleActive) {
      if (eetPct !== undefined && kapPctMedTidligere !== eetPct) {
        return KAP_PCT_UNDER_TO_AAR_MESSAGE;
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
    //
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
  skadedato: ISODateString | undefined = undefined,
  fodselsdato: ISODateString | undefined = undefined
): string | undefined => {
  const afgoerelsestype = row.afgoerelseType;
  const virkningsdatoIso = coerceToISODateString(row.virkningsDato);
  const kapDatoIso = coerceToISODateString(row.kapDato);
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.kapDato)) {
      return KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE;
    }
  }

  if (kapDatoIso !== undefined && virkningsdatoIso !== undefined && kapDatoIso < virkningsdatoIso) {
    return 'Kapitaliseringsdato er før virkningsdato.';
  }

  if (hasTextValue(row.tidlKapDato)) {
    const afgoerelsesdatoIso = coerceToISODateString(row.afgoerelsesDato);
    if (
      afgoerelsesdatoIso !== undefined &&
      afgoerelsesdatoIso >= SKAERING_2024_07_01 &&
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
    skadedato !== undefined &&
    fodselsdato !== undefined &&
    isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadedato, fodselsdato, controlDateIso);

  if (isWithinTwoYearsRuleActive && kapDatoIso !== afgoerelsesdatoIso) {
    return KAP_DATO_UNDER_TO_AAR_MESSAGE;
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

const validateDateNotBeforeSkadedato = (
  dateRaw: string | undefined,
  fieldLabel: string,
  skadedato: ISODateString | undefined,
  skadestype: Skadestype | undefined,
): string | undefined => {
  if (!skadedato) return undefined;
  const dateIso = coerceToISODateString(dateRaw);
  if (dateIso === undefined) return undefined;
  if (dateIso < skadedato) {
    return `Der er indtastet en ${fieldLabel} før ${resolveStamdataDatoReference(skadestype).labelLower}`;
  }
  return undefined;
};

export const collectEetAslAfgoerelseValidationIssues = (
  rows: readonly AslAfgoerelseRow[],
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  skadestype?: Skadestype,
): EetAslAfgoerelseValidationIssue[] => {
  const issues: EetAslAfgoerelseValidationIssue[] = [];

  for (const row of rows) {
    const duplicateError = validateDuplicateAfgoerelse(row, rows);
    if (duplicateError) {
      issues.push({ rowId: row.id, field: 'afgoerelsesDato', message: duplicateError });
      issues.push({ rowId: row.id, field: 'virkningsDato', message: duplicateError });
    }

    const afgoerelsesDatoBeforeSkadedatoError = validateDateNotBeforeSkadedato(row.afgoerelsesDato, 'afgørelsesdato', skadedato, skadestype);
    if (afgoerelsesDatoBeforeSkadedatoError) {
      issues.push({ rowId: row.id, field: 'afgoerelsesDato', message: afgoerelsesDatoBeforeSkadedatoError });
    }

    const virkningsDatoBeforeSkadedatoError = validateDateNotBeforeSkadedato(row.virkningsDato, 'virkningsdato', skadedato, skadestype);
    const virkningsDatoAfterTidlKapDatoError = validateVirkningsDatoByTidlKapDato(row);
    const virkningsDatoError = virkningsDatoBeforeSkadedatoError ?? virkningsDatoAfterTidlKapDatoError;
    if (virkningsDatoError) {
      issues.push({ rowId: row.id, field: 'virkningsDato', message: virkningsDatoError });
    }

    const eetPctError =
      validatePercentNotZero(row.eetPct, 'EET %') ??
      validatePercentDivisibleBy5(row.eetPct, 'EET %') ??
      validateEetPctByPriorKapPct(row, rows);
    if (eetPctError) {
      issues.push({ rowId: row.id, field: 'eetPct', message: eetPctError });
    }

    const kapDatoBeforeSkadedatoError = validateDateNotBeforeSkadedato(row.kapDato, 'kapitaliseringsdato', skadedato, skadestype);
    const kapDatoError =
      kapDatoBeforeSkadedatoError ??
      validateKapDatoByAfgoerelsestype(row, skadedato, fodselsdato) ??
      validateKapDatoByTidlKapDato(row);
    if (kapDatoError) {
      issues.push({ rowId: row.id, field: 'kapDato', message: kapDatoError });
    }

    const kapPctError =
      validatePercentNotZero(row.kapPct, 'Kapitaliseringsprocent') ??
      validatePercentDivisibleBy5(row.kapPct, 'Kapitaliseringsprocent') ??
      validateKapPctByAfgoerelsestype(row, rows, skadedato, fodselsdato);
    if (kapPctError) {
      issues.push({ rowId: row.id, field: 'kapPct', message: kapPctError });
    }

    const tidlKapDatoBeforeSkadedatoError = validateDateNotBeforeSkadedato(row.tidlKapDato, 'genoptagelsesdato', skadedato, skadestype);
    const tidlKapDatoError = tidlKapDatoBeforeSkadedatoError ?? validateTidlKapDatoByAfgoerelsestype(row);
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
    return TIDL_KAP_DATO_WITHOUT_KAPITALISERING_MESSAGE;
  }

  const afgoerelsestype = row.afgoerelseType;
  if (afgoerelsestype === undefined || afgoerelsestype === 'Midlertidig') {
    if (hasTextValue(row.tidlKapDato)) {
      return TIDL_KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE;
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

export const validatePercentNotZero = (
  raw: number | undefined,
  label: string
): string | undefined => {
  const parsed = parseCommittedPercent(raw);
  if (parsed === undefined) return undefined;
  if (parsed === 0) return `${label} må ikke være 0 %.`;
  return undefined;
};

export const validatePercentDivisibleBy5 = (
  raw: number | undefined,
  label: string
): string | undefined => {
  const parsed = parseCommittedPercent(raw);
  if (parsed === undefined) return undefined;
  // Persistence-schemaet beskytter kun den canonical talsyntaks. Det tidligere
  // schema-bound skal derfor leve i den rene issue-validator, så load/import også
  // fail-closer uden et monteret procentfelt.
  if (parsed < 0 || parsed > 100) return `${label} skal være mellem 0 og 100 %.`;
  if (!Number.isInteger(parsed)) return `${label} skal være et heltal.`;
  if (parsed % 5 !== 0) return `${label} skal være deleligt med 5.`;
  return undefined;
};

export const validatePercentDivisibleBy5FromValue = (
  value: number | undefined,
  label: string
): string | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > 100) return `${label} skal være mellem 0 og 100 %.`;
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
 *   4. Endelig afgørelse med EET % < 50 kræver både kap.dato og kap. % – UNDTAGEN ved ≤ 2 år til
 *      folkepension, hvor de to felter netop skal stå tomme (kræver `skadedato` og `fodselsdato`)
 *   5. Kap.dato uden kap. % er ikke tilladt
 *   6. Kap. % uden kap.dato er ikke tilladt
 *
 * IDs er stabile konstanter – brug dem i filter-sæt fremfor at generere fra message-tekst.
 *
 * Bemærkning: 'delvist-endelig-missing-kapitalisering' er bevidst ikke inkluderet her.
 * Den emitteres selvstændigt af eetKapitaliseringCalculation og eetLoebendeYdelserCalculation,
 * fordi de to beregninger har forskellig forforståelse af hvornår delvist endelig kræver
 * kapitalisering (F2 beregner løbende uafhængigt af kapitalisering).
 */
export const ASL_IDENTICAL_AFGOERELSER_ID = 'asl-identiske-afgoerelser';

export const NON_ENDELIG_AFTER_ENDELIG_WARNING_ID = 'warn-non-endelig-after-endelig';

/**
 * Advarslen når afgørelsestabellen indeholder en ikke-endelig afgørelse EFTER en endelig.
 *
 * Reglen hører til TABELLEN, ikke til den motor, der først fik brug for den. Den lå oprindeligt
 * alene i løbende ydelser, så EET efter EAL kunne lade en midlertidig afgørelse fra 2022 på 30 %
 * fortrænge en endelig fra 2020 på 50 % – en forskel på 813.240 kr. i det trykte krav – helt uden
 * en «Fejl og advarsler»-boks, mens de to nabofaner advarede i samme sag (BB-178, mønster M-30).
 *
 * Udvælgelsen er bevidst uændret: mangler en særskilt EET-procent efter EAL, lægges den SENESTE
 * procent efter ASL til grund uden skelen til afgørelsestypen, fordi erstatningsansvarsloven ikke
 * kender et midlertidigt erhvervsevnetab. Advarslen fortæller alene, at der er mere end én
 * afgørelse at vælge imellem, så brugeren kan se, hvilken der bar tallet.
 *
 * Læg nye forbrugere til her frem for at kopiere prædikatet – det er præcis den drift, M-30 fanger.
 */
export type NonEndeligAfterEndeligRow = Readonly<{
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  afgoerelseType: AslAfgoerelseRow['afgoerelseType'];
}>;

const formatNonEndeligAfterEndeligWarning = (
  hasMidlertidig: boolean,
  hasDelvistEndelig: boolean
): string => {
  const afgoerelsestype = hasMidlertidig && hasDelvistEndelig
    ? 'midlertidig og delvist endelig'
    : hasMidlertidig
      ? 'midlertidig'
      : 'delvist endelig';
  return `Der er angivet en ${afgoerelsestype} afgørelse efter en endelig afgørelse.`;
};

/**
 * Opløser rå tabelrækker til det, advarslen har brug for, og springer de ufuldstændige over.
 *
 * Findes for de motorer, der ikke i forvejen har en opløst rækkeliste (EET efter EAL vælger kun ÉN
 * afgørelse og bygger derfor ingen). Rækker uden begge datoer eller uden type melder sig selv
 * gennem `collectIncompleteRowIssues` og skal ikke også udløse denne advarsel.
 */
export const resolveNonEndeligAfterEndeligRows = (
  rows: readonly AslAfgoerelseRow[]
): NonEndeligAfterEndeligRow[] => {
  const resolved: NonEndeligAfterEndeligRow[] = [];
  for (const row of rows) {
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const virkningsdato = coerceToISODateString(row.virkningsDato);
    if (!afgoerelsesdato || !virkningsdato || !row.afgoerelseType) continue;
    resolved.push({ afgoerelsesdato, virkningsdato, afgoerelseType: row.afgoerelseType });
  }
  return resolved;
};

/**
 * Returnerer advarselsteksten, når mindst én ikke-endelig afgørelse ligger efter en endelig –
 * ellers `undefined`. Rækkerne skal være opløste (datoer og type udfyldt); ufuldstændige rækker
 * melder sig selv gennem `collectIncompleteRowIssues`.
 */
export const resolveNonEndeligAfterEndeligWarning = (
  rows: readonly NonEndeligAfterEndeligRow[]
): string | undefined => {
  const endelige = rows.filter((row) => row.afgoerelseType === 'Endelig');
  if (endelige.length === 0) return undefined;

  const nonEndeligeAfterEndelig = rows.filter((row) =>
    (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig') &&
    endelige.some((endelig) =>
      row.afgoerelsesdato > endelig.afgoerelsesdato ||
      (
        row.afgoerelsesdato === endelig.afgoerelsesdato &&
        row.virkningsdato > endelig.virkningsdato
      )
    )
  );
  if (nonEndeligeAfterEndelig.length === 0) return undefined;

  return formatNonEndeligAfterEndeligWarning(
    nonEndeligeAfterEndelig.some((row) => row.afgoerelseType === 'Midlertidig'),
    nonEndeligeAfterEndelig.some((row) => row.afgoerelseType === 'Delvist endelig')
  );
};

export const INCOMPLETE_ROW_ISSUE_IDS = {
  missingAfgoerelsesdato: 'missing-afgoerelsesdato',
  missingEetPct: 'missing-eet-pct',
  missingAfgoerelseType: 'missing-afgoerelseType',
  endeligUnder50MissingKap: 'endelig-under-50-missing-kapitalisering',
  kapDatoWithoutKapPct: 'kap-dato-without-kap-pct',
  kapPctWithoutKapDato: 'kap-pct-without-kap-dato',
  virkningsdatoAfterTidlKapDato: 'virkningsdato-after-tidlkap-dato',
  kapDatoNotAfterTidlKapDato: 'kap-dato-not-after-tidlkap-dato',
  invalidEetPct: 'invalid-eet-pct',
  invalidKapPct: 'invalid-kap-pct',
} as const;

/**
 * Beskeden om en påbegyndt afgørelsesrække uden sin EET-procent.
 *
 * Konstant og ikke en inline-streng, fordi EET efter EAL bruger den SAMME besked, når dens
 * ASL-fallback løber tør netop fordi en afgørelsesrækkes procentcelle er tom (BB-181). Fire faner
 * skal sige det samme om det samme forhold og pege på den samme celle; drifter ordlyden, får
 * brugeren to beskrivelser af én mangel og kan ikke se, at det er samme rettelse.
 */
export const MISSING_EET_PCT_MESSAGE = 'Der er en afgørelse uden EET %';

/**
 * Sand, når mindst én påbegyndt afgørelsesrække mangler sin EET-procent.
 *
 * Udstillet særskilt, fordi EET efter EAL skal kunne skelne to tilstande, der begge efterlader
 * fanen uden en procent: en HALVFÆRDIG afgørelsesrække (denne) og slet ingen afgørelser. Kun den
 * første må pege på afgørelsestabellen; den anden hører ved EAL-feltet, fordi en sag kan være
 * omfattet af erstatningsansvarsloven alene (BB-181).
 */
export const hasStartedRowMissingEetPct = (rows: readonly AslAfgoerelseRow[]): boolean =>
  rows
    .filter((row) => !isAslAfgoerelseRowEmpty(row))
    .some((row) => {
      const pct = parseCommittedPercent(row.eetPct);
      return pct === undefined || pct === 0;
    });

export type IncompleteRowIssue = Readonly<{
  id: string;
  message: string;
}>;

export const collectIncompleteRowIssues = (
  rows: readonly AslAfgoerelseRow[],
  skadedato: ISODateString | undefined = undefined,
  fodselsdato: ISODateString | undefined = undefined
): IncompleteRowIssue[] => {
  const issues: IncompleteRowIssue[] = [];
  const startedRows = rows.filter((row) => !isAslAfgoerelseRowEmpty(row));

  const hasMissingAfgoerelsesdato = startedRows.some((row) => !coerceToISODateString(row.afgoerelsesDato));
  if (hasMissingAfgoerelsesdato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.missingAfgoerelsesdato, message: 'Der er en afgørelse uden afgørelsesdato' });
  }

  if (hasStartedRowMissingEetPct(rows)) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.missingEetPct, message: MISSING_EET_PCT_MESSAGE });
  }

  const invalidEetPctMessage = startedRows
    .map((row) => validatePercentDivisibleBy5(row.eetPct, 'EET %'))
    .find((message) => message !== undefined);
  if (invalidEetPctMessage) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.invalidEetPct, message: invalidEetPctMessage });
  }

  const invalidKapPctMessage = startedRows
    .map((row) => validatePercentDivisibleBy5(row.kapPct, 'Kapitaliseringsprocent'))
    .find((message) => message !== undefined);
  if (invalidKapPctMessage) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.invalidKapPct, message: invalidKapPctMessage });
  }

  const hasMissingAfgoerelseType = startedRows.some((row) => !row.afgoerelseType);
  if (hasMissingAfgoerelseType) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.missingAfgoerelseType, message: 'Der er en afgørelse uden afgørelsestype' });
  }

  const hasEndeligUnder50MissingKap = startedRows.some((row) => {
    if (row.afgoerelseType !== 'Endelig') return false;
    const eetPct = parseCommittedPercent(row.eetPct);
    if (eetPct === undefined || eetPct === 0 || eetPct >= 50) return false;
    // Ved ≤ 2 år til folkepension er de TOMME felter den rigtige indtastning: kapitalisering sker fra
    // afgørelsesdagen af hele erhvervsevnetabet, og de to feltregler afviser derfor enhver anden
    // værdi. Uden denne undtagelse var både «udfyld» og «lad stå tomt» en blokering – en blindgyde
    // uden en lovlig indtastning (BB-168). Motoren udleder selv begge værdier i netop dette tilfælde
    // (`collectResolvedRows` i `eetKapitaliseringCalculation`), som også bærer samme undtagelse.
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const controlDate = coerceToISODateString(row.tidlKapDato) ?? afgoerelsesdato;
    const isForcedUnderTwoYears =
      skadedato !== undefined &&
      fodselsdato !== undefined &&
      controlDate !== undefined &&
      isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadedato, fodselsdato, controlDate);
    if (isForcedUnderTwoYears) return false;
    return !hasTextValue(row.kapDato) && !hasTextValue(row.kapPct);
  });
  if (hasEndeligUnder50MissingKap) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.endeligUnder50MissingKap, message: 'Endelig afgørelse under 50 % mangler oplysninger om kapitalisering' });
  }

  const hasVirkningsdatoAfterTidlKapDato = startedRows.some(
    (row) => validateVirkningsDatoByTidlKapDato(row) !== undefined
  );
  if (hasVirkningsdatoAfterTidlKapDato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.virkningsdatoAfterTidlKapDato, message: 'Ved genoptagelse af en tidligere afgørelse skal den oprindelige virkningsdato angives' });
  }

  const hasKapDatoNotAfterTidlKapDato = startedRows.some(
    (row) => validateKapDatoByTidlKapDato(row) !== undefined
  );
  if (hasKapDatoNotAfterTidlKapDato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.kapDatoNotAfterTidlKapDato, message: 'Ved genoptagne afgørelser skal den nye kapitaliseringsdato angives' });
  }

  const hasKapDatoWithoutKapPct = startedRows.some(
    (row) =>
      hasTextValue(row.kapDato) &&
      !hasTextValue(row.kapPct) &&
      row.afgoerelseType !== undefined &&
      row.afgoerelseType !== 'Midlertidig'
  );
  if (hasKapDatoWithoutKapPct) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.kapDatoWithoutKapPct, message: 'Der er indtastet kapitaliseringsdato men ikke -procent' });
  }

  const hasKapPctWithoutKapDato = startedRows.some(
    (row) =>
      hasTextValue(row.kapPct) &&
      !hasTextValue(row.kapDato) &&
      row.afgoerelseType !== undefined &&
      row.afgoerelseType !== 'Midlertidig'
  );
  if (hasKapPctWithoutKapDato) {
    issues.push({ id: INCOMPLETE_ROW_ISSUE_IDS.kapPctWithoutKapDato, message: 'Der er indtastet kapitaliseringsprocent men ikke -dato' });
  }

  return issues;
};

// To rækker er identiske når afgørelsesdato og virkningsdato begge er ens.
export const hasIdenticalAfgoerelser = (rows: readonly AslAfgoerelseRow[]): boolean =>
  rows.some((row) => validateDuplicateAfgoerelse(row, rows) !== undefined);
