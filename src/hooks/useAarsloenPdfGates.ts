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
import type {
  AarsloenTableHandle,
  StamdataValues
} from '../types/common';
import type { AarsloenValues } from '../schemas/formSchemas';
import type { PeriodeResult } from '../utils/periodeBeregning';
import type { AarsloenBeregningResult } from '../types/common';
import { loadSHDagePdfModule, loadAarsloenPdfModule } from '../utils/pdf/pdfLoader';
import { logError } from '../utils/logger';
import { harTabelValideringsFejl } from '../utils/aarsloenValidation';
import { hasAtLeastOneValidRow } from '../utils/aarsloenTableCalculations';
import { stamdataSchema } from '../schemas/formSchemas';
import type { StorageKey } from '../config/storageManifest';

// ============================================================================
// TYPES
// ============================================================================

interface PdfEligibility {
  canDownload: boolean;
  reason?: string;
}

interface UseAarsloenPdfGatesProps {
  values: AarsloenValues;
  omregningAktiveret: boolean;
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
  beregnetAarsloen: number;
  beregningsData: AarsloenBeregningResult;
  fejlmeddelelser: string[];
  harFatalBeregningsFejl: boolean;
  tabelRef: React.RefObject<AarsloenTableHandle | null>;
  getPersistedData: <K extends StorageKey>(formName: K) => unknown;
}

interface UseAarsloenPdfGatesReturn {
  canDownloadPdf: boolean;
  canDownloadSHDagePdf: boolean;
  handleAarsloenPdfDownload: () => Promise<void>;
  handleSHDagePdfDownload: () => Promise<void>;
  downloadShake: boolean;
}

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
  fejlmeddelelser,
  harFatalBeregningsFejl,
  tabelRef,
  getPersistedData,
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

  // Trigger shake animation
  const triggerDownloadShake = React.useCallback(() => {
    setDownloadShake(true);
    setTimeout(() => setDownloadShake(false), 500);
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
  const getPdfEligibility = React.useMemo((): PdfEligibility => {
    // GATE 1: Data i tabellen
    if (!tableData || tableData.length === 0) {
      return { canDownload: false, reason: 'Ingen data i tabel' };
    }

    // GATE 2: Valideringsfejl i tabel
    if (harTabelValideringsFejl(tableData, loenperiode)) {
      return { canDownload: false, reason: 'Valideringsfejl i tabel' };
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
      return { canDownload: false, reason: 'Ingen gyldige rækker i tabel' };
    }

    // GATE 4: Fatale beregningsfejl
    if (harFatalBeregningsFejl) {
      return { canDownload: false, reason: 'Fatale beregningsfejl' };
    }

    // GATE 5: Hvis omregning aktiveret - kræv periodeData
    if (omregningAktiveret) {
      if (!periodeData) {
        return { canDownload: false, reason: 'Mangler periode-data' };
      }
    }

    return { canDownload: true };
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

  // ============================================================================
  // STAMDATA VALIDERING (genbrugelig)
  // ============================================================================

  const getValidatedStamdata = React.useCallback((): StamdataValues | null => {
    const persisted = getPersistedData('stamdata');
    const result = stamdataSchema.safeParse(persisted);
    if (result.success) {
      return result.data as StamdataValues;
    }
    logError('Stamdata validering fejlede', {
      context: 'useAarsloenPdfGates.getValidatedStamdata',
      error: new Error('Invalid stamdata structure'),
      data: { issues: result.error.issues },
    });
    return null;
  }, [getPersistedData]);

  // ============================================================================
  // PDF DOWNLOAD HANDLERS
  // ============================================================================

  /**
   * Håndter PDF download for årslønsberegning
   *
   * VIGTIGT: Denne funktion udfører ALLE gates før download.
   */
  const handleAarsloenPdfDownload = React.useCallback(async () => {
    // FATAL GATE 1: Beregningsfejl
    if (harFatalBeregningsFejl) {
      triggerDownloadShake();
      return;
    }

    // FATAL GATE 2: Tabel-valideringsfejl (real-time check)
    const errors = tabelRef.current?.getErrors();
    if (errors && errors.length > 0) {
      triggerDownloadShake();

      // Flash første fejl-celle
      const firstError = errors[0];
      if (firstError.kind === 'cell') {
        tabelRef.current?.flashError(firstError);
      }

      return;
    }

    // Hent valideret stamdata
    const stamdata = getValidatedStamdata();

    // Ingen fejl - generer PDF
    try {
      const { generateAarsloenPdf } = await loadAarsloenPdfModule();

      generateAarsloenPdf({
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
        fejlmeddelelser,
        stamdata,
      });
    } catch (error) {
      logError('Kunne ikke generere årsløn PDF', {
        context: 'useAarsloenPdfGates.handleAarsloenPdfDownload',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
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
    fejlmeddelelser,
    triggerDownloadShake,
    harFatalBeregningsFejl,
    getValidatedStamdata,
    tabelRef,
  ]);

  /**
   * Håndter PDF download for SH-dage
   */
  const handleSHDagePdfDownload = React.useCallback(async () => {
    // Gates
    if (!periodeData) return;
    if (shDageAntal == null) return;
    if (shDageAntal === 0) return;

    // Hent valideret stamdata
    const stamdata = getValidatedStamdata();

    // Konverter perioder til format som PDF-generatoren forventer
    const perioder = periodeData.perioder || [];

    try {
      const { generateSHDagePdf } = await loadSHDagePdfModule();
      generateSHDagePdf(perioder, stamdata);
    } catch (error) {
      logError('Kunne ikke generere SH-dage PDF', {
        context: 'useAarsloenPdfGates.handleSHDagePdfDownload',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [periodeData, shDageAntal, getValidatedStamdata]);

  return {
    canDownloadPdf,
    canDownloadSHDagePdf,
    handleAarsloenPdfDownload,
    handleSHDagePdfDownload,
    downloadShake,
  };
};
