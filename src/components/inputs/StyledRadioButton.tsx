import React from 'react';
import { Box, Radio, FormControlLabel, RadioGroup, FormLabel, FormControl, Tooltip, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';

/**
 * StyledRadioButton - Moderne radio button med blå farve
 *
 * Bruger MUI's indbyggede Radio og RadioGroup komponenter med custom styling.
 *
 * Features:
 * - Moderne design med rund figur
 * - Blå farve når valgt
 * - Kan bruges individuelt eller i gruppe
 * - Horisontalt eller vertikalt layout
 */
interface RadioOption {
  value: string;
  label: string;
}

interface StyledRadioButtonProps {
  label?: string;
  options?: RadioOption[];
  value?: string | undefined;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, value: string) => void;
  /**
   * Valg er en immediate commit for radio-knapper.
   * Dette giver Mineo-style commit-semantik ud over det native MUI-callback.
   */
  onCommit?: CommitHandler<string | undefined>;
  /**
   * Hvis `true`, understøtter komponenten "intet valg" ved at committe `undefined`.
   *
   * Bemærk: Internt er dette implementeret via en sentinel-streng pr. instans
   * for at opfylde MUI's controlled `value`-kontrakt for `RadioGroup`. Consumere SKAL behandle
   * `undefined` som den eneste "ingen værdi"-tilstand.
   */
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  row?: boolean;
  name?: string;
  error?: boolean;
  helperText?: string;
  /** Kortere hover-tekst end den fulde besked. Se `StyledTextFieldBaseProps.tooltipText`. */
  tooltipText?: string;
  /**
   * Undo/redo-fokusrestore-attributter (§3.7): sættes på den VALGTE radios input-slot, så fokus efter
   * undo/redo lander PRÆCIST på denne editorlokation (feltadresse + editorlokation), ikke via `name`.
   * `inputCore/react/fields/RadioField` leverer dem.
   */
  restoreTargetAttributes?: Readonly<Record<string, string>>;
}

/**
 * Fælles fokus-halo for radio-knapper. Dækker BÅDE tab-fokus (`.Mui-focusVisible`) og
 * undo/redo-restore (`[data-mineo-undo-focused]` sættes på `<input>` af historyTargetRestore),
 * så de to tilstande ser ens ud. Nødvendigt fordi MUI's default focus-ripple IKKE udløses af
 * programmatisk `focus()` (undo/redo) — se `historyTargetRestore.ts` og StyledToggleSwitch.
 */
const RADIO_FOCUS_HALO_SX = {
  padding: '4px',
  '&.Mui-checked': {
    color: 'primary.main',
  },
  // Halo på den runde radio-ikon-figur ved tab-fokus (.Mui-focusVisible på roden) OG ved
  // undo/redo-restore (data-mineo-undo-focused på <input>, som er søsken til ikonet i roden).
  '&.Mui-focusVisible .MuiSvgIcon-root, & input[data-mineo-undo-focused] ~ * .MuiSvgIcon-root, & input[data-mineo-undo-focused] ~ .MuiSvgIcon-root':
    {
      borderRadius: '50%',
      boxShadow: (theme: Theme) => `0 0 0 6px ${theme.palette.primary.main}29`,
    },
} as const;

