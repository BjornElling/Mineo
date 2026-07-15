import {
  createEntityPath,
  deserializeFieldAddress,
  isFieldAddressBelowEntity,
  serializeFieldAddress,
  type CollectionRef,
} from './fieldAddress';
import type { CollectionBinding, InputCatalog } from './fieldCatalog';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
  type PersistedInputSections,
  type PersistedInputState,
  type PersistedInputStateCandidate,
} from './inputState';
import type { FieldRef } from './fieldDefinition';
import { deepEqual } from '../utils/deepEqual';

export type SettleFieldCommand<T> = Readonly<{
  kind: 'settleField';
  field: FieldRef<T>;
  raw: string;
}>;

/** Immediate controls bærer canonical data direkte; labels eller boolean-strenge er aldrig dataprotocol. */
export type CommitImmediateFieldCommand<T> = Readonly<{
  kind: 'commitImmediateField';
  field: FieldRef<T>;
  value: T;
}>;

export type FieldInputCommand<T> = SettleFieldCommand<T> | CommitImmediateFieldCommand<T>;

export type InsertRowCommand<TEntity> = Readonly<{
  kind: 'insertRow';
  binding: CollectionBinding<TEntity>;
  collection: CollectionRef;
  entity: TEntity;
  index?: number;
}>;

export type DeleteRowCommand<TEntity> = Readonly<{
  kind: 'deleteRow';
  binding: CollectionBinding<TEntity>;
  collection: CollectionRef;
  entityId: string;
}>;

export type ReorderRowsCommand<TEntity> = Readonly<{
  kind: 'reorderRows';
  binding: CollectionBinding<TEntity>;
  collection: CollectionRef;
  orderedEntityIds: readonly string[];
}>;

/** Første settle i en tom UI-række opretter række og feltresultat i samme kandidataggregate. */
export type SettleFieldInNewRowCommand<TEntity, TField> = Readonly<{
  kind: 'settleFieldInNewRow';
  binding: CollectionBinding<TEntity>;
  collection: CollectionRef;
  entity: TEntity;
  index?: number;
  field: FieldRef<TField>;
  raw: string;
}>;

export type ResetSectionCommand<TKey extends keyof PersistedInputSections> = Readonly<{
  kind: 'resetSection';
  section: TKey;
  value: PersistedInputSections[TKey];
}>;

export type ReplaceCaseCommand = Readonly<{
  kind: 'replaceCase';
  input: PersistedInputStateCandidate;
}>;

export type ClearCaseCommand = Readonly<{ kind: 'clearCase' }>;
export type UndoInputCommand = Readonly<{ kind: 'undo' }>;
export type RedoInputCommand = Readonly<{ kind: 'redo' }>;
export type InputHistoryCommand = UndoInputCommand | RedoInputCommand;

export type InputMutationCommand<TField = never, TEntity = never> =
  | FieldInputCommand<TField>
  | InsertRowCommand<TEntity>
  | DeleteRowCommand<TEntity>
  | ReorderRowsCommand<TEntity>
  | SettleFieldInNewRowCommand<TEntity, TField>
  | ResetSectionCommand<keyof PersistedInputSections>
  | ReplaceCaseCommand
  | ClearCaseCommand;

export type InputCommand<TField = never, TEntity = never> =
  | InputMutationCommand<TField, TEntity>
  | InputHistoryCommand;

export const settleField = <T>(field: FieldRef<T>, raw: string): SettleFieldCommand<T> =>
  Object.freeze({ kind: 'settleField', field, raw });

export const commitImmediateField = <T>(field: FieldRef<T>, value: T): CommitImmediateFieldCommand<T> =>
  Object.freeze({ kind: 'commitImmediateField', field, value });

export const insertRow = <TEntity>(
  binding: CollectionBinding<TEntity>,
  entity: TEntity,
  options: Readonly<{ parentEntityIds?: readonly string[]; index?: number }> = {}
): InsertRowCommand<TEntity> => Object.freeze({
  kind: 'insertRow',
  binding,
  collection: binding.createRef(...(options.parentEntityIds ?? [])),
  entity,
  ...(options.index === undefined ? {} : { index: options.index }),
});

