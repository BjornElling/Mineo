import React from 'react';
import { Box, Typography } from '@mui/material';
import TextLinkButton from '../inputs/TextLinkButton';

// En SPEJLET stamdata-række: en værdi, siden viser, men som ejes af Stamdata og kun kan rettes dér.
//
// Rækken har tre tilstande, og BB-126 handlede om, at den TREDJE mistede sin vej tilbage:
//
//   1. Værdien findes      → værdien vises.
//   2. Feltet er tomt      → «Mangler (angiv i Stamdata)» MED klikbart link, der navigerer og blinkmarkerer.
//   3. Feltet er ugyldigt  → viste før feltets fulde fejltekst UDEN link – altså netop den tilstand, der
//                            kræver mest af brugeren (en værdi der skal RETTES et andet sted), var den ene
//                            uden anvisning om hvor.
//
// Rækken fandtes i seks nær-identiske kopier (to på Forsørgertab, fire på Varige mén), hver med sin egen
// ternary og sin egen udgave af tilstand 3 – en med `Tooltip` + generisk tekst, en med den rå fejltekst.
// Derfor er den nu ÉN komponent: tilstandene kan ikke længere drifte fra hinanden, og en syvende række
// arver den rigtige adfærd frem for den nærmeste nabos.
//
// Ordlyden i tilstand 3 følger tilstand 2's form efter udviklerens anvisning: kort, med linket til sidst,
// frem for den lange «Der er udfyldt en ugyldig værdi i feltet 'Fødselsdato'». Feltets egen fulde tekst
// er stadig tilgængelig som hover-tekst, så præcisionen ikke går tabt.

export type MirroredStamdataRowProps = Readonly<{
  /** Rækkens navn, som brugeren læser det (fx «Skadelidtes fødselsdato»). */
  label: string;
  /** Den formaterede værdi, når den kan bruges. `undefined` = tom eller ugyldig. */
  value: string | undefined;
  /** Feltets egen fejltekst, når værdien er ugyldig. `undefined` = ikke ugyldig. */
  errorMessage: string | undefined;
  /** Navigerer til Stamdata og blinkmarkerer feltet. Samme handler i begge fejlgrene (BB-126). */
  onNavigate: () => void;
  /** Nedtoning af den forklarende tekst. Rækkerne brugte `text.secondary` og `text.disabled` i flæng. */
  color?: string;
}>;

const STAMDATA_LINK_LABEL = 'Stamdata';

/**
 * Linket til Stamdata. Ét sted, så de to grene ikke kan få hver sin markup – det var netop dét, der lod
 * den røde gren miste linket, mens den tomme beholdt det.
 *
 * Linket var et `<span onClick>` og kunne derfor slet ikke nås med tastaturet (BB-464). Som
 * `TextLinkButton` er det en native knap i Containerens Tab-ring, der aktiveres med Enter og mellemrum.
 */
const StamdataLink = ({ onNavigate }: Readonly<{ onNavigate: () => void }>) => (
  <TextLinkButton placement="inline" onClick={onNavigate}>
    {STAMDATA_LINK_LABEL}
  </TextLinkButton>
);

const MirroredStamdataRow = React.memo(({
  label,
  value,
  errorMessage,
  onNavigate,
  color = 'text.secondary',
}: MirroredStamdataRowProps) => (
  <Box className="row--label-right-hover">
    <Typography className="row--text">{label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ justifyContent: 'flex-end' }}>
      {value !== undefined && errorMessage === undefined ? (
        <Typography className="row--text">{value}</Typography>
      ) : (
        // Begge fejlgrene bærer linket. Forskellen er kun ordet før det: «Ugyldig værdi» mod «Mangler».
        <Typography className="row--text" color={color} {...(errorMessage === undefined ? {} : { title: errorMessage })}>
          {errorMessage === undefined ? 'Mangler' : 'Ugyldig værdi'} (
          {errorMessage === undefined ? 'angiv i' : 'ret i'}&nbsp;{' '}
          <StamdataLink onNavigate={onNavigate} />
          )
        </Typography>
      )}
    </Box>
  </Box>
));

MirroredStamdataRow.displayName = 'MirroredStamdataRow';

export default MirroredStamdataRow;
