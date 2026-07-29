/**
 * Ren download-gate-beslutning for méngodtgørelse-siden (varige mén).
 *
 * Gaten (§A2/§3.4/§5.4): gaten afledes nu udelukkende af den ENE reader-projektion
 * (`buildVarigeMenReaderProjection`), som cellerne/visningen allerede afspejler. Den erstatter det tidligere
 * boolean-baserede input (`hasBlockingFieldErrors`/`hasMissingFields`/`hasBeregningsResultat`), der byggede på
 * `useFormFieldErrors` + rå sektioner. Sandhedstabellen er uændret:
 *
 *  - projektion blokeret af en rød feltfejl (format/bounds/rule) → `field-error` ("Fejl i indtastning"),
 *  - projektion blokeret KUN af manglende påkrævede felter → `missing-fields` ("Indtastning mangler"),
 *  - projektion `ready`, men uden beregningsresultat (fx intet lovsats-år) → `no-result`.
 *
 * Funktionen er uden React, så sandhedstabellen kan unit-testes direkte og ikke afhænger af monterede inputfelter.
 */

import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';
import type { VarigeMenReaderProjection } from './varigeMenReaderProjection';

export const evaluateVarigeMenDownloadGate = (
  projection: VarigeMenReaderProjection
): DocumentDownloadGateResult => {
  if (projection.status === 'blocked') {
    // En rød feltfejl (kind 'field') har forrang over en manglende-felt-consumerfejl, præcis som den tidligere
    // rækkefølge `beregningsFejl` → `manglendeFelter`.
    const hasFieldError = projection.issues.some((issue) => issue.kind === 'field');
    if (hasFieldError) {
      return blockDocumentDownload({ code: 'varigemen:field-error', message: 'Fejl i indtastning' });
    }
    return blockDocumentDownload({ code: 'varigemen:missing-fields', message: 'Indtastning mangler' });
  }
  if (projection.value.beregningsResultat === null) {
    return blockDocumentDownload({ code: 'varigemen:no-result', message: 'Beregning kan ikke dannes' });
  }
  return allowDocumentDownload();
};
