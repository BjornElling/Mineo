/**
 * Custom hook for årsløn dokument-download-gates
 *
 * Ansvar:
 * - Konsolideret dokument-eligibility check
 * - Trigger download shake animation
 * - Håndtering af dokument-downloads
 *
 * Dette hook samler alle dokument-download-gates ét sted for nem vedligeholdelse. Outputtet er
 * format-agnostisk (PDF eller Word afhængigt af documentDownloadFormat).
 */

import React from 'react';
import type { StandardLoenTableHandle } from '../types/handles';
import type { AarsloenValues } from '../schemas/formSchemas';
import type { PeriodeResult } from '../utils/periodeBeregning';
import type { AarsloenBeregningResult } from '../types/calculation';
import {
  harTabelValideringsFejl,
  resolveAarsloenCanonicalRangeIssues,
} from '../domain/aarsloen/aarsloenValidationPolicies';
import { hasAtLeastOneValidRow } from '../domain/aarsloen/standardLoenRowCalculations';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { AppSettings } from '../settings/appSettingsSchema';
import { downloadAarsloenDokument, downloadSHDageDokument } from '../document/service/documentService';
import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../document/layout/documentGateTypes';

// ============================================================================
// TYPES
// ============================================================================

type UseAarsloenDocumentGatesProps = {
  values: AarsloenValues;
  omregningAktiveret: boolean;
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
  beregnetAarsloen: number;
  beregningsData: AarsloenBeregningResult;
  harFatalBeregningsFejl: boolean;
  tabelRef: React.RefObject<StandardLoenTableHandle | null>;
  persistedStamdata: PersistedSectionMap['stamdata'] | null;
  settings: AppSettings;
};

