import * as React from 'react';
import type { FieldRef } from '../fieldDescriptor';
import type { FieldIssue } from '../inputIssue';
import { useCellEditor, type CellSpec } from './useCellEditor';
import type { FieldEditorController } from './useFieldEditor';
import { useGridCellEditing, useGridCellFocus, useGridCoreApi } from '../../components/tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../components/tables/gridCore/gridCoreTypes';
import { gridCellKey } from '../../components/tables/gridCore/gridCoreUtils';
import { readClipboardText } from '../../utils/clipboardUtils';
import { buildRestoreTargetAttributes, type RestoreTargetAttributes } from './historyRestoreTarget';
import { serializeFieldAddress } from '../fieldAddress';

// Greenfield-React grid-celle-surface (§2.5/§3.5): den ENE UI-mekanik for en persisteret grid-celle. Den
// bro-forbinder de TO redigerings-autoriteter, som en løntabel har:
//
//  1. `GridCoreController` (via StandardGridTable + `tableKeyboardNavigation`, capture-fase) ejer NAVIGATION og
//     edit-ÅBNING: pile/Enter/Tab-celle-nav, to-trins-klik, printbar-tast→edit, Delete-ryd-i-celle og
//     klik-udenfor-commit. Det er en bevidst bevaret surface-mekanik (§2.5 — grid-adapteren ejer navigation),
//     som opererer på DOM + en per-celle `GridCellEditorHandle`.
//  2. `useCellEditor` (den ENE greenfield-editor-motor) ejer DRAFT/COMMIT: åben draft, settle→command, cancel,
//     immediate-clear, rejected-visning og det tokenbundne feltissue (§3.5/§1.8).
//
// Broen: grid-core `openEditing(cell)` → editorens `open()`; editorens `settle()` → grid-core `closeEditing()`.
// Cellen registrerer en `GridCellEditorHandle`, hvis metoder udelukkende delegerer til controlleren, så der
// fortsat kun er ÉN write-grænse (§3.6) og ÉT sæt draft-state. Til forskel fra legacy `useTableInputCore` holder
// dette lag INGEN draftkopi, invalidDrafts-kanal, fingerprint eller epoch-resync — alt det bor i motoren/readeren.

/** Familiespecifikt tegnfilter i åben editor (fx `filterIntegerKeyDown`); kaldes efter Enter/Escape/nav. */
export type GridCellKeyFilter = (e: React.KeyboardEvent<HTMLInputElement>) => void;

export type GridCellSurfaceConfig = Readonly<{
  /** Familiespecifikt tegnfilter i åben editor. */
  keyFilter?: GridCellKeyFilter;
  /** Låst celle: ingen redigering/commit (fx afledte kolonner renderes ikke som celler, så sjældent brugt). */
  locked?: boolean;
}>;

