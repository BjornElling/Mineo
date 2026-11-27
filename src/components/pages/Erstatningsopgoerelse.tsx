import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import EOOplysningerTab from './erstatningsopgoerelse/EOOplysningerTab';
import LoenindkomstTab from './erstatningsopgoerelse/LoenindkomstTab';
import OffentligeYdelserTab from './erstatningsopgoerelse/OffentligeYdelserTab';
import EOberegningTab from './erstatningsopgoerelse/EOberegningTab';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';
import { useErstatningsopgoerelseViewModel } from './erstatningsopgoerelse/useErstatningsopgoerelseViewModel';

const TAB_KEYS = EO_TAB_KEYS;

/**
 * Erstatningsopgørelse: samlet opgørelse af erstatningskrav.
 *
 * Siden er fane-komposition (`page-component-contract.md` §4.4): reader-projektionen, fanetilladelser, -besøg og
 * navigation bor i `useErstatningsopgoerelseViewModel`; hver fane har sin egen under-viewmodel.
 */
const Erstatningsopgoerelse = React.memo(() => {
  const vm = useErstatningsopgoerelseViewModel();
  const { activeTab, setActiveTab, eoSnapshot } = vm;

  return (
    <Box>
      {/* Side-header */}
      <Typography className="page-title">Erstatningsopgørelse</Typography>

      {/* Fane-navigation */}
      <PageTabs items={vm.tabItems} value={activeTab} onChange={setActiveTab} />

      <Box>
        {/* Indhold. Mount-reglen (altid-mountet EO-oplysninger, øvrige fra første besøg) ejes af `isTabMounted`. */}
        <Box
          role="tabpanel"
          hidden={activeTab !== TAB_KEYS.EO_OPLYSNINGER}
          sx={{ display: activeTab === TAB_KEYS.EO_OPLYSNINGER ? 'block' : 'none' }}
        >
          <EOOplysningerTab
            values={vm.eoValues}
            stamdataValues={vm.stamdataValues}
            eoErrors={vm.projection.eoErrors}
            loenudviklingIssues={vm.projection.loenudviklingIssues}
            tafCellIssues={vm.projection.tafCellIssues}
            svieSmerteCellIssues={vm.projection.svieSmerteCellIssues}
            tafEfterKapitaliseringAdvarsler={vm.projection.tafEfterKapitaliseringAdvarsler}
            isActive={activeTab === TAB_KEYS.EO_OPLYSNINGER}
            indkomstBeregningKanSkjules={vm.indkomstBeregningKanSkjules}
          />
        </Box>
        {vm.isTabMounted(TAB_KEYS.LOENINDKOMST) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.LOENINDKOMST}
            sx={{ display: activeTab === TAB_KEYS.LOENINDKOMST ? 'block' : 'none' }}
          >
            <LoenindkomstTab
              eoValues={vm.eoValues}
              stamdataValues={vm.stamdataValues}
              onNavigateToTabtArbejdsfortjeneste={vm.handleNavigateToTabtArbejdsfortjeneste}
              sfggSixMonthWarningEmploymentIds={eoSnapshot.data?.sfggSixMonthWarningEmploymentIds ?? []}
              loenudviklingIssues={vm.projection.loenudviklingIssues}
            />
          </Box>
        )}
        {vm.isTabMounted(TAB_KEYS.OFFENTLIGE_YDELSER) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.OFFENTLIGE_YDELSER}
            sx={{ display: activeTab === TAB_KEYS.OFFENTLIGE_YDELSER ? 'block' : 'none' }}
          >
            <OffentligeYdelserTab
              values={vm.eoValues}
              midlertidigtEetToggleWarning={vm.midlertidigtEetToggleWarning}
              midlertidigtEetSkiftGiverFradrag={vm.midlertidigtEetSkiftGiverFradrag}
            />
          </Box>
        )}
        {vm.isTabMounted(TAB_KEYS.BEREGNING) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.BEREGNING}
            sx={{ display: activeTab === TAB_KEYS.BEREGNING ? 'block' : 'none' }}
          >
            <EOberegningTab
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isActive={activeTab === TAB_KEYS.BEREGNING}
              projection={vm.projection}
              indkomstBeregningSkjult={vm.indkomstBeregningKanSkjules}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
});

Erstatningsopgoerelse.displayName = 'Erstatningsopgoerelse';

export default Erstatningsopgoerelse;
