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
import {
  generateLoenudviklingRowId,
  initialLoenudviklingManuelProcentsatsRow,
  initialLoenudviklingManuelRow,
} from './helpers/eoRowInitialValues';

type ManualRegulationKind = 'Manuelt angivet' | 'Manuel procentsats';

type BasisTarget = Readonly<{
  collection: CollectionRef;
  hasBaseRow: boolean;
  createBaseRow: () => Readonly<{ id: string }>;
}>;

/** Første synlige række er basisrækken, også hvis ældre state mangler den canonical række. */
export const resolveManualRegulationBasisRowId = (
  committedRows: readonly Readonly<{ id: string }>[],
  visibleRows: readonly Readonly<{ rowId: string }>[]
): string | undefined => committedRows[0]?.id ?? visibleRows[0]?.rowId;

/**
 * Begge manuelle reguleringsformer har samme strukturelle invariant: første canonical række er en
 * programstyret basisrække, hvis dato afledes som `anvendtRegulering` og aldrig er brugerinput. Valget og
 * basisrækken committes atomisk, så der ikke kan opstå et mellemtrin med en redigerbar første datocelle.
 */
export const createManualRegulationBasisCommitOverride = <T extends string | undefined>(args: Readonly<{
  field: FieldRef<T>;
  location: EditorLocation;
  manualCollection: CollectionRef;
  manualPercentCollection: CollectionRef;
  hasManualBaseRow: boolean;
  hasManualPercentBaseRow: boolean;
}>): ((value: T) => EditorDispatch<T>) => {
  const targets: Readonly<Record<ManualRegulationKind, BasisTarget>> = {
    'Manuelt angivet': {
      collection: args.manualCollection,
      hasBaseRow: args.hasManualBaseRow,
      createBaseRow: () => ({
        ...initialLoenudviklingManuelRow,
        id: generateLoenudviklingRowId(),
      }),
    },
    'Manuel procentsats': {
      collection: args.manualPercentCollection,
      hasBaseRow: args.hasManualPercentBaseRow,
      createBaseRow: () => ({
        ...initialLoenudviklingManuelProcentsatsRow,
        id: generateLoenudviklingRowId(),
        procent: 0,
      }),
    },
  };

  return (value) => {
    const kind: ManualRegulationKind | undefined = value === 'Manuelt angivet'
      ? 'Manuelt angivet'
      : value === 'Manuel procentsats'
        ? 'Manuel procentsats'
        : undefined;
    const target = kind ? targets[kind] : undefined;
    if (!target || target.hasBaseRow) {
      return immediateCommitCommand(args.field, value, args.location);
    }

    return Object.freeze({
      command: structuralInputTransaction([
        inputTransactionStep(setImmediateField(args.field, value)),
        inputTransactionStep(insertRow(target.collection, target.createBaseRow(), 0)),
      ]),
      origin: buildFieldHistoryOrigin(args.location, args.field),
    });
  };
};
