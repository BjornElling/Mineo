import React from 'react';
import { Switch, FormControlLabel } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';
import type { StyledToggleSwitchHandle } from '../../types/handles';
import { useShakeFlag } from '../../hooks/useShakeFlag';

type ToggleInputSlotProps = React.InputHTMLAttributes<HTMLInputElement> & {
  'data-mineo-field-address'?: string;
  'data-mineo-editor-location-id'?: string;
};

/**
 * StyledToggleSwitch - Moderne toggle switch med blå farve
 *
 * Bruger MUI's indbyggede Switch komponent med custom styling.
 *
 * Arkitektonisk note (immediate-commit control):
 * - Toggle er en "immediate commit" widget ligesom StyledDropdown
 * - Alle inputveje (klik, Enter, Space) går gennem samme semantiske handling
 * - `onCommit` er den ENESTE og obligatoriske kontrakt
 * - Komponenten er 100% controlled og kræver at parent opdaterer `checked`
 *
 * Keyboard-kontrakt:
 * - Enter og Space toggler switchen (preventDefault + stopPropagation)
 * - Keyboard-toggle går via commitToggle (MUI's native onChange ignoreres for keyboard)
 * - Dette sikrer symmetrisk event-flow for alle inputveje
 * - Container-navigation intercepter ikke Enter/Space for denne widget
 *
 * Features:
 * - Moderne slider-design med rund figur
 * - Blå farve når aktiveret
 * - Kan bruges med eller uden label
 */
interface StyledToggleSwitchProps {
  label?: string;
  /**
   * Controlled state - obligatorisk.
   *
   * Komponenten er 100% controlled og kan ikke fungere uden.
   */
  checked: boolean;
  /**
   * Semantisk commit-handler - obligatorisk.
   *
   * Toggle switches er immediate-commit controls.
   * Kaldes fra alle inputveje: mouse-klik, Enter og Space.
   * Parent SKAL opdatere `checked` som respons på dette callback.
   */
  onCommit: CommitHandler<boolean>;
  disabled?: boolean;
  /** Kun relevant når `label` er angivet. */
  labelPlacement?: 'start' | 'end' | 'top' | 'bottom';
  id?: string;
  name?: string;
  value?: string;
  /** Sættes når togglen bruges uden synligt label (label er placeret som søsker-element).
   *  Giver assistive technologies — og tests — en stabil accessible name. */
  ariaLabel?: string;
  /**
   * Undo/redo-fokusrestore-attributter (§3.7): sættes på input-slottet, så fokus efter undo/redo lander
   * PRÆCIST på denne editorlokation (feltadresse + editorlokation), ikke via `name`.
   * `inputCore/react/fields/ToggleField` og `MappedToggleField` leverer dem.
   */
  restoreTargetAttributes?: Readonly<Record<string, string>>;
}

