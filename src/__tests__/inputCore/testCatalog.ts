import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RenteberegningValues, RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { SatserValues } from '../../schemas/formSchemas/sections/satserSchemas';
import type { ISODateString } from '../../types/branded';
import type { CollectionHistoryOrigin } from '../../inputCore/inputHistory';
import type { EditorLocation } from '../../inputCore/editor/fieldEditorState';
import { defineStructuralField } from '../../inputCore/structuralDescriptors';
import { skadestypeEnum } from '../../schemas/formSchemas/enumSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import {
  createInputCatalog,
  defineField,
  createIntegerFieldCodec,
  createAmountFieldCodec,
  createDateFieldCodec,
  createPercentFieldCodec,
  createChoiceFieldCodec,
  booleanFieldCodec,
  optionalTextFieldCodec,
  createRequiredChoiceFieldCodec,
  createCollectionRef,
  catalogFields,
  catalogCollections,
  type CollectionDescriptor,
  type FieldAddress,
  type FieldDescriptor,
  type PersistedInputSections,
} from '../../inputCore';
import { unconstrainedDateBounds } from '../../inputCore/dateBoundsDeclaration';

// Ren, framework-fri testkatalog for greenfield-inputkernen. Bygger på ægte sektionsschemas (`satser`,
// `renteberegning`), så XOR- og eksistens-valideringen køres mod den rigtige Zod-kontrakt.

const readSatser = (sections: PersistedInputSections): SatserValues | null => sections.satser;
const readRente = (sections: PersistedInputSections): RenteberegningValues | null => sections.renteberegning;

const ensureRente = (section: RenteberegningValues | null): RenteberegningValues =>
  section ?? { beregningsdato: undefined, kommentarer: undefined, rentekravRows: [] };

const findRowId = (address: FieldAddress): string => {
  const entity = address.path.find((segment) => segment.kind === 'entity');
  if (entity === undefined || entity.kind !== 'entity') throw new Error('testkatalog: adresse mangler entity-led');
  return entity.entityId;
};

const isUndefined = (value: unknown): boolean => value === undefined;

