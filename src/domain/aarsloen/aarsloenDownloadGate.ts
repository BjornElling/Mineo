/**
 * Årsløns to download-gates — rene funktioner over `AarsloenReaderProjection` (Fase 5).
 *
 * **Hvad der flyttede, og hvorfor.** Reglerne lå før i `src/hooks/useAarsloenDocumentGates.ts` og
 * opererede på et `AarsloenDocumentSnapshot`, som KOMPONENTEN samlede af ni felter (`values`,
 * `omregningAktiveret`, `periodeData`, `shDageAntal`, `beregnetAarsloen`, `beregningsData`,
 * `harFatalBeregningsFejl`, `tableErrors`, `stamdataProjection`) og gav videre som props. Det gjorde
 * gaten afhængig af, at hver callsite samlede snapshottet korrekt — de øvrige 16 outputs udleder
 * derimod deres gate af en reader-projektion.
 *
 * Reglerne er bevaret 1:1: samme prædikater, samme rækkefølge, samme koder og samme beskeder. Kun
 * INPUTTET er ensartet, så gaten nu læser den kanoniske `buildAarsloenReaderProjection` frem for et
 * komponent-samlet objekt. Alle værdier, snapshottet bar, findes i forvejen på projektionen.
 *
 * `calculation === null` er projektionens måde at sige "feltgaten er rød, så motoren blev ikke kaldt"
 * (§3.9). Det er derfor en blokerings-årsag her, ikke en manglende værdi at gætte om.
 */
import {
  allowDocumentDownload,
  blockDocumentDownload,
  blockDocumentDownloadForInvalidInput,
  blockDocumentDownloadWithSpecificReason,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import { resolveAarsloenCanonicalRangeIssues } from './aarsloenValidationPolicies';
import type { AarsloenReaderProjection } from './aarsloenProjection';
import { hasAtLeastOneValidRow } from './standardLoenRowCalculations';

/**
 * Fælles for begge gates: stamdata er en obligatorisk dokumentdependency.
 *
 * Årsagen er `specific`, når den kommer fra et stamdata-ISSUE (UT-F07): issuet navngiver det felt, brugeren
 * skal rette, og den besked er mere værd end den universelle tekst. Den generiske fallback er derimod
 * `missing-input` — "Stamdata indeholder fejl" fortæller intet, brugeren kan handle på.
 */
const blockedByStamdata = (
  projection: AarsloenReaderProjection,
  code: string
): DocumentDownloadGateResult | null => {
  if (projection.documentStamdata.status === 'ready') return null;
  const issueMessage = projection.documentStamdata.status === 'blocked'
    ? projection.documentStamdata.issues[0]?.message
    : undefined;
  return issueMessage === undefined
    ? blockDocumentDownload({ code, message: 'Stamdata indeholder fejl' })
    : blockDocumentDownloadWithSpecificReason({ code, message: issueMessage });
};

/**
 * Fælles for begge gates: et canonical range-issue blokerer. Issuets egen besked navngiver grænsen
 * ("Procent skal være mellem 0 og 100"), så den citeres ordret (UT-F07).
 */
const blockedByCanonicalRange = (
  projection: AarsloenReaderProjection,
  code: string
): DocumentDownloadGateResult | null => {
  const issue = resolveAarsloenCanonicalRangeIssues(projection.values, {
    omregningAktiveret: projection.omregningGate.effectiveEnabled,
  })[0];
  return issue === undefined
    ? null
    : blockDocumentDownloadWithSpecificReason({ code, message: issue.message });
};

/** Årsløns-dokumentet. Rækkefølgen er identisk med `resolveAarsloenDocumentEligibility`. */
export const evaluateAarsloenDownloadGate = (
  projection: AarsloenReaderProjection
): DocumentDownloadGateResult => {
  const stamdataBlocked = blockedByStamdata(projection, 'aarsloen:stamdata-blocked');
  if (stamdataBlocked) return stamdataBlocked;

  const rangeBlocked = blockedByCanonicalRange(projection, 'aarsloen:canonical-range-error');
  if (rangeBlocked) return rangeBlocked;

  const { values, tableValidation, calculation, omregningGate } = projection;
  if (values.tableData.length === 0) {
    return blockDocumentDownload({ code: 'aarsloen:no-table-data', message: 'Ingen data i tabel' });
  }
  if (tableValidation.errors.length > 0) {
    // Rækkerne ER udfyldt, men indholdet er ugyldigt → "Fejl i indtastning", ikke "Indtastning mangler".
    return blockDocumentDownloadForInvalidInput({ code: 'aarsloen:table-validation-error', message: 'Valideringsfejl i tabel' });
  }
  if (!hasAtLeastOneValidRow(values.tableData, values.loenperiode, {
    feriePct: values.feriePct,
    fritvalgPct: values.fritvalgPct,
    shSoPct: values.shSoPct,
    storeBededagPct: values.storeBededagPct,
    pensionPct: values.pensionPct,
  }, values.tillaegAngivesSom)) {
    return blockDocumentDownload({ code: 'aarsloen:no-valid-rows', message: 'Ingen gyldige rækker i tabel' });
  }
  // Feltgaten var rød, så motoren blev ikke kaldt (§3.9). Før Fase 5 svarede dette til
  // `harFatalBeregningsFejl` på et snapshot, hvor beregningen altid var forsøgt.
  if (calculation === null) {
    return blockDocumentDownload({ code: 'aarsloen:fatal-calculation-error', message: 'Fatale beregningsfejl' });
  }
  if (calculation.harFatalBeregningsFejl) {
    return blockDocumentDownload({ code: 'aarsloen:fatal-calculation-error', message: 'Fatale beregningsfejl' });
  }
  if (omregningGate.effectiveEnabled && calculation.periodeData === null) {
    return blockDocumentDownload({ code: 'aarsloen:missing-period-data', message: 'Mangler periode-data' });
  }
  return allowDocumentDownload();
};

/** SH-dage-dokumentet. Rækkefølgen er identisk med `resolveShDageDocumentEligibility`. */
export const evaluateShDageDownloadGate = (
  projection: AarsloenReaderProjection
): DocumentDownloadGateResult => {
  const stamdataBlocked = blockedByStamdata(projection, 'aarsloen:sh-stamdata-blocked');
  if (stamdataBlocked) return stamdataBlocked;

  const rangeBlocked = blockedByCanonicalRange(projection, 'aarsloen:sh-canonical-range-error');
  if (rangeBlocked) return rangeBlocked;

  const { calculation } = projection;
  if (calculation === null || calculation.periodeData === null) {
    return blockDocumentDownload({ code: 'aarsloen:sh-missing-period-data', message: 'Mangler periode-data' });
  }
  if (calculation.shDageAntal === null) {
    return blockDocumentDownload({ code: 'aarsloen:sh-no-count', message: 'Antal SH-dage er ikke beregnet' });
  }
  if (calculation.shDageAntal === 0) {
    return blockDocumentDownload({ code: 'aarsloen:sh-zero', message: 'Ingen SH-dage i de indtastede perioder' });
  }
  return allowDocumentDownload();
};
