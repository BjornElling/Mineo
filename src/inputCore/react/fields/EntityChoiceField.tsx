import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledDropdown, { type StyledDropdownValue } from '../../../components/inputs/StyledDropdown';
import type { CollectionRef } from '../../fieldAddress';
import type { FieldDescriptor } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useCellEditor, type CellSpec } from '../useCellEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

/**
 * Form-dropdown for et felt i en valgfri entity-række. Hvis rækken endnu ikke findes, opretter det første
 * ikke-tomme valg rækken og værdien atomisk gennem celleeditorens generelle placeholder-kommando.
 */
export type EntityChoiceFieldProps<TValue extends StyledDropdownValue, TEntity> = Readonly<{
  descriptor: FieldDescriptor<TValue | undefined>;
  collection: CollectionRef;
  entity: TEntity;
  entityId: string;
  entityExists: boolean;
  location: EditorLocation;
  children?: React.ReactNode;
  placeholder?: string;
  width?: number | string;
  name?: string;
  sx?: SxProps<Theme>;
}>;

export default function EntityChoiceField<TValue extends StyledDropdownValue, TEntity>({ descriptor, collection, entity, entityId, entityExists, location, children, placeholder, width, name, sx }: EntityChoiceFieldProps<TValue, TEntity>) {
  const cell = React.useMemo<CellSpec<TValue | undefined, TEntity>>(
    () => entityExists
      ? { kind: 'existing', field: descriptor.bind(entityId), location }
      : { kind: 'placeholder', descriptor, collection, entity, entityId, location },
    [collection, descriptor, entity, entityExists, entityId, location]
  );
  const controller = useCellEditor(cell);
  // Restore-mål via feltadresse + editorlokation (§3.7): den bundne cellefeltadresse er den samme, useCellEditor
  // binder internt (`descriptor.bind(entityId)`), så fokus efter undo/redo lander på DENNE editorlokation.
  const restoreTargetAttributes = useRestoreTargetAttributes(
    React.useMemo(() => descriptor.bind(entityId).address, [descriptor, entityId]),
    location
  );
  return <StyledDropdown<TValue>
    name={name}
    value={controller.value}
    onChange={(event) => {
      const value = event.target.value;
      if (value === undefined) {
        if (entityExists) controller.clearImmediate();
        return;
      }
      controller.commitImmediate(value);
    }}
    placeholder={placeholder}
    width={width}
    error={controller.issue !== undefined}
    helperText={controller.issue?.message ?? ''}
    restoreTargetAttributes={restoreTargetAttributes}
    sx={sx}
  >{children}</StyledDropdown>;
}
