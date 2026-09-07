import * as React from 'react';
import { resolveAutofillSuggestion } from '../autofill/autofillSuggestEngine';
import type { AutofillSuggestModel, AutofillSuggestion } from '../autofill/autofillSuggestModel';

// Autofill-suggest, lag 5 (React-grænsen). Contexten er tabellens ENESTE kanal til cellerne, og den er
// bevidst OPT-IN: en tabel uden provider har ingen autofill, og cellefamilierne behøver ikke et flag pr.
// kolonne. Det er derfor funktionen er fuldt kodet, men kun aktiv i de tabeller, der monterer provideren.
//
// Contexten bærer en OPSLAGSFUNKTION og ikke et færdigt kort over alle celler. Grunden er, at kun den
// fokuserede celle kan have en synlig ghost – at forudberegne forslag for hver tom celle i tabellen ville
// være arbejde, ingen ser.

type AutofillSuggestContextValue = Readonly<{
  resolve: (rowId: string, colIndex: number) => AutofillSuggestion | null;
}>;

const AutofillSuggestContext = React.createContext<AutofillSuggestContextValue | null>(null);

export type AutofillSuggestProviderProps = Readonly<{
  model: AutofillSuggestModel;
  children: React.ReactNode;
}>;

export const AutofillSuggestProvider = ({ model, children }: AutofillSuggestProviderProps): React.ReactElement => {
  const value = React.useMemo<AutofillSuggestContextValue>(
    () => ({ resolve: (rowId, colIndex) => resolveAutofillSuggestion(model, rowId, colIndex) }),
    [model]
  );
  return <AutofillSuggestContext.Provider value={value}>{children}</AutofillSuggestContext.Provider>;
};

/**
 * Forslaget for én celle, eller `null`.
 *
 * `enabled` er kalderens synlighedsbetingelse (fokuseret celle med tom draft). Den sendes ind frem for at
 * blive vurderet her, fordi cellens surface ejer både fokus- og drafttilstanden – og fordi et `false`
 * sparer opslaget helt for de celler, der aldrig kan vise en ghost.
 */
export const useAutofillSuggestion = (
  rowId: string,
  colIndex: number,
  enabled: boolean
): AutofillSuggestion | null => {
  const context = React.useContext(AutofillSuggestContext);
  if (context === null || !enabled) return null;
  return context.resolve(rowId, colIndex);
};
