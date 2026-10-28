import React from 'react';
import type { StandardLoenTableHandle } from '../types/handles';
import type { AarsloenOmregningGate } from '../domain/aarsloen/aarsloenValidationPolicies';
import type { ToggleCommitDecision, ToggleCommitOverride } from '../inputCore/react/fields/ToggleField';

interface UseOmregningToggleProps {
  gate: AarsloenOmregningGate;
  tabelRef: React.RefObject<StandardLoenTableHandle | null>;
}

interface UseOmregningToggleReturn {
  checked: boolean;
  effectiveEnabled: boolean;
  /**
   * Gatens afgørelse som feltadapterens {@link ToggleCommitOverride} (§1.11): `'reject'` ved en ugyldig
   * aktivering, hvorved adapteren IKKE skriver og togglen bliver stående, ellers `'commit'`, hvorved adapteren
   * skriver gennem sin normale write-grænse. Bivirkningen – blinket af fejlcellen – hører til
   * afvisningen og sker derfor her; rystelsen udløser togglen selv på `'reject'`.
   *
   * Hooken skriver ikke selv: gaten er en afslutningsPOLITIK, ikke en grund til at
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
 * - Manuel enable blokeres tidligt ved ugyldige forhold (→ rystelse + blink af første fejl)
 *
 * Rystelsen ejes af togglen selv: `'reject'` får `StyledToggleSwitch` til at ryste (udviklerbeslutning
 * 2026-10-28). Hooken tilføjer kun henvisningen til årsagen – fejlcellen, den manglende indtastning eller
 * første periodecelle – og den blinker, HVOR den står (`'inPlace'`): brugeren forsøgte at slå omregningen
 * til, ikke at blive ført hen til tabellen.
 */
export const useOmregningToggle = ({
  gate,
  tabelRef,
}: UseOmregningToggleProps): UseOmregningToggleReturn => {
  const decideToggle = React.useCallback(
    (newValue: boolean): ToggleCommitDecision => {
      if (newValue && !gate.canEnable) {
        // Hvis der er tabel-fejl, guid brugeren til den relevante celle
        const summary = gate.validationSummary;
        if (summary.firstErrorCell) {
          if (summary.firstErrorCell.reason === 'missing') {
            tabelRef.current?.showMissingEntryError(summary.firstErrorCell, 'inPlace');
          } else {
            tabelRef.current?.flashError({
              kind: 'cell',
              issue: 'invalid',
              rowId: summary.firstErrorCell.rowId,
              colKey: summary.firstErrorCell.colKey,
            }, 'inPlace');
          }
        } else {
          // Ingen konkret fejlcelle (typisk en helt tom tabel uden påbegyndt periode): peg brugeren
          // på første periodecelle, så rystelsen ikke står alene uden en henvisning til årsagen.
          tabelRef.current?.showNeedsPeriodHint('inPlace');
        }

        // Ingen state-ændring
        return 'reject';
      }

      // Gyldig ændring → feltadapteren skriver gennem sin normale write-grænse.
      return 'commit';
    },
    [gate, tabelRef]
  );

  return {
    checked: gate.checked,
    effectiveEnabled: gate.effectiveEnabled,
    decideToggle,
  };
};
