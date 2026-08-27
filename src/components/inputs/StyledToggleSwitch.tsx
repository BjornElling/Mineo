import React from 'react';
import { Switch, FormControlLabel } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';
import { accessibleNameAttributes, type AccessibleNameProps } from './accessibleName';

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
 *
 * Tilgængeligt navn (obligatorisk):
 * - Switchen renderes med `role="checkbox"` og SKAL kunne identificeres af skærmlæsere og
 *   rolle-/navn-navigation. Navnet er derfor et krav i typen, ikke en valgfri prop – se
 *   `accessibleName.ts` for hvorfor de to tidligere valgfrie props efterlod 34 af 35
 *   callsites navnløse.
 * - Normalvejen er `visibleLabel`: teksten renderes som kontrollens egen `<label>`, så det viste og
 *   det oplæste er samme streng, og klik på teksten aktiverer switchen.
 */
type StyledToggleSwitchOwnProps = {
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
  /** Kun relevant når `visibleLabel` er angivet. */
  labelPlacement?: 'start' | 'end' | 'top' | 'bottom';
  id?: string;
  name?: string;
  value?: string;
  /**
   * Undo/redo-fokusrestore-attributter (§3.7): sættes på input-slottet, så fokus efter undo/redo lander
   * PRÆCIST på denne editorlokation (feltadresse + editorlokation), ikke via `name`.
   * `inputCore/react/fields/ToggleField` og `MappedToggleField` leverer dem.
   */
  restoreTargetAttributes?: Readonly<Record<string, string>>;
};

type StyledToggleSwitchProps = StyledToggleSwitchOwnProps & AccessibleNameProps;

/**
 * Kontakten har BEVIDST ingen imperativ ref-flade. Den havde tidligere et `StyledToggleSwitchHandle`
 * med præcis ét medlem – `shake()` – som omregnings-gaten kaldte ved en afvist aktivering. Rystelsen
 * er fjernet i hele programmet (udviklerbeslutning 2026-08-15), og dermed bortfaldt hele
 * handlet. Genindfør hverken `forwardRef` eller `useImperativeHandle` her uden et reelt medlem.
 */
const StyledToggleSwitch = (props: StyledToggleSwitchProps) => {
  const {
    checked,
    onCommit,
    disabled = false,
    labelPlacement = 'end',
    id,
    name,
    value,
    restoreTargetAttributes,
  } = props;
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const resolvedName = name ?? resolvedId;
  // Navnet valideres og oversættes til ARIA-attributter ét sted. `visibleLabel` sætter bevidst ingen
  // attribut: navnet kommer fra FormControlLabel's <label>-binding nedenfor.
  const nameAttributes = accessibleNameAttributes(props, `StyledToggleSwitch(${resolvedName})`);
  const { visibleLabel } = props;

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
    ...nameAttributes,
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
        // (undo/redo) – se historyTargetRestore.ts.
        '& .MuiSwitch-switchBase.Mui-focusVisible .MuiSwitch-thumb, & .MuiSwitch-switchBase:has(.MuiSwitch-input[data-mineo-undo-focused]) .MuiSwitch-thumb': {
          boxShadow: (theme) => `0 0 0 8px ${theme.palette.primary.main}29`,
        },
      }}
    />
  );

  // Synlig label: FormControlLabel binder <label> til input'et (htmlFor/id), så teksten BÅDE er
  // kontrollens accessible name og et klikbart mål. Uden binding var teksten kun et søskende-element,
  // og switchen stod navnløs – se accessibleName.ts.
  if (visibleLabel !== undefined) {
    return (
      <FormControlLabel
        control={switchComponent}
        label={visibleLabel}
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
};

StyledToggleSwitch.displayName = 'StyledToggleSwitch';

export default StyledToggleSwitch;
