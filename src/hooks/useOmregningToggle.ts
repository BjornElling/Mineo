import React from 'react';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../types/handles';
import type { AarsloenOmregningGate } from '../domain/aarsloen/aarsloenValidationPolicies';
import type { ToggleCommitDecision, ToggleCommitOverride } from '../inputCore/react/fields/ToggleField';

interface UseOmregningToggleProps {
  gate: AarsloenOmregningGate;
  tabelRef: React.RefObject<StandardLoenTableHandle | null>;
  toggleRef: React.RefObject<StyledToggleSwitchHandle | null>;
}

interface UseOmregningToggleReturn {
  checked: boolean;
  effectiveEnabled: boolean;
  /**
   * Gatens afgørelse som feltadapterens {@link ToggleCommitOverride} (§1.11): `'reject'` ved en ugyldig
   * aktivering, hvorved adapteren IKKE skriver og togglen bliver stående, ellers `'commit'`, hvorved adapteren
   * skriver gennem sin normale write-grænse. Bivirkningerne — shake og fejlcelle-guidning — hører til
   * afvisningen og sker derfor her.
   *
   * Hooken skriver ikke selv. Det er hele pointen i R7-F02: gaten er en afslutningsPOLITIK, ikke en grund til at
   * forbinde et rå `StyledToggleSwitch` manuelt og derved miste `FieldRef`-bindingen og undo/redo-fokusmetadataen.
   */
  decideToggle: ToggleCommitOverride<boolean>;
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
}: UseOmregningToggleProps): UseOmregningToggleReturn => {
  const decideToggle = React.useCallback(
    (newValue: boolean): ToggleCommitDecision => {
      if (newValue && !gate.canEnable) {
        // Altid ryst toggle ved ugyldig aktivering
        toggleRef.current?.shake();

        // Hvis der er tabel-fejl, guid brugeren til den relevante celle
        const summary = gate.validationSummary;
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
        return 'reject';
      }

      // Gyldig ændring → feltadapteren skriver gennem sin normale write-grænse.
      return 'commit';
    },
    [gate, tabelRef, toggleRef]
  );

  return {
    checked: gate.checked,
    effectiveEnabled: gate.effectiveEnabled,
    decideToggle,
  };
};
