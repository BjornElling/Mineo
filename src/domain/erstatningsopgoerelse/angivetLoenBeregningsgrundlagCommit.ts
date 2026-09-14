import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EditorLocation } from '../../inputCore/editor/fieldEditorState';
import {
  buildFieldHistoryOrigin,
  immediateCommitCommand,
  type EditorDispatch,
} from '../../inputCore/editor/fieldEditorEngine';
import {
  inputTransaction,
  inputTransactionStep,
  setImmediateField,
} from '../../inputCore/inputReducer';

type Beregningsgrundlag = 'Beregningsperiode' | 'Angivet månedsløn' | 'Angivet dagsløn';

/**
 * Bygger den atomiske handling for EO's beregningsgrundlag.
 *
 * Månedsløn skal åbne Store Bededag-valget med `true`, mens dagsløn skal åbne det med `false`. Det er
 * en direkte følge af brugerens valg af beregningsgrundlag, så de to felter committes samlet. Når
 * beregningsperiode vælges, røres togglen ikke – den er skjult og skal bevare sin værdi uden at kunne
 * påvirke beregningen.
 */
export const createEoBeregningsgrundlagCommitOverride = <T extends Beregningsgrundlag | undefined>(args: Readonly<{
  field: FieldRef<T>;
  storeBededagField: FieldRef<boolean>;
  location: EditorLocation;
}>): ((value: T) => EditorDispatch<T>) => (value) => {
  const defaultToggle = value === 'Angivet månedsløn'
    ? true
    : value === 'Angivet dagsløn'
      ? false
      : undefined;

  if (defaultToggle === undefined) return immediateCommitCommand(args.field, value, args.location);

  return Object.freeze({
    command: inputTransaction([
      inputTransactionStep(setImmediateField(args.field, value)),
      inputTransactionStep(setImmediateField(args.storeBededagField, defaultToggle)),
    ]),
    origin: buildFieldHistoryOrigin(args.location, args.field),
  });
};
