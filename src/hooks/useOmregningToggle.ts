import React from 'react';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../types/handles';
import type { CommitEvent, CommitHandler } from '../types/fieldEvents';
import type { AarsloenOmregningGate } from '../domain/aarsloen/aarsloenValidationPolicies';

interface UseOmregningToggleProps {
  gate: AarsloenOmregningGate;
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
 * - Persisted brugerinput er ønsket tilstand
 * - Den centrale omregnings-gate afgør både toggle-visning og effektiv aktivering
 * - Manuel enable blokeres tidligt ved ugyldige forhold (→ shake + fokus på første fejl)
 */
export const useOmregningToggle = ({
  gate,
  tabelRef,
  toggleRef,
  onEnabledChange,
}: UseOmregningToggleProps): UseOmregningToggleReturn => {
  /**
   * Håndter brugerens toggle-interaktion
   */
  const handleToggle = React.useCallback(
    (event: CommitEvent<boolean>) => {
      const newValue = event.target.value;

      if (newValue && !gate.canEnable) {
        // Altid ryst toggle ved ugyldig aktivering
        toggleRef.current?.shake();

        // Hvis der er tabel-fejl, guid brugeren til den relevante celle
        const summary = tabelRef.current?.getValidationSummary() ?? gate.validationSummary;
        if (summary.firstErrorCell) {
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
        } else {
          // Ingen konkret fejlcelle (typisk en helt tom tabel uden påbegyndt periode): peg brugeren
          // på første periodecelle, så aktivering uden gyldig periode ikke kun bliver en stum rystelse.
          tabelRef.current?.showNeedsPeriodHint();
        }

        // Ingen state-ændring
        return;
      }

      // Gyldig ændring → opdater persisted state
      onEnabledChange(newValue);
    },
    [
      gate,
      tabelRef,
      toggleRef,
      onEnabledChange,
    ]
  );

  return {
    checked: gate.checked,
    effectiveEnabled: gate.effectiveEnabled,
    handleToggle,
  };
};
