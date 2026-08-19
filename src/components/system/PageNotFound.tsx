import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';

/**
 * 404-siden – en almindelig Mineo-side, ikke en blindgyde.
 *
 * Den var tidligere en helt hvid flade med to linjer sort tekst i øverste venstre hjørne, renderet
 * UDEN for shellen: ingen sidemenu, ingen knap, intet link, ingen programfarver. Sagen lå uskadt i
 * fanens hukommelse, men det kunne brugeren ikke vide – skærmen så ud, som om programmet var væk. En
 * bruger, der nåede hertil med en times arbejde i sagen, havde god grund til at tro, det var tabt, og
 * den eneste vej tilbage (browserens tilbage-knap eller at rette adressen i hånden) blev ikke nævnt.
 *
 * Derfor to ting: siden ligger nu inde i shellen, så sidemenuen står i venstre side og ER vejen
 * videre, og teksten siger eksplicit, at sagen er uændret. Den er den ENESTE oplysning, der ikke kan
 * læses af skærmen selv.
 *
 * **Adressen vises bevidst ikke længere.** Den var den halve skærm i den gamle udgave, men den er
 * brugerens eget input, gengivet uden at kunne bruges til noget – den hjælper ingen videre, og en
 * fejlskrevet adresse er allerede synlig i browserens adressefelt.
 *
 * To rækkevidde-forhold, som denne side hviler på og derfor ikke må brydes:
 *
 *  1. **Den kan ikke nås uden om login.** Alle routes – katalogets sider OG denne catch-all – ligger
 *     inde i `App`, som `AuthGate` først monterer, når login-flaget er sat. En ukendt adresse rammer
 *     altså login-siden, præcis som en kendt gør; 404-siden er ikke en genvej ind bag gaten.
 *  2. **Den findes ikke på mobil.** `bootstrapClientApp` renderer `UnsupportedDevicePage` og
 *     returnerer FØR `renderApp`, så React Router aldrig monteres på telefon og tablet. Mobilbrugeren
 *     får derfor fortsat udelukkende sin egen «Desværre»-side, uanset hvilken adresse han åbner.
 */
const PageNotFound = React.memo(() => {
  const location = useLocation();

  // Adressen bruges ikke i visningen, men hører i tilgængelighedsnavnet, så en skærmlæser-bruger og
  // en fejlrapport kan se HVILKEN adresse der fejlede uden at gætte.
  const accessibleName = `Siden findes ikke: ${location.pathname}`;

  return (
    <Box sx={{ padding: 4 }} role="region" aria-label={accessibleName}>
      <Typography variant="h5" sx={{ marginBottom: 2 }}>
        Siden findes ikke
      </Typography>
      <Typography variant="body2">
        Din sag er uændret; vælg en side i menuen.
      </Typography>
    </Box>
  );
});

PageNotFound.displayName = 'PageNotFound';

export default PageNotFound;