export const deleteRow = <TEntity>(
  binding: CollectionBinding<TEntity>,
  entityId: string,
  parentEntityIds: readonly string[] = []
): DeleteRowCommand<TEntity> => Object.freeze({
  kind: 'deleteRow',
  binding,
  collection: binding.createRef(...parentEntityIds),
  entityId,
});

export const reorderRows = <TEntity>(
  binding: CollectionBinding<TEntity>,
  orderedEntityIds: readonly string[],
  parentEntityIds: readonly string[] = []
): ReorderRowsCommand<TEntity> => Object.freeze({
  kind: 'reorderRows',
  binding,
  collection: binding.createRef(...parentEntityIds),
  orderedEntityIds: Object.freeze([...orderedEntityIds]),
});

export const settleFieldInNewRow = <TEntity, TField>(
  binding: CollectionBinding<TEntity>,
  entity: TEntity,
  field: FieldRef<TField>,
  raw: string,
  options: Readonly<{ parentEntityIds?: readonly string[]; index?: number }> = {}
): SettleFieldInNewRowCommand<TEntity, TField> => Object.freeze({
  kind: 'settleFieldInNewRow',
  binding,
  collection: binding.createRef(...(options.parentEntityIds ?? [])),
  entity,
  field,
  raw,
  ...(options.index === undefined ? {} : { index: options.index }),
});

export const resetSection = <TKey extends keyof PersistedInputSections>(
  section: TKey,
  value: PersistedInputSections[TKey]
): ResetSectionCommand<TKey> => Object.freeze({ kind: 'resetSection', section, value });

export const replaceCase = (input: PersistedInputStateCandidate): ReplaceCaseCommand =>
  Object.freeze({ kind: 'replaceCase', input });

export const clearCase = (): ClearCaseCommand => Object.freeze({ kind: 'clearCase' });
export const undoInput = (): UndoInputCommand => Object.freeze({ kind: 'undo' });
export const redoInput = (): RedoInputCommand => Object.freeze({ kind: 'redo' });

export type InputReducerResult = Readonly<{
  changed: boolean;
  input: PersistedInputState;
}>;

type InputStateParts = Readonly<{
  sections: PersistedInputSections;
  rejectedInputs: PersistedInputState['rejectedInputs'];
}>;

const withRejectedInput = <T>(input: InputStateParts, field: FieldRef<T>, raw: string): PersistedInputStateCandidate => {
  const address = serializeFieldAddress(field.address);
  return {
    ...input,
    rejectedInputs: {
      ...input.rejectedInputs,
      [address]: { raw },
    },
  };
};

const withCanonicalValue = <T>(
  input: InputStateParts,
  field: FieldRef<T>,
  value: T,
  catalog: InputCatalog
): PersistedInputStateCandidate => {
  const address = serializeFieldAddress(field.address);
  const { [address]: _removedRejectedInput, ...rejectedInputs } = input.rejectedInputs;
  return {
    sections: catalog.writeCanonical(input.sections, field, value),
    rejectedInputs,
  };
};

const reduceSettledField = <T>(
  input: InputStateParts,
  command: SettleFieldCommand<T>,
  catalog: InputCatalog
): PersistedInputStateCandidate => {
  catalog.assertKnownFieldInInput(input.sections, command.field);
  const resolution = command.field.definition.codec.parseForSettle(command.raw);
  if (resolution.status === 'valid') return withCanonicalValue(input, command.field, resolution.value, catalog);

  // En invalid command må aldrig gemme en tom rejection; tomhed skal være en canonical værdi.
  if (command.raw === '') throw new Error('InputCommand: codec afviste tom tekst, som ikke kan være rejected input');
  return withRejectedInput(input, command.field, command.raw);
};

const removeRejectedBelowEntity = (
  rejectedInputs: PersistedInputState['rejectedInputs'],
  collection: CollectionRef,
  entityId: string
): PersistedInputState['rejectedInputs'] => {
  const entityPath = createEntityPath([
    ...collection.path,
    { kind: 'entity', collection: collection.collection, entityId },
  ]);
  return Object.fromEntries(Object.entries(rejectedInputs).filter(([serializedAddress]) => {
    const address = deserializeFieldAddress(serializedAddress);
    if (address === null) throw new Error('InputCommand: current-state indeholder en ugyldig feltadresse');
    return !isFieldAddressBelowEntity(address, collection.section, entityPath);
  }));
};

