import React from 'react';
import { Typography } from '@mui/material';

export type TextLinkButtonProps = Readonly<{
  children: React.ReactNode;
  onClick: () => void;
  /**
   * `row` (standard): linket står som sit eget tekstled i en række (fx reparationslinket i «Fejl og
   * advarsler») og bærer derfor rækkens tekstklasse `row--text`.
   * `inline`: linket står midt i en sætning (fx «Mangler (angiv i Stamdata)») og arver den omgivende
   * teksts skrift.
   */
  placement?: 'row' | 'inline';
}>;

/**
 * Det ENE tekstlink, der udfører en handling i Mineo (navigerer til et felt, åbner en dialog) – i
 * modsætning til `ExternalLink`, der åbner en ekstern side og bevidst står uden for Tab-rækkefølgen.
 *
 * Hvorfor en fælles komponent (BB-463/BB-464, TVAERGAAENDE M-08): linkene fandtes som håndsammensatte
 * `<Typography component="button">` på seks flader og som et `<span onClick>` i Stamdata-rækken. Ingen af
 * dem bar Containerens opt-in-markør `data-mineo-focusable-button`, så den app-ejede Tab-ring sprang dem
 * over, og Enter på et fokuseret link faldt igennem til «flyt til næste felt» og landede i sidens første
 * felt frem for at følge linket. Markøren, `type="button"` og den native knap er derfor fastlåst her, så
 * et nyt link ikke kan glemme dem (håndhævet af AST-reglen `a11y/text-link-button-single-source`).
 *
 * Native `<button>` frem for `<span role="button">`: knappen giver aktivering med både Enter og mellemrum
 * uden egen tastaturkode, og Containeren lader Enter på en optaget knap gå til browseren
 * (keyboard-navigation.md, opt-in-listen). Knap-nulstillingen (ramme, baggrund, polstring, skrift)
 * ligger i `typography.css` under `button.icon-text-link`, så linket ser ud som et `<a>`.
 */
const TextLinkButton = React.forwardRef<HTMLButtonElement, TextLinkButtonProps>(
  ({ children, onClick, placement = 'row' }, ref) => (
    <Typography
      ref={ref}
      component="button"
      type="button"
      data-mineo-focusable-button="true"
      // `text-action-button` giver tastaturfokus programmets fælles tekstknap-markering (en tonet flade,
      // layout.css) i stedet for browserens skarpe, sorte standard-outline tæt om bogstaverne.
      className={placement === 'row' ? 'row--text icon-text-link text-action-button' : 'icon-text-link text-action-button'}
      onClick={onClick}
      // En knap er som udgangspunkt `inline-block`; midt i en sætning skal linket flyde med teksten.
      sx={placement === 'inline' ? { display: 'inline' } : undefined}
    >
      {children}
    </Typography>
  )
);

TextLinkButton.displayName = 'TextLinkButton';

export default TextLinkButton;