const StyledToggleSwitch = React.forwardRef<StyledToggleSwitchHandle, StyledToggleSwitchProps>(({
  label,
  checked,
  onCommit,
  disabled = false,
  labelPlacement = 'end',
  id,
  name,
  value,
  ariaLabel,
  restoreTargetAttributes,
}, ref) => {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const resolvedName = name ?? resolvedId;

  // Shake-animation via den kanoniske deklarative hook (timeout + cleanup ejes af hooken).
  const { shake: isShaking, triggerShake } = useShakeFlag();

  // Eksponér shake() metode til parent via ref (immediate-commit-kontrollers imperative handle,
  // jf. mineo-field-pattern.md §"Instant-commit-kontroller"). Muterer ikke committed form-state.
  React.useImperativeHandle(ref, () => ({
    shake: triggerShake,
  }), [triggerShake]);

  /**
   * Én semantisk handling: toggle committed state.
   *
   * Alle inputveje (mouse-klik, Enter, Space) ender her.
   * Følger samme arkitektur som StyledDropdown's `handleSelect`.
   *
   * Guard mod redundante commits: Hvis nextChecked === checked, gør intet.
   * Dette beskytter mod edge cases ved hurtige gentagne keydowns.
   */
  const commitToggle = React.useCallback((nextChecked: boolean) => {
    if (nextChecked === checked) return;
    onCommit(createCommitEvent(nextChecked));
  }, [onCommit, checked]);

  /**
   * Håndter MUI Switch onChange (pointer-input).
   *
   * Ignorerer keyboard-events for at undgå dobbelt-commit.
   * Keyboard-toggle håndteres udelukkende i handleKeyDown.
   *
   * Teknisk note om event-detektion:
   * `event.nativeEvent instanceof KeyboardEvent` er en heuristik, ikke en
   * garanteret API-kontrakt fra React eller MUI. Den virker i praksis på tværs
   * af moderne browsere, men er teknisk set browser-afhængig.
   */
  const handleMuiChange = React.useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    nextChecked: boolean
  ) => {
    // Heuristik: Ignorér keyboard-events (Space håndteres i handleKeyDown)
    if (event.nativeEvent instanceof KeyboardEvent) {
      return;
    }
    commitToggle(nextChecked);
  }, [commitToggle]);

  /**
   * Håndter keyboard-toggle: Enter og Space.
   *
   * Keyboard-kontrakt for immediate-commit widgets:
   * - preventDefault() forhindrer MUI's native toggle og form-submit
   * - stopPropagation() forhindrer Container-navigation
   *
   * Antagelse om synkron state:
   * `!checked` baseres på closure-state, hvilket forudsætter at parent opdaterer
   * `checked` synkront efter onCommit. I Mineos arkitektur (controlled components
   * med synkron state-lifting) er dette altid tilfældet.
   */
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        commitToggle(!checked);
      }
    }
  }, [checked, disabled, commitToggle]);

  const inputSlotProps: ToggleInputSlotProps = {
    id: resolvedId,
    name: resolvedName,
    role: 'checkbox',
    onKeyDown: handleKeyDown,
    'aria-checked': checked,
    ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
    // Undo/redo-restore lokaliserer via feltadresse + editorlokation, ikke `name` (§3.2/§3.7).
    ...(restoreTargetAttributes ?? {}),
  };

  const switchComponent = (
    <Switch
      id={resolvedId}
      checked={checked}
      onChange={handleMuiChange}
      disabled={disabled}
      name={resolvedName}
      value={value}
      slotProps={{
        input: inputSlotProps,
      }}
      sx={{
        margin: 0,
        animation: isShaking ? 'shake 0.5s' : 'none',
        '@keyframes shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
        },
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: 'primary.main',
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          backgroundColor: 'primary.main',
        },
        // Sørg for konsistent focus-visible ring-farve uanset checked-tilstand.
        // (MUI bruger currentColor til focus-ripple; unchecked falder tilbage til en grå tone.)
        '& .MuiSwitch-switchBase.Mui-focusVisible': {
          color: 'primary.main',
        },
        // Synlig fokus-halo bag thumb'en. Dækker BÅDE tab-fokus (.Mui-focusVisible) og
        // undo/redo-restore (data-mineo-undo-focused), så de to tilstande ser ens ud.
        // Nødvendigt fordi MUI's default focus-ripple IKKE udløses af programmatisk focus()
        // (undo/redo) — se historyTargetRestore.ts.
        '& .MuiSwitch-switchBase.Mui-focusVisible .MuiSwitch-thumb, & .MuiSwitch-switchBase:has(.MuiSwitch-input[data-mineo-undo-focused]) .MuiSwitch-thumb': {
          boxShadow: (theme) => `0 0 0 8px ${theme.palette.primary.main}29`,
        },
      }}
    />
  );

  // Hvis der er en label, wrap i FormControlLabel
  if (label) {
    return (
      <FormControlLabel
        control={switchComponent}
        label={label}
        labelPlacement={labelPlacement}
        sx={{
          '& .MuiFormControlLabel-label': {
            color: 'text.primary',
          },
        }}
      />
    );
  }

  // Ellers returner kun switchen
  return switchComponent;
});

StyledToggleSwitch.displayName = 'StyledToggleSwitch';

export default StyledToggleSwitch;
