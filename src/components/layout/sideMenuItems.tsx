import type { ReactElement } from 'react';
import {
  EventRepeat,
  AssistWalker,
  Payments,
  ListAlt,
  TrendingUp,
  PersonalInjury,
  Flare,
  Person,
  Settings,
  Info,
} from '@mui/icons-material';
import type { MenuPageKey } from '../../config/pageNavigation';

/** Menuinventaret er separat, så `SideMenu` kun eksporterer sin React-komponent til Fast Refresh. */
export type SideMenuItem = {
  id: MenuPageKey;
  label: string;
  icon: ReactElement;
};

// Defineret uden for komponenten, så den levende navigationsliste ikke genskabes ved render.
export const navigationItems: readonly SideMenuItem[] = [
  { id: 'stamdata', label: 'Stamdata', icon: <Person /> },
  { id: 'erstatningsopgoerelse', label: 'Erstatningsopgørelse', icon: <Payments /> },
  { id: 'erhvervsevnetab', label: 'Erhvervsevnetab', icon: <AssistWalker /> },
  { id: 'varigemen', label: 'Varige mén', icon: <PersonalInjury /> },
  { id: 'forsoergertab', label: 'Forsørgertab', icon: <Flare /> },
  { id: 'aarsloen', label: 'Årslønsberegning', icon: <EventRepeat /> },
  { id: 'renteberegning', label: 'Renteberegning', icon: <TrendingUp /> },
  { id: 'satser', label: 'Satser', icon: <ListAlt /> },
];

export const utilityItems: readonly SideMenuItem[] = [
  { id: 'indstillinger', label: 'Indstillinger', icon: <Settings /> },
  // Bevidst UX-valg: siden er internt navngivet `mineo`, men labelen i sidemenuen forbliver `Om`.
  { id: 'mineo', label: 'Om', icon: <Info /> },
];
