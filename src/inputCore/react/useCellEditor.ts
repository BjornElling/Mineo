import * as React from 'react';
import type { CollectionRef } from '../fieldAddress';
import type { FieldDescriptor, FieldRef } from '../fieldDescriptor';
import type { EditorLocation } from '../editor/fieldEditorState';
import { promoteRowSettleIntentToCommand, promoteRowImmediateCommitToCommand } from '../editor/fieldEditorEngine';
import {
  useFieldEditor,
  type FieldEditorController,
  type ImmediateCommitOverride,
  type SettleCommandOverride,
} from './useFieldEditor';
import type { EditorFocusTarget } from '../runtime/activeEditorRegistry';

// Greenfield-React (§2.5 trin 1 / §3.5): celleeditoren for en grid-celle. En celle er blot et persisteret felt
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
 * En placeholder-celle (§1.11): rækken findes IKKE endnu. `descriptor` + `entity` beskriver den nye række, og
 * `collection` er dens collection. Det første ikke-tomme settle i en placeholder-celle oprettes rækken atomisk;
 * et tomt settle er no-op og opretter ingen række.
 */
export type PlaceholderCell<T, TEntity> = Readonly<{
  kind: 'placeholder';
  descriptor: FieldDescriptor<T>;
  collection: CollectionRef;
  /** Den fuldt formede tom-række-entity (fra row-factory), som `settleFieldInNewRow` indsætter. */
  entity: TEntity;
  /** Placeholder-rækkens stabile entity-id — den bundne cellereference peger på præcis denne kommende række. */
  entityId: string;
  /** Indsættelsesindeks for den nye række (default: sidst). */
  index?: number;
  location: EditorLocation;
}>;

export type CellSpec<T, TEntity = unknown> = ExistingRowCell<T> | PlaceholderCell<T, TEntity>;

/**
 * Den fælles grid-celleeditor. Returnerer den samme controller som et formularfelt (§7.1 — identisk kontrakt),
 * så form- og grid-surfacen kan dele UI-mekanikken i `useFormFieldSurface`. For en placeholder-celle er den
 * bundne `field` cellereferencen for den kommende række (bundet til placeholder-entityens id), så lukket visning,
 * draft-seed og issue-opslag fungerer, allerede før rækken er committet.
 */
export const useCellEditor = <T, TEntity = unknown>(
  cell: CellSpec<T, TEntity>,
  focusTarget?: EditorFocusTarget
): FieldEditorController<T> => {
  const field = React.useMemo<FieldRef<T>>(() => {
    if (cell.kind === 'existing') return cell.field;
    if (cell.entityId.trim() === '') {
      throw new Error('useCellEditor: placeholder-celle skal bære et stabilt, ikke-tomt entity-id');
    }
    return cell.descriptor.bind(cell.entityId);
    // Genberegn kun når celle-spec'et skifter identitet.
  }, [cell]);

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
