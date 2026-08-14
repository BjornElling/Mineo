import React from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';

type StyledCheckboxProps = Readonly<{
  checked: boolean;
  onCommit: CommitHandler<boolean>;
  label: React.ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  /**
   * Permanent tilvalg: feltet er ikke redigerbart, men er — modsat `disabled` — ALTID markeret.
   * `disabled` betyder «programinaktiv», og et programinaktivt felt vises bevidst umarkeret (se
   * `visibleChecked`). Et element, der pr. definition altid indgår, er den modsatte tilstand og kan
   * derfor ikke udtrykkes med `disabled` alene. Låst-til er en ren visning: den committer aldrig, så
   * feltets afsluttede værdi ændres ikke af, at fladen låser den.
   */
  lockedOn?: boolean;
  size?: 'small' | 'medium';
  /**
   * Undo/redo-fokusrestore-attributter (§3.7): sættes på checkbox-input-slottet, så fokus efter undo/redo
   * lander PRÆCIST på denne editorlokation (feltadresse + editorlokation), ikke via `name`.
   * `inputCore/react/fields/CheckboxField` leverer dem.
   */
  restoreTargetAttributes?: Readonly<Record<string, string>>;
}>;

const StyledCheckbox = ({
  checked,
  onCommit,
  label,
  id,
  name,
  disabled = false,
  lockedOn = false,
  size = 'small',
  restoreTargetAttributes,
}: StyledCheckboxProps) => {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const resolvedName = name ?? resolvedId;
  // Et låst-til felt indgår altid og vises derfor markeret, uanset den afsluttede værdi.
  // Ellers gælder: en programinaktiv checkbox må ikke fremstå som et aktivt tilvalg. Den afsluttede
  // værdi bevares i inputkernen og vises igen, når programmet genaktiverer feltet.
  const interactionDisabled = disabled || lockedOn;
  // Programinaktivitet vinder over låst visning, hvis kombinationen nogensinde slipper gennem en
  // lavere komponentgrænse: et inaktuelt valg må aldrig fremstå som valgt.
  const visibleChecked = disabled ? false : lockedOn ? true : checked;

  const commitChecked = React.useCallback(
    (nextChecked: boolean) => {
      // Låst-til er kun visning: den må aldrig skrive en værdi tilbage til feltet.
      if (lockedOn) return;
      if (nextChecked === checked) return;
      onCommit(createCommitEvent(nextChecked));
    },
    [checked, lockedOn, onCommit]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, nextChecked: boolean) => {
      if (event.nativeEvent instanceof KeyboardEvent) {
        return;
      }
      commitChecked(nextChecked);
    },
    [commitChecked]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (!interactionDisabled) {
        commitChecked(!checked);
      }
    },
    [checked, commitChecked, interactionDisabled]
  );

  return (
    <FormControlLabel
      control={(
        <Checkbox
          id={resolvedId}
          name={resolvedName}
          checked={visibleChecked}
          onChange={handleChange}
          disabled={interactionDisabled}
          size={size}
          slotProps={{
            // Feltidentitet i DOM: serialiseret feltadresse + editorlokation (§3.2/§3.7), sat af
            // feltfamilien og videreført her. Checkboxen er en immediate-commit widget, så restoren skal
            // kunne finde den uden forudgående fokus — men identiteten er adressen, ikke `name`.
            // Transiente checkboxes (fx app-settings på Indstillinger) har ingen feltadresse og deltager
            // ikke i restoren. Cast som StyledRadioButton: MUI's slotProps-type tillader ikke
            // data-attributter direkte.
            input: {
              id: resolvedId,
              name: resolvedName,
              onKeyDown: handleKeyDown,
              'aria-checked': visibleChecked,
              ...(restoreTargetAttributes ?? {}),
            } as React.InputHTMLAttributes<HTMLInputElement>,
          }}
        />
      )}
      label={label}
      sx={{
        marginRight: 1,
        '& .MuiFormControlLabel-label': {
          fontFamily: 'var(--font-family-base)',
          fontSize: '15px',
          fontWeight: 'var(--font-weight-regular)',
          lineHeight: 'var(--line-height-base)',
          color: 'var(--mineo-color-row-text)',
        },
      }}
    />
  );
};

StyledCheckbox.displayName = 'StyledCheckbox';

export default StyledCheckbox;
