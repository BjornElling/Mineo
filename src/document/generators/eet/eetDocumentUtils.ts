/**
 * Delte formateringshjælpere for EET-PDF-generatorer.
 *
 * Bruges af differencekravPdf, loebendeYdelserPdf, kapitaliseringPdf og EetEfterEalPdf.
 */

import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { formatKr } from '../../layout/documentFormatUtils';

/** Alias for pdfFormatUtils.formatKr — behold for bagudkompatibilitet med EET-PDF-importsteder. */
export const formatKrEet = formatKr;

// Ja/Nej-formatering ejes af domænelaget (eetFormatUtils.formatJaNej). Re-eksporteres her under
// det etablerede EET-PDF-alias for bagudkompatibilitet — ingen lokal kopi.
export { formatJaNej as formatJaNejEet } from '../../../domain/erhvervsevnetab/eetFormatUtils';

/**
 * Formaterer en kapitaliseringsfaktor med op til 3 decimaler, trailing zeros trimmes.
 * Eksempel: 9.5 → "9,5", 8.000 → "8", 7.123 → "7,123"
 */
export const formatFaktorEet = (value: number): string => formatAsAmountTrimmed(value, 3);
