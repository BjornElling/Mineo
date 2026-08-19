import * as React from 'react';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';
import {
  selectAccessibleNameProps,
  type AccessibleNameProps,
} from '../../../components/inputs/accessibleName';

// Toggle-felt (§1.3/§3.6): en boolsk immediate-commit control. Klik/Enter/Space committer STRAKS via
// `commitImmediate` – ingen draft/settle-fase. Modtager kun sin `field`/`location`; den viste checked-tilstand
// læses fra den afsluttede revision gennem editor-controlleren. Feltet har BEVIDST ingen ref-videreførsel:
// den fandtes alene for at give en gate-afvisning adgang til switchens `shake()`, og rystelsen er fjernet
// i hele programmet. En afvisning peger nu på den konkrete fejlcelle i stedet.

/**
 * En callsite-ejet afslutning af togglen (§1.11). Kaldes med den ønskede næste værdi og afgør, hvad der sker:
 *
 * - `'commit'` – adapteren skriver værdien gennem sin normale `commitImmediate`. En gate bruger dette for den
 *   tilladte ændring; skrivevejen forbliver dermed adapterens.
 * - `'reject'` – ingen skrivning; kontrollen bliver stående (gate-afvisning).
 * - `'handled'` – callsitet har selv afsluttet ændringen, typisk som én atomisk transaktion, der også rører
 *   andre felter eller rækker. Adapteren skriver da ikke oveni.
 *
 * Findes for de persisterede toggles, hvis afslutning IKKE er én ren feltskrivning. Tidligere måtte netop de
 * callsites bruge det rå `StyledToggleSwitch` direkte og forbinde editoren manuelt – hvorved BÅDE den konkrete
 * `FieldRef` og undo/redo-fokusmetadataen faldt væk. Overriden flytter kun AFSLUTNINGEN; identitet, visning og
 * restore-attributter forbliver adapterens ansvar.
 */
export type ToggleCommitDecision = 'commit' | 'reject' | 'handled';
export type ToggleCommitOverride<TValue> = (next: TValue) => ToggleCommitDecision;

export type ToggleFieldProps = Readonly<{
  field: FieldRef<boolean>;
  location: EditorLocation;

  labelPlacement?: 'start' | 'end' | 'top' | 'bottom';
  disabled?: boolean;
  name?: string;
  id?: string;
  /** Callsite-ejet afslutning (gate/atomisk transaktion). Udelades for en almindelig ét-felts-toggle. */
  commit?: ToggleCommitOverride<boolean>;
  /**
   * Den viste checked-tilstand, når den IKKE blot er feltets afsluttede værdi – fx en gate, der beregner den
   * synlige tilstand ud af det persisterede ønske plus dets forudsætninger. Udelades normalt.
   */
  checkedOverride?: boolean;
}> &
  // Det tilgængelige navn er obligatorisk og videreføres uændret til switchen. Kravet ligger i typen,
  // så en navnløs toggle ikke kan type-checke – se components/inputs/accessibleName.ts.
  AccessibleNameProps;

const ToggleField = (props: ToggleFieldProps) => {
    const { field, location, labelPlacement, disabled, name, id, commit, checkedOverride } = props;
    const controller = useFieldEditor(field, location);
    const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
    // En boolsk descriptor har altid en defineret canonical værdi (emptyValue false/true); controller.value er
    // derfor defineret for et toggle-felt. Fald tilbage til false for at opfylde den controlled kontrakt.
    const checked = checkedOverride ?? controller.value ?? false;

    const handleCommit = React.useCallback(
      (e: CommitEvent<boolean>): boolean => {
        const next = e.target.value;
        const decision = commit === undefined ? 'commit' : commit(next);
        if (decision === 'reject') return false;
        if (decision === 'commit') controller.commitImmediate(next);
        return true;
      },
      [commit, controller]
    );

    return (
      <StyledToggleSwitch
        checked={checked}
        onCommit={handleCommit}
        {...selectAccessibleNameProps(props)}
        {...(labelPlacement === undefined ? {} : { labelPlacement })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(name === undefined ? {} : { name })}
        {...(id === undefined ? {} : { id })}
        restoreTargetAttributes={restoreTargetAttributes}
      />
    );
};

ToggleField.displayName = 'ToggleField';

export default ToggleField;
