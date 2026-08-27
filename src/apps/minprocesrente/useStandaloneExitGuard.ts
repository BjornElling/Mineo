import React from 'react';
import { useSettledSnapshot } from '../../inputCore/react';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import type { DocumentOutcome } from '../../document/definition/documentOutcome';

/**
 * Standalone MinProcesrentes advarsel, før fanen lukkes med arbejde, der ikke er hentet.
 *
 * **Hvorfor fladen har brug for den.** Standalone har hverken Gem, Hent eller filformat, så det
 * eneste varige spor af en halv times arbejde er den PDF, brugeren måtte have hentet. Fanen lukkede
 * uden spørgsmål, og alt var væk – mens søskendefladen Mineo i samme situation viser browserens «vil
 * du forlade siden?». Forskellen er ikke synlig for den offentlige besøgende, og han har ingen grund
 * til at forvente, at der ikke er noget net under (BB-048). Bemærk at F5 er sikker i forvejen:
 * indtastningerne ligger i fanens egen sessionslagring og kommer tilbage.
 *
 * **Hvad der udløser advarslen.** Præcis det samme grundlag som Mineos: den afsluttede revision målt
 * mod en baseline. Forskellen er, hvad der flytter baselinen. I Mineo er det en `.eo`-save; her er det
 * en gennemført download, jf. udviklerens regel: advarslen skal kun komme, når der er indtastninger, som
 * ikke er hentet som PDF siden sidste ændring. Den, der lige har hentet sit dokument, generes altså
 * ikke – men taster han videre bagefter, er der igen noget at miste, og advarslen kommer tilbage af sig
 * selv, fordi revisionen så er højere end baselinen.
 *
 * Guard-hooken selv er GENBRUGT frem for kopieret: beslutningen «revision > baseline ⇒ advar», dens
 * nulstilling ved en autoritativ erstatning og `beforeunload`-lyttterens livscyklus er den samme regel
 * på begge flader, og to kopier af den ville kunne drifte fra hinanden.
 */
/**
 * Registrerer et gennemført hent, så baselinen flytter. Et afvist eller fejlet forsøg gør det IKKE:
 * brugeren har da ikke fået sin fil, og der er stadig noget at miste.
 *
 * **Guarden er ÉN pr. flade, ikke én pr. output.** Trackeren gives derfor videre til de tre
 * dokumenthandles frem for at hvert handle monterer sin egen guard. Med tre guards ville der være tre
 * uafhængige baselines og tre `beforeunload`-lyttere: et hent af oversigten ville ikke rydde
 * rækkespecifikationens baseline, og fanen ville advare om arbejde, brugeren netop havde hentet.
 * Advarslen er en egenskab ved SIDEN – der er én fane at lukke – og hører derfor sammen med sidens
 * ene revision.
 */
export type StandaloneDownloadTracker = (outcome: DocumentOutcome) => void;

export const useStandaloneExitGuard = (): StandaloneDownloadTracker => {
  const { revision, replacementGeneration } = useSettledSnapshot();
  const { combinedSectionRevisionRef, markSaved } = useUnsavedChangesGuard({
    combinedSectionRevision: Number(revision),
    authoritativeSnapshotEpoch: replacementGeneration,
  });

  return React.useCallback((outcome: DocumentOutcome) => {
    // Baselinen læses fra ref'en EFTER downloaden, ikke fra den revision, renderet så. En download
    // finaliserer en åben editor som del af sin preflight, og den settle hæver revisionen – havde vi
    // brugt render-tidens værdi, ville netop den sidste rettelse stå som ikke-hentet.
    if (outcome.status === 'downloaded') markSaved(combinedSectionRevisionRef.current);
  }, [combinedSectionRevisionRef, markSaved]);
};
