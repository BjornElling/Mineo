import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { usePersistedActiveTab } from '../../../hooks/usePersistedActiveTab';
import { useAppSettings } from '../../../contexts/useAppSettings';
import {
  renteDocumentDefinition,
  renteOversigtDocumentDefinition,
} from '../../../domain/renteberegning/renteberegningDocumentDefinitions';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../../document/runtime/react/useMineoDocumentOutput';

/**
 * Renteberegnings ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Siden læser stamdata + kommentarer gennem den offentlige `InputReader`, og dokument-download går gennem de to
 * typede definitioner — modellen komponerer dem mod hovedappens miljø og leverer de færdige handles til den
 * delte fane, som også standalone MinProcesrente bruger.
 */

export const RENTEBEREGNING_TAB_KEYS = {
  RATES: 'rates',
  CALCULATION: 'calculation',
} as const;

type RenteberegningTabKey =
  (typeof RENTEBEREGNING_TAB_KEYS)[keyof typeof RENTEBEREGNING_TAB_KEYS];

const RENTEBEREGNING_TAB_ITEMS: readonly Readonly<{ key: RenteberegningTabKey; label: string }>[] = [
  { key: RENTEBEREGNING_TAB_KEYS.CALCULATION, label: 'Beregning' },
  { key: RENTEBEREGNING_TAB_KEYS.RATES, label: 'Rentesatser' },
];

/**
 * Rækkeknapperne spørger definitionen pr. række gennem `gateFor({ rowId })`; dette handles EGEN `canDownload`
 * bruges derfor ikke, og `gateRequest` er blot en gyldig, eksisterende form. Der er ikke en dummy-rækkeid i omløb.
 */
const RENTE_GATE_PROBE: Readonly<{ rowId: string }> = { rowId: '' };

export function useRenteberegningViewModel() {
  const { settings } = useAppSettings();

  // ÉN kildekontekst for begge outputs; de deler renteprojektionen gennem `context.shared`.
  const documentContext = useMineoDocumentSourceContext();
  const renteDownload = useMineoDocumentOutputWithContext(
    renteDocumentDefinition,
    RENTE_GATE_PROBE,
    documentContext
  );
  const renteOversigtDownload = useMineoDocumentOutputWithContext(
    renteOversigtDocumentDefinition,
    undefined,
    documentContext
  );

  const { activeTab, setActiveTab } = usePersistedActiveTab<RenteberegningTabKey>({
    pageId: 'renteberegning',
    allowedTabs: [RENTEBEREGNING_TAB_KEYS.RATES, RENTEBEREGNING_TAB_KEYS.CALCULATION],
    defaultTab: RENTEBEREGNING_TAB_KEYS.CALCULATION,
  });

  return {
    activeTab,
    setActiveTab,
    tabItems: RENTEBEREGNING_TAB_ITEMS,
    renteDownload,
    renteOversigtDownload,
    referenceRates,
    surchargeRates,
    documentDownloadFormat: settings.documentDownloadFormat,
  };
}
