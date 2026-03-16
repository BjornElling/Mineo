import * as React from 'react';
import type { GridCoreContextValue, GridCoreStateContextValue, GridCoreApiContextValue } from './gridCoreContext.shared';
import { GridCoreStateReactContext, GridCoreApiReactContext } from './gridCoreContext.shared';

export const useGridCoreState = (): GridCoreStateContextValue => {
  const ctx = React.useContext(GridCoreStateReactContext);
  if (!ctx) throw new Error('useGridCoreState: missing GridCoreProvider in component tree');
  return ctx;
};

export const useGridCoreApi = (): GridCoreApiContextValue => {
  const ctx = React.useContext(GridCoreApiReactContext);
  if (!ctx) throw new Error('useGridCoreApi: missing GridCoreProvider in component tree');
  return ctx;
};

/**
 * Kombineret hook der abonnerer på begge GridCore-contexts.
 * Brug kun denne hvis komponenten har brug for både state og API.
 * Ellers foretrækkes useGridCoreState() eller useGridCoreApi() direkte.
 *
 * ADVARSEL: Returnerer et nyt objekt-spread ved hvert render — er ikke referentielt stabil.
 * Må ikke bruges som basis for useMemo/useCallback-deps eller sendes som prop til
 * React.memo-wrappede komponenter. Brug useGridCoreState()/useGridCoreApi() separat i de tilfælde.
 */
export const useGridCore = (): GridCoreContextValue => {
  const state = useGridCoreState();
  const api = useGridCoreApi();
  return { ...state, ...api };
};
