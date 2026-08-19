import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from './ContentBox';
import { hasPageMessage, type PageMessage } from './pageMessage';

/**
 * De to render-veje for en {@link PageMessage} – og de ENESTE.
 *
 * Værnet "vis kun, hvis der ER en besked" ligger HER, i én implementation, frem for håndrullet pr. side. Det er
 * hele grunden til at komponenterne findes: Årsløns tomme "Kritisk Fejl"-boks var en side, der formulerede sit
 * eget værn (`if (!beregningsFejl) return null`) på en værdi, hvor truthiness ikke betød "har indhold". Se
 * {@link ./pageMessage} for den fulde fejlklasse.
 *
 * Fordi input er en `PageMessage`, kan kaldere ikke ramme den forveksling: en tilstedeværende variant BÆRER
 * garanteret ikke-tom tekst, og der findes ingen truthiness-vurdering tilbage at gøre forkert. En tom boks kan
 * ikke længere opstå – heller ikke hvis en fremtidig viewmodel skriver en forkert fallback, for `[]` er ikke en
 * `PageMessage` og bliver afvist af typen ved kildens grænse.
 *
 * Markup i begge veje er ORDRET den, siderne havde før, så samlingen er en ren struktur-ændring uden visuel
 * effekt.
 */

type PageMessageBoxProps = Readonly<{
  /** Boksens overskrift, fx "Kritisk Fejl" eller "Dokument-fejl". */
  title: string;
  message: PageMessage;
  /** Sand for en fejl (rød tekst), falsk for en neutral meddelelse. Default: fejl. */
  isError?: boolean;
}>;

/**
 * En SELVSTÆNDIG meddelelsesboks med overskrift. Renderer intet (ikke engang en tom ramme), når der ingen
 * besked er – modsat en tom `ContentBox`, som ville optage plads og påstå en fejl uden at navngive den.
 */
export const PageMessageBox = React.memo(({ title, message, isError = true }: PageMessageBoxProps) => {
  if (!hasPageMessage(message)) return null;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">{title}</Typography>
      <Typography className="row--text" sx={isError ? { color: 'error.main' } : undefined}>
        {message.text}
      </Typography>
    </ContentBox>
  );
});

PageMessageBox.displayName = 'PageMessageBox';

type PageMessageRowProps = Readonly<{
  message: PageMessage;
  /** Sand for en fejl (rød tekst), falsk for en neutral meddelelse. Default: fejl. */
  isError?: boolean;
  /**
   * Sætter `row--label-right-hover__content` på højre-cellen. Nogle bokse (Specifikationer) havde den klasse,
   * andre en bar `<Box />`. Forskellen bevares her frem for at ensrette markup, så samlingen ikke medfører en
   * utilsigtet visuel ændring.
   */
  rightCellHasContentClass?: boolean;
}>;

/**
 * En besked-RÆKKE til brug INDE i en eksisterende `ContentBox` (fx méngodtgørelses- og rentebokse, hvor
 * fejllinjen står mellem beregningsrækkerne og ikke har sin egen ramme).
 */
export const PageMessageRow = React.memo((
  { message, isError = true, rightCellHasContentClass = false }: PageMessageRowProps
) => {
  if (!hasPageMessage(message)) return null;

  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text" sx={isError ? { color: 'error.main' } : undefined}>
        {message.text}
      </Typography>
      {rightCellHasContentClass ? <Box className="row--label-right-hover__content" /> : <Box />}
    </Box>
  );
});

PageMessageRow.displayName = 'PageMessageRow';
