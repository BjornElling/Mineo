import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EditorLocation } from '../../inputCore/editor/fieldEditorState';
import {
  immediateCommitCommand,
  buildFieldHistoryOrigin,
  type EditorDispatch,
} from '../../inputCore/editor/fieldEditorEngine';
import {
  inputTransactionStep,
  insertRow,
  setImmediateField,
  structuralInputTransaction,
} from '../../inputCore/inputReducer';
import { generateLoenudviklingRowId, initialLoenudviklingManuelProcentsatsRow } from './helpers/eoRowInitialValues';

/**
 * Manuel procentsats har en låst basisrække som første canonical række. Når formen vælges første gang,
 * oprettes basisrækken i samme undo-trin som valget, så den første synlige række aldrig bliver en redigerbar
 * placeholder, og den første brugerindtastede regulering aldrig fejlagtigt overtager basisrækkens rolle.
 */
export const createManualPercentBasisCommitOverride = <T extends string | undefined>(args: Readonly<{
  field: FieldRef<T>;
  location: EditorLocation;
  collection: CollectionRef;
  hasBaseRow: boolean;
}>): ((value: T) => EditorDispatch<T>) => (value) => {
  if (value !== 'Manuel procentsats' || args.hasBaseRow) {
    return immediateCommitCommand(args.field, value, args.location);
  }

  const baseRow = {
    ...initialLoenudviklingManuelProcentsatsRow,
    id: generateLoenudviklingRowId(),
    procent: 0,
  };
  return Object.freeze({
    command: structuralInputTransaction([
      inputTransactionStep(setImmediateField(args.field, value)),
      inputTransactionStep(insertRow(args.collection, baseRow, 0)),
    ]),
    origin: buildFieldHistoryOrigin(args.location, args.field),
  });
};
