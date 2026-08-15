/**
 * Rene download-gate-beslutninger for renteberegning-siden.
 *
 * Erstatter de tidligere rå-boolean-gates i RenteberegningTab med det fælles
 * documentGateTypes-primitiv (jf. dokument-output-kontrakt §A2: download-knapper
 * skal modtage et samlet gate-resultat med `canDownload` og auditerbare årsager,
 * og den committed-only-regel skal håndhæves strukturelt — ikke som kommentar).
 *
 * Begge gates udledes UDELUKKENDE fra committed-afledt state (pdfContexts/
 * anyRowHasError fra den ready reader-projektion plus committed beregningsdato).
 * De er rene funktioner uden React/draft-state,
 * så sandhedstabellen kan unit-testes direkte.
 */

import {
  allowDocumentDownload,
  blockDocumentDownload,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import type { ISODateString } from '../../types/branded';

export type RenteDownloadGateInput = Readonly<{
  /** Mindst én committed række med fuldt beregnet pdfContext (belob + renterFra gyldige og beregning ok). */
  hasValidPdfContexts: boolean;
  /** En committed ikke-tom række uden gyldig pdfContext (fx delvist udfyldt). */
  anyRowHasError: boolean;
}>;

/**
 * En ufuldstændig rentelinje er en MANGEL, ikke en ugyldig indtastning.
 *
 * Grenen svarede før «Fejl i indtastning». Det var forkert for enhver tilstand, den kan nå:
 * `anyRowHasError` aflæses KUN i aggregatets `ready`-gren, og aggregatet læser hver rækkes felter gennem
 * `collector.optional`. Et rødt felt gør derfor read'et `unavailable`, projektionen `blocked` og
 * `anyRowHasError` uaflæselig — de røde rækker gates et helt andet sted
 * (`blockedProjectionFromCauses` i `renteberegningDocumentDefinitions.ts`). Når flaget ER sandt, er
 * samtlige felter altså læsbare, og den manglende `pdfContext` skyldes en ufuldstændig række (typisk et
 * beløb uden «Renter fra»-dato). Brugeren skal udfylde, ikke rette.
 *
 * Samme fejlform som brugerfundet på Årsløn 2026-08-15: én aggregeret boolean over flere tilstande fik
 * påklistret én hardkodet klasse. Her var klassen forkert for HELE grenen — ikke bare halvdelen.
 */
const blockedByIncompleteRow = (code: string): DocumentDownloadGateResult =>
  blockDocumentDownload({ code, message: 'En rente-linje med indtastning er ufuldstændig' });

// Der var også et `beregningsdatoHasError`-flag. Det er FJERNET: en feltfejl på beregningsdatoen gør
// aggregat-projektionen `blocked`, så alle tre callsites sendte hardkodet `false`, og begge grene, flaget
// styrede, var uopnåelige. Et felt, ingen kan sætte sandt, beskriver en gate-tilstand der ikke findes.

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
    return blockedByIncompleteRow('renteberegning:row-has-error');
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
  if (!input.hasValidPdfContexts) {
    return blockDocumentDownload({ code: 'renteberegning:no-valid-rows', message: 'Ingen gyldige rente-linjer' });
  }
  if (input.anyRowHasError) {
    return blockedByIncompleteRow('renteberegning:row-has-error');
  }
  return allowDocumentDownload();
};
