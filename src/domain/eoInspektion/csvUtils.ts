export const CSV_DELIMITER = ';';

export const normalizeCsvHeader = (value: string): string => value.replace(/\s*\n\s*/g, ' ').trim();

export const escapeCsvCell = (value: string): string => {
  const needsQuotes = value.includes(CSV_DELIMITER) || value.includes('"') || value.includes('\n') || value.includes('\r');
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

/**
 * Konverter værdi til CSV-scalar (string)
 *
 * I dev/test: Kaster fejl ved ikke-skalære værdier
 * I prod: Returnerer fallback-tekst UDEN logging (GDPR + data privacy)
 *
 * VIGTIGT: Prod må IKKE logge sagsdata til console
 */
export const toCsvScalar = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';

  const isDev = import.meta.env.DEV;

  if (isDev) {
    throw new Error(`CSV cell must be scalar, got: ${typeof value}`);
  }

  return '[Ugyldig CSV-værdi]';
};
