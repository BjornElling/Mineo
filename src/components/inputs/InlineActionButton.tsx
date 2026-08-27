import * as React from 'react';
import { Button, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';

type InlineActionButtonProps = Readonly<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /**
   * Hvorfor knappen er grå. Vises som tooltip – den ENESTE visningskanal (§11.1). Udled den med
   * `resolveActionGate` frem for at skrive en streng i hånden, så to grå knapper ikke taler hver sit
   * sprog.
   */
  disabledReason?: string;
  tabIndex?: number;
  sx?: SxProps<Theme>;
}>;

/**
 * Knap til en page-lokal hjælpehandling ved siden af et felt (fx «Indsæt» i sygedagpenge-hjælperen).
 *
 * **Deaktiveret tilstand følger den universelle regel for grå knapper** (`page-component-contract.md`
 * §11.1, generaliseret fra downloadknapperne ved udviklerbeslutning 2026-08-15):
 *
 *  - Knappen bliver stående som nedtonet og inaktiv – den forsvinder ikke.
 *  - Årsagen vises KUN i tooltippet, kun ved hover.
 *  - Et klik er TAVST. Ingen besked, ingen tekstknude.
 *
 * `aria-disabled` frem for `disabled`: en `disabled` knap kan ikke fokuseres, og brugeren ville da
 * hverken kunne Tab'e til den eller – på en berøringsflade uden hover – nå årsagen. Med
 * `aria-disabled` bliver knappen i tab-sekvensen og oplyses som utilgængelig, mens `aria-describedby`
 * knytter årsagen til den, så en skærmlæser læser den op. Det lukker det hul, at knappen
 * kunne Tab'es til og Enter-aktiveres, uden at NOGET forklarede, hvorfor der ikke skete noget.
 */
const InlineActionButton = React.memo(({
  children,
  onClick,
  disabled = false,
  disabledReason,
  tabIndex = 0,
  sx,
}: InlineActionButtonProps) => {
  const reasonId = React.useId();
  const hasReason = disabled && disabledReason !== undefined && disabledReason !== '';

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    // Tavs ved blokering: tooltippet har allerede oplyst årsagen (§11.1).
    if (disabled) return;
    onClick();
  }, [disabled, onClick]);

  const button = (
    <Button
      type="button"
      variant="outlined"
      size="small"
      data-mineo-focusable-button="true"
      aria-disabled={disabled ? 'true' : undefined}
      aria-describedby={hasReason ? reasonId : undefined}
      tabIndex={tabIndex}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      sx={mergeSx({
        minWidth: '88px',
        height: '40px',
        borderRadius: '10px',
        px: 2,
        fontFamily: '"Montserrat", sans-serif',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        background: 'var(--color-input-bg)',
        borderColor: 'var(--color-input-border)',
        boxShadow: 'none',
        '&:hover': {
          background: 'var(--color-input-bg)',
          borderColor: 'var(--color-input-border-hover)',
          color: 'var(--color-input-border-focus)',
          boxShadow: 'none',
        },
        '&[aria-disabled="true"]': {
          color: 'var(--color-icon-muted)',
          background: 'var(--color-input-bg)',
          borderColor: 'var(--color-input-border)',
          cursor: 'default',
          // `pointerEvents: 'none'` ville også slå HOVER fra, og tooltippet – årsagens eneste
          // visningskanal – ville aldrig kunne åbnes. Klikket standses i stedet ved at undlade
          // `onClick`, så knappen forbliver hover-bar og dermed forklarlig.
        },
      }, sx)}
    >
      {children}
    </Button>
  );

  if (!hasReason) return button;

  return (
    <Tooltip title={disabledReason} id={reasonId}>
      {/* Wrapper: knappen bevarer sine pointer-events, men en `<span>` giver tooltippen et stabilt
          anker, også hvis knappen senere skulle blive en ægte `disabled`-kontrol. */}
      <span>{button}</span>
    </Tooltip>
  );
});

InlineActionButton.displayName = 'InlineActionButton';

export default InlineActionButton;
