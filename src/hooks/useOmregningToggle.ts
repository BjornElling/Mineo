/**
 * Custom hook for omregning toggle state management
 *
 * Ansvar:
 * - Håndterer toggle state via reducer (single source of truth)
 * - Synkroniserer med persisted state
 * - Håndterer validering før toggle-aktivering
 * - Shake animation for fejl-feedback
 *
 * VIGTIGT: Denne hook eliminerer dobbelt state-tracking.
 * Reducer er SSoT, persisted state opdateres kun når reducer ændres.
 */

import React from 'react';
import type { AarsloenTableHandle, StyledToggleSwitchHandle } from '../types/common';
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

/**
 * Reducer for toggle state (simpel - ingen auto-enable/disable længere)
 */
const toggleReducer = (state: ToggleState, action: ToggleAction): ToggleState => {
  switch (action.type) {
    case 'ENABLE':
      return { enabled: true };
    case 'DISABLE':
      return { enabled: false };
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
  tabelRef: React.RefObject<AarsloenTableHandle | null>;
  toggleRef: React.RefObject<StyledToggleSwitchHandle | null>;
  onEnabledChange: (enabled: boolean) => void;
}

interface UseOmregningToggleReturn {
  enabled: boolean;
  handleToggle: CommitHandler<boolean>;
}

/**
 * Hook der håndterer omregning toggle state
 *
 * VIGTIGT: Ingen automatisk enable/disable - kun manuel toggle med validering.
 * Dette gør state mere forudsigelig og letter at ræsonnere om.
 *
 * @param initialEnabled - Initial værdi fra persisted state
 * @param tabelHarFejl - Om tabellen har valideringsfejl
 * @param tabelRef - Ref til tabel-komponenten
 * @param toggleRef - Ref til toggle-komponenten
 * @param onEnabledChange - Callback når toggle ændres (til at opdatere persisted state)
 */
export const useOmregningToggle = ({
  initialEnabled,
  tabelHarFejl,
  tabelRef,
  toggleRef,
  onEnabledChange,
}: UseOmregningToggleProps): UseOmregningToggleReturn => {
  const [state, dispatch] = React.useReducer(toggleReducer, {
    enabled: initialEnabled,
  });

  // Synkroniser reducer med persisted state ved mount/rehydration
  React.useEffect(() => {
    if (state.enabled !== initialEnabled) {
      dispatch({ type: initialEnabled ? 'ENABLE' : 'DISABLE' });
    }
  }, [initialEnabled, state.enabled]);

  /**
   * Håndter toggle-ændring med validering
   */
  const handleToggle = React.useCallback(
    (event: CommitEvent<boolean>) => {
      const newValue = event.target.value;

      // Hvis bruger prøver at tænde toggle OG der er fejl i tabel
      if (newValue && tabelHarFejl) {
        // Trigger shake-animation på toggle
        toggleRef.current?.shake();

        // Flash første fejl-celle
        const errors = tabelRef.current?.getErrors();
        if (errors && errors.length > 0) {
          const firstError = errors[0];
          if (firstError.kind === 'cell') {
            tabelRef.current?.flashError(firstError);
          }
        }

        // Blokér toggle-ændring
        return;
      }

      // Ingen fejl - opdater state
      dispatch({ type: newValue ? 'ENABLE' : 'DISABLE' });
      onEnabledChange(newValue);
    },
    [tabelHarFejl, tabelRef, toggleRef, onEnabledChange]
  );

  // Automatisk deaktivering hvis fejl opstår mens toggle er tændt
  React.useEffect(() => {
    if (tabelHarFejl && state.enabled) {
      dispatch({ type: 'DISABLE' });
      onEnabledChange(false);
    }
  }, [tabelHarFejl, state.enabled, onEnabledChange]);

  return {
    enabled: state.enabled,
    handleToggle,
  };
};
