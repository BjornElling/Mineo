/**
 * Ren download-gate-beslutning for méngodtgørelse-siden (varige mén).
 *
 * Gaten (§A2/§3.4/§5.4): gaten afledes nu udelukkende af den ENE reader-projektion
 * (`buildVarigeMenReaderProjection`), som cellerne/visningen allerede afspejler. Den erstatter det tidligere
 * boolean-baserede input (`hasBlockingFieldErrors`/`hasMissingFields`/`hasBeregningsResultat`), der byggede på
 * `useFormFieldErrors` + rå sektioner. Sandhedstabellen er uændret:
 *
 *  - projektion blokeret af en rød feltfejl (format/bounds/rule) → `field-error`, kind `invalid-input`
 *    ("Fejl i indtastning"),
 *  - projektion blokeret KUN af manglende påkrævede felter → `missing-fields`, kind `missing-input`
 *    ("Indtastning mangler"),
 *  - projektion `ready`, men uden beregningsresultat (fx intet lovsats-år) → `no-result`.
 *
 * Funktionen er uden React, så sandhedstabellen kan unit-testes direkte og ikke afhænger af monterede inputfelter.
 */

import {
  allowDocumentDownload,
  blockDocumentDownload,
  blockDocumentDownloadForFieldIssue,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import type { VarigeMenReaderProjection } from './varigeMenReaderProjection';

export const evaluateVarigeMenDownloadGate = (
  projection: VarigeMenReaderProjection
): DocumentDownloadGateResult => {
  if (projection.status === 'blocked') {
    // En rød feltfejl (kind 'field') har forrang over en manglende-felt-consumerfejl, præcis som den tidligere
    // rækkefølge `beregningsFejl` → `manglendeFelter`.
    const fieldIssue = projection.issues.find((issue) => issue.kind === 'field');
    if (fieldIssue?.kind === 'field') {
      return blockDocumentDownloadForFieldIssue(fieldIssue, 'varigemen:field-error');
    }
    return blockDocumentDownload({ code: 'varigemen:missing-fields', message: 'Indtastning mangler' });
  }
  if (projection.value.beregningsResultat === null) {
    return blockDocumentDownload({ code: 'varigemen:no-result', message: 'Beregning kan ikke dannes' });
  }
  return allowDocumentDownload();
};
