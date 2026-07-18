import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { referenceRates, surchargeRates } from '../../data/interestRates';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import type { RentePdfContext } from '../tables/BeregnetRenteTable';
import { useAppSettings } from '../../contexts/useAppSettings';
import { downloadRenteDokument, downloadRenteOversigtDokument } from '../../document/service/documentService';
import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';
import ContentBox from '../layout/ContentBox';
import RenteberegningTab, { type RenteDocumentSharedSnapshot } from './renteberegning/RenteberegningTab';
import RentesatserTab from './renteberegning/RentesatserTab';
import { getDocumentFormatLabel } from '../../document/documentFormat';
import { projectStamdataForDocument } from '../../domain/stamdata/stamdataDocumentProjection';
import { useInputEvaluation } from '../../inputCore/react';

// Greenfield-migreret (§2.4 trin 4 / Fase 3 Renteberegning-slice). Siden læser stamdata + kommentarer gennem den
// offentlige `InputReader`; download-handlerne henter et FRISK kildesnapshot, så en netop indtastet kommentar/stamdata
// er med i dokumentet (§3.9). Ingen `usePersistedForm`-legacy-sink.

type TabKey = 'rates' | 'calculation';

const TAB_KEYS = {
  RATES: 'rates',
  CALCULATION: 'calculation',
} as const;

const Renteberegning = React.memo(() => {
  const { settings } = useAppSettings();
  const evaluation = useInputEvaluation();
  const stamdataProjection = React.useMemo(
    () => projectStamdataForDocument(evaluation.reader, 'document.rente'),
    [evaluation]
  );
  const documentFormatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
    pageId: 'renteberegning',
    allowedTabs: [TAB_KEYS.RATES, TAB_KEYS.CALCULATION],
    defaultTab: TAB_KEYS.CALCULATION,
  });

  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);
  const [oversigtErrorMessage, setOversigtErrorMessage] = React.useState<string | null>(null);

  const handleDownloadRentePdf = React.useCallback(
    async (pdfContext: RentePdfContext, shared: RenteDocumentSharedSnapshot) => {
      const actualInterestDateDanish = isoToDanish(pdfContext.actualInterestDate);
      const beregningsdatoDanish = isoToDanish(pdfContext.beregningsdato);
      if (!actualInterestDateDanish || !beregningsdatoDanish) {
        setPdfErrorMessage(`Kunne ikke generere rente som ${documentFormatLabel}.`);
        return;
      }
      if (shared.stamdataProjection?.status !== 'ready') return;
      const result = await downloadRenteDokument({
        beloeb: pdfContext.beloeb,
        actualInterestDate: actualInterestDateDanish,
        beregningsdato: beregningsdatoDanish,
        periods: pdfContext.periods,
        latestReferenceRateDate: isoToDanish(pdfContext.latestReferenceRateDate ?? undefined) ?? null,
        isSourceCurrent: shared.isSourceCurrent,
        kommentarer: shared.kommentarer,
        settings,
        persistedStamdata: shared.stamdataProjection.value,
      });
      setPdfErrorMessage(result.success ? null : result.error);
    },
    [documentFormatLabel, settings]
  );

  const handleDownloadOversigt = React.useCallback(
    async (
      rows: readonly RenteOversigtRow[],
      beregningsdato: ISODateString,
      latestReferenceRateDate: ISODateString | null,
      shared: RenteDocumentSharedSnapshot,
    ) => {
      if (shared.stamdataProjection?.status !== 'ready') return;
      const result = await downloadRenteOversigtDokument({
        beregningsdato,
        rows,
        latestReferenceRateDate,
        isSourceCurrent: shared.isSourceCurrent,
        kommentarer: shared.kommentarer,
        settings,
        persistedStamdata: shared.stamdataProjection.value,
      });
      setOversigtErrorMessage(result.success ? null : result.error);
    },
    [settings]
  );

  return (
    <Box>
      <Typography className="page-title">Renteberegning</Typography>

      <PageTabs
        items={[
          { key: TAB_KEYS.CALCULATION, label: 'Beregning' },
          { key: TAB_KEYS.RATES, label: 'Rentesatser' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === TAB_KEYS.RATES ? (
        <RentesatserTab />
      ) : (
        <RenteberegningTab
          onDownloadSpecifikation={handleDownloadRentePdf}
          pdfErrorMessage={pdfErrorMessage}
          referenceRates={referenceRates}
          surchargeRates={surchargeRates}
          ContentBoxComponent={ContentBox}
          onDownloadOversigt={handleDownloadOversigt}
          oversigtErrorMessage={oversigtErrorMessage}
          showOversigtBox
          documentDownloadFormat={settings.documentDownloadFormat}
          stamdataProjection={stamdataProjection}
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;