type UseAarsloenDocumentGatesReturn = {
  canDownloadDocument: boolean;
  /** Blokerings-årsag for hoved-download, eller null når download er tilladt. Bruges som tooltip på det nedtonede ikon. */
  documentDisabledReason: string | null;
  canDownloadSHDageDocument: boolean;
  /** Blokerings-årsag for SH-dage-download, eller null når download er tilladt. */
  shDageDisabledReason: string | null;
  handleAarsloenDocumentDownload: () => Promise<void>;
  handleSHDageDocumentDownload: () => Promise<void>;
  downloadShake: boolean;
  downloadErrorMessage: string | null;
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook der håndterer dokument-download-gates og downloads
 *
 * @param props - Se UseAarsloenDocumentGatesProps
 * @returns Dokument-download state og handlers
 */
export const useAarsloenDocumentGates = ({
  values,
  omregningAktiveret,
  periodeData,
  shDageAntal,
  beregnetAarsloen,
  beregningsData,
  harFatalBeregningsFejl,
  tabelRef,
  persistedStamdata,
  settings,
}: UseAarsloenDocumentGatesProps): UseAarsloenDocumentGatesReturn => {
  const {
    tableData,
    loenperiode,
    tillaegAngivesSom,
    feriePct,
    fritvalgPct,
    shSoPct,
    storeBededagPct,
    pensionPct,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
  } = values;

  // State til download-knap shake-animation
  const [downloadShake, setDownloadShake] = React.useState(false);
  const [downloadErrorMessage, setDownloadErrorMessage] = React.useState<string | null>(null);
  const downloadShakeTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (downloadShakeTimeoutRef.current !== null) {
        window.clearTimeout(downloadShakeTimeoutRef.current);
      }
    };
  }, []);

  // Trigger shake animation
  const triggerDownloadShake = React.useCallback(() => {
    setDownloadShake(true);
    if (downloadShakeTimeoutRef.current !== null) {
      window.clearTimeout(downloadShakeTimeoutRef.current);
    }
    downloadShakeTimeoutRef.current = window.setTimeout(() => {
      setDownloadShake(false);
      downloadShakeTimeoutRef.current = null;
    }, 500);
  }, []);

  // ============================================================================
  // DOKUMENT-ELIGIBILITY GATES
  // ============================================================================

  /**
   * Hovedfunktion: Evaluér om dokumentet kan downloades
   *
   * VIGTIGT: Dette er single source of truth for dokument-eligibility.
   * Alle gates samlet ét sted for nem vedligeholdelse.
   */
  const getDocumentEligibility = React.useMemo((): DocumentDownloadGateResult => {
    const canonicalRangeIssue = resolveAarsloenCanonicalRangeIssues(values, { omregningAktiveret })[0];
    if (canonicalRangeIssue) {
      return blockDocumentDownload({
        code: 'aarsloen:canonical-range-error',
        message: canonicalRangeIssue.message,
      });
    }

    // GATE 1: Data i tabellen
    if (!tableData || tableData.length === 0) {
      return blockDocumentDownload({ code: 'aarsloen:no-table-data', message: 'Ingen data i tabel' });
    }

    // GATE 2: Valideringsfejl i tabel
    if (harTabelValideringsFejl(tableData, loenperiode, tillaegAngivesSom)) {
      return blockDocumentDownload({ code: 'aarsloen:table-validation-error', message: 'Valideringsfejl i tabel' });
    }

    // GATE 3: Mindst én gyldig række (komplet periode + samlet løn ≠ 0)
    if (
      !hasAtLeastOneValidRow(tableData, loenperiode, {
        feriePct,
        fritvalgPct,
        shSoPct,
        storeBededagPct,
        pensionPct,
      }, tillaegAngivesSom)
    ) {
      return blockDocumentDownload({ code: 'aarsloen:no-valid-rows', message: 'Ingen gyldige rækker i tabel' });
    }

    // GATE 4: Fatale beregningsfejl
    if (harFatalBeregningsFejl) {
      return blockDocumentDownload({ code: 'aarsloen:fatal-calculation-error', message: 'Fatale beregningsfejl' });
    }

    // GATE 5: Hvis omregning aktiveret - kræv periodeData
    if (omregningAktiveret) {
      if (!periodeData) {
        return blockDocumentDownload({ code: 'aarsloen:missing-period-data', message: 'Mangler periode-data' });
      }
    }

    return allowDocumentDownload();
  }, [
    tableData,
    loenperiode,
    tillaegAngivesSom,
    feriePct,
    fritvalgPct,
    shSoPct,
    storeBededagPct,
    pensionPct,
    harFatalBeregningsFejl,
    omregningAktiveret,
    periodeData,
    values,
  ]);

  const canDownloadDocument = getDocumentEligibility.canDownload;
  const documentDisabledReason = getDocumentEligibility.canDownload
    ? null
    : getDocumentEligibility.reasons[0]?.message ?? null;

  /**
   * Evaluér om SH-dage-dokumentet kan downloades. Returnerer et gate-resultat med
   * auditerbar årsag, så det nedtonede download-ikon kan vise hvorfor det er blokeret.
   */
  const shDageEligibility = React.useMemo((): DocumentDownloadGateResult => {
    const canonicalRangeIssue = resolveAarsloenCanonicalRangeIssues(values, { omregningAktiveret })[0];
    if (canonicalRangeIssue) {
      return blockDocumentDownload({
        code: 'aarsloen:sh-canonical-range-error',
        message: canonicalRangeIssue.message,
      });
    }
    if (!periodeData) {
      return blockDocumentDownload({ code: 'aarsloen:sh-missing-period-data', message: 'Mangler periode-data' });
    }
    if (shDageAntal == null) {
      return blockDocumentDownload({ code: 'aarsloen:sh-no-count', message: 'Antal SH-dage er ikke beregnet' });
    }
    if (shDageAntal === 0) {
      return blockDocumentDownload({ code: 'aarsloen:sh-zero', message: 'Ingen SH-dage i de indtastede perioder' });
    }
    return allowDocumentDownload();
  }, [omregningAktiveret, periodeData, shDageAntal, values]);

  const canDownloadSHDageDocument = shDageEligibility.canDownload;
  const shDageDisabledReason = shDageEligibility.canDownload
    ? null
    : shDageEligibility.reasons[0]?.message ?? null;

  /**
   * Håndter dokument-download for årslønsberegning
   *
   * VIGTIGT: Denne funktion udfører ALLE gates før download.
   */
  const handleAarsloenDocumentDownload = React.useCallback(async () => {
    // FATAL GATE 1: Beregningsfejl
    if (harFatalBeregningsFejl) {
      setDownloadErrorMessage(null);
      triggerDownloadShake();
      return;
    }

    // FATAL GATE 2: Tabel-valideringsfejl (real-time check)
    const errors = tabelRef.current?.getErrors();
    if (errors && errors.length > 0) {
      setDownloadErrorMessage(null);
      triggerDownloadShake();

      // Flash første fejl-celle
      const firstError = errors[0];
      if (firstError.kind === 'cell') {
        tabelRef.current?.flashError(firstError);
      }

      return;
    }

    // Handlingen genkører den samme committed gate som knappen. Dermed kan en
    // programmatisk aktivering ikke omgå fx en canonical rangefejl.
    if (!getDocumentEligibility.canDownload) {
      setDownloadErrorMessage(null);
      triggerDownloadShake();
      return;
    }

    const result = await downloadAarsloenDokument({
      input: {
        satser: {
          feriePct,
          fritvalgPct,
          shSoPct,
          storeBededagPct,
          pensionPct,
        },
        loenperiode,
        tillaegAngivesSom,
        tableData,
        beregnetAarsloen,
        omregningTilFuldtAar: omregningAktiveret,
        periodeData,
        fuldLoenUnderFerie,
        retTilSjetteFerieuge,
        antalFeriedage,
        loenPaaHelligdage,
        shDageAntal,
        beregningsData,
      },
      settings,
      persistedStamdata,
    });
    setDownloadErrorMessage(result.success ? null : result.error);
  }, [
    feriePct,
    fritvalgPct,
    shSoPct,
    storeBededagPct,
    pensionPct,
    loenperiode,
    tillaegAngivesSom,
    tableData,
    beregnetAarsloen,
    omregningAktiveret,
    periodeData,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
    shDageAntal,
    beregningsData,
    triggerDownloadShake,
    harFatalBeregningsFejl,
    persistedStamdata,
    tabelRef,
    settings,
    getDocumentEligibility,
  ]);

  /**
   * Håndter dokument-download for SH-dage
   */
  const handleSHDageDocumentDownload = React.useCallback(async () => {
    if (!shDageEligibility.canDownload || !periodeData) return;

    // Konverter perioder til format som PDF-generatoren forventer
    const perioder = periodeData.perioder || [];

    const result = await downloadSHDageDokument({
      perioder,
      settings,
      persistedStamdata,
    });
    setDownloadErrorMessage(result.success ? null : result.error);
  }, [periodeData, settings, persistedStamdata, shDageEligibility]);

  return {
    canDownloadDocument,
    documentDisabledReason,
    canDownloadSHDageDocument,
    shDageDisabledReason,
    handleAarsloenDocumentDownload,
    handleSHDageDocumentDownload,
    downloadShake,
    downloadErrorMessage,
  };
};
