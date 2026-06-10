/**
 * Custom hook for årsløn PDF download gates
 *
 * Ansvar:
 * - Konsolideret PDF-eligibility check
 * - Trigger download shake animation
 * - Håndtering af PDF downloads
 *
 * Dette hook samler alle PDF-relaterede gates ét sted for nem vedligeholdelse.
 */

import React from 'react';
import type { StandardLoenTableHandle } from '../types/handles';
import type { AarsloenValues } from '../schemas/formSchemas';
import type { PeriodeResult } from '../utils/periodeBeregning';
import type { AarsloenBeregningResult } from '../types/calculation';
import { harTabelValideringsFejl } from '../domain/aarsloen/aarsloenValidationPolicies';
import { hasAtLeastOneValidRow } from '../domain/aarsloen/standardLoenRowCalculations';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { AppSettings } from '../settings/appSettingsSchema';
import { downloadAarsloenDokument, downloadSHDageDokument } from '../pdf/infrastructure/pdfService';
import { allowPdfDownload, blockPdfDownload, type PdfDownloadGateResult } from '../pdf/pdfGateTypes';

// ============================================================================
// TYPES
// ============================================================================

type UseAarsloenPdfGatesProps = {
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

type UseAarsloenPdfGatesReturn = {
  canDownloadPdf: boolean;
  canDownloadSHDagePdf: boolean;
  handleAarsloenPdfDownload: () => Promise<void>;
  handleSHDagePdfDownload: () => Promise<void>;
  downloadShake: boolean;
  downloadErrorMessage: string | null;
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook der håndterer PDF download gates og downloads
 *
 * @param props - Se UseAarsloenPdfGatesProps
 * @returns PDF download state og handlers
 */
export const useAarsloenPdfGates = ({
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
}: UseAarsloenPdfGatesProps): UseAarsloenPdfGatesReturn => {
  const {
    tableData,
    loenperiode,
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
  // PDF ELIGIBILITY GATES
  // ============================================================================

  /**
   * Hovedfunktion: Evaluér om PDF kan downloades
   *
   * VIGTIGT: Dette er single source of truth for PDF-eligibility.
   * Alle gates samlet ét sted for nem vedligeholdelse.
   */
  const getPdfEligibility = React.useMemo((): PdfDownloadGateResult => {
    // GATE 1: Data i tabellen
    if (!tableData || tableData.length === 0) {
      return blockPdfDownload({ code: 'aarsloen:no-table-data', message: 'Ingen data i tabel' });
    }

    // GATE 2: Valideringsfejl i tabel
    if (harTabelValideringsFejl(tableData, loenperiode)) {
      return blockPdfDownload({ code: 'aarsloen:table-validation-error', message: 'Valideringsfejl i tabel' });
    }

    // GATE 3: Mindst én gyldig række (komplet periode + samlet løn ≠ 0)
    if (
      !hasAtLeastOneValidRow(tableData, loenperiode, {
        feriePct,
        fritvalgPct,
        shSoPct,
        storeBededagPct,
        pensionPct,
      })
    ) {
      return blockPdfDownload({ code: 'aarsloen:no-valid-rows', message: 'Ingen gyldige rækker i tabel' });
    }

    // GATE 4: Fatale beregningsfejl
    if (harFatalBeregningsFejl) {
      return blockPdfDownload({ code: 'aarsloen:fatal-calculation-error', message: 'Fatale beregningsfejl' });
    }

    // GATE 5: Hvis omregning aktiveret - kræv periodeData
    if (omregningAktiveret) {
      if (!periodeData) {
        return blockPdfDownload({ code: 'aarsloen:missing-period-data', message: 'Mangler periode-data' });
      }
    }

    return allowPdfDownload();
  }, [
    tableData,
    loenperiode,
    feriePct,
    fritvalgPct,
    shSoPct,
    storeBededagPct,
    pensionPct,
    harFatalBeregningsFejl,
    omregningAktiveret,
    periodeData,
  ]);

  const canDownloadPdf = getPdfEligibility.canDownload;

  /**
   * Evaluér om SH-dage PDF kan downloades
   */
  const canDownloadSHDagePdf = React.useMemo((): boolean => {
    if (!periodeData) return false;
    if (shDageAntal == null) return false; // null eller undefined
    if (shDageAntal === 0) return false; // Ingen SH-dage at vise
    return true;
  }, [periodeData, shDageAntal]);

  /**
   * Håndter PDF download for årslønsberegning
   *
   * VIGTIGT: Denne funktion udfører ALLE gates før download.
   */
  const handleAarsloenPdfDownload = React.useCallback(async () => {
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
  ]);

  /**
   * Håndter PDF download for SH-dage
   */
  const handleSHDagePdfDownload = React.useCallback(async () => {
    // Gates
    if (!periodeData) return;
    if (shDageAntal == null) return;
    if (shDageAntal === 0) return;

    // Konverter perioder til format som PDF-generatoren forventer
    const perioder = periodeData.perioder || [];

    const result = await downloadSHDageDokument({
      perioder,
      settings,
      persistedStamdata,
    });
    setDownloadErrorMessage(result.success ? null : result.error);
  }, [periodeData, shDageAntal, settings, persistedStamdata]);

  return {
    canDownloadPdf,
    canDownloadSHDagePdf,
    handleAarsloenPdfDownload,
    handleSHDagePdfDownload,
    downloadShake,
    downloadErrorMessage,
  };
};
