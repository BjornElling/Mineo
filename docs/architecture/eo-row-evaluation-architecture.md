# Rækkeevaluering i Erstatningsopgørelse

## 1. Kilder og forbrugere

Rækkeevalueringen i `src/domain/eoRowEvaluation/` omsætter afsluttet input, feltissues og
snapshottets beregningsresultater til statusrækker. Beregning viser fejl og advarsler fra disse
rækker. Downloadgaten bruger de samme fejl til at afgøre, om opgørelsen kan hentes.

`buildErstatningsopgoerelseReaderProjection` bygger sidens revision fra readeren. Rækkeevalueringen
læser denne projektion og den relevante indstillingsprojektion (`EoRowPolicy`). Beregning bruger
`useEoBeregningViewModel`, mens dokumenterne bruger `erstatningsopgoerelseDownloadGate`.

## 2. Evaluering og navigation

`EO_ROW_BUILDERS` fastlægger rækkernes sektioner, rækkefølge og wiring. En builder tager
`EoRowEvaluationContext` og returnerer `EoRowModel` med stabile id'er, status, besked og eventuelt
felt-/rækkemål. `executeEoRowBuilderEntry` isolerer en uventet fejl pr. builder gennem det fælles
systemfejlflow. `collectAllEoRows` samler rækkerne, tilføjer navigation og anvender
relevansfiltrering og dependency-suppression. Afhængigheder og navigation afgøres via de
strukturelle id'er og mål. Beskederne er tekst til brugeren.

## 3. Beregnede værdier

En række med beregnede værdier læser `canonicalOutput` eller den autoritative
præsentationsmodel. Eksempelvis skal SFGG's reference- og dagssatsrækker have snapshottets
`pdfModel` for at kunne vurdere motorens resultat. Når en beregning er blokeret, viser
Beregning kun uafhængige resultater fra `readyBranches`; de samlede beløb er utilgængelige.

Dagsgrundlaget er en CSV-projektion af samme snapshot. Den læser løn- og ydelsesdage opsamlet
under motorens periodisering. Dens afrundingslinje afstemmer de formaterede dage med
kolonnetotalen. Placering, download og fejltilstande styres af `eo-snapshot-contract.md` §6.

## 4. Ændringer i en række

1. Kontrollér feltets relevans og eventuelle afhængigheder i kontrakten og builderen.
2. Tilføj række, besked og strukturelt navigationsmål ved den eksisterende sektion.
3. Kontrollér både fejlrækken på Beregning og downloadgatens beslutning, når fejlen spærrer
   dokumentet. Brug snapshotprojektionen til at afprøve beregnede delresultater.
