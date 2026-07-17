import React from 'react';

import type { PersistedSectionMap } from '../config/persistenceRegistry';
import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../document/layout/documentGateTypes';
import { downloadAarsloenDokument, downloadSHDageDokument } from '../document/service/documentService';
import { hasAtLeastOneValidRow } from '../domain/aarsloen/standardLoenRowCalculations';
import { resolveAarsloenCanonicalRangeIssues } from '../domain/aarsloen/aarsloenValidationPolicies';
import type { AarsloenValues } from '../schemas/formSchemas';
import type { AppSettings } from '../settings/appSettingsSchema';
import type { AarsloenBeregningResult } from '../types/calculation';
import type { StandardLoenTableHandle } from '../types/handles';
import type { TableError } from '../types/table';
import type { PeriodeResult } from '../utils/periodeBeregning';

export type AarsloenDocumentSnapshot = Readonly<{
  values: AarsloenValues;
  omregningAktiveret: boolean;
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
  beregnetAarsloen: number;
  beregningsData: AarsloenBeregningResult;
  harFatalBeregningsFejl: boolean;
  tableErrors: readonly TableError[];
  persistedStamdata: PersistedSectionMap['stamdata'] | null;
  settings: AppSettings;
  isSourceCurrent: () => boolean;
}>;

type UseAarsloenDocumentGatesProps = AarsloenDocumentSnapshot & Readonly<{
  tabelRef: React.RefObject<StandardLoenTableHandle | null>;
}>;

type UseAarsloenDocumentGatesReturn = Readonly<{
  canDownloadDocument: boolean;
  documentDisabledReason: string | null;
  canDownloadSHDageDocument: boolean;
  shDageDisabledReason: string | null;
  handleAarsloenDocumentDownload: (latest?: AarsloenDocumentSnapshot) => Promise<void>;
  handleSHDageDocumentDownload: (latest?: AarsloenDocumentSnapshot) => Promise<void>;
  downloadShake: boolean;
  downloadErrorMessage: string | null;
}>;

