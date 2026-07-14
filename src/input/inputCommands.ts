import { serializeFieldAddress } from './fieldAddress';
import type { FieldCatalog } from './fieldCatalog';
import { createPersistedInputStateSchema, type PersistedInputState } from './inputState';
import type { FieldRef } from './fieldDefinition';

export type SettleFieldCommand<T> = Readonly<{
  kind: 'settleField';
  field: FieldRef<T>;
  raw: string;
}>;

/** Samme parser- og reducervej som settle, men udstedt af dropdown, toggle/radio eller lukket celle-clear. */
export type CommitImmediateFieldCommand<T> = Readonly<{
  kind: 'commitImmediateField';
  field: FieldRef<T>;
  raw: string;
}>;

export type FieldInputCommand<T> = SettleFieldCommand<T> | CommitImmediateFieldCommand<T>;

export const settleField = <T>(field: FieldRef<T>, raw: string): SettleFieldCommand<T> =>
  Object.freeze({ kind: 'settleField', field, raw });

export const commitImmediateField = <T>(field: FieldRef<T>, raw: string): CommitImmediateFieldCommand<T> =>
  Object.freeze({ kind: 'commitImmediateField', field, raw });

export type InputReducerResult = Readonly<{
  changed: boolean;
  input: PersistedInputState;
}>;

const inputsEqual = (left: PersistedInputState, right: PersistedInputState): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const withRejectedInput = <T>(input: PersistedInputState, field: FieldRef<T>, raw: string): PersistedInputState => {
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
  input: PersistedInputState,
  field: FieldRef<T>,
  value: T,
  fieldCatalog: FieldCatalog
): PersistedInputState => {
  const address = serializeFieldAddress(field.address);
  const { [address]: _removedRejectedInput, ...rejectedInputs } = input.rejectedInputs;
  return {
    sections: fieldCatalog.writeCanonical(input.sections, field, value),
    rejectedInputs,
  };
};

/**
 * Ren reducer for afsluttede feltændringer. Runtime-laget udfører først storage/history efter
 * dette punkt har produceret og valideret hele kandidataggregatet.
 */
export const reduceFieldInputCommand = <T>(
  input: PersistedInputState,
  command: FieldInputCommand<T>,
  fieldCatalog: FieldCatalog,
  isKnownFieldAddress: Parameters<typeof createPersistedInputStateSchema>[0]
): InputReducerResult => {
  fieldCatalog.assertKnownField(command.field);
  const resolution = command.field.definition.codec.parseForSettle(command.raw);
  const candidate = resolution.status === 'valid'
    ? withCanonicalValue(input, command.field, resolution.value, fieldCatalog)
    : withRejectedInput(input, command.field, command.raw);

  // En invalid command må aldrig gemme en tom rejection; tomhed skal være en canonical værdi.
  if (resolution.status === 'invalid' && command.raw === '') {
    throw new Error('InputCommand: codec afviste tom tekst, som ikke kan være rejected input');
  }

  const parsed = createPersistedInputStateSchema(isKnownFieldAddress).safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`InputCommand: kandidataggregat fejlede schema-validering: ${parsed.error.message}`);
  }
  if (inputsEqual(input, parsed.data)) return Object.freeze({ changed: false, input });
  return Object.freeze({ changed: true, input: parsed.data });
};
