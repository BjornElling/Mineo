import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import {
  createInputCatalog,
  defineField,
  createIntegerFieldCodec,
  createAmountFieldCodec,
  createDateFieldCodec,
  optionalTextFieldCodec,
  createRequiredChoiceFieldCodec,
  createCollectionRef,
  type CollectionDescriptor,
  type FieldAddress,
  type FieldDescriptor,
  type PersistedInputSections,
} from '../../inputCore';

// Ren, framework-fri testkatalog for greenfield-inputkernen. Bygger på ægte sektionsschemas (`satser`,
// `renteberegning`), så XOR- og eksistens-valideringen køres mod den rigtige Zod-kontrakt.

type SatserSection = { aargang: number | undefined };
type RentekravRow = {
  id: string;
  belob: AmountValue | undefined;
  renterFra: ISODateString | undefined;
  tillaegstid: number | undefined;
  enhed: 'dage' | 'uger' | 'maaneder';
};
type RenteberegningSection = {
  beregningsdato: ISODateString | undefined;
  kommentarer: string | undefined;
  rentekravRows: RentekravRow[];
};

const readSatser = (sections: PersistedInputSections): SatserSection | null =>
  sections.satser as SatserSection | null;
const readRente = (sections: PersistedInputSections): RenteberegningSection | null =>
  sections.renteberegning as RenteberegningSection | null;

const ensureRente = (section: RenteberegningSection | null): RenteberegningSection =>
  section ?? { beregningsdato: undefined, kommentarer: undefined, rentekravRows: [] };

const findRowId = (address: FieldAddress): string => {
  const entity = address.path.find((segment) => segment.kind === 'entity');
  if (entity === undefined || entity.kind !== 'entity') throw new Error('testkatalog: adresse mangler entity-led');
  return entity.entityId;
};

// ── Statisk felt: satser.aargang (heltal med range 1900–2100) ────────────────────────────────────────
export const aargangField: FieldDescriptor<number | undefined> = defineField({
  id: 'satser.aargang',
  template: { section: 'satser', path: [], field: 'aargang' },
  codec: createIntegerFieldCodec({ allowNegative: false, minValue: 1900, maxValue: 2100 }),
  emptyValue: undefined,
  label: 'Satsår',
  controlKind: 'text',
  readCanonical: (sections) => readSatser(sections)?.aargang,
  writeCanonical: (sections, _address, value) => ({ ...sections, satser: { aargang: value } }),
});

// ── Statiske felter i renteberegning ─────────────────────────────────────────────────────────────────
export const beregningsdatoField: FieldDescriptor<ISODateString | undefined> = defineField({
  id: 'renteberegning.beregningsdato',
  template: { section: 'renteberegning', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  // Bounds på en CANONICAL værdi (§1.6, anden repræsentation): datoen forbliver canonical, men et afledt
  // rødt issue skjuler den. Modstykke til format/range, der er rejected råtekst.
  validators: [(value) => value !== undefined && value < '2000-01-01'
    ? { reason: 'bounds', code: 'beregningsdato.foer2000', message: 'Beregningsdatoen skal være i år 2000 eller senere' }
    : undefined],
  readCanonical: (sections) => readRente(sections)?.beregningsdato,
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    renteberegning: { ...ensureRente(readRente(sections)), beregningsdato: value },
  }),
});

export const kommentarerField: FieldDescriptor<string | undefined> = defineField({
  id: 'renteberegning.kommentarer',
  template: { section: 'renteberegning', path: [], field: 'kommentarer' },
  codec: optionalTextFieldCodec,
  emptyValue: undefined,
  label: 'Kommentarer',
  controlKind: 'text',
  readCanonical: (sections) => readRente(sections)?.kommentarer,
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    renteberegning: { ...ensureRente(readRente(sections)), kommentarer: value },
  }),
});

