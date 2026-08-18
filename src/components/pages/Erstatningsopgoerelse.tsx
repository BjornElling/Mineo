import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import SideTab from '../layout/SideTab';
import SideTabRail from '../layout/SideTabRail';
import EOOplysningerTab from './erstatningsopgoerelse/EOOplysningerTab';
import LoenindkomstTab from './erstatningsopgoerelse/LoenindkomstTab';
import OffentligeYdelserTab from './erstatningsopgoerelse/OffentligeYdelserTab';
import EOberegningTab from './erstatningsopgoerelse/EOberegningTab';
import EOInspektion from './erstatningsopgoerelse/EOInspektion';
import EOKontrolTabel from './erstatningsopgoerelse/EOKontrolTabel';
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
      <PageTabs items={vm.tabItems} value={vm.mainTabValue} onChange={setActiveTab} />

      {/* Fane-indhold med kontrolfaner i højre side */}
      <Box sx={{ position: 'relative' }}>
        {/* Kontrolfaner (roteret 90°, placeret UDEN FOR ContentBox' højrekant). Skinnen klipper
            udhænget ved arbejdsfladens synlige højrekant, så de to faner hverken indgår i
            skaleringens pladsregnskab eller kan give vandret rul. */}
        {vm.showInspektionTab && (
          <SideTabRail>
            <SideTab
              label="EO-kontrol"
              active={activeTab === TAB_KEYS.INSPEKTION}
              onClick={() => setActiveTab(TAB_KEYS.INSPEKTION)}
              top="-25px"
            />
            <SideTab
              label="Kontroltabel"
              active={activeTab === TAB_KEYS.KONTROLTABEL}
              onClick={() => setActiveTab(TAB_KEYS.KONTROLTABEL)}
              top="125px"
            />
          </SideTabRail>
        )}

        {/* Indhold. Mount-reglen (altid-mountet EO-oplysninger, øvrige fra første besøg) ejes af `isTabMounted`. */}
        <Box
          role="tabpanel"
          hidden={activeTab !== TAB_KEYS.EO_OPLYSNINGER}
          sx={{ display: activeTab === TAB_KEYS.EO_OPLYSNINGER ? 'block' : 'none' }}
        >
          <EOOplysningerTab
            values={vm.eoValues}
            stamdataValues={vm.stamdataValues}
            manualRegulationDateIssues={vm.projection.manualRegulationDateIssues}
            tafCutoffDateIssues={vm.projection.tafCutoffDateIssues}
            svieSmerteCutoffDateIssues={vm.projection.svieSmerteCutoffDateIssues}
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
              manualRegulationDateIssues={vm.projection.manualRegulationDateIssues}
            />
          </Box>
        )}
        {vm.isTabMounted(TAB_KEYS.OFFENTLIGE_YDELSER) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.OFFENTLIGE_YDELSER}
            sx={{ display: activeTab === TAB_KEYS.OFFENTLIGE_YDELSER ? 'block' : 'none' }}
          >
            <OffentligeYdelserTab values={vm.eoValues} />
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
            />
          </Box>
        )}
        {vm.showInspektionTab && vm.isTabMounted(TAB_KEYS.INSPEKTION) ? (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.INSPEKTION}
            sx={{ display: activeTab === TAB_KEYS.INSPEKTION ? 'block' : 'none' }}
          >
            <EOInspektion
              eoSnapshot={activeTab === TAB_KEYS.INSPEKTION ? eoSnapshot : null}
              manuelReguleringInputErrors={vm.manuelReguleringInputErrors}
            />
          </Box>
        ) : null}
        {vm.showInspektionTab && vm.isTabMounted(TAB_KEYS.KONTROLTABEL) ? (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.KONTROLTABEL}
            sx={{ display: activeTab === TAB_KEYS.KONTROLTABEL ? 'block' : 'none' }}
          >
            <EOKontrolTabel
              isActive={activeTab === TAB_KEYS.KONTROLTABEL}
              inspektionSnapshot={activeTab === TAB_KEYS.KONTROLTABEL ? eoSnapshot.inspektionSnapshot ?? null : null}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});

Erstatningsopgoerelse.displayName = 'Erstatningsopgoerelse';

export default Erstatningsopgoerelse;
