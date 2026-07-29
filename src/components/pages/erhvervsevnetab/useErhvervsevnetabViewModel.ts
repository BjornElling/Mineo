import * as React from 'react';

import { usePersistedActiveTab } from '../../../hooks/usePersistedActiveTab';
import {
  ERHVERVSEVNETAB_TAB_KEYS,
  type ErhvervsevnetabTabKey,
} from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { buildErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import {
  differencekravDocumentDefinition,
  efterEalDocumentDefinition,
  kapitaliseringDocumentDefinition,
  loebendeYdelserDocumentDefinition,
} from '../../../domain/erhvervsevnetab/eetDocumentDefinitions';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../../document/runtime/react/useMineoDocumentOutput';
import { useInputEvaluation } from '../../../inputCore/react/useInputEvaluation';

/**
 * Erhvervsevnetabs ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Siden ejer ingen sektionsstate og ingen error-bus: ÉN tokenbundet reader-projektion driver alle fem faner,
 * deres resultater, rækkevisning og dokumentgates. Modellen orkestrerer — den genberegner ikke.
 */

const EET_TAB_ITEMS: readonly Readonly<{ key: ErhvervsevnetabTabKey; label: string }>[] = [
  { key: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER, label: 'EET oplysninger' },
  { key: ERHVERVSEVNETAB_TAB_KEYS.LOEBENDE_YDELSER, label: 'Løbende ydelser' },
  { key: ERHVERVSEVNETAB_TAB_KEYS.KAPITALISERING, label: 'Kapitalisering' },
  { key: ERHVERVSEVNETAB_TAB_KEYS.EET_EAL, label: 'EET efter EAL' },
  { key: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV, label: 'Differencekrav' },
];

const ALLOWED_TABS: readonly ErhvervsevnetabTabKey[] = EET_TAB_ITEMS.map((item) => item.key);

export function useErhvervsevnetabViewModel() {
  const evaluation = useInputEvaluation();
  const projection = React.useMemo(
    () => buildErhvervsevnetabReaderProjection(evaluation.reader),
    [evaluation]
  );

  // ÉN kildekontekst for alle fire dokumentoutputs. Definitionerne deler EET-projektionen og gate-sættet gennem
  // `context.shared`, så de fire knapper tilsammen kun betaler for én evaluering pr. revision — ikke fire.
  const documentContext = useMineoDocumentSourceContext();
  const loebendeYdelserDownload = useMineoDocumentOutputWithContext(loebendeYdelserDocumentDefinition, undefined, documentContext);
  const kapitaliseringDownload = useMineoDocumentOutputWithContext(kapitaliseringDocumentDefinition, undefined, documentContext);
  const efterEalDownload = useMineoDocumentOutputWithContext(efterEalDocumentDefinition, undefined, documentContext);
  const differencekravDownload = useMineoDocumentOutputWithContext(differencekravDocumentDefinition, undefined, documentContext);

  const { activeTab, setActiveTab } = usePersistedActiveTab<ErhvervsevnetabTabKey>({
    pageId: 'erhvervsevnetab',
    allowedTabs: ALLOWED_TABS,
    defaultTab: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
  });

  const goToOplysninger = React.useCallback(
    () => setActiveTab(ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER),
    [setActiveTab]
  );

  return {
    activeTab,
    setActiveTab,
    tabItems: EET_TAB_ITEMS,
    projection,
    goToOplysninger,
    loebendeYdelserDownload,
    kapitaliseringDownload,
    efterEalDownload,
    differencekravDownload,
  };
}
