import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import {
  ERHVERVSEVNETAB_TAB_KEYS,
  type ErhvervsevnetabTabKey,
} from '../../domain/erhvervsevnetab/eetIssueNavigation';
import { buildErhvervsevnetabReaderProjection } from '../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import {
  differencekravDocumentDefinition,
  efterEalDocumentDefinition,
  kapitaliseringDocumentDefinition,
  loebendeYdelserDocumentDefinition,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../document/runtime/react/useMineoDocumentOutput';
import { useInputEvaluation } from '../../inputCore/react/useInputEvaluation';
import EetOplysningerTab from './erhvervsevnetab/EetOplysningerTab';
import EetEfterEalTab from './erhvervsevnetab/EetEfterEalTab';
import EetLoebendeYdelserTab from './erhvervsevnetab/EetLoebendeYdelserTab';
import EetKapitaliseringTab from './erhvervsevnetab/EetKapitaliseringTab';
import EetDifferencekravTab from './erhvervsevnetab/EetDifferencekravTab';

// Greenfield-migreret Erhvervsevnetab (§2.4 trin 7). Siden ejer ingen sektionsstate eller error-bus:
// én tokenbundet reader-projektion driver alle fem faner, deres resultater, rækkevisning og dokumentgates.

const TAB_KEYS = ERHVERVSEVNETAB_TAB_KEYS;
type TabKey = ErhvervsevnetabTabKey;

const Erhvervsevnetab = React.memo(() => {
  const evaluation = useInputEvaluation();
  const projection = React.useMemo(
    () => buildErhvervsevnetabReaderProjection(evaluation.reader),
    [evaluation]
  );
  // ÉN kildekontekst for alle fire dokumentoutputs. Definitionerne deler EET-projektionen og
  // gate-sættet gennem `context.shared`, så de fire knapper tilsammen kun betaler for én evaluering
  // pr. revision — ikke fire.
  const documentContext = useMineoDocumentSourceContext();
  const loebendeYdelserDownload = useMineoDocumentOutputWithContext(loebendeYdelserDocumentDefinition, undefined, documentContext);
  const kapitaliseringDownload = useMineoDocumentOutputWithContext(kapitaliseringDocumentDefinition, undefined, documentContext);
  const efterEalDownload = useMineoDocumentOutputWithContext(efterEalDocumentDefinition, undefined, documentContext);
  const differencekravDownload = useMineoDocumentOutputWithContext(differencekravDocumentDefinition, undefined, documentContext);
  const { activeTab, setActiveTab } = usePersistedActiveTab<TabKey>({
    pageId: 'erhvervsevnetab',
    allowedTabs: [
      TAB_KEYS.EET_OPLYSNINGER,
      TAB_KEYS.LOEBENDE_YDELSER,
      TAB_KEYS.KAPITALISERING,
      TAB_KEYS.EET_EAL,
      TAB_KEYS.DIFFERENCEKRAV,
    ],
    defaultTab: TAB_KEYS.EET_OPLYSNINGER,
  });
  const goToOplysninger = React.useCallback(() => setActiveTab(TAB_KEYS.EET_OPLYSNINGER), [setActiveTab]);

  return (
    <Box>
      <Typography className="page-title">Erhvervsevnetab</Typography>
      <PageTabs
        items={[
          { key: TAB_KEYS.EET_OPLYSNINGER, label: 'EET oplysninger' },
          { key: TAB_KEYS.LOEBENDE_YDELSER, label: 'Løbende ydelser' },
          { key: TAB_KEYS.KAPITALISERING, label: 'Kapitalisering' },
          { key: TAB_KEYS.EET_EAL, label: 'EET efter EAL' },
          { key: TAB_KEYS.DIFFERENCEKRAV, label: 'Differencekrav' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        minTabWidth={130}
      />

      {activeTab === TAB_KEYS.EET_OPLYSNINGER && <EetOplysningerTab projection={projection} />}
      {activeTab === TAB_KEYS.LOEBENDE_YDELSER && (
        <EetLoebendeYdelserTab
          onGoToEetOplysninger={goToOplysninger}
          projection={projection}
          download={loebendeYdelserDownload}
        />
      )}
      {activeTab === TAB_KEYS.KAPITALISERING && (
        <EetKapitaliseringTab
          onGoToEetOplysninger={goToOplysninger}
          projection={projection}
          download={kapitaliseringDownload}
        />
      )}
      {activeTab === TAB_KEYS.EET_EAL && (
        <EetEfterEalTab
          onGoToEetOplysninger={goToOplysninger}
          projection={projection}
          download={efterEalDownload}
        />
      )}
      {activeTab === TAB_KEYS.DIFFERENCEKRAV && (
        <EetDifferencekravTab
          onGoToEetOplysninger={goToOplysninger}
          projection={projection}
          download={differencekravDownload}
        />
      )}
    </Box>
  );
});

Erhvervsevnetab.displayName = 'Erhvervsevnetab';

export default Erhvervsevnetab;
