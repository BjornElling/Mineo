import { usePersistedActiveTab } from '../../../hooks/usePersistedActiveTab';

/**
 * Varige méns ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Modellen er tynd, fordi sidens ansvar naturligt ER tynd: siden ejer ingen input-state – `MenberegningTab`
 * læser og skriver selv gennem inputCore – så det eneste page-niveau-ansvar er faneorkestreringen. Den er
 * **bevidst bevaret for ensartning** (§4.4's anti-refactor-back): svaret på "hvor bor en §2.1-sides afledte
 * state og handlers" skal være det samme for alle otte sider. Inlin den ikke.
 */

export const VARIGE_MEN_TAB_KEYS = {
  MENBEREGNING: 'menberegning',
  SATSER: 'satser',
} as const;

type VarigeMenTabKey = (typeof VARIGE_MEN_TAB_KEYS)[keyof typeof VARIGE_MEN_TAB_KEYS];

const VARIGE_MEN_TAB_ITEMS: readonly Readonly<{ key: VarigeMenTabKey; label: string }>[] = [
  { key: VARIGE_MEN_TAB_KEYS.MENBEREGNING, label: 'Ménberegning' },
  { key: VARIGE_MEN_TAB_KEYS.SATSER, label: 'Satser' },
];

export function useVarigeMenViewModel() {
  const { activeTab, setActiveTab } = usePersistedActiveTab<VarigeMenTabKey>({
    pageId: 'varigemen',
    allowedTabs: [VARIGE_MEN_TAB_KEYS.MENBEREGNING, VARIGE_MEN_TAB_KEYS.SATSER],
    defaultTab: VARIGE_MEN_TAB_KEYS.MENBEREGNING,
  });

  return { activeTab, setActiveTab, tabItems: VARIGE_MEN_TAB_ITEMS };
}
