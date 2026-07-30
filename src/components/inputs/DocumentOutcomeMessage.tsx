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
 * **Hvilken besked skal ind?** Se `visibleDocumentFailureMessage`. Viser fladen allerede gate-årsagen ved
 * knappen (som nedtonet tekst), skal den bruge `visibleDocumentFailureMessage(handle)`, så årsagen ikke står
 * to gange. Har fladen kun årsagen i knappens tooltip, skal den bruge `handle.errorMessage` direkte — ellers
 * ville en gate-blokering være usynlig. Komponenten tager den færdige besked og vælger ikke selv politik.
 *
 * Uventede runtimefejl routes centralt (§A5) og har bevidst ingen lokal tekst i hovedappen.
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
