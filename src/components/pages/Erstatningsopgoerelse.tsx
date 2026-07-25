import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import SideTab from '../layout/SideTab';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { useMidlertidigtEetInsertSource } from '../../hooks/useMidlertidigtEetInsertSource';
import { useScrollToSectionWithRetry } from '../../hooks/useScrollToSectionWithRetry';
import { useAppSettings } from '../../contexts/useAppSettings';
import EOOplysningerTab from './erstatningsopgoerelse/EOOplysningerTab';
import LoenindkomstTab from './erstatningsopgoerelse/LoenindkomstTab';
import OffentligeYdelserTab from './erstatningsopgoerelse/OffentligeYdelserTab';
import EOberegningTab from './erstatningsopgoerelse/EOberegningTab';
import EOInspektion from './erstatningsopgoerelse/EOInspektion';
import EOKontrolTabel from './erstatningsopgoerelse/EOKontrolTabel';
import { useInputEvaluation } from '../../inputCore/react';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';
import { buildErstatningsopgoerelseReaderProjection } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { evaluateErstatningsopgoerelseDownloadGates } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseDownloadGate';
import { selectBlockingEoEntityIdsBySuffix } from '../../domain/erstatningsopgoerelse/eoInputIssues';

const TAB_KEYS = EO_TAB_KEYS;

type TabKey = typeof TAB_KEYS[keyof typeof TAB_KEYS];

/**
 * Erstatningsopgørelse-komponent til samlet opgørelse af erstatningskrav
 */
