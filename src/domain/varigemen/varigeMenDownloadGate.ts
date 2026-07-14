/**
 * Ren download-gate-beslutning for méngodtgørelse-siden (varige mén).
 *
 * Erstatter det tidligere inline-boolean-udtryk
 *   `beregningsFejl || manglendeFelter || !beregningsResultat`
 * i MenberegningTab med det fælles documentGateTypes-primitiv (jf.
 * dokument-output-kontrakt §A2: et samlet gate-resultat med `canDownload` og
 * auditerbare årsager; committed-only-reglen håndhæves strukturelt).
 *
 * Alle indgange er afledt fra afsluttet canonical input: feltissues, manglende felter,
 * den rene stamdatarelation og den autoritative engine. Funktionen er uden React, så
 * sandhedstabellen kan unit-testes direkte og ikke afhænger af monterede inputfelter.
 */

import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';
import type { StamdataValues } from '../../schemas/formSchemas';
import { resolveStamdataDateOrder } from '../stamdata/stamdataDateOrder';

export type VarigeMenDownloadGateInput = Readonly<{
  /** Canonical stamdata; datoordenen valideres rent og uafhængigt af monterede inputfelter. */
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadelidteFodselsdato'>;
  /** Blokerende feltfejl på relevante committed inputfelter (fødselsdato/skadedato/méngrad/beregningsdato). */
  hasBlockingFieldErrors: boolean;
  /** Påkrævet committed input mangler (eller méngrad = 0). */
  hasMissingFields: boolean;
  /** Den autoritative beregning kunne dannes på committed input. */
  hasBeregningsResultat: boolean;
}>;

export const evaluateVarigeMenDownloadGate = (input: VarigeMenDownloadGateInput): DocumentDownloadGateResult => {
  if (resolveStamdataDateOrder(input.stamdata).issues.length > 0) {
    return blockDocumentDownload({
      code: 'varigemen:stamdata-date-order',
      message: 'Skadedato er før fødselsdato.',
    });
  }
  if (input.hasBlockingFieldErrors) {
    return blockDocumentDownload({ code: 'varigemen:field-error', message: 'Fejl i indtastning' });
  }
  if (input.hasMissingFields) {
    return blockDocumentDownload({ code: 'varigemen:missing-fields', message: 'Indtastning mangler' });
  }
  if (!input.hasBeregningsResultat) {
    return blockDocumentDownload({ code: 'varigemen:no-result', message: 'Beregning kan ikke dannes' });
  }
  return allowDocumentDownload();
};
