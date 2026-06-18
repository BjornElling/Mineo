/**
 * Fælles PDF-options kontrakt
 *
 * VIGTIGT:
 * - Dette er den ENESTE kanal for brevhoved-flag og stamdata til PDF-generatorer
 * - PDF-generatorer må IKKE læse settings eller kende DocumentBrevhovedType
 * - Alle nye fælles PDF-parametre skal tilføjes her
 *
 * KONTRAKT:
 * - stamdata er valgfri (dato-linjen kræver dagsDatoISO fra kaldestedet, journalnr-linjen er betinget)
 * - visBrevhoved default false hvis undefined
 * - Ingen domæneparametre må tilføjes her (kun tværgående concerns)
 */

import type { ISODateString } from '../../types/branded';

/**
 * Minimal stamdata-struktur for brevhoved
 *
 * Alle felter er valgfri fordi:
 * - Bruger kan have tomme stamdata
 * - Dato-linjen kræver dagsDatoISO fra kaldestedet, journalnr-linjen er betinget
 */
export interface DocumentStamdata {
  journalnr?: string;
  dagsDatoISO?: ISODateString;
  advokat?: string;
  sagsbehandler?: string;
}

/**
 * Fælles options for alle PDF-generatorer
 *
 * Bruges til at styre tværgående concerns som brevhoved,
 * locale, formattering, etc.
 */
export interface DocumentCommonOptions {
  /**
   * Om PDF skal have brevhoved med stamdata
   * Default: false
   */
  visBrevhoved?: boolean;

  /**
   * Stamdata til brevhoved
   * Kun relevant hvis visBrevhoved=true
   */
  stamdata?: DocumentStamdata | null;
}