export type GridCellSurface<T> = Readonly<{
  /** Draften i åben tilstand, ellers lukket-visning fra den afsluttede revision (§3.5). Bindes til `<input>`. */
  displayText: string;
  /** Grid-core redigerer denne celle netop nu (edit-open-autoriteten). Styrer `readOnly`. */
  isEditing: boolean;
  /** Grid-core har fysisk fokus på cellen (til placeholder-visning m.m.). */
  isFocused: boolean;
  /** Feltets aktive røde issue fra det tokenbundne snapshot (§1.8). Vises UÆNDRET under redigering (§1.2). */
  issue: FieldIssue | undefined;
  value: T | undefined;
  inputElementRef: React.RefObject<HTMLInputElement | null>;
  /** `readOnly`-flag: sandt når grid-core ikke redigerer cellen. */
  readOnly: boolean;
  /**
   * DOM-attributter, celle-`<input>`'et SKAL bære, så undo/redo-fokusrestoren kan lokalisere præcis denne celle
   * (§3.7): serialiseret feltadresse + editorlokation. Celle-komponenten spreder dem på inputtet.
   */
  restoreTargetAttributes: RestoreTargetAttributes;

  onDraftChange: (nextDraft: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;

  controller: FieldEditorController<T>;
}>;

/**
 * Den delte greenfield grid-celle-surface. `gridCell` er cellens koordinat i grid-core; `cell` er celleeditor-
 * spec'et (eksisterende række eller placeholder, §1.11). Registrerer et `GridCellEditorHandle`, som grid-core-
 * navigationen driver, og oversætter grid-core edit-lifecycle ↔ greenfield-editor-lifecycle.
 */
export const useGridCellSurface = <T, TEntity = unknown>(
  gridCell: GridCellCoord,
  cell: CellSpec<T, TEntity>,
  config: GridCellSurfaceConfig = {}
): GridCellSurface<T> => {
  const { keyFilter, locked = false } = config;
  const gridApi = useGridCoreApi();
  const isEditing = useGridCellEditing(gridCell);
  const isFocused = useGridCellFocus(gridCell);

  const inputElementRef = React.useRef<HTMLInputElement>(null);
  const focusTarget = React.useMemo(
    () => ({ focus: () => inputElementRef.current?.focus({ preventScroll: true }) }),
    []
  );
  const controller = useCellEditor<T, TEntity>(cell, focusTarget);

  // En stabil ref til aktuelle {controller, isEditing, config}, så event-handlere/handle-metoder er stabile.
  const latest = React.useRef({ controller, isEditing, keyFilter, locked });
  latest.current = { controller, isEditing, keyFilter, locked };

  // Den bundne cellereference (til codec-opslag i paste + tast-initieret åbning). Holdes i en ref, så de
  // stabile handlere altid ser den aktuelle celles felt uden at churne.
  const cellFieldRef = React.useRef<FieldRef<T>>(cellFieldOf(cell));
  cellFieldRef.current = cellFieldOf(cell);

  // Undo/redo-fokusrestore-mål (§3.7): serialiseret celle-feltadresse + editorlokation. Genberegnes kun når
  // celle-spec'et skifter identitet (ny række/kolonne), så attribut-objektet er stabilt mellem renders.
  const restoreTargetAttributes = React.useMemo(
    () => buildRestoreTargetAttributes(serializeFieldAddress(cellFieldOf(cell).address), cell.location.locationId),
    [cell]
  );

  const onDraftChange = React.useCallback((nextDraft: string) => {
    latest.current.controller.changeDraft(nextDraft);
  }, []);

  // Tegnfilter i åben editor. Enter/Escape ejes af grid-core-navigationen (capture-fase) og når ikke hertil
  // som edit-taster; vi filtrerer kun almindelige tegn, og kun mens der ikke er en aktiv rød fejl (så en
  // fejlende råtekst kan rettes frit — samme gate som formular-surfacen).
  const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const { controller: ctl, keyFilter: filter } = latest.current;
    if (!ctl.isOpen) return;
    if (!filter) return;
    if (ctl.issue !== undefined) return;
    filter(e);
  }, []);

  // Celle-paste. Brugerbeslutning (2026-07-17): en lukket celle committer det indsatte STRAKS (ingen
  // åbn-med-kladde-fase). En åben celle splicer ind i draften på caret-positionen (som formular-surfacen).
  const onPaste = React.useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const { controller: ctl, locked: isLocked } = latest.current;
    if (isLocked) return;
    const raw = readClipboardText(e);
    const normalize = cellFieldRef.current.descriptor.codec.normalizePaste ?? ((r: string) => r);
    const normalized = normalize(raw);
    e.preventDefault();
    e.stopPropagation();
    if (normalized === '') return;

    if (!ctl.isOpen) {
      // Lukket paste = immediate commit: åbn, seed hele den indsatte tekst som draft, settle straks.
      ctl.open(normalized);
      ctl.settle();
      return;
    }

    const input = inputElementRef.current;
    const draft = ctl.displayText;
    const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
    const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
    ctl.changeDraft(draft.slice(0, start) + normalized + draft.slice(end));
    const nextCaret = start + normalized.length;
    requestAnimationFrame(() => {
      const el = inputElementRef.current;
      if (!el) return;
      try {
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // no-op
      }
    });
  }, []);

  // Bro-retning 2: registrér cellens `GridCellEditorHandle`. Navigationen (capture-fase) kalder disse; hver
  // metode delegerer til den ENE greenfield-controller. `commitCurrent`/`clearAndCommit`/`cancelEdit` lukker
  // grid-core-editingen bagefter, så grid-core-lifecyclen og greenfield-lifecyclen holder trit.
  const editorHandle = React.useMemo<GridCellEditorHandle>(() => ({
    getElement: () => inputElementRef.current,
    getIsLocked: () => latest.current.locked,
    openCurrent: () => {
      if (latest.current.locked || latest.current.controller.isOpen) return;
      latest.current.controller.open();
    },
    commitCurrent: () => {
      if (latest.current.locked) return true;
      // Greenfield settle er altid "succesfuld" ud fra editorens synspunkt: gyldigt/tomt/rejected settle
      // afslutter alle redigeringen (§1.3). En storagefejl holder editoren åben (motoren guarder), men den
      // returnerer ikke et fejlsignal her — grid-core-commit betragtes som gennemført, og en evt. fejl vises
      // via systemfejl-overfladen. Returnér true, så grid-core lukker editingen.
      latest.current.controller.settle();
      gridApi.closeEditing();
      return true;
    },
    clearAndCommit: () => {
      if (latest.current.locked) return;
      // Delete/Backspace på en lukket, fokuseret celle (§1.3): ryd og commit straks.
      latest.current.controller.clearImmediate();
      gridApi.closeEditing();
    },
    cancelEdit: () => {
      if (latest.current.locked) return;
      // Escape (§1.3): luk uden command; den uændrede afsluttede tilstand vises igen.
      latest.current.controller.cancel();
      gridApi.closeEditing();
    },
    prepareEditFromKey: (key: string) => {
      if (latest.current.locked) return false;
      if (!cellFieldRef.current.descriptor.codec.acceptsInitialKey(key)) return false;
      // Tast-initieret åbning (§1.3): editoren seedes med det første tegn (overwrite-all-semantik).
      latest.current.controller.open(key);
      requestAnimationFrame(() => {
        const el = inputElementRef.current;
        if (!el) return;
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {
          // no-op
        }
      });
      return true;
    },
    selectAll: () => {
      const el = inputElementRef.current;
      if (el) {
        el.focus();
        try {
          el.select();
        } catch {
          // no-op
        }
      }
      requestAnimationFrame(() => inputElementRef.current?.select());
    },
  }), [gridApi]);

  const resolvedGridCellKey = gridCellKey(gridCell);
  React.useEffect(() => {
    gridApi.registerEditor(gridCell, editorHandle);
    return () => {
      gridApi.unregisterEditor(gridCell);
    };
    // resolvedGridCellKey er den stabile streng-repræsentation af gridCell; gridCell udelades bevidst (inline
    // object literal i kalderen = ny reference, samme værdi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHandle, gridApi, resolvedGridCellKey]);

  const onBlur = React.useCallback(() => {
    if (!latest.current.controller.isOpen) return;
    latest.current.controller.settle();
    gridApi.closeEditing();
  }, [gridApi]);

  return {
    displayText: controller.displayText,
    isEditing,
    isFocused,
    issue: controller.issue,
    value: controller.value,
    inputElementRef,
    readOnly: !isEditing,
    restoreTargetAttributes,
    onDraftChange,
    onKeyDown,
    onPaste,
    onBlur,
    controller,
  };
};

/**
 * Den bundne `FieldRef` for et celle-spec. BEGGE cellearter bærer den færdigt bundne reference (§3.2), så der
 * findes ikke længere en surface-lokal bindingsregel, der kunne drifte fra tabellens egen.
 */
const cellFieldOf = <T, TEntity>(cell: CellSpec<T, TEntity>): FieldRef<T> => cell.field;
