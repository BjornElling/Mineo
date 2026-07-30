/**
 * Rene download-gate-beslutninger for renteberegning-siden.
 *
 * Erstatter de tidligere rå-boolean-gates i RenteberegningTab med det fælles
 * documentGateTypes-primitiv (jf. dokument-output-kontrakt §A2: download-knapper
 * skal modtage et samlet gate-resultat med `canDownload` og auditerbare årsager,
 * og den committed-only-regel skal håndhæves strukturelt — ikke som kommentar).
 *
 * Begge gates udledes UDELUKKENDE fra committed-afledt state (pdfContexts/
 * anyRowHasError beregnet fra committedRentekravById via computeRentekravRow,
 * plus committed beregningsdato). De er rene funktioner uden React/draft-state,
 * så sandhedstabellen kan unit-testes direkte.
 */

import {
  allowDocumentDownload,
  blockDocumentDownload,
  blockDocumentDownloadForInvalidInput,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import type { ISODateString } from '../../types/branded';

export type RenteDownloadGateInput = Readonly<{
  /** Mindst én committed række med fuldt beregnet pdfContext (belob + renterFra gyldige og beregning ok). */
  hasValidPdfContexts: boolean;
  /** En committed ikke-tom række uden gyldig pdfContext (fx delvist udfyldt). */
  anyRowHasError: boolean;
  /** Feltfejl på committed beregningsdato (range-/datofejl). */
  beregningsdatoHasError: boolean;
}>;

/**
 * "Download alle specifikationer" (mobil-boksen).
 *
 * Bemærk: loading-tilstanden (downloadAllIsLoading) er en UI-transient og indgår
 * IKKE i dette committed-only gate-resultat; komponenten OR'er den separat på
 * knappens `disabled`, så en igangværende download stadig deaktiverer knappen.
 */
export const evaluateDownloadAllGate = (input: RenteDownloadGateInput): DocumentDownloadGateResult => {
  if (!input.hasValidPdfContexts) {
    return blockDocumentDownload({ code: 'renteberegning:no-valid-rows', message: 'Ingen gyldige rente-linjer' });
  }
  if (input.anyRowHasError) {
    return blockDocumentDownloadForInvalidInput({ code: 'renteberegning:row-has-error', message: 'En rente-linje med indtastning er ugyldig' });
  }
  if (input.beregningsdatoHasError) {
    return blockDocumentDownloadForInvalidInput({ code: 'renteberegning:beregningsdato-error', message: 'Beregningsdato er ugyldig' });
  }
  return allowDocumentDownload();
};

/**
 * "Download samlet oversigt" (desktop-rækken).
 *
 * Kræver udover de samme tre betingelser som download-alle, at beregningsdato
 * faktisk er udfyldt (committed undefined → blokeret).
 */
export const evaluateOversigtDownloadGate = (
  input: RenteDownloadGateInput & { beregningsdato: ISODateString | undefined },
): DocumentDownloadGateResult => {
  if (input.beregningsdato === undefined) {
    return blockDocumentDownload({ code: 'renteberegning:missing-beregningsdato', message: 'Beregningsdato mangler' });
  }
  if (input.beregningsdatoHasError) {
    return blockDocumentDownloadForInvalidInput({ code: 'renteberegning:beregningsdato-error', message: 'Beregningsdato er ugyldig' });
  }
  if (!input.hasValidPdfContexts) {
    return blockDocumentDownload({ code: 'renteberegning:no-valid-rows', message: 'Ingen gyldige rente-linjer' });
  }
  if (input.anyRowHasError) {
    return blockDocumentDownloadForInvalidInput({ code: 'renteberegning:row-has-error', message: 'En rente-linje med indtastning er ugyldig' });
  }
  return allowDocumentDownload();
};
