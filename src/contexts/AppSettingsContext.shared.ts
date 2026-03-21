// .shared.ts: context-definition og types uden implementering.
// Adskilt fra .tsx for at tillade import fra test og domænelag uden React-komponent-afhængigheder.
import * as React from 'react';
import type { AppSettings } from '../settings/appSettingsSchema';

export type AppSettingsContextValue = Readonly<{
  settings: AppSettings;
  updateSettings: (patch: Readonly<Partial<AppSettings>>) => void;
}>;

export const AppSettingsContext = React.createContext<AppSettingsContextValue | null>(null);
