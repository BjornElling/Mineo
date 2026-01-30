export type RowId = string;

export type WithId = { id: RowId };

export type RowErrors<RowIdType extends RowId, TField extends string> = Record<
  RowIdType,
  Partial<Record<TField, string>>
>;

