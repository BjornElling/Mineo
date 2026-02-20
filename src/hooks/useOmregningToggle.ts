import React from 'react';
import type { AarsloenTableHandle, StyledToggleSwitchHandle } from '../types/handles';
import type { CommitEvent, CommitHandler } from '../components/inputs/fieldEvents';

// ============================================================================
// TYPES
// ============================================================================

type ToggleState = {
  enabled: boolean;
};

type ToggleAction =
  | { type: 'ENABLE' }
  | { type: 'DISABLE' };

// ============================================================================
// REDUCER
// ============================================================================

const toggleReducer = (state: ToggleState, action: ToggleAction): ToggleState => {
  switch (action.type) {
    case 'ENABLE':
      return state.enabled ? state : { enabled: true };
    case 'DISABLE':
      return !state.enabled ? state : { enabled: false };
    default:
      return state;
  }
};

// ============================================================================
// HOOK
// ============================================================================

interface UseOmregningToggleProps {
  initialEnabled: boolean;
  tabelHarFejl: boolean;
  hasValidPeriod: boolean;
  tabelRef: React.RefObject<AarsloenTableHandle | null>;
  toggleRef: React.RefObject<StyledToggleSwitchHandle | null>;
  onEnabledChange: (enabled: boolean) => void;
}

interface UseOmregningToggleReturn {
  enabled: boolean;
  handleToggle: CommitHandler<boolean>;
}

/**
 * Hook der håndterer omregning-toggle.
 *
 * Principper:
 * - Reducer er single source of truth
 * - initialEnabled bruges kun ved init
 * - Manuel enable blokeres tidligt ved ugyldige forhold (→ shake)
 * - Auto-disable-effects fungerer som sikkerhedsnet
 */
export const useOmregningToggle = ({
  initialEnabled,
  tabelHarFejl,
  hasValidPeriod,
  tabelRef,
  toggleRef,
  onEnabledChange,
}: UseOmregningToggleProps): UseOmregningToggleReturn => {
  // 🔒 initialEnabled bruges KUN ved init
  const [state, dispatch] = React.useReducer(
    toggleReducer,
    initialEnabled,
    (initial) => ({ enabled: initial })
  );

  /**
   * Håndter brugerens toggle-interaktion
   */
  const handleToggle = React.useCallback(
    (event: CommitEvent<boolean>) => {
      const newValue = event.target.value;

      // Blokér manuel enable hvis:
      // - tabellen har fejl
      // - perioden er ugyldig / tabellen er tom
      if (newValue && (tabelHarFejl || !hasValidPeriod)) {
        // Altid ryst toggle ved ugyldig aktivering
        toggleRef.current?.shake();

        // Hvis der er tabel-fejl, guid brugeren til den relevante celle
        if (tabelHarFejl) {
          const summary = tabelRef.current?.getValidationSummary();
          if (summary?.firstErrorCell) {
            if (summary.firstErrorCell.reason === 'missing') {
              tabelRef.current?.showMissingEntryError(summary.firstErrorCell);
            } else {
              tabelRef.current?.flashError({
                kind: 'cell',
                issue: 'invalid',
                rowId: summary.firstErrorCell.rowId,
                colKey: summary.firstErrorCell.colKey,
              });
            }
          }
        }

        // Ingen state-ændring
        return;
      }

      // Gyldig ændring → opdater reducer + persisted state
      dispatch({ type: newValue ? 'ENABLE' : 'DISABLE' });
      onEnabledChange(newValue);
    },
    [
      tabelHarFejl,
      hasValidPeriod, // vigtigt: undgå stale closure
      tabelRef,
      toggleRef,
      onEnabledChange,
    ]
  );

  // Automatisk deaktivering hvis tabel-fejl opstår mens toggle er tændt
  React.useEffect(() => {
    if (tabelHarFejl && state.enabled) {
      dispatch({ type: 'DISABLE' });
      onEnabledChange(false);
    }
  }, [tabelHarFejl, state.enabled, onEnabledChange]);

  // Automatisk deaktivering hvis perioden bliver ugyldig
  React.useEffect(() => {
    if (!hasValidPeriod && state.enabled) {
      dispatch({ type: 'DISABLE' });
      onEnabledChange(false);
    }
  }, [hasValidPeriod, state.enabled, onEnabledChange]);

  return {
    enabled: state.enabled,
    handleToggle,
  };
};