// ── Statisk felt: satser.aargang (heltal med bounds 1900–2100) ────────────────────────────────────────
// Efter kravændringen 2026-07-18 er 1900..2100 IKKE en codec-afvisning: et velformet årstal uden for
// intervallet committes canonical og bærer et afledt bounds-issue (§1.6). Det gælder også paste-stien.
export const aargangField: FieldDescriptor<number | undefined> = defineField({
  id: 'satser.aargang',
  template: { section: 'satser', path: [], field: 'aargang' },
  codec: createIntegerFieldCodec({ allowNegative: false, minValue: 1900, maxValue: 2100 }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Satsår',
  controlKind: 'text',
  validators: [(value) => value !== undefined && (value < 1900 || value > 2100)
    ? { reason: 'bounds', code: 'satser.aargang.bounds', message: 'Værdi skal være mellem 1900 og 2100', detail: { minValue: 1900, maxValue: 2100 } }
    : undefined],
  readCanonical: (sections) => readSatser(sections)?.aargang,
  writeCanonical: (sections, _address, value) => ({ ...sections, satser: { aargang: value } }),
});

// ── Statiske felter i renteberegning ─────────────────────────────────────────────────────────────────
export const beregningsdatoField: FieldDescriptor<ISODateString | undefined> = defineField({
  id: 'renteberegning.beregningsdato',
  template: { section: 'renteberegning', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  dateBounds: unconstrainedDateBounds('Testfeltet tester inputkernen, ikke en produktgrænse.'),
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
  isEmpty: isUndefined,
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
  isEmpty: isUndefined,
  label: 'Beløb',
  controlKind: 'text',
  validators: [(value) => value !== undefined && value.value !== undefined && (value.value < 0 || value.value > 1_000_000)
    ? { reason: 'bounds', code: 'belob.bounds', message: 'Værdi skal være mellem 0 og 1000000', detail: { minValue: 0, maxValue: 1_000_000 } }
    : undefined],
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
  isEmpty: isUndefined,
  label: 'Tillægstid',
  controlKind: 'text',
  validators: [(value) => value !== undefined && (value < 0 || value > 100)
    ? { reason: 'bounds', code: 'tillaegstid.bounds', message: 'Værdi skal være mellem 0 og 100', detail: { minValue: 0, maxValue: 100 } }
    : undefined],
  relevance: (field, view) => {
    const rowId = findRowId(field.address);
    return view.readCanonical(enhedField.bind(rowId)) !== 'uger';
  },
  readCanonical: (sections, address) => readRow(sections, findRowId(address))?.tillaegstid,
  writeCanonical: (sections, address, value) => updateRow(sections, findRowId(address), (row) => ({ ...row, tillaegstid: value })),
});

export const enhedField: FieldDescriptor<TillaegstidEnhed> = defineField({
  id: 'renteberegning.rentekravRows.enhed',
  template: { section: 'renteberegning', path: [{ kind: 'entity', collection: 'rentekravRows' }], field: 'enhed' },
  codec: createRequiredChoiceFieldCodec<TillaegstidEnhed>(['dage', 'uger', 'maaneder'], 'dage'),
  emptyValue: 'dage',
  isEmpty: () => false,
  label: 'Enhed',
  controlKind: 'choice',
  readCanonical: (sections, address) => readRow(sections, findRowId(address))?.enhed ?? 'dage',
  writeCanonical: (sections, address, value) => updateRow(sections, findRowId(address), (row) => ({ ...row, enhed: value })),
});

/**
 * `renterFra` — datofamiliens RÆKKE-repræsentant.
 *
 * §7.1's fælles feltkontrakt skal køres mod BÅDE form- og grid-adapteren for
 * hver codecfamilie, og `date` havde kun et formularfelt i testkataloget. Uden en celle-udgave kunne
 * kontrakten ikke sammenligne de to adaptere for netop den familie.
 */
export const renterFraField: FieldDescriptor<ISODateString | undefined> = defineField({
  id: 'renteberegning.rentekravRows.renterFra',
  template: { section: 'renteberegning', path: [{ kind: 'entity', collection: 'rentekravRows' }], field: 'renterFra' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Renter fra',
  controlKind: 'text',
  dateBounds: unconstrainedDateBounds('Testfeltet tester inputkernen, ikke en produktgrænse.'),
  readCanonical: (sections, address) => readRow(sections, findRowId(address))?.renterFra,
  writeCanonical: (sections, address, value) =>
    updateRow(sections, findRowId(address), (row) => ({ ...row, renterFra: value })),
});

// ── §7.1's øvrige codecfamilier ──────────────────────────────────────────────────────────────────────
//
// De tre nedenfor findes, så den FÆLLES feltkontrakt kan køres mod begge
// adaptere for hver familie, produktionen har på begge surfaces. De bruger `defineStructuralField`, som
// læser/skriver generisk på adressen, frem for håndskrevne read/write-par: sektionerne (`aarsloen`,
// `stamdata`) er produktionens ægte Zod-schemas, så XOR-, eksistens- og relevansvalideringen fortsat
// kører mod den rigtige kontrakt.

const createEmptyAarsloenSection = (): unknown => ({ tableData: [] });
const createEmptyStamdataSection = (): unknown => ({});

/** Valgmængden læses fra produktionens enum, så testkataloget ikke kan drifte fra den. */
const SKADESTYPE_VALUES = skadestypeEnum.options as readonly Skadestype[];

/** `percent`-familien. */
export const feriePctField: FieldDescriptor<number | undefined> = defineStructuralField<number | undefined>({
  id: 'aarsloen.feriePct',
  template: { section: 'aarsloen', path: [], field: 'feriePct' },
  codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Ferieprocent',
  controlKind: 'text',
  createEmptySection: createEmptyAarsloenSection,
});

/** `boolean`-familien (toggle). */
export const omregningField: FieldDescriptor<boolean> = defineStructuralField<boolean>({
  id: 'aarsloen.omregningTilFuldtAar',
  template: { section: 'aarsloen', path: [], field: 'omregningTilFuldtAar' },
  codec: booleanFieldCodec,
  emptyValue: false,
  isEmpty: () => false,
  label: 'Omregning til fuldt år',
  controlKind: 'toggle',
  createEmptySection: createEmptyAarsloenSection,
});

/** `selection`-familien (optional choice — tom tekst er canonical `undefined`). */
export const skadestypeField: FieldDescriptor<Skadestype | undefined> = defineStructuralField<Skadestype | undefined>({
  id: 'stamdata.skadestype',
  template: { section: 'stamdata', path: [], field: 'skadestype' },
  codec: createChoiceFieldCodec<Skadestype>(SKADESTYPE_VALUES),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Skadestype',
  controlKind: 'choice',
  createEmptySection: createEmptyStamdataSection,
});

export const createTestCatalog = () => createInputCatalog({
  fields: catalogFields(
    aargangField, beregningsdatoField, kommentarerField,
    belobField, tillaegstidField, enhedField, renterFraField,
    feriePctField, omregningField, skadestypeField
  ),
  collections: catalogCollections(rentekravRowsCollection),
});

/** Variant der isoleret tester den produktionsfælles tomrække-livscyklus uden at ændre det generelle feltfixture. */
export const createAutoPruningTestCatalog = () => createInputCatalog({
  fields: catalogFields(
    aargangField, beregningsdatoField, kommentarerField,
    belobField, tillaegstidField, enhedField, renterFraField,
    feriePctField, omregningField, skadestypeField
  ),
  collections: catalogCollections({
    ...rentekravRowsCollection,
    // `enhed='dage'` er rækkens canonical default og må ikke alene holde en ellers tom række i live.
    isEntityEmpty: (row: RentekravRow) =>
      row.belob === undefined && row.renterFra === undefined && row.tillaegstid === undefined,
  }),
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

/**
 * Rækkeorigin til test-fixtures, der SEEDER rækker via `dispatchInput` (§3.7).
 *
 * Strukturelle rækkecommands kræver en origin, så en undo altid har et restore-anker. En test, der blot
 * opsætter en baseline-række, har ingen brugerhandling at pege på — men den skal levere en gyldig origin
 * ligesom produktionen. ÉT delt fixture-origin, så en opblødning af kravet ikke kan gemme sig i en test, der
 * opfandt sin egen halve origin.
 */
export const testRowOrigin = (collection = 'rentekravRows'): CollectionHistoryOrigin => Object.freeze({
  kind: 'collection' as const,
  collection,
  editorLocationId: `test:rows:${collection}`,
  route: '/renteberegning',
  tabKey: null,
});

/**
 * Editorlokation til test-fixtures (§3.2). `route` + `tabKey` er PÅKRÆVEDE på `EditorLocation`, fordi lokationen
 * ejer sin egen fokusdestination. ÉT delt fixture, så et opblødt krav ikke kan gemme sig i en test, der opfandt
 * sin egen halve lokation.
 *
 * Lokationen er NAVIGERBAR som produktionens, og det er ikke en bekvemmelighed: en placeholder-celle promoverer
 * sin række med `settleFieldInNewRow` — en STRUKTUREL command, hvis origin kræver en rigtig route (§3.7,
 * `assertStructuralOrigin`). Et første forsøg gav fixturet en tom "ikke navigerbar" route; det gjorde fire
 * placeholder-tests røde, og runtime havde ret. Fixturet efterligner derfor produktionen frem for at opfinde en
 * svagere variant — præcis grunden til at der kun findes ÉT.
 */
export const testLocation = (locationId: string): EditorLocation => Object.freeze({
  locationId,
  route: '/renteberegning',
  tabKey: null,
});
