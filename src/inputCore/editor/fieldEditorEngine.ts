import { serializeFieldAddress } from '../fieldAddress';
import type { FieldRef } from '../fieldDescriptor';
import type { SettledInput } from '../settledInput';
import type { FieldIssue, FieldIssueSnapshot } from '../inputIssue';
import { activeFieldIssue } from '../inputIssue';
import type { EditorLocation, EditorSettleIntent, SettledFieldView } from './fieldEditorState';
import { settleField, setImmediateField, clearField, settleFieldInNewRow } from '../inputReducer';
import type {
  SettleFieldCommand,
  SetImmediateFieldCommand,
  ClearFieldCommand,
  SettleFieldInNewRowCommand,
  StructuralTransactionCommand,
} from '../inputReducer';
import type { CollectionRef } from '../fieldAddress';
import type { FieldHistoryOrigin } from '../inputHistory';

// Kun de tre felt-scopede commands udstedes herfra; entity-/system-commands ejes af række- og case-portene.
// En præcis command-type (ikke den brede union) undgår den contravariante generiske variansfælde, som
// `dispatchInput`'s løse parametertype allerede beskriver (jf. dispatchInput.ts).
// `settleFieldInNewRow` er editorens ENESTE entity-command (§1.11): den atomiske placeholder-promotion, hvor
// det første ikke-tomme settle i en tom række-placeholder opretter rækken OG skriver feltet i én transaktion.
type EditorFieldCommand<T> =
  | SettleFieldCommand<T>
  | SetImmediateFieldCommand<T>
  | ClearFieldCommand<T>
  | SettleFieldInNewRowCommand<unknown, T>;

export type EditorDispatch<T> = Readonly<{
  command: EditorFieldCommand<T> | StructuralTransactionCommand;
  origin: FieldHistoryOrigin;
}>;

// Editor-bindingen (§3.5/§3.6): rene, framework-frie hjælpere, der oversætter mellem den afsluttede
// revision og editor-state-machinen. De rører ikke React, DOM eller storage — de læser et immutabelt
// `SettledInput`-snapshot og udsteder de commands, runtime-bindingen sender til `dispatchInput`.

/**
 * Afleder den lukkede visning UDELUKKENDE fra det afsluttede input (§3.5): står feltet som rejected råtekst,
 * vises den ordret; ellers vises den canonical værdi. `readCanonical` ejes af descriptoren, så visningen aldrig
 * afhænger af en lokal draftkopi.
 */
export const deriveSettledFieldView = <T>(input: SettledInput, field: FieldRef<T>): SettledFieldView<T> => {
  const rejected = input.rejectedInputs[serializeFieldAddress(field.address)];
  if (rejected !== undefined) return Object.freeze({ kind: 'rejected', rejected });
  const raw = field.descriptor.readCanonical(input.sections, field.address);
  // `readCanonical` returnerer `undefined` for et fravær (fx en endnu ikke oprettet `null`-sektion) og anvender
  // BEVIDST ikke feltets `emptyValue` (§3.4-renhed). Den lukkede visning skal derimod vise feltets canonical
  // TOMVÆRDI ved fravær: for et optionelt felt er tomværdien selv `undefined` (uændret), men for et påkrævet
  // valg (fx `tillaegAngivesSom`→'procent', `loenperiode`→'maaned') er tomværdien den gyldige default. Uden dette
  // ville en fresh/`Slet alt`-sag (alle sektioner `null`) give `undefined` til en påkrævet-valg-control og få den
  // til at kaste. Fald derfor tilbage til descriptorens `emptyValue`, når den canonical læsning er `undefined`.
  const value = raw === undefined ? field.descriptor.emptyValue : raw;
  return Object.freeze({ kind: 'canonical', value });
};

/**
 * Den viste tekst i lukket tilstand (§3.5): rejected råtekst ordret eller `codec.format` af den canonical
 * værdi. Bruges af UI-basen; parsing/formatering ligger aldrig i adapteren.
 */
export const formatSettledFieldText = <T>(field: FieldRef<T>, view: SettledFieldView<T>): string =>
  view.kind === 'rejected' ? view.rejected.raw : field.descriptor.codec.format(view.value);

/**
 * Feltets aktive røde issue fra det tokenbundne snapshot (§1.8). Vises uændret UNDER redigering (§1.2): den
 * åbne draft driver aldrig fejlfeedback, så editoren læser issuet fra den afsluttede revision, ikke draften.
 */
export const activeFieldIssueFor = <T>(
  issues: FieldIssueSnapshot,
  field: FieldRef<T>
): FieldIssue | undefined => activeFieldIssue(issues, serializeFieldAddress(field.address));

// Felteditorens origin er ALTID en feltorigin — også for de to promoveringsveje (`settleFieldInNewRow` og
// `insertRow` fra et immediate-commit-valg). En promovering er kontraktligt et FELT-settle (§3.8), og undo
// skal derfor fokusere den celle, brugeren skrev i — ikke blot navigere til tabellen.
export const buildFieldHistoryOrigin = <T>(
  location: EditorLocation,
  field: FieldRef<T>
): FieldHistoryOrigin => Object.freeze({
  kind: 'field' as const,
  field: field.address,
  editorLocationId: location.locationId,
  // Route/fane bæres videre som eksplicit navigation-metadata (§3.7), så undo/redo-restoren kan finde tilbage
  // til den rette side/fane. Begge er PÅKRÆVEDE på `EditorLocation`, så destinationen er altid
  // komplet — den tidligere `route === undefined`-gren dækkede en tilstand, typen ikke længere tillader.
  route: location.route,
  tabKey: location.tabKey,
});


