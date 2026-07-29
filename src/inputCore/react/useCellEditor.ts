import * as React from 'react';
import type { CollectionRef } from '../fieldAddress';
import type { FieldRef } from '../fieldDescriptor';
import type { EditorLocation } from '../editor/fieldEditorState';
import { promoteRowSettleIntentToCommand, promoteRowImmediateCommitToCommand } from '../editor/fieldEditorEngine';
import {
  useFieldEditor,
  type FieldEditorController,
  type ImmediateCommitOverride,
  type SettleCommandOverride,
} from './useFieldEditor';
import type { EditorFocusTarget } from '../runtime/activeEditorRegistry';

// React-laget (§2.5 trin 1 / §3.5): celleeditoren for en grid-celle. En celle er blot et persisteret felt
// bundet til sin rækkes entity-id — så en EKSISTERENDE-række-celle er 1:1 `useFieldEditor` uden nogen særregler
// (samme motor, §7.1). Det eneste grid-specifikke er PLACEHOLDER-promotion (§1.11): en tom, endnu ikke oprettet
// række, hvis første ikke-tomme settle atomisk skal oprette rækken via `settleFieldInNewRow`. Det udtrykkes som
// en ren settle-override på den samme editor — ikke en anden editor og ikke en konkurrerende celle-værdikopi.

/** En eksisterende-række-celle: bundet cellereference for en række, der allerede findes i inputaggregaten. */
export type ExistingRowCell<T> = Readonly<{
  kind: 'existing';
  field: FieldRef<T>;
  location: EditorLocation;
}>;

/**
 * En placeholder-celle (§1.11): rækken findes IKKE endnu. `field` er den FÆRDIGT bundne cellereference for den
 * kommende række, og `collection` + `entity` beskriver rækken, som `settleFieldInNewRow` skal indsætte. Det
 * første ikke-tomme settle i en placeholder-celle opretter rækken atomisk; et tomt settle er no-op og opretter
 * ingen række.
 *
 * `field` er bundet af KALDEREN — ikke af denne hook. Kun den collection-/tabelgrænse, cellen bor i, kender hele
 * ejerstien: en nested collection (fx EO's løntabel under ét ansættelsesforhold) kræver BÅDE ejerens og rækkens
 * entity-id. Ville hooken selv binde ud fra ét `entityId`, ville en placeholder i en nested collection
 * uundgåeligt få en adresse med for få entity-led (§3.2), og `settleFieldInNewRow`-reducerens
 * "feltet tilhører ikke den nye række"-guard ville — i bedste fald — fange det først under brugerhandlingen.
 * Derfor er `FieldRef` den ene cellegrænse for BEGGE cellearter.
 */
export type PlaceholderCell<T, TEntity> = Readonly<{
  kind: 'placeholder';
  /** Den fuldt bundne cellereference for den kommende række (hele ejerstien + placeholder-rækkens entity-id). */
  field: FieldRef<T>;
  collection: CollectionRef;
  /** Den fuldt formede tom-række-entity (fra row-factory), som `settleFieldInNewRow` indsætter. */
  entity: TEntity;
  /** Indsættelsesindeks for den nye række (default: sidst). */
  index?: number;
  location: EditorLocation;
}>;

export type CellSpec<T, TEntity = unknown> = ExistingRowCell<T> | PlaceholderCell<T, TEntity>;

/**
 * Den fælles grid-celleeditor. Returnerer den samme controller som et formularfelt (§7.1 — identisk kontrakt),
 * så form- og grid-surfacen kan dele UI-mekanikken i `useFormFieldSurface`.
 *
 * BEGGE cellearter bærer `field`: den fuldt bundne cellereference. For en placeholder er det referencen for den
 * KOMMENDE række, så lukket visning, draft-seed og issue-opslag fungerer, allerede før rækken er committet.
 * Hooken driver dermed kun det allerede identificerede felt og tilføjer placeholderens atomiske rækkeoprettelse
 * — den konstruerer ingen dataidentitet selv.
 */
export const useCellEditor = <T, TEntity = unknown>(
  cell: CellSpec<T, TEntity>,
  focusTarget?: EditorFocusTarget
): FieldEditorController<T> => {
  // Dataidentiteten er ALLEREDE afgjort af kalderen for begge cellearter — hooken konstruerer den ikke.
  const field: FieldRef<T> = cell.field;

  const settleOverride = React.useMemo<SettleCommandOverride<T> | undefined>(() => {
    if (cell.kind === 'existing') return undefined;
    // Placeholder-promotion: re-router settle til `settleFieldInNewRow` (opret række + skriv felt atomisk).
    return (intent) => promoteRowSettleIntentToCommand(intent, cell.collection, cell.entity, cell.index);
  }, [cell]);

  const immediateCommitOverride = React.useMemo<ImmediateCommitOverride<T> | undefined>(() => {
    if (cell.kind === 'existing') return undefined;
    // Placeholder-promotion for et immediate-valg (§1.11): et dropdown-/toggle-valg på den endnu ikke oprettede
    // række opretter rækken atomisk OG bevarer valget (ellers ville valget falde tilbage til rækkefaktorens default,
    // når en anden celle senere opretter rækken).
    return (value) => promoteRowImmediateCommitToCommand(field, value, cell.collection, cell.entity, cell.location, cell.index);
  }, [cell, field]);

  return useFieldEditor(field, cell.location, focusTarget, settleOverride, immediateCommitOverride);
};