const Erstatningsopgoerelse = React.memo(() => {
  const { settings } = useAppSettings();
  const showInspektionTab = settings.showEOInspektionMenu;

  const allowedTabs = React.useMemo(() => {
    const tabs: TabKey[] = [
      TAB_KEYS.EO_OPLYSNINGER,
      TAB_KEYS.LOENINDKOMST,
      TAB_KEYS.OFFENTLIGE_YDELSER,
      TAB_KEYS.BEREGNING,
    ];
    if (showInspektionTab) tabs.push(TAB_KEYS.INSPEKTION, TAB_KEYS.KONTROLTABEL);
    return tabs;
  }, [showInspektionTab]);

  const defaultTab = TAB_KEYS.EO_OPLYSNINGER;
  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<TabKey>({
    pageId: 'erstatningsopgoerelse',
    allowedTabs,
    defaultTab,
  });
  const scrollToSectionWithRetry = useScrollToSectionWithRetry();
  const [visitedTabs, setVisitedTabs] = React.useState<Record<TabKey, boolean>>({
    [TAB_KEYS.EO_OPLYSNINGER]: true,
  } as Record<TabKey, boolean>);

  const mainTabValue =
    activeTab === TAB_KEYS.EO_OPLYSNINGER ||
    activeTab === TAB_KEYS.LOENINDKOMST ||
    activeTab === TAB_KEYS.OFFENTLIGE_YDELSER ||
    activeTab === TAB_KEYS.BEREGNING
      ? activeTab
      : false;

  const midlertidigtEetInsertSource = useMidlertidigtEetInsertSource();
  const evaluation = useInputEvaluation();
  const projection = React.useMemo(
    () => buildErstatningsopgoerelseReaderProjection(evaluation.reader, { midlertidigtEetInsertSource }),
    [evaluation, midlertidigtEetInsertSource]
  );
  const downloadGates = React.useMemo(
    () => evaluateErstatningsopgoerelseDownloadGates(projection, settings),
    [projection, settings]
  );
  const { eoValues, stamdataValues, snapshot: eoSnapshot } = projection;
  const manuelReguleringInputErrors = React.useMemo(
    () => selectBlockingEoEntityIdsBySuffix(projection.eoErrors, ':loenindkomst'),
    [projection.eoErrors]
  );

  const handleNavigateToTabtArbejdsfortjeneste = React.useCallback(() => {
    setActiveTab(TAB_KEYS.EO_OPLYSNINGER);
    scrollToSectionWithRetry('taf');
  }, [scrollToSectionWithRetry, setActiveTab]);

  React.useEffect(() => {
    // Hvis kontrolfanerne slås fra mens en af dem aktuelt er aktiv, falder vi deterministisk tilbage.
    if (!isAllowedTab(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, defaultTab, isAllowedTab, setActiveTab]);
  
  React.useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev[activeTab]) return prev;
      return { ...prev, [activeTab]: true };
    });
  }, [activeTab]);

  return (
    <Box>
      {/* Side-header */}
      <Typography className="page-title">Erstatningsopgørelse</Typography>

      {/* Fane-navigation */}
      <PageTabs
        items={[
          { key: TAB_KEYS.EO_OPLYSNINGER, label: 'EO oplysninger' },
          { key: TAB_KEYS.LOENINDKOMST, label: 'Lønindkomst' },
          { key: TAB_KEYS.OFFENTLIGE_YDELSER, label: 'Offentlige ydelser' },
          { key: TAB_KEYS.BEREGNING, label: 'Beregning' },
        ]}
        value={mainTabValue}
        onChange={setActiveTab}
      />

      {/* Fane-indhold med kontrolfaner i højre side */}
      <Box sx={{ position: 'relative' }}>
        {/* Kontrolfaner (roteret 90° til højre, placeret ved højrekanten af ContentBox) */}
        {showInspektionTab && (
          <>
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
          </>
        )}

        {/* Indhold */}
        {/*
         * VIGTIGT (trust-kritisk UX):
         * - EOOplysningerTab er altid mounted (bevarer draft-state + runtime field errors).
         * - Øvrige faner mountes ved første besøg og forbliver derefter mounted for at bevare state, mens en tung initial render undgås.
         */}
        <Box
          role="tabpanel"
          hidden={activeTab !== TAB_KEYS.EO_OPLYSNINGER}
          sx={{ display: activeTab === TAB_KEYS.EO_OPLYSNINGER ? 'block' : 'none' }}
        >
          <EOOplysningerTab values={eoValues} stamdataValues={stamdataValues} />
        </Box>
        {(visitedTabs[TAB_KEYS.LOENINDKOMST] || activeTab === TAB_KEYS.LOENINDKOMST) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.LOENINDKOMST}
            sx={{ display: activeTab === TAB_KEYS.LOENINDKOMST ? 'block' : 'none' }}
          >
            <LoenindkomstTab
              eoValues={eoValues}
              stamdataValues={stamdataValues}
              onNavigateToTabtArbejdsfortjeneste={handleNavigateToTabtArbejdsfortjeneste}
              sfggSixMonthWarningEmploymentIds={eoSnapshot.data?.sfggSixMonthWarningEmploymentIds ?? []}
            />
          </Box>
        )}
        {(visitedTabs[TAB_KEYS.OFFENTLIGE_YDELSER] || activeTab === TAB_KEYS.OFFENTLIGE_YDELSER) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.OFFENTLIGE_YDELSER}
            sx={{ display: activeTab === TAB_KEYS.OFFENTLIGE_YDELSER ? 'block' : 'none' }}
          >
            <OffentligeYdelserTab
              values={eoValues}
            />
          </Box>
        )}
        {(visitedTabs[TAB_KEYS.BEREGNING] || activeTab === TAB_KEYS.BEREGNING) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.BEREGNING}
            sx={{ display: activeTab === TAB_KEYS.BEREGNING ? 'block' : 'none' }}
          >
            <EOberegningTab
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isActive={activeTab === TAB_KEYS.BEREGNING}
              projection={projection}
              downloadGates={downloadGates}
            />
          </Box>
        )}
        {showInspektionTab && (visitedTabs[TAB_KEYS.INSPEKTION] || activeTab === TAB_KEYS.INSPEKTION) ? (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.INSPEKTION}
            sx={{ display: activeTab === TAB_KEYS.INSPEKTION ? 'block' : 'none' }}
          >
            <EOInspektion
              eoSnapshot={activeTab === TAB_KEYS.INSPEKTION ? eoSnapshot : null}
              manuelReguleringInputErrors={manuelReguleringInputErrors}
            />
          </Box>
        ) : null}
        {showInspektionTab && (visitedTabs[TAB_KEYS.KONTROLTABEL] || activeTab === TAB_KEYS.KONTROLTABEL) ? (
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
