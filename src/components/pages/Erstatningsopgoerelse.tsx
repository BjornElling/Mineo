import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import SideTab from '../layout/SideTab';
import { usePersistedForm, type CommitOriginOptions } from '../../hooks/usePersistedForm';
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
import { buildTafRanges } from '../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildMidlertidigtEetImportContext } from '../../domain/erstatningsopgoerelse/helpers/midlertidigtEetTransientInjection';

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
    const stamdata = persistedStamdata ?? STAMDATA_INITIAL_VALUES;
    const eoValues = persistedEO ?? initialValues;

    const revision = buildInspektionRevision();
    const midlertidigtEetImportContext = eoValues.midlertidigtEetFraEetSiden === 'Ja'
      ? buildMidlertidigtEetImportContext(
        midlertidigtEetInsertSource,
        buildTafRanges(eoValues, {
          skadedatoISO: stamdata.skadedato,
        })
      )
      : undefined;

    return computeEoSnapshot({
      revision,
      stamdataValues: stamdata,
      eoValues,
      stamdataErrors: getFieldErrorsBySourceSnapshot('stamdata'),
      eoErrors: getFieldErrorsBySourceSnapshot('erstatningsopgoerelse'),
      midlertidigtEetImportContext,
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
      return setFormValues((prev) => ({
        ...prev,
        offentligeYdelserRows: newData,
      }), origin);
    },
    [setFormValues]
  );

  const handleLoenindkomstAnsaettelsesforholdChange = React.useCallback(
    (
      updater: (prev: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold']) => ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'],
      origin?: CommitOriginOptions
    ) => {
      return setFormValues((prev) => ({
        ...prev,
        loenindkomstAnsaettelsesforhold: updater(prev.loenindkomstAnsaettelsesforhold),
      }), origin);
    },
    [setFormValues]
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
