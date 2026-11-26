import React from 'react';
import { Fab, Tooltip, type SxProps, type Theme } from '@mui/material';
import { mergeSx } from '../../utils/mergeSx';

type FloatingActionButtonProps = {
  onClick: () => void;
  icon: React.ReactNode;
  color?: 'primary' | 'error';
  disabled?: boolean;
  /**
   * Knappens tilgængelige navn OG dens tooltip når handlingen er mulig.
   *
   * Påkrævet: knappen har kun et ikon som barn, så uden dette er den navnløs for en skærmlæser. En
   * `<Tooltip>` udenom er IKKE et navn – MUI sætter `aria-labelledby` på popper-elementet, som kun
   * findes mens tooltippen er åben (se `accessibilityRules.ts`). Navnet sættes derfor eksplicit på
   * selve knappen.
   */
  tooltip: string;
  /**
   * Hvorfor knappen er grå. Vises som tooltip i stedet for `tooltip`, når `disabled` er sand –
   * årsagens ENESTE visningskanal (§11.1). Navnet (`aria-label`) forbliver `tooltip`, så knappens
   * identitet ikke skifter, fordi den midlertidigt er spærret.
   */
  disabledReason?: string;
  sx?: SxProps<Theme>;
};

/**
 * Flydende rund action-knap (`Tilføj`, `Flyt op`, `Flyt ned`, `Slet …` på et kort).
 *
 * **Deaktiveret tilstand følger den universelle regel for grå knapper** (`page-component-contract.md`
 * §11.1): knappen bliver stående som nedtonet og reelt inaktiv, årsagen vises kun i tooltippet, og et
 * klik er tavst.
 *
 * **Knapper ryster ikke** (bevidst valg; kun toggles gør, jf. §11.1). En knap, der ryster ved klik, MENS
 * den fremstår aktiv (kun visuelt dæmpet, ikke slået fra), giver to modstridende svar på samme klik og
 * oplyser knappen som brugbar for en skærmlæser. Knappen er ægte `disabled` med årsagen i tooltippet.
 * Genindfør ikke en shake-prop her.
 */
/**
 * Et klik, der er 2. (eller senere) klik i samme dobbeltklik, udløser ikke handlingen.
 *
 * Kortenes handlinger flytter sig, når de virker: «Tilføj» lægger et nyt kort ind, så det forrige korts
 * «Flyt op»/«Flyt ned» havner præcis under markøren, og «Flyt op» flytter kortet, så nabokortets tilsvarende
 * knap overtager pladsen. Andet klik i et dobbeltklik rammer derfor en ANDEN knap eller et ANDET kort end det,
 * brugeren sigtede efter – et eksisterende kort skifter plads, uden at brugeren har bedt om det.
 *
 * `MouseEvent.detail` er browserens klikantal på samme sted inden for dobbeltklik-intervallet: 1 ved et
 * enkeltklik, 2 ved andet klik i et dobbeltklik – og 0 ved tastaturaktivering (Enter/mellemrum), som derfor
 * altid virker. Et nyt, særskilt klik efter intervallet har igen `detail` 1 og flytter kortet videre.
 */
const isRepeatClickOfSameGesture = (event: React.MouseEvent): boolean => event.detail >= 2;

const FloatingActionButton = React.memo(({
  onClick,
  icon,
  color = 'primary',
  disabled = false,
  tooltip,
  disabledReason,
  sx,
}: FloatingActionButtonProps) => {
  const tooltipText = disabled ? disabledReason ?? tooltip : tooltip;

  const button = (
    <Fab
      color={color}
      // Navnet er stabilt og følger handlingen, ikke blokeringstilstanden.
      aria-label={tooltip}
      onClick={disabled ? undefined : (event) => {
        if (isRepeatClickOfSameGesture(event)) return;
        onClick();
      }}
      disabled={disabled}
      sx={mergeSx({
        width: 56,
        height: 56,
        boxShadow: disabled ? 'none' : 6,
        transition: 'all 0.2s ease',
        backgroundColor: disabled ? 'action.disabledBackground' : undefined,
        '&:hover': disabled ? {} : {
          boxShadow: 12,
          transform: 'scale(1.05)',
        },
      }, sx)}
    >
      {icon}
    </Fab>
  );

  return (
    <Tooltip title={tooltipText} arrow placement="top">
      {/* En `disabled` MUI-knap udsender ingen pointer-events, så tooltippen skal ankres på en
          wrapper. Uden den ville årsagen – knappens eneste forklaring – være uopnåelig præcis når
          den er relevant. */}
      <span>{button}</span>
    </Tooltip>
  );
});

FloatingActionButton.displayName = 'FloatingActionButton';

export default FloatingActionButton;
