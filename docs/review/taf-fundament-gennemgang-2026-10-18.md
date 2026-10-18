# TAF-visningernes fælles fundament

Dato: 2026-10-18. Omfatter den almindelige erstatningsopgørelse, TAF fordelt på år,
TAF opreguleret til beregningsåret og grafen over indtægtsniveau.

## Gennemført

- Alle fire læser samme effektive TAF-input fra EO-snapshottet, inklusive satsprojektion,
  relevans og den transiente import fra Erhvervsevnetab-siden. Det oprindelige brugerinput
  og gemte `.eo`-data ændres ikke.
- `buildIncomeForRanges` ejer periodisering og medtagelse af ansættelser og ydelsestyper.
  Den nye `buildTafIndtaegterBeregning` samler den tidligere gentagne konvertering til
  indkomstfradrag: navne, rækkefølge, afrunding, forbehold og EET-bilagets periodeafrunding.
  Både hovedopgørelsen og årsfordelingen bruger denne funktion. Årsfordelingen tilføjer
  sygeferiegodtgørelse fra hovedmotorens SFGG-resultat.
- Årsfordelingen deler hovedmotorens forventede lønsegmenter ved årsskifter, inklusive
  den regulerede enhedsløn ved KL-lønaftaler. Den henter ikke nye reguleringssatser.
  Unødvendige afhængigheder af præsentationslaget og et ubrugt stamdata-input er fjernet.
- Opreguleringen læser årsfordelingens færdige TAF-krav og bruger den fælles akkumulerede
  reguleringsmotor. Den har ingen selvstændig indkomstindsamling.
- Grafen genbruger den fælles periodealgebra og gennemløber indkomstkildernes perioder én gang.
  Dens renderer, farver, layout og visuelle udjævning er bevaret.
- Integrationstests uden beregningsmocks kontrollerer samtidige løn- og ydelseskilder,
  manuelt/importeret EET, konkrete beløb og bevarelse af det oprindelige input. Den fælles
  fradragsberegning testes mod alle aktuelle ydelsestyper, også deres historisk gemte labels.

## Bevidste forskelle

- Årsfordelingen afrunder delberegninger pr. år. Afvigelsen fra hovedopgørelsens samlede
  krav vises som afrunding, højst 1 kr.; større afvigelser blokerer årsgrundlaget.
- Efter udviklerens godkendelse videreføres afrundingen uændret i det opregulerede dokument,
  hvor en særskilt linje vises ved et beløb forskelligt fra 0. Både PDF og Word medtager den i totalen.
- Efter udviklerens udtrykkelige beslutning er TAF 0 kr., når der ikke mangler indtægt.
  Også de viste krav pr. år bliver da 0 kr., mens indtægter og fradrag fortsat vises.
- Grafen viser et indtægtsniveau pr. måned/arbejdsdag, ikke TAF-kravet eller en bilagssum.
  Samples og eksisterende visuel udjævning bruges aldrig som grundlag for dokumenternes beløb.
- Hovedopgørelsen beholder en importeret EET-linje på 0 kr.; årsfordelingen udelader den.
  Denne eksisterende forskel i præsentation er bevaret. Beløbet beregnes samme sted.

## Bekræftede graffejl og godkendte rettelser

1. **Samme navn på to ansættelsesforhold.** Grafen grupperede efter navn, så to ansættelser
   med samme navn fik ét samlet farvet område. Begge indkomster blev talt med.
   Udvikleren godkendte særskilt visning. Serierne følger nu ansættelsesforholdets id,
   mens navnet alene er visning. En omdøbning ændrer derfor heller ikke serieidentiteten.
2. **Indkomst i en periode uden arbejdsdage.** Bekræftet med en rigtig snapshotberegning:
   TAF 01-01-2024 til 31-03-2024, angivet dagsløn 1.000 kr., ferie hele februar samt
   løn 1.000 kr., dagpenge 2.000 kr. og manuelt EET 3.000 kr. alene i februar.
   Hovedopgørelsen og årsfordelingen medtager 6.000 kr. i fradrag og beregner et TAF-krav
   på 35.000 kr. uden feltfejl. Grafen sprang februar over, fordi den ikke havde arbejdsdage,
   og blev derefter blokeret på manglende indkomstsegmenter. Havde en sag indkomst i andre perioder,
   kunne grafen fortsat dannes, mens indkomsten i perioden uden arbejdsdage manglede.
   Udvikleren godkendte, at grafen fordeler denne indkomst over periodens hverdage før
   feriefradrag, eksklusive SH. Grafen medtager derfor nu alle tre indtægter; i eksemplet
   vises 47,62 kr., 95,24 kr. og 142,86 kr. pr. dag, afrundet særskilt pr. kilde.
   Kravet er fortsat 35.000 kr., og grafens design bevares.

Begge rettelser er godkendt af udvikleren og gennemført. Samples uden indkomst og rene
weekend-/SH-samples bevarer den eksisterende visuelle behandling.

## Verifikation

- 170 relevante testfiler med 2.433 tests bestået, inklusive TAF-motorer, snapshot,
  dokumentprojektioner, PDF-/Word-indhold og grafens eksisterende visuelle golden-tests.
- Tre Chrome-browserforløb bestået: graf med EET-import, samme afrundingslinje i begge
  årsdokumenter og reguleringsparitet gennem PDF, Gem/Hent og Word. Ingen runtimefejl
  eller eksterne requests i disse forløb.
- App-, test-, E2E- og Node-typekontrol samt lint bestået. Kontrakt- og encodingkontrol bestået.
- Uafhængig kodegennemgang af den fælles fradragsberegning fandt ingen ændrede beløb,
  ændret rækkefølge eller ændrede afrundingsregler som følge af konsolideringen.
- Efter de to godkendte graffejlrettelser: 87 målrettede tests bestået, inklusive konkrete
  snapshotberegninger med ens arbejdsstednavne, navneændring og betalt ferie uden arbejdsdage.
  Grafens eksisterende visuelle golden-tests er uændrede og består fortsat.
- Et yderligere Chrome-browserforløb med både betalt ferie og to ansættelser med samme navn
  består uden runtimefejl eller eksterne requests. Den faktiske graf-PDF og et desktop-screenshot
  er inspiceret: begge lønserier og begge ydelser vises, og grafens design er bevaret.
