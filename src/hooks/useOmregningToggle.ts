import React from 'react';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../types/handles';
import type { CommitEvent, CommitHandler } from '../types/fieldEvents';

interface UseOmregningToggleProps {
  requestedEnabled: boolean;
  tabelHarFejl: boolean;
  hasValidPeriod: boolean;
  tabelRef: React.RefObject<StandardLoenTableHandle | null>;
  toggleRef: React.RefObject<StyledToggleSwitchHandle | null>;
  onEnabledChange: (enabled: boolean) => void;
}

interface UseOmregningToggleReturn {
  checked: boolean;
  effectiveEnabled: boolean;
  handleToggle: CommitHandler<boolean>;
}

/**
 * Hook der håndterer omregning-toggle.
 *
 * Principper:
 * - Persisted brugerinput er single source of truth
 * - Effektiv beregnings-aktivering gates af committed tabel/periode-state
 * - Manuel enable blokeres tidligt ved ugyldige forhold (→ shake)
 * - Ingen auto-disable via useEffect, så committed brugerinput ikke overskrives implicit
 */
export const useOmregningToggle = ({
  requestedEnabled,
  tabelHarFejl,
  hasValidPeriod,
  tabelRef,
  toggleRef,
  onEnabledChange,
}: UseOmregningToggleProps): UseOmregningToggleReturn => {
  const effectiveEnabled = requestedEnabled && !tabelHarFejl && hasValidPeriod;

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

      // Gyldig ændring → opdater persisted state
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

  return {
    checked: requestedEnabled,
    effectiveEnabled,
    handleToggle,
  };
};
