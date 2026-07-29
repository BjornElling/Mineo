import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../domain/erhvervsevnetab/eetIssueNavigation';
import { useErhvervsevnetabViewModel } from './erhvervsevnetab/useErhvervsevnetabViewModel';
import EetOplysningerTab from './erhvervsevnetab/EetOplysningerTab';
import EetEfterEalTab from './erhvervsevnetab/EetEfterEalTab';
import EetLoebendeYdelserTab from './erhvervsevnetab/EetLoebendeYdelserTab';
import EetKapitaliseringTab from './erhvervsevnetab/EetKapitaliseringTab';
import EetDifferencekravTab from './erhvervsevnetab/EetDifferencekravTab';

// Siden er ren fane-komposition (`page-component-contract.md` §4.4): reader-projektionen, de fire
// dokumenthandles og faneorkestreringen bor i `useErhvervsevnetabViewModel`.

const TAB_KEYS = ERHVERVSEVNETAB_TAB_KEYS;

const Erhvervsevnetab = React.memo(() => {
  const vm = useErhvervsevnetabViewModel();

  return (
    <Box>
      <Typography className="page-title">Erhvervsevnetab</Typography>
      <PageTabs
        items={vm.tabItems}
        value={vm.activeTab}
        onChange={vm.setActiveTab}
        minTabWidth={130}
      />

      {vm.activeTab === TAB_KEYS.EET_OPLYSNINGER && <EetOplysningerTab projection={vm.projection} />}
      {vm.activeTab === TAB_KEYS.LOEBENDE_YDELSER && (
        <EetLoebendeYdelserTab
          onGoToEetOplysninger={vm.goToOplysninger}
          projection={vm.projection}
          download={vm.loebendeYdelserDownload}
        />
      )}
      {vm.activeTab === TAB_KEYS.KAPITALISERING && (
        <EetKapitaliseringTab
          onGoToEetOplysninger={vm.goToOplysninger}
          projection={vm.projection}
          download={vm.kapitaliseringDownload}
        />
      )}
      {vm.activeTab === TAB_KEYS.EET_EAL && (
        <EetEfterEalTab
          onGoToEetOplysninger={vm.goToOplysninger}
          projection={vm.projection}
          download={vm.efterEalDownload}
        />
      )}
      {vm.activeTab === TAB_KEYS.DIFFERENCEKRAV && (
        <EetDifferencekravTab
          onGoToEetOplysninger={vm.goToOplysninger}
          projection={vm.projection}
          download={vm.differencekravDownload}
        />
      )}
    </Box>
  );
});

Erhvervsevnetab.displayName = 'Erhvervsevnetab';

export default Erhvervsevnetab;
