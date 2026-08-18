// .shared.ts: context-definition og types uden implementering.
// Adskilt fra .tsx for at tillade import fra test og domænelag uden React-komponent-afhængigheder.
import * as React from 'react';
import type { AppSettings, ResolvedThemeMode } from '../settings/appSettingsSchema';

export type AppSettingsContextValue = Readonly<{
  settings: AppSettings;
  updateSettings: (patch: Readonly<Partial<AppSettings>>) => boolean;
  /**
   * Det tema, der faktisk males — `settings.themeMode` oversat gennem computerens præference.
   * Forbrugere, der skal TEGNE noget, skal læse denne og aldrig `settings.themeMode`, som kan
   * være `'system'`. Se `resolveThemeMode` i `appSettingsSchema.ts`.
   */
  resolvedThemeMode: ResolvedThemeMode;
}>;

export const AppSettingsContext = React.createContext<AppSettingsContextValue | null>(null);
