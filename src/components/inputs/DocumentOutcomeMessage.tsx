import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Den KANONISKE visning af et dokumentudfald i en contentbox.
 *
 * `DocumentDownloadHandle` leverer korrekt en brugerrettet besked for de udfald, brugeren selv kan gøre noget
 * ved — et stale-afbrud, fordi sagen ændrede sig mens dokumentet blev bygget, eller en utilgængelig
 * DEV-server. Otte dokumentførende flader aktiverede en download uden nogensinde at rendere den besked, så
 * brugeren klikkede på en aktiv knap, fik ingen fil og ingen forklaring. Samtidig fandtes den samme
 * fejlrække i fem forskellige udgaver på de flader, der HUSKEDE at vise den.
 *
 * Komponenten er derfor svaret på begge halvdele: ét sted, der ejer rækkens opbygning, så en ny
 * dokumentførende flade ikke skal genopfinde den — og ikke kan nøjes med at aktivere downloaden.
 *
 * **Hvilken besked skal ind?** Altid `handle.errorMessage` råt. Hook'en har allerede filtreret: en
 * gate-blokering bærer ingen besked, fordi en deaktiveret knap ikke svarer med tekst — årsagen hører
 * kun i knappens tooltip. Fladen skal derfor ikke lægge egen politik oven på feltet, og der findes
 * ikke længere et valg mellem to kilder. Komponenten tager den færdige besked og vælger ikke selv politik.
 *
 * Uventede runtimefejl routes centralt (§A5) og har bevidst ingen lokal tekst i hovedappen. Tilbage står
 * derfor i praksis kun et stale-afbrud og en død DEV-server.
 */
export type DocumentOutcomeMessageProps = Readonly<{
  /** Den færdige besked, eller `null`/`undefined` når der intet er at vise. Komponenten renderer da intet. */
  message: string | null | undefined;
}>;

const DocumentOutcomeMessage = React.memo(({ message }: DocumentOutcomeMessageProps) => {
  if (message === null || message === undefined || message === '') return null;

  return (
    <Box className="row--label-right-hover" data-testid="document-outcome-message">
      <Typography className="row--text" sx={{ color: 'error.main' }}>
        {message}
      </Typography>
      <Box className="row--label-right-hover__content" />
    </Box>
  );
});

DocumentOutcomeMessage.displayName = 'DocumentOutcomeMessage';

export default DocumentOutcomeMessage;