/**
 * Oversætter et settle-intent til den command + origin, runtime-bindingen dispatcher. `none` (cancel/no-op)
 * giver ingen command. En tom draft udtrykkes eksplicit som `clearField` frem for `settleField(field, '')`:
 * de er ækvivalente gennem reduceren (`defineField` garanterer, at codecet resolver tom tekst til feltets
 * tomværdi), men clear er den semantisk korrekte command for et tomt settle og deler guard-taksonomi med
 * `immediateClearCommand`. Ikke-tom draft går altid gennem `settleField`, så codecet afgør valid/rejected.
 */
export const settleIntentToCommand = <T>(intent: EditorSettleIntent<T>): EditorDispatch<T> | null => {
  if (intent.kind === 'none') return null;
  const origin = buildFieldHistoryOrigin(intent.location, intent.field);
  const command: EditorFieldCommand<T> = intent.raw.trim() === ''
    ? clearField(intent.field)
    : settleField(intent.field, intent.raw);
  return Object.freeze({ command, origin });
};

/**
 * Placeholder-promotion (§1.11): oversætter et settle-intent på en IKKE-eksisterende række-placeholder til én
 * atomisk `settleFieldInNewRow`-command, der opretter rækken og skriver feltet i samme transaktion. Et tomt
 * settle på placeholderen er `null` (no-op — et rent fokus+blur på en tom placeholder opretter ingen række).
 *
 * `field` er den FÆRDIGT bundne cellereference for den nye række (bundet til placeholderens entity-id), og
 * `entity` er den fulde placeholder-entity, `insertRow`-siden af transaktionen indsætter. Reduceren verificerer,
 * at feltet tilhører netop den nye række.
 */
export const promoteRowSettleIntentToCommand = <TEntity, TField>(
  intent: EditorSettleIntent<TField>,
  collection: CollectionRef,
  entity: TEntity,
  index?: number
): EditorDispatch<TField> | null => {
  if (intent.kind === 'none') return null;
  if (intent.raw.trim() === '') return null;
  return Object.freeze({
    command: settleFieldInNewRow(collection, entity, intent.field, intent.raw, index),
    origin: buildFieldHistoryOrigin(intent.location, intent.field),
  });
};

/**
 * Immediate-commit for choice/toggle (§1.3/§3.6): dropdownvalg og toggle committer straks uden en cancel-fase.
 * Bruger `setImmediateField`, så reduceren kan køre den styrende-valg-oprydning (§3.6) atomisk.
 */
export const immediateCommitCommand = <T>(
  field: FieldRef<T>,
  value: T,
  location: EditorLocation
): EditorDispatch<T> =>
  Object.freeze({ command: setImmediateField(field, value), origin: buildFieldHistoryOrigin(location, field) });

/**
 * Placeholder-promotion for et IMMEDIATE-COMMIT-valg (§1.11): et dropdown-/toggle-valg i en endnu ikke oprettet
 * placeholder-række opretter rækken atomisk OG skriver valget i samme transaktion, via `settleFieldInNewRow` med
 * valgets codec-formaterede råtekst. Modstykket til {@link promoteRowSettleIntentToCommand} for immediate-controls,
 * så fx et enhed-valg på den tomme trailing række bevares (i stedet for at falde tilbage til rækkefaktorens default,
 * når en anden celle senere opretter rækken).
 */
export const promoteRowImmediateCommitToCommand = <TEntity, TField>(
  field: FieldRef<TField>,
  value: TField,
  collection: CollectionRef,
  entity: TEntity,
  location: EditorLocation,
  index?: number
): EditorDispatch<TField> =>
  Object.freeze({
    command: settleFieldInNewRow(collection, entity, field, field.descriptor.codec.format(value), index),
    origin: buildFieldHistoryOrigin(location, field),
  });

/**
 * Delete/Backspace på et lukket, fokuseret felt (§1.3): rydder og committer straks til tomværdien. Guardet på
 * feltets aktuelle view, så et allerede tomt felt uden rejected råinput er `null` (ingen command) — ellers
 * ville et strukturelt tom-write (fx `null`-sektion → `{}`) give en overflødig undo-frame (§3.6).
 * Rydningen sker kun, når der faktisk er en ikke-tom værdi eller en rejected råtekst.
 */
export const immediateClearCommand = <T>(
  field: FieldRef<T>,
  view: SettledFieldView<T>,
  location: EditorLocation
): EditorDispatch<T> | null => {
  const hasSomethingToClear = view.kind === 'rejected' || !field.descriptor.isEmpty(view.value);
  if (!hasSomethingToClear) return null;
  return Object.freeze({ command: clearField(field), origin: buildFieldHistoryOrigin(location, field) });
};