/**
 * Bygger den strukturelle kandidataggregate for én mutation. Delt af den validerende {@link reduceInputCommand}
 * (fase 2/ren kerne) OG af fase-4-runnerens typed-spor, så der kun findes ÉN reducer-logik: strukturelle
 * rejected-adresser, celle-/rækkefelter og atomisk descendant-oprydning ved sletning. Runneren genbruger
 * kandidatbygningen uden den fuld-katalog-validering, som `reduceInputCommand` lægger ovenpå, fordi storen i
 * fase 4 endnu kan indeholde legacy-bro-adresser (celler) side om side; envelope-valideringen ejer den
 * transitionelle accept, indtil sidste celle er migreret struktureret.
 */
export const buildInputCommandCandidate = <TField, TEntity>(
  input: InputStateParts,
  command: InputMutationCommand<TField, TEntity>,
  catalog: InputCatalog
): PersistedInputStateCandidate => {
  switch (command.kind) {
    case 'settleField':
      return reduceSettledField(input, command, catalog);
    case 'commitImmediateField':
      catalog.assertKnownFieldInInput(input.sections, command.field);
      return withCanonicalValue(input, command.field, command.value, catalog);
    case 'insertRow':
      return {
        sections: catalog.insertEntity(input.sections, command.binding, command.collection, command.entity, command.index),
        rejectedInputs: input.rejectedInputs,
      };
    case 'deleteRow':
      return {
        sections: catalog.deleteEntity(input.sections, command.binding, command.collection, command.entityId),
        rejectedInputs: removeRejectedBelowEntity(input.rejectedInputs, command.collection, command.entityId),
      };
    case 'reorderRows':
      return {
        sections: catalog.reorderEntities(
          input.sections,
          command.binding,
          command.collection,
          command.orderedEntityIds
        ),
        rejectedInputs: input.rejectedInputs,
      };
    case 'settleFieldInNewRow': {
      const entityId = catalog.getEntityId(command.binding, command.entity);
      const entityPath = createEntityPath([
        ...command.collection.path,
        { kind: 'entity', collection: command.collection.collection, entityId },
      ]);
      if (!isFieldAddressBelowEntity(command.field.address, command.collection.section, entityPath)) {
        throw new Error('InputCommand: feltet tilhører ikke den nye række');
      }
      const insertedSections = catalog.insertEntity(
        input.sections,
        command.binding,
        command.collection,
        command.entity,
        command.index
      );
      const inserted: InputStateParts = {
        sections: insertedSections,
        rejectedInputs: input.rejectedInputs,
      };
      return reduceSettledField(inserted, settleField(command.field, command.raw), catalog);
    }
    case 'resetSection': {
      const rejectedInputs = Object.fromEntries(Object.entries(input.rejectedInputs).filter(([serializedAddress]) => {
        const address = deserializeFieldAddress(serializedAddress);
        if (address === null) throw new Error('InputCommand: current-state indeholder en ugyldig feltadresse');
        return address.section !== command.section;
      }));
      return {
        sections: { ...input.sections, [command.section]: command.value },
        rejectedInputs,
      };
    }
    case 'replaceCase':
      return command.input;
    case 'clearCase':
      return { sections: createEmptyPersistedInputSections(), rejectedInputs: {} };
  }
};

/** Ren, exhaustiv reducer. Storage, history og revision ejes først af fase-3-runneren. */
export const reduceInputCommand = <TField, TEntity>(
  input: PersistedInputState,
  command: InputMutationCommand<TField, TEntity>,
  catalog: InputCatalog
): InputReducerResult => {
  const parsed = createPersistedInputStateSchema(catalog).safeParse(buildInputCommandCandidate(input, command, catalog));
  if (!parsed.success) {
    throw new Error(`InputCommand: kandidataggregat fejlede schema-validering: ${parsed.error.message}`);
  }
  if (deepEqual(input, parsed.data)) return Object.freeze({ changed: false, input });
  return Object.freeze({ changed: true, input: parsed.data });
};