// ── Dynamisk collection: rentekravRows ───────────────────────────────────────────────────────────────
export const rentekravRowsCollection: CollectionDescriptor<RentekravRow> = {
  id: 'renteberegning.rentekravRows',
  template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
  getEntityId: (entity) => entity.id,
  readEntities: (sections) => readRente(sections)?.rentekravRows ?? [],
  writeEntities: (sections, _collection, entities) => ({
    ...sections,
    renteberegning: { ...ensureRente(readRente(sections)), rentekravRows: [...entities] },
  }),
};

const updateRow = (
  sections: PersistedInputSections,
  rowId: string,
  update: (row: RentekravRow) => RentekravRow
): PersistedInputSections => {
  const rente = ensureRente(readRente(sections));
  return {
    ...sections,
    renteberegning: {
      ...rente,
      rentekravRows: rente.rentekravRows.map((row) => row.id === rowId ? update(row) : row),
    },
  };
};

const readRow = (sections: PersistedInputSections, rowId: string): RentekravRow | undefined =>
  readRente(sections)?.rentekravRows.find((row) => row.id === rowId);

// ── Child-felter under en rentekrav-række ────────────────────────────────────────────────────────────
export const belobField: FieldDescriptor<AmountValue | undefined> = defineField({
  id: 'renteberegning.rentekravRows.belob',
  template: { section: 'renteberegning', path: [{ kind: 'entity', collection: 'rentekravRows' }], field: 'belob' },
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true, minValue: 0, maxValue: 1_000_000 }),
  emptyValue: undefined,
  label: 'Beløb',
  controlKind: 'text',
  readCanonical: (sections, address) => readRow(sections, findRowId(address))?.belob,
  writeCanonical: (sections, address, value) => updateRow(sections, findRowId(address), (row) => ({ ...row, belob: value })),
});

/**
 * `tillaegstid` er kun relevant, når satsåret IKKE er 2000. Bruges til at teste, at et styrende valg, som
 * gør feltet irrelevant, rydder en aktiv rød feltfejl (§1.9/§3.6) men bevarer en gyldig værdi.
 */
export const tillaegstidField: FieldDescriptor<number | undefined> = defineField({
  id: 'renteberegning.rentekravRows.tillaegstid',
  template: { section: 'renteberegning', path: [{ kind: 'entity', collection: 'rentekravRows' }], field: 'tillaegstid' },
  codec: createIntegerFieldCodec({ allowNegative: false, minValue: 0, maxValue: 100 }),
  emptyValue: undefined,
  label: 'Tillægstid',
  controlKind: 'text',
  relevance: (view) => view.readCanonical(aargangField.bind()) !== 2000,
  readCanonical: (sections, address) => readRow(sections, findRowId(address))?.tillaegstid,
  writeCanonical: (sections, address, value) => updateRow(sections, findRowId(address), (row) => ({ ...row, tillaegstid: value })),
});

export const enhedField: FieldDescriptor<'dage' | 'uger' | 'maaneder'> = defineField({
  id: 'renteberegning.rentekravRows.enhed',
  template: { section: 'renteberegning', path: [{ kind: 'entity', collection: 'rentekravRows' }], field: 'enhed' },
  codec: createRequiredChoiceFieldCodec(['dage', 'uger', 'maaneder']),
  emptyValue: 'dage',
  label: 'Enhed',
  controlKind: 'choice',
  readCanonical: (sections, address) => readRow(sections, findRowId(address))?.enhed ?? 'dage',
  writeCanonical: (sections, address, value) => updateRow(sections, findRowId(address), (row) => ({ ...row, enhed: value })),
});

export const createTestCatalog = () => createInputCatalog({
  fields: [aargangField, beregningsdatoField, kommentarerField, belobField, tillaegstidField, enhedField],
  collections: [rentekravRowsCollection],
});

export const makeRow = (id: string, overrides: Partial<RentekravRow> = {}): RentekravRow => ({
  id,
  belob: undefined,
  renterFra: undefined,
  tillaegstid: undefined,
  enhed: 'dage',
  ...overrides,
});

export const rentekravRowsRef = () => createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });
