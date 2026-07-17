import { serializeFieldAddress } from '../fieldAddress';
import type { FieldRef } from '../fieldDescriptor';
import type { SettledInput } from '../settledInput';
import type { FieldIssue, FieldIssueSnapshot } from '../inputIssue';
import { activeFieldIssue } from '../inputIssue';
import type { EditorLocation, EditorSettleIntent, SettledFieldView } from './fieldEditorState';
import { settleField, setImmediateField, clearField } from '../inputReducer';
import type {
  SettleFieldCommand,
  SetImmediateFieldCommand,
  ClearFieldCommand,
} from '../inputReducer';
import type { HistoryOrigin } from '../inputHistory';

// Kun de tre felt-scopede commands udstedes herfra; entity-/system-commands ejes af række- og case-portene.
// En præcis command-type (ikke den brede union) undgår den contravariante generiske variansfælde, som
// `dispatchInput`'s løse parametertype allerede beskriver (jf. dispatchInput.ts).
type EditorFieldCommand<T> = SettleFieldCommand<T> | SetImmediateFieldCommand<T> | ClearFieldCommand<T>;

export type EditorDispatch<T> = Readonly<{ command: EditorFieldCommand<T>; origin: HistoryOrigin }>;

// Greenfield-editor-binding (§3.5/§3.6): rene, framework-frie hjælpere, der oversætter mellem den afsluttede
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
  const value = field.descriptor.readCanonical(input.sections, field.address);
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

const originFor = <T>(location: EditorLocation, field: FieldRef<T>): HistoryOrigin =>
  Object.freeze({ field: field.address, editorLocationId: location.locationId });

/**
 * Oversætter et settle-intent til den command + origin, runtime-bindingen dispatcher. `none` (cancel/no-op)
 * giver ingen command. En tom draft udtrykkes eksplicit som `clearField` frem for `settleField(field, '')`:
 * de er ækvivalente gennem reduceren (`defineField` garanterer, at codecet resolver tom tekst til feltets
 * tomværdi), men clear er den semantisk korrekte command for et tomt settle og deler guard-taksonomi med
 * `immediateClearCommand`. Ikke-tom draft går altid gennem `settleField`, så codecet afgør valid/rejected.
 */
export const settleIntentToCommand = <T>(intent: EditorSettleIntent<T>): EditorDispatch<T> | null => {
  if (intent.kind === 'none') return null;
  const origin = originFor(intent.location, intent.field);
  const command: EditorFieldCommand<T> = intent.raw.trim() === ''
    ? clearField(intent.field)
    : settleField(intent.field, intent.raw);
  return Object.freeze({ command, origin });
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
  Object.freeze({ command: setImmediateField(field, value), origin: originFor(location, field) });

/**
 * Delete/Backspace på et lukket, fokuseret felt (§1.3): rydder og committer straks til tomværdien. Guardet på
 * feltets aktuelle view, så et allerede tomt felt uden rejected råinput er `null` (ingen command) — ellers
 * ville et strukturelt tom-write (fx `null`-sektion → `{}`) give en overflødig undo-frame (§3.6, jf. legacy
 * Backspace-guarden). Rydningen sker kun, når der faktisk er en ikke-tom værdi eller en rejected råtekst.
 */
export const immediateClearCommand = <T>(
  field: FieldRef<T>,
  view: SettledFieldView<T>,
  location: EditorLocation
): EditorDispatch<T> | null => {
  const hasSomethingToClear = view.kind === 'rejected' || !field.descriptor.isEmpty(view.value);
  if (!hasSomethingToClear) return null;
  return Object.freeze({ command: clearField(field), origin: originFor(location, field) });
};