const StyledRadioButton = React.forwardRef<HTMLDivElement, StyledRadioButtonProps>(({
  label,
  options = [],
  value,
  onChange,
  onCommit,
  allowEmpty = false,
  emptyLabel = '-',
  disabled = false,
  row = false,
  name,
  error = false,
  helperText = '',
  tooltipText,
  restoreTargetAttributes,
}, ref) => {
  const autoId = React.useId();
  const emptyValue = `__mineo_radio_empty__${autoId}`;
  const groupName = name ?? `mineo-radio-${autoId}`;

  const resolvedValue = value ?? emptyValue;

  // Feltidentitets-attributter for den VALGTE radio: serialiseret feltadresse + editorlokation (§3.2/§3.7).
  // Kun den valgte radio bærer dem, så restoren fokuserer den faktisk valgte knap. Returnerer `undefined`,
  // når der intet er at bære (så MUI-slotProps forbliver uberørt).
  const selectedInputSlotProps = React.useMemo(() => {
    const attrs: Record<string, string> = { ...(restoreTargetAttributes ?? {}) };
    return Object.keys(attrs).length === 0
      ? undefined
      : { input: attrs as React.InputHTMLAttributes<HTMLInputElement> };
  }, [restoreTargetAttributes]);
  const showError = error && helperText.trim() !== '';
  const resolvedTooltipText = tooltipText ?? helperText;
  const a11yErrorId = `${emptyValue}-error`;

  if (import.meta.env.DEV) {
    if (options.some((o) => o.value === emptyValue)) {
      throw new Error('StyledRadioButton: empty-value sentinel collided with an option value');
    }
    if (error && helperText.trim() === '') {
      throw new Error('StyledRadioButton: helperText is required when error=true (avoid silent error states)');
    }
  }

  return (
    <FormControl component="fieldset" disabled={disabled} error={error} sx={{ margin: 0 }}>
      {label && (
        <FormLabel
          component="legend"
          sx={{
            fontWeight: 500,
            color: 'text.primary',
            marginBottom: 1,
            '&.Mui-focused': {
              color: 'text.primary',
            },
          }}
        >
          {label}
        </FormLabel>
      )}
      <Tooltip
        title={showError ? resolvedTooltipText : ''}
        arrow
        placement="top"
        disableHoverListener={!showError}
        disableFocusListener={!showError}
        disableTouchListener={!showError}
      >
        <Box
          sx={{
            position: 'relative',
            borderRadius: '10px',
            // Ingen synlig "ramme" omkring radio-grupper i normaltilstand.
            // Behold en gennemsigtig kant for at undgå layout shift når fejl-kanten dukker op.
            border: '1px solid',
            borderColor: showError ? 'var(--color-input-border-error)' : 'transparent',
            padding: 0,
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            '& .MuiFormControlLabel-root': {
              margin: 0,
            },
          }}
        >
          <RadioGroup
            ref={ref}
            value={resolvedValue}
            aria-describedby={showError ? a11yErrorId : undefined}
            onChange={(e, nextValue) => {
              const committedValue = nextValue === emptyValue ? undefined : nextValue;
              if (onCommit) {
                onCommit(createCommitEvent(committedValue));
                return;
              }
              onChange?.(e, nextValue);
            }}
            row={row}
            name={groupName}
            sx={{
              margin: 0,
              minHeight: '40px',
              alignItems: 'center',
              ...(row
                ? {
                    columnGap: '14px',
                  }
                : {
                    rowGap: '6px',
                  }),
            }}
          >
            {allowEmpty && (
              <FormControlLabel
                key={emptyValue}
                value={emptyValue}
                control={
                  <Radio
                    size="small"
                    // Undo/redo-fokus: bær feltidentiteten på den tomme radio når den er valgt
                    // (committed = undefined), så historyTargetRestore kan finde gruppen efter
                    // undo/redo — symmetrisk med de øvrige options nedenfor.
                    slotProps={resolvedValue === emptyValue ? selectedInputSlotProps : undefined}
                    sx={RADIO_FOCUS_HALO_SX}
                  />
                }
                label={<Typography className="row--text">{emptyLabel}</Typography>}
              />
            )}
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={
                  <Radio
                    size="small"
                    // Undo/redo-fokus: bær feltidentiteten på den valgte radio, så
                    // historyTargetRestore kan finde og fokusere gruppen efter undo/redo.
                    slotProps={option.value === resolvedValue ? selectedInputSlotProps : undefined}
                    sx={RADIO_FOCUS_HALO_SX}
                  />
                }
                label={<Typography className="row--text">{option.label}</Typography>}
              />
            ))}
          </RadioGroup>
          {showError && (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {helperText}
            </span>
          )}
        </Box>
      </Tooltip>
    </FormControl>
  );
});

StyledRadioButton.displayName = 'StyledRadioButton';

export default StyledRadioButton;
