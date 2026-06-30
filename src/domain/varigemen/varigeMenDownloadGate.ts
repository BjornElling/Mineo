/**
 * Ren download-gate-beslutning for méngodtgørelse-siden (varige mén).
 *
 * Erstatter det tidligere inline-boolean-udtryk
 *   `beregningsFejl || manglendeFelter || !beregningsResultat`
 * i MenberegningTab med det fælles documentGateTypes-primitiv (jf.
 * dokument-output-kontrakt §A2: et samlet gate-resultat med `canDownload` og
 * auditerbare årsager; committed-only-reglen håndhæves strukturelt).
 *
 * Alle tre indgange er committed-afledte: feltfejl kommer fra onBlur-committet
 * felt-fejlmodel, de manglende felter fra committed stamdata/værdier, og
 * `hasBeregningsResultat` fra den autoritative engine, der kun køres på committed
 * input. Ren funktion uden React, så sandhedstabellen kan unit-testes direkte.
 */

import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';

export type VarigeMenDownloadGateInput = Readonly<{
  /** Blokerende feltfejl på relevante committed inputfelter (fødselsdato/skadedato/méngrad/beregningsdato). */
  hasBlockingFieldErrors: boolean;
  /** Påkrævet committed input mangler (eller méngrad = 0). */
  hasMissingFields: boolean;
  /** Den autoritative beregning kunne dannes på committed input. */
  hasBeregningsResultat: boolean;
}>;

export const evaluateVarigeMenDownloadGate = (input: VarigeMenDownloadGateInput): DocumentDownloadGateResult => {
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
