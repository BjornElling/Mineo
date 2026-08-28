import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledDropdown, { type StyledDropdownValue } from '../../../components/inputs/StyledDropdown';
import type { CollectionRef } from '../../fieldAddress';
import type { FieldDescriptor } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useCellEditor, type CellSpec } from '../useCellEditor';
import { collectionOwnerEntityIds } from '../../collectionCellBinding';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';
import { resolveFieldIssueText } from '../fieldIssueText';
import { useFieldLabel } from '../useFieldLabel';

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
  /** Visningstekst for en option med rig markup – se `GridChoiceCellProps.getOptionLabel`. */
  getOptionLabel?: (value: TValue) => string;
  sx?: SxProps<Theme>;
}>;

export default function EntityChoiceField<TValue extends StyledDropdownValue, TEntity>({ descriptor, collection, entity, entityId, entityExists, location, children, placeholder, width, name, getOptionLabel, sx }: EntityChoiceFieldProps<TValue, TEntity>) {
  // Én cellebinding for begge arter (§3.2): feltet bindes HÉR med hele ejerstien fra collectionen efterfulgt af
  // entityens id, så en eksisterende og en endnu ikke oprettet entity aldrig kan få forskellig adressestruktur.
  const field = React.useMemo(
    () => descriptor.bind(...collectionOwnerEntityIds(collection), entityId),
    [collection, descriptor, entityId]
  );
  const cell = React.useMemo<CellSpec<TValue | undefined, TEntity>>(
    () => entityExists
      ? { kind: 'existing', field, location }
      : { kind: 'placeholder', field, collection, entity, location },
    [collection, entity, entityExists, field, location]
  );
  const controller = useCellEditor(cell);
  // Restore-mål via feltadresse + editorlokation (§3.7): samme bundne cellefeltadresse som editoren driver, så
  // fokus efter undo/redo lander på DENNE editorlokation.
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
  const issueText = resolveFieldIssueText(controller.issue);
  // Feltnavnet kommer fra den ENE autoritet, også for en endnu ikke oprettet række: et navn er metadata
  // om feltet, ikke dets værdi, så `labelOf` kræver ikke en eksisterende entity (§3.2a).
  const accessibleName = useFieldLabel(field);
  return <StyledDropdown<TValue>
    ariaLabel={accessibleName}
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
    expectedOptionValues={descriptor.codec.options}
    {...(getOptionLabel === undefined ? {} : { getOptionLabel })}
    error={issueText.message !== undefined}
    helperText={issueText.message ?? ''}
    {...(issueText.tooltip === undefined ? {} : { tooltipText: issueText.tooltip })}
    restoreTargetAttributes={restoreTargetAttributes}
    sx={sx}
  >{children}</StyledDropdown>;
}
