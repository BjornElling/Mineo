/**
 * Ren download-gate-beslutning for méngodtgørelse-siden (varige mén).
 *
 * Gaten (§A2, input-architecture.md §2.4) afledes udelukkende af den ENE reader-projektion
 * (`buildVarigeMenReaderProjection`), som cellerne/visningen allerede afspejler. Sandhedstabellen:
 *
 *  - projektion blokeret af rød(e) feltfejl (format/bounds/rule) → kind `invalid-input`
 *    ("Fejl i indtastning"), eller `specific` hvis der er præcis ÉN rød fejl med en konkret tekst,
 *  - projektion blokeret KUN af manglende påkrævede felter → kind `missing-input` ("Indtastning mangler"),
 *  - projektion `ready`, men uden beregningsresultat (fx intet lovsats-år) → `no-result`.
 *
 * Funktionen er uden React, så sandhedstabellen kan unit-testes direkte og ikke afhænger af monterede inputfelter.
 */

import {
  allowDocumentDownload,
  blockDocumentDownloadForUnavailableCalculation,
  blockDocumentDownloadFromCauses,
  toBlockingCauses,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import type { VarigeMenReaderProjection } from './varigeMenReaderProjection';

export const evaluateVarigeMenDownloadGate = (
  projection: VarigeMenReaderProjection
): DocumentDownloadGateResult => {
  if (projection.status === 'blocked') {
    // HELE issue-listen sendes til klassifikationen. Valgte gaten ÉT feltissue med `.find()` og citerede det,
    // ville to samtidige røde felter se ud som én fejl, og tooltippen ville udpege det ene som "fejlen".
    // Rød-før-tom-forrangen ligger i `classifyBlockingCauses`, som lader en feltfejl vinde over en
    // `missing`-consumerfejl.
    return blockDocumentDownloadFromCauses(
      'varigemen:field-error',
      toBlockingCauses(projection.issues),
      'Indtastning mangler'
    );
  }
  if (projection.value.beregningsResultat === null) {
    // Input er komplet og gyldigt (projektionen er `ready`), men motoren fandt fx ingen lovsats for
    // beregningsåret (§1.1).
    return blockDocumentDownloadForUnavailableCalculation({ code: 'varigemen:no-result', message: 'Beregning kan ikke dannes' });
  }
  return allowDocumentDownload();
};