export const resolveAarsloenDocumentEligibility = (
  snapshot: AarsloenDocumentSnapshot
): DocumentDownloadGateResult => {
  const { values, omregningAktiveret, tableErrors, harFatalBeregningsFejl, periodeData } = snapshot;
  const canonicalRangeIssue = resolveAarsloenCanonicalRangeIssues(values, { omregningAktiveret })[0];
  if (canonicalRangeIssue) {
    return blockDocumentDownload({ code: 'aarsloen:canonical-range-error', message: canonicalRangeIssue.message });
  }
  if (values.tableData.length === 0) {
    return blockDocumentDownload({ code: 'aarsloen:no-table-data', message: 'Ingen data i tabel' });
  }
  if (tableErrors.length > 0) {
    return blockDocumentDownload({ code: 'aarsloen:table-validation-error', message: 'Valideringsfejl i tabel' });
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
  if (harFatalBeregningsFejl) {
    return blockDocumentDownload({ code: 'aarsloen:fatal-calculation-error', message: 'Fatale beregningsfejl' });
  }
  if (omregningAktiveret && periodeData === null) {
    return blockDocumentDownload({ code: 'aarsloen:missing-period-data', message: 'Mangler periode-data' });
  }
  return allowDocumentDownload();
};

export const resolveShDageDocumentEligibility = (
  snapshot: AarsloenDocumentSnapshot
): DocumentDownloadGateResult => {
  const canonicalRangeIssue = resolveAarsloenCanonicalRangeIssues(snapshot.values, {
    omregningAktiveret: snapshot.omregningAktiveret,
  })[0];
  if (canonicalRangeIssue) {
    return blockDocumentDownload({ code: 'aarsloen:sh-canonical-range-error', message: canonicalRangeIssue.message });
  }
  if (snapshot.periodeData === null) {
    return blockDocumentDownload({ code: 'aarsloen:sh-missing-period-data', message: 'Mangler periode-data' });
  }
  if (snapshot.shDageAntal === null) {
    return blockDocumentDownload({ code: 'aarsloen:sh-no-count', message: 'Antal SH-dage er ikke beregnet' });
  }
  if (snapshot.shDageAntal === 0) {
    return blockDocumentDownload({ code: 'aarsloen:sh-zero', message: 'Ingen SH-dage i de indtastede perioder' });
  }
  return allowDocumentDownload();
};

export const useAarsloenDocumentGates = (props: UseAarsloenDocumentGatesProps): UseAarsloenDocumentGatesReturn => {
  const { tabelRef, ...renderSnapshot } = props;
  const [downloadShake, setDownloadShake] = React.useState(false);
  const [downloadErrorMessage, setDownloadErrorMessage] = React.useState<string | null>(null);
  const downloadShakeTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (downloadShakeTimeoutRef.current !== null) window.clearTimeout(downloadShakeTimeoutRef.current);
  }, []);

  const triggerDownloadShake = React.useCallback(() => {
    setDownloadShake(true);
    if (downloadShakeTimeoutRef.current !== null) window.clearTimeout(downloadShakeTimeoutRef.current);
    downloadShakeTimeoutRef.current = window.setTimeout(() => {
      setDownloadShake(false);
      downloadShakeTimeoutRef.current = null;
    }, 500);
  }, []);

  const documentEligibility = resolveAarsloenDocumentEligibility(renderSnapshot);
  const shDageEligibility = resolveShDageDocumentEligibility(renderSnapshot);

  const handleAarsloenDocumentDownload = React.useCallback(async (latest = renderSnapshot) => {
    const eligibility = resolveAarsloenDocumentEligibility(latest);
    if (!eligibility.canDownload) {
      setDownloadErrorMessage(null);
      triggerDownloadShake();
      const firstError = latest.tableErrors[0];
      if (firstError?.kind === 'cell') tabelRef.current?.flashError(firstError);
      return;
    }

    const { values } = latest;
    const result = await downloadAarsloenDokument({
      input: {
        satser: {
          feriePct: values.feriePct,
          fritvalgPct: values.fritvalgPct,
          shSoPct: values.shSoPct,
          storeBededagPct: values.storeBededagPct,
          pensionPct: values.pensionPct,
        },
        loenperiode: values.loenperiode,
        tillaegAngivesSom: values.tillaegAngivesSom,
        tableData: values.tableData,
        beregnetAarsloen: latest.beregnetAarsloen,
        omregningTilFuldtAar: latest.omregningAktiveret,
        periodeData: latest.periodeData,
        fuldLoenUnderFerie: values.fuldLoenUnderFerie,
        retTilSjetteFerieuge: values.retTilSjetteFerieuge,
        antalFeriedage: values.antalFeriedage,
        loenPaaHelligdage: values.loenPaaHelligdage,
        shDageAntal: latest.shDageAntal,
        beregningsData: latest.beregningsData,
      },
      settings: latest.settings,
      persistedStamdata: latest.persistedStamdata,
      isSourceCurrent: latest.isSourceCurrent,
    });
    setDownloadErrorMessage(result.success ? null : result.error);
  }, [renderSnapshot, tabelRef, triggerDownloadShake]);

  const handleSHDageDocumentDownload = React.useCallback(async (latest = renderSnapshot) => {
    if (!resolveShDageDocumentEligibility(latest).canDownload || latest.periodeData === null) return;
    const result = await downloadSHDageDokument({
      perioder: latest.periodeData.perioder ?? [],
      settings: latest.settings,
      persistedStamdata: latest.persistedStamdata,
      isSourceCurrent: latest.isSourceCurrent,
    });
    setDownloadErrorMessage(result.success ? null : result.error);
  }, [renderSnapshot]);

  return {
    canDownloadDocument: documentEligibility.canDownload,
    documentDisabledReason: documentEligibility.canDownload ? null : documentEligibility.reasons[0]?.message ?? null,
    canDownloadSHDageDocument: shDageEligibility.canDownload,
    shDageDisabledReason: shDageEligibility.canDownload ? null : shDageEligibility.reasons[0]?.message ?? null,
    handleAarsloenDocumentDownload,
    handleSHDageDocumentDownload,
    downloadShake,
    downloadErrorMessage,
  };
};
