import type { FieldAddress } from './fieldAddress';

export type FieldResolution<T> =
  | Readonly<{ status: 'valid'; value: T }>
  | Readonly<{ status: 'invalid' }>;

export type FieldCodec<T> = Readonly<{
  parseForSettle: (raw: string) => FieldResolution<T>;
  format: (value: T) => string;
  acceptsInitialKey: (key: string) => boolean;
  normalizePaste?: (raw: string) => string;
}>;

export type FieldControlKind = 'text' | 'choice' | 'toggle';

export type FieldFocusTarget = Readonly<{
  route: string;
  tab: string | null;
}>;

export type FieldDefinitionBase = Readonly<{
  label: string;
  controlKind: FieldControlKind;
  focusTarget: FieldFocusTarget;
}>;

export type FieldDefinition<T> = FieldDefinitionBase & Readonly<{
  codec: FieldCodec<T>;
}>;

export type FieldRefBase = Readonly<{
  address: FieldAddress;
  definition: FieldDefinitionBase;
}>;

export type FieldRef<T> = Readonly<{
  address: FieldAddress;
  definition: FieldDefinition<T>;
}>;

export const defineField = <T>(definition: FieldDefinition<T>): FieldDefinition<T> => Object.freeze({
  ...definition,
  // Codecet kopieres og fryses, så parser-/formatteringsadfærd ikke kan muteres efter katalogregistrering.
  codec: Object.freeze({ ...definition.codec }),
  focusTarget: Object.freeze({ ...definition.focusTarget }),
});

export const bindField = <T>(definition: FieldDefinition<T>, address: FieldAddress): FieldRef<T> => Object.freeze({
  address,
  definition,
});

export const toFieldRefBase = <T>(field: FieldRef<T>): FieldRefBase => field;
