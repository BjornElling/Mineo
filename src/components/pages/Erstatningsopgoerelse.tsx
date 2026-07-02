import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { useMidlertidigtEetInsertSource } from '../../hooks/useMidlertidigtEetInsertSource';
import { useScrollToSectionWithRetry } from '../../hooks/useScrollToSectionWithRetry';
import {
  getFieldErrorRevisionSnapshot,
  getFieldErrorsBySourceSnapshot,
  getPersistedSectionSnapshot,
  getSectionRevisionSnapshot,
  useFieldErrorRevisionSelector,
  usePersistedSectionSelector,
  useSectionRevisionSelector,
} from '../../hooks/useFormPersistenceSelectors';
import {
  erstatningsopgoerelseSchema,
  type ErstatningsopgoerelseValues,
} from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { useAppSettings } from '../../contexts/useAppSettings';
import EOOplysningerTab from './erstatningsopgoerelse/EOOplysningerTab';
import LoenindkomstTab from './erstatningsopgoerelse/LoenindkomstTab';
import OffentligeYdelserTab from './erstatningsopgoerelse/OffentligeYdelserTab';
import EOberegningTab from './erstatningsopgoerelse/EOberegningTab';
import EOInspektion from './erstatningsopgoerelse/EOInspektion';
import EOKontrolTabel from './erstatningsopgoerelse/EOKontrolTabel';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import type { StamdataValues } from '../../schemas/formSchemas';
import { computeEoSnapshot, type EoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';

const TAB_KEYS = {
  EO_OPLYSNINGER: 'eo_oplysninger',
  LOENINDKOMST: 'loenindkomst',
  OFFENTLIGE_YDELSER: 'offentlige_ydelser',
  BEREGNING: 'beregning',
  INSPEKTION: 'inspektion',
  KONTROLTABEL: 'kontroltabel',
} as const;

type TabKey = typeof TAB_KEYS[keyof typeof TAB_KEYS];

const EO_SNAPSHOT_VERSION = 'eo-snapshot-v1';

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

  // Initial values baseret på settings (bruges kun ved oprettelse af NY sag)
  const initialValues = React.useMemo(
    () => createErstatningsopgoerelseInitialValues(settings),
    [settings]
  );

  const form = usePersistedForm(
    erstatningsopgoerelseSchema,
    'erstatningsopgoerelse',
    initialValues
  );
  const setFormValues = form.setValues;

  const midlertidigtEetInsertSource = useMidlertidigtEetInsertSource();

  // Bevidst opdeling: useSectionRevisionSelector/useFieldErrorRevisionSelector (hooks) abonnerer på
  // store-ændringer og udløser re-renders når revisioner ændrer sig. buildInspektionRevision og buildInspektionSnapshot
  // bruger snapshot-funktioner (getState()-læsninger) i stedet for hooks — det giver konsistent state på
  // call-tidspunktet uden at skabe hook-afhængigheder. Slå dem ikke sammen til hook-læsninger: hooks inde i
  // en useCallback ville være ulovligt, og at læse hook-værdier via closure ville give forældede snapshots.
  //
  // EET- og faellesAarsloen-sektionerne inkluderes altid (uafhængigt af togglen
  // `midlertidigtEetFraEetSiden`), så snapshot-cachen invalideres deterministisk når
  // brugeren ændrer noget på EET-siden, uanset hvilken tilstand togglen er i. Den lille
  // ekstra rebuild ved EET-ændringer mens togglen er 'Nej' er bevidst valgt fremfor en
  // toggle-betinget revisions-sammensætning, som ville være vanskeligere at ræsonnere om.
  const buildInspektionRevision = React.useCallback((): string => {
    return [
      EO_SNAPSHOT_VERSION,
      getSectionRevisionSnapshot('stamdata'),
      getSectionRevisionSnapshot('erstatningsopgoerelse'),
      getSectionRevisionSnapshot('erhvervsevnetab'),
      getSectionRevisionSnapshot('faellesAarsloen'),
      getFieldErrorRevisionSnapshot('stamdata'),
      getFieldErrorRevisionSnapshot('erstatningsopgoerelse'),
    ].join('-');
  }, []);

  const buildInspektionSnapshot = React.useCallback((): EoSnapshot => {
    const persistedStamdata = getPersistedSectionSnapshot('stamdata');
    const persistedEO = getPersistedSectionSnapshot('erstatningsopgoerelse');

    const revision = buildInspektionRevision();

    return computeEoSnapshot({
      revision,
      stamdataValues: persistedStamdata ?? STAMDATA_INITIAL_VALUES,
      eoValues: persistedEO ?? initialValues,
      stamdataErrors: getFieldErrorsBySourceSnapshot('stamdata'),
      eoErrors: getFieldErrorsBySourceSnapshot('erstatningsopgoerelse'),
      midlertidigtEetInsertSource,
    });
  }, [buildInspektionRevision, initialValues, midlertidigtEetInsertSource]);

  const buildInspektionSnapshotRef = React.useRef(buildInspektionSnapshot);
  React.useEffect(() => {
    buildInspektionSnapshotRef.current = buildInspektionSnapshot;
  }, [buildInspektionSnapshot]);

  const persistedStamdata = usePersistedSectionSelector('stamdata');
  const stamdataValuesForBeregningTab = React.useMemo<StamdataValues>(() => {
    const nextPersistedStamdata = persistedStamdata;
    if (!nextPersistedStamdata) return STAMDATA_INITIAL_VALUES;
    return { ...STAMDATA_INITIAL_VALUES, ...nextPersistedStamdata };
  }, [persistedStamdata]);
  const [eoSnapshot, setEoSnapshot] = React.useState<EoSnapshot | null>(null);
  const stamdataRevision = useSectionRevisionSelector('stamdata');
  const eoRevision = useSectionRevisionSelector('erstatningsopgoerelse');
  const erhvervsevnetabRevision = useSectionRevisionSelector('erhvervsevnetab');
  const faellesAarsloenRevision = useSectionRevisionSelector('faellesAarsloen');
  const stamdataErrorRevision = useFieldErrorRevisionSelector('stamdata');
  const eoErrorRevision = useFieldErrorRevisionSelector('erstatningsopgoerelse');
  const currentInspektionRevision = React.useMemo(
    () => [
      EO_SNAPSHOT_VERSION,
      stamdataRevision,
      eoRevision,
      erhvervsevnetabRevision,
      faellesAarsloenRevision,
      stamdataErrorRevision,
      eoErrorRevision,
    ].join('-'),
    [eoErrorRevision, eoRevision, erhvervsevnetabRevision, faellesAarsloenRevision, stamdataErrorRevision, stamdataRevision]
  );
  const isSnapshotTabActive =
    activeTab === TAB_KEYS.BEREGNING || activeTab === TAB_KEYS.INSPEKTION || activeTab === TAB_KEYS.KONTROLTABEL;

  React.useEffect(() => {
    if (!isSnapshotTabActive) return;
    if (eoSnapshot?.revision === currentInspektionRevision) return;
    setEoSnapshot(buildInspektionSnapshotRef.current());
  }, [currentInspektionRevision, eoSnapshot?.revision, isSnapshotTabActive]);

  const handleOffentligeYdelserRowsChange = React.useCallback(
    (newData: NonNullable<ErstatningsopgoerelseValues['offentligeYdelserRows']>, origin?: { fieldPath?: string }) => {
      setFormValues((prev) => ({
        ...prev,
        offentligeYdelserRows: newData,
      }), origin);
    },
    [setFormValues]
  );

  const handleLoenindkomstAnsaettelsesforholdChange = React.useCallback(
    (
      updater: (prev: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold']) => ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'],
      origin?: { fieldPath?: string }
    ) => {
      setFormValues((prev) => ({
        ...prev,
        loenindkomstAnsaettelsesforhold: updater(prev.loenindkomstAnsaettelsesforhold),
      }), origin);
    },
    [setFormValues]
  );

  const handleTabChange = React.useCallback(
    (_event: React.SyntheticEvent, value: unknown) => {
      if (!isAllowedTab(value)) return;
      setActiveTab(value);
    },
    [isAllowedTab, setActiveTab]
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
      <Box
        sx={{
          position: 'relative',
          width: '1200px',
          height: 0,
          mb: '40px',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-48px',
            right: '20px',
            zIndex: 10,
          }}
        >
          <Tabs
            value={mainTabValue}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                minWidth: 140,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'var(--color-primary)',
                height: '2px',
              },
            }}
          >
            <Tab className="tab-item" label="EO oplysninger" value={TAB_KEYS.EO_OPLYSNINGER} />
            <Tab className="tab-item" label="Lønindkomst" value={TAB_KEYS.LOENINDKOMST} />
            <Tab className="tab-item" label="Offentlige ydelser" value={TAB_KEYS.OFFENTLIGE_YDELSER} />
            <Tab className="tab-item" label="Beregning" value={TAB_KEYS.BEREGNING} />
          </Tabs>
        </Box>
      </Box>

      {/* Fane-indhold med kontrolfaner i højre side */}
      <Box sx={{ position: 'relative' }}>
        {/* Kontrolfaner (roteret 90° til højre, placeret ved højrekanten af ContentBox) */}
        {showInspektionTab && (
          <>
            <Box
              onClick={() => setActiveTab(TAB_KEYS.INSPEKTION)}
              className={activeTab === TAB_KEYS.INSPEKTION ? 'tab-item side-tab active' : 'tab-item side-tab'}
              sx={{
                position: 'absolute',
                left: '1200px',
                top: '-25px',
                transform: 'rotate(90deg)',
                transformOrigin: 'left bottom',
                zIndex: 10,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 140,
                minHeight: 48,
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontFamily: 'Montserrat, sans-serif',
                lineHeight: 1.25,
                letterSpacing: '0.02857em',
              }}
            >
              EO-kontrol
            </Box>
            <Box
              onClick={() => setActiveTab(TAB_KEYS.KONTROLTABEL)}
              className={activeTab === TAB_KEYS.KONTROLTABEL ? 'tab-item side-tab active' : 'tab-item side-tab'}
              sx={{
                position: 'absolute',
                left: '1200px',
                top: '125px',
                transform: 'rotate(90deg)',
                transformOrigin: 'left bottom',
                zIndex: 10,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 140,
                minHeight: 48,
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontFamily: 'Montserrat, sans-serif',
                lineHeight: 1.25,
                letterSpacing: '0.02857em',
              }}
            >
              Kontroltabel
            </Box>
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
          <EOOplysningerTab form={form} />
        </Box>
        {(visitedTabs[TAB_KEYS.LOENINDKOMST] || activeTab === TAB_KEYS.LOENINDKOMST) && (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.LOENINDKOMST}
            sx={{ display: activeTab === TAB_KEYS.LOENINDKOMST ? 'block' : 'none' }}
          >
            <LoenindkomstTab
              loenindkomstAnsaettelsesforhold={form.values.loenindkomstAnsaettelsesforhold}
              beregnesUdFra={form.values.beregnesUdFra}
              tafBeregningsperiodeFra={form.values.tafBeregningsperiodeFra}
              tafBeregningsperiodeTil={form.values.tafBeregningsperiodeTil}
              ferieperioder={form.values.ferieperioder}
              fravaerPerioder={form.values.fravaerPerioder}
              eoValues={form.values}
              setEOValues={setFormValues}
              onAnsaettelsesforholdChange={handleLoenindkomstAnsaettelsesforholdChange}
              onNavigateToTabtArbejdsfortjeneste={handleNavigateToTabtArbejdsfortjeneste}
              sfggSixMonthWarningEmploymentIds={eoSnapshot?.data?.sfggSixMonthWarningEmploymentIds ?? []}
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
              rows={form.values.offentligeYdelserRows ?? []}
              onRowsChange={handleOffentligeYdelserRowsChange}
              kommentarer={form.values.offentligeYdelserKommentarer}
              midlertidigtEetFraEetSiden={form.values.midlertidigtEetFraEetSiden}
              setEOValues={setFormValues}
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
              eoSnapshot={eoSnapshot}
              stamdataValues={stamdataValuesForBeregningTab}
              eoValues={form.values}
              setEOValues={setFormValues}
            />
          </Box>
        )}
        {showInspektionTab && (visitedTabs[TAB_KEYS.INSPEKTION] || activeTab === TAB_KEYS.INSPEKTION) ? (
          <Box
            role="tabpanel"
            hidden={activeTab !== TAB_KEYS.INSPEKTION}
            sx={{ display: activeTab === TAB_KEYS.INSPEKTION ? 'block' : 'none' }}
          >
            <EOInspektion eoSnapshot={activeTab === TAB_KEYS.INSPEKTION ? eoSnapshot : null} />
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
              inspektionSnapshot={activeTab === TAB_KEYS.KONTROLTABEL ? eoSnapshot?.inspektionSnapshot ?? null : null}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});

Erstatningsopgoerelse.displayName = 'Erstatningsopgoerelse';

export default Erstatningsopgoerelse;
