import * as React from 'react';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';
import { immediateCommitCommand, type EditorDispatch } from '../../../inputCore/editor/fieldEditorEngine';
import type { ImmediateCommitOverride } from '../../../inputCore/react/useFieldEditor';
import type { ToggleCommitOverride } from '../../../inputCore/react/fields/ToggleField';
import { useInputEditPort } from '../../../inputCore/react/inputRuntimeContext';
import { findRestoreTarget } from '../../../inputCore/react/historyRestoreTarget';
import {
  formatSfggFravaersdageEnhedsskiftBesked,
  resolveSfggFravaersdageEnhedsskift,
  type SfggEnhedsskiftValues,
} from '../sfggFravaersdageEnhedsskift';


/** Bekræftelsesdialogens props – spredes på `ConfirmationDialog` sammen med titel og knaptekster. */
export type SfggEnhedsskiftDialogProps = Readonly<{
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  restoreFocusTo: React.RefObject<HTMLElement | null>;
}>;

export const SFGG_ENHEDSSKIFT_DIALOG_TITLE = 'Fraværsdagene skifter enhed';
export const SFGG_ENHEDSSKIFT_CONFIRM_TEXT = 'Ja, skift';

/**
 * Den ene bekræftelse før et valg, der skifter enheden for et indtastet antal fraværsdage uden løn (BB-449, M-68).
 * Alle kontroller, der kan flytte enheden, går gennem denne hook, så teksten, beslutningen og undo/redo er ens.
 *
 * Valget committes FØRST ved bekræftelsen og med præcis den dispatch, feltet selv ville have sendt – samme command
 * og samme feltorigin – så ét undo fortryder valget og fokuserer kontrollen som ved et almindeligt valg. Annuller
 * sender intet, og kontrollen viser fortsat den afsluttede værdi. Antallet omregnes ikke.
 *
 * @param values den aktuelle afsluttede projektion; `efter` til hver kontrol bygges ud fra den.
 */
export const useSfggEnhedsskiftBekraeftelse = (values: SfggEnhedsskiftValues) => {
  const edit = useInputEditPort();
  // Valget, der venter på svaret – som en afsluttende handling, så dispatchens feltype ikke skal udviskes.
  const [pending, setPending] = React.useState<Readonly<{ commit: () => void }> | null>(null);
  // Teksten ryddes ikke ved lukning: dialogen toner ud og skal ikke stå tom imens.
  const [besked, setBesked] = React.useState('');
  const restoreFocusTo = React.useRef<HTMLElement | null>(null);

  /** `true`, når bekræftelsen er åbnet og valget dermed venter; `false`, når valget kan committes straks. */
  const kraeverBekraeftelse = React.useCallback(
    <T,>(efter: SfggEnhedsskiftValues, dispatch: EditorDispatch<T>): boolean => {
      const skift = resolveSfggFravaersdageEnhedsskift(values, efter);
      if (skift === null) return false;
      // Menupunktet, der udløste valget, er væk, når dialogen lukker; fokus skal tilbage til selve kontrollen
      // (keyboard-navigation.md §Popup-fokus-restore). Det er samme mål, som undo/redo fokuserer.
      restoreFocusTo.current = findRestoreTarget(dispatch.origin);
      setBesked(formatSfggFravaersdageEnhedsskiftBesked(skift));
      setPending({ commit: () => edit.dispatch(dispatch.command, dispatch.origin) });
      return true;
    },
    [edit, values]
  );

  /**
   * Dropdown: feltadapterens immediate-commit-override (§1.11). `base` er en eventuel eksisterende override, der
   * bygger valgets atomiske dispatch (fx «Beregnes ud fra» med Store Bededag-togglen); den bevares uændret.
   */
  const choiceOverride = React.useCallback(
    <T,>(args: Readonly<{
      field: FieldRef<T>;
      location: EditorLocation;
      efter: (value: T) => SfggEnhedsskiftValues;
      base?: (value: T) => EditorDispatch<T>;
    }>): ImmediateCommitOverride<T> => (value) => {
      const dispatch = args.base?.(value) ?? immediateCommitCommand(args.field, value, args.location);
      return kraeverBekraeftelse(args.efter(value), dispatch) ? null : dispatch;
    },
    [kraeverBekraeftelse]
  );

  /** Toggle: feltadapterens commit-override; `'handled'` holder kontakten på den afsluttede værdi, til svaret er givet. */
  const toggleOverride = React.useCallback(
    <T,>(args: Readonly<{
      field: FieldRef<T>;
      location: EditorLocation;
      efter: (value: T) => SfggEnhedsskiftValues;
    }>): ToggleCommitOverride<T> => (value) =>
      kraeverBekraeftelse(args.efter(value), immediateCommitCommand(args.field, value, args.location))
        ? 'handled'
        : 'commit',
    [kraeverBekraeftelse]
  );

  const onConfirm = React.useCallback(() => {
    pending?.commit();
    setPending(null);
  }, [pending]);
  const onCancel = React.useCallback(() => setPending(null), []);

  const dialogProps: SfggEnhedsskiftDialogProps = {
    open: pending !== null,
    message: besked,
    onConfirm,
    onCancel,
    restoreFocusTo,
  };

  return { choiceOverride, toggleOverride, dialogProps };
};
