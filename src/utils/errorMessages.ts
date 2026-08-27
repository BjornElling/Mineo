/**
 * Fejlbeskeder til Mineo
 *
 * Mapper tekniske fejl-koder til brugervenlige danske beskeder.
 *
 * Formål:
 * - Brugeren skal forstå HVAD der gik galt
 * - Brugeren skal vide HVORDAN problemet løses
 * - IKKE vise stack traces eller tekniske detaljer direkte
 *
 * Anvendelse:
 * 1. Kast CalculationError med specifik kode
 * 2. getUserMessage() mapper til dansk besked
 * 3. Teknisk besked gemmes i logs til debugging
 */

/**
 * Alle mulige fejl-koder i Mineo
 *
 * TypeScript sikrer at kun gyldige koder kan bruges.
 */
export const ERROR_MESSAGES = {
  // Dato-fejl
  INVALID_DATE_FORMAT: 'Datoen skal være i formatet dd-mm-åååå',
  DATE_FROM_AFTER_DATE_TO: 'Fra-dato skal være før til-dato',
  DATE_OUT_OF_RANGE: 'Datoen ligger uden for tilladt interval',
  INVALID_YEAR_FORMAT: 'Året skal være 4 cifre (fx 2025)',

  // Beløbs-fejl
  NEGATIVE_AMOUNT: 'Beløb kan ikke være negative',
  INVALID_AMOUNT_FORMAT: 'Beløb skal være et tal',
  AMOUNT_TOO_LARGE: 'Beløb er for stort (max 999.999.999 kr.)',

  // Tabel-fejl
  TABLE_EMPTY: 'Tabellen skal indeholde mindst én række',
  TABLE_ROW_MISSING_DATA: 'En eller flere rækker mangler data',
  TABLE_INVALID_DATA: 'Tabellen indeholder ugyldige data',

  // Beregnings-fejl
  DIVISION_BY_ZERO: 'Perioden indeholder ingen arbejdsdage. Tjek datointervallerne.',
  MISSING_REQUIRED_FIELD: 'Dette felt skal udfyldes før beregning kan køres',
  CALCULATION_FAILED: 'Beregningen fejlede. Tjek at alle felter er udfyldt korrekt.',
  INVALID_CALCULATION_INPUT: 'Input til beregning er ugyldig. Tjek alle felter.',

  // Fil-fejl
  FILE_LOAD_FAILED: 'Kunne ikke indlæse fil. Tjek at filen er gyldig.',
  FILE_SAVE_FAILED: 'Kunne ikke gemme fil. Tjek at du har skriverettigheder.',
  FILE_INVALID_FORMAT: 'Filen har et ugyldigt format',
  FILE_CORRUPTED: 'Filen er korrupt eller beskadiget',

  // PDF-fejl
  PDF_GENERATION_FAILED: 'Kunne ikke generere PDF. Prøv igen.',
  PDF_NO_DATA: 'Ingen data at generere PDF fra',

  // Generiske fejl
  UNKNOWN_ERROR: 'Der opstod en uventet fejl. Prøv at genindlæse siden.',
  NETWORK_ERROR: 'Netværksfejl. Tjek din internetforbindelse.',
  VALIDATION_ERROR: 'Valideringsfejl. Tjek at alle felter er udfyldt korrekt.',
} as const;

/**
 * Type-sikker fejl-kode
 *
 * Kun værdier fra ERROR_MESSAGES kan bruges som fejl-koder.
 */
export type ErrorCode = keyof typeof ERROR_MESSAGES;

/**
 * Custom Error class med type-sikker fejl-kode
 *
 * Eksempel:
 * ```typescript
 * if (arbejdsdage === 0) {
 *   throw new CalculationError(
 *     'DIVISION_BY_ZERO',
 *     'arbejdsdage var 0 i beregnMaanedPeriode'
 *   );
 * }
 * ```
 */
export class CalculationError extends Error {
  code: ErrorCode;
  cause?: unknown;

  /**
   * Opret CalculationError
   *
   * @param {ErrorCode} code - Type-sikker fejl-kode
   * @param {string} [technicalMessage] - Teknisk besked til logs (valgfri)
   */
  constructor(code: ErrorCode, technicalMessageOrOptions?: string | { technicalMessage?: string; cause?: unknown }) {
    const technicalMessage =
      typeof technicalMessageOrOptions === 'string'
        ? technicalMessageOrOptions
        : technicalMessageOrOptions?.technicalMessage;
    const cause =
      typeof technicalMessageOrOptions === 'string' ? undefined : technicalMessageOrOptions?.cause;

    // Brug bruger-besked som Error.message hvis ingen teknisk besked
    super(technicalMessage || ERROR_MESSAGES[code]);
    this.name = 'CalculationError';
    this.code = code;
    this.cause = cause;

    // Bevar stack trace (kun moderne browsers)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CalculationError);
    }
  }
}

/**
 * Hent brugervenlig fejlbesked fra error
 *
 * Hvis error er CalculationError, returneres den danske besked.
 * Ellers returneres generisk fejlbesked.
 *
 * @param {Error} error - Error at få besked fra
 * @returns {string} Brugervenlig dansk besked
 */
export function getUserMessage(error: Error): string {
  if (error instanceof CalculationError) {
    return ERROR_MESSAGES[error.code];
  }

  // Fallback for andre fejl-typer
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Tjek om error er CalculationError
 *
 * Type guard funktion.
 *
 * @param {Error} error - Error at tjekke
 * @returns {boolean} Sand hvis værdien er en CalculationError
 */
export function isCalculationError(error: Error): error is CalculationError {
  return error instanceof CalculationError;
}
