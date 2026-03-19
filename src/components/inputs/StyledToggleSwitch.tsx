import React from 'react';
import { Switch, FormControlLabel } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';
import type { StyledToggleSwitchHandle } from '../../types/handles';

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
  name?: string;
  value?: string;
}

const StyledToggleSwitch = React.forwardRef<StyledToggleSwitchHandle, StyledToggleSwitchProps>(({
  label,
  checked,
  onCommit,
  disabled = false,
  labelPlacement = 'end',
  name,
  value,
}, ref) => {
  // State for shake-animation
  const [isShaking, setIsShaking] = React.useState(false);

  // Ref til cleanup af shake-timeout
  const shakeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout ved unmount
  React.useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  // Eksponér shake() metode til parent via ref
  React.useImperativeHandle(ref, () => ({
    shake: () => {
      // Idempotent: ignorér hvis animation allerede kører
      if (isShaking) return;

      setIsShaking(true);
      shakeTimeoutRef.current = setTimeout(() => {
        setIsShaking(false);
        shakeTimeoutRef.current = null;
      }, 500);
    }
  }), [isShaking]);

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
   * `checked` synkront efter onCommit. I MINEOs arkitektur (controlled components
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

  const switchComponent = (
    <Switch
      checked={checked}
      onChange={handleMuiChange}
      disabled={disabled}
      name={name}
      value={value}
      slotProps={{
        input: {
          onKeyDown: handleKeyDown,
          'aria-checked': checked,
        },
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
        // Ensure consistent focus-visible ring color regardless of checked state.
        // (MUI uses currentColor for the focus ripple; unchecked defaults to a grey tone.)
        '& .MuiSwitch-switchBase.Mui-focusVisible': {
          color: 'primary.main',
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
