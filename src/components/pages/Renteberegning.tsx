import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { referenceRates, surchargeRates } from '../../data/interestRates';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { useAppSettings } from '../../contexts/useAppSettings';
import ContentBox from '../layout/ContentBox';
import RenteberegningTab from './renteberegning/RenteberegningTab';
import RentesatserTab from './renteberegning/RentesatserTab';
import {
  renteDocumentDefinition,
  renteOversigtDocumentDefinition,
} from '../../domain/renteberegning/renteberegningDocumentDefinitions';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../document/runtime/react/useMineoDocumentOutput';

// Renteberegning (§2.4 trin 4): siden læser stamdata + kommentarer gennem den offentlige `InputReader`, og
// dokument-download går gennem de to typede definitioner — siden komponerer dem mod hovedappens miljø og videregiver de
// færdige handles til den delte fane, som også standalone MinProcesrente bruger.

type TabKey = 'rates' | 'calculation';

const TAB_KEYS = {
  RATES: 'rates',
  CALCULATION: 'calculation',
} as const;

/**
 * Rækkeknapperne spørger definitionen pr. række gennem `gateFor({ rowId })`; dette handles EGEN
 * `canDownload` bruges derfor ikke, og `gateRequest` er blot en gyldig, eksisterende form. Der er
 * ikke længere en dummy-rækkeid i omløb.
 */
const RENTE_GATE_PROBE: Readonly<{ rowId: string }> = { rowId: '' };

const Renteberegning = React.memo(() => {
  const { settings } = useAppSettings();

  // ÉN kildekontekst for begge outputs; de deler renteprojektionen gennem `context.shared`.
  const documentContext = useMineoDocumentSourceContext();
  const renteDownload = useMineoDocumentOutputWithContext(renteDocumentDefinition, RENTE_GATE_PROBE, documentContext);
  const renteOversigtDownload = useMineoDocumentOutputWithContext(renteOversigtDocumentDefinition, undefined, documentContext);

  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
    pageId: 'renteberegning',
    allowedTabs: [TAB_KEYS.RATES, TAB_KEYS.CALCULATION],
    defaultTab: TAB_KEYS.CALCULATION,
  });

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
          renteDownload={renteDownload}
          referenceRates={referenceRates}
          surchargeRates={surchargeRates}
          ContentBoxComponent={ContentBox}
          renteOversigtDownload={renteOversigtDownload}
          showOversigtBox
          documentDownloadFormat={settings.documentDownloadFormat}
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;
