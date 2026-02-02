/**
 * Fælles PDF-options kontrakt
 *
 * VIGTIGT:
 * - Dette er den ENESTE kanal for brevhoved-flag og stamdata til PDF-generatorer
 * - PDF-generatorer må IKKE læse settings eller kende PdfType
 * - Alle nye fælles PDF-parametre skal tilføjes her
 *
 * KONTRAKT:
 * - stamdata er valgfri (PDF'en degraderer pænt hvis manglende)
 * - visBrevhoved default false hvis undefined
 * - Ingen domæneparametre må tilføjes her (kun tværgående concerns)
 */

import type { ISODateString } from '../../types/branded';

/**
 * Minimal stamdata-struktur for brevhoved
 *
 * Alle felter er valgfri fordi:
 * - Bruger kan have tomme stamdata
 * - PDF skal kunne genereres uden brevhoved
 */
export interface PdfStamdata {
  journalnr?: string;
  dagsDatoISO?: ISODateString;
  dagsDatoLabel?: string;
  useDagsDatoFallback?: boolean;
  advokat?: string;
  sagsbehandler?: string;
}

/**
 * Fælles options for alle PDF-generatorer
 *
 * Bruges til at styre tværgående concerns som brevhoved,
 * locale, formattering, etc.
 */
export interface PdfCommonOptions {
  /**
   * Om PDF skal have brevhoved med stamdata
   * Default: false
   */
  visBrevhoved?: boolean;

  /**
   * Stamdata til brevhoved
   * Kun relevant hvis visBrevhoved=true
   */
  stamdata?: PdfStamdata | null;
}
