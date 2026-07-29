import * as React from 'react';

import { usePersistedActiveTab } from '../../../hooks/usePersistedActiveTab';
import { useMidlertidigtEetInsertSource } from '../../../hooks/useMidlertidigtEetInsertSource';
import { useScrollToSectionWithRetry } from '../../../hooks/useScrollToSectionWithRetry';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { useInputEvaluation } from '../../../inputCore/react';
import { EO_TAB_KEYS, type EoTabKey } from '../../../config/eoTabKeys';
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { selectBlockingLoenindkomstEntityIds } from '../../../domain/erstatningsopgoerelse/eoInputIssues';

/**
 * Erstatningsopgørelses ene kanoniske viewmodel på PAGE-niveau (`page-component-contract.md` §4.4).
 *
 * Enheden er per side: de eksisterende tab-niveau-under-viewmodels (`useEoOplysningerViewModel`,
 * `useLoenindkomstViewModel`, `useEoBeregningViewModel`) er feature-slicede subviews og bevares uændret. Denne
 * model ejer det, der hører til SIDEN: den ene tokenbundne reader-projektion, fanetilladelser og -besøg, og
 * navigationen mellem faner. Beregningskernen (`computeEoSnapshot`) er urørt — modellen orkestrerer, den
 * genberegner ikke.
 */

// `EoTabKey` importeres fra `config/eoTabKeys` — den kanoniske kilde. En lokal genudledning af samme udtryk
// ville være to offentlige navne for ét begreb, altså præcis den parallelle model dette review lukker.

const EO_MAIN_TAB_ITEMS: readonly Readonly<{ key: EoTabKey; label: string }>[] = [
  { key: EO_TAB_KEYS.EO_OPLYSNINGER, label: 'EO oplysninger' },
  { key: EO_TAB_KEYS.LOENINDKOMST, label: 'Lønindkomst' },
  { key: EO_TAB_KEYS.OFFENTLIGE_YDELSER, label: 'Offentlige ydelser' },
  { key: EO_TAB_KEYS.BEREGNING, label: 'Beregning' },
];

const MAIN_TAB_KEYS: readonly EoTabKey[] = EO_MAIN_TAB_ITEMS.map((item) => item.key);

const DEFAULT_TAB: EoTabKey = EO_TAB_KEYS.EO_OPLYSNINGER;

export function useErstatningsopgoerelseViewModel() {
  const { settings } = useAppSettings();
  const showInspektionTab = settings.showEOInspektionMenu;

  const allowedTabs = React.useMemo(() => {
    const tabs: EoTabKey[] = [...MAIN_TAB_KEYS];
    if (showInspektionTab) tabs.push(EO_TAB_KEYS.INSPEKTION, EO_TAB_KEYS.KONTROLTABEL);
    return tabs;
  }, [showInspektionTab]);

  const { activeTab, setActiveTab, isAllowedTab } = usePersistedActiveTab<EoTabKey>({
    pageId: 'erstatningsopgoerelse',
    allowedTabs,
    defaultTab: DEFAULT_TAB,
  });

  const scrollToSectionWithRetry = useScrollToSectionWithRetry();
  const [visitedTabs, setVisitedTabs] = React.useState<Record<EoTabKey, boolean>>(
    { [EO_TAB_KEYS.EO_OPLYSNINGER]: true } as Record<EoTabKey, boolean>
  );

  /** `false` når en kontrolfane er aktiv: hovedfane-striben har da intet valgt element. */
  const mainTabValue: EoTabKey | false = MAIN_TAB_KEYS.includes(activeTab) ? activeTab : false;

  const midlertidigtEetInsertSource = useMidlertidigtEetInsertSource();
  const evaluation = useInputEvaluation();
  const projection = React.useMemo(
    () => buildErstatningsopgoerelseReaderProjection(evaluation.reader, { midlertidigtEetInsertSource }),
    [evaluation, midlertidigtEetInsertSource]
  );

  const manuelReguleringInputErrors = React.useMemo(
    () => selectBlockingLoenindkomstEntityIds(projection.eoErrors),
    [projection.eoErrors]
  );

  const handleNavigateToTabtArbejdsfortjeneste = React.useCallback(() => {
    setActiveTab(EO_TAB_KEYS.EO_OPLYSNINGER);
    scrollToSectionWithRetry('taf');
  }, [scrollToSectionWithRetry, setActiveTab]);

  React.useEffect(() => {
    // Hvis kontrolfanerne slås fra mens en af dem aktuelt er aktiv, falder vi deterministisk tilbage.
    if (!isAllowedTab(activeTab)) {
      setActiveTab(DEFAULT_TAB);
    }
  }, [activeTab, isAllowedTab, setActiveTab]);

  React.useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev[activeTab]) return prev;
      return { ...prev, [activeTab]: true };
    });
  }, [activeTab]);

  /**
   * Er fanen mountet? EO's faner mountes ved FØRSTE besøg og forbliver mountet (skjult med `display: none`), så
   * draft-state og runtime-feltfejl bevares, mens en tung initial render undgås. EO-oplysninger er altid mountet.
   */
  const isTabMounted = React.useCallback(
    (tab: EoTabKey): boolean => visitedTabs[tab] === true || activeTab === tab,
    [activeTab, visitedTabs]
  );

  return {
    activeTab,
    setActiveTab,
    mainTabValue,
    tabItems: EO_MAIN_TAB_ITEMS,
    showInspektionTab,
    isTabMounted,
    projection,
    eoValues: projection.eoValues,
    stamdataValues: projection.stamdataValues,
    eoSnapshot: projection.snapshot,
    manuelReguleringInputErrors,
    handleNavigateToTabtArbejdsfortjeneste,
  };
}
