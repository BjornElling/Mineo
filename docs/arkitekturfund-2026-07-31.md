# Arkitekturfund fra dokumentationsgennemgangen

**Dato:** 2026-07-31
**Anledning:** Oprydningen efter draft/commit-omlægningen krævede, at hver kontrakt og hvert
arkitekturdokument blev verificeret mod koden. Undervejs dukkede der forhold op, som ikke er
dokumentationsfejl, men forhold ved **programmets opbygning**.

**Filens status.** Rent observerende. Intet heri er rettet, og intet er en opgave, der er tildelt. Kontrakter
og øvrig dokumentation beskriver bevidst programmet, som det ER — ikke som det kunne være. Denne fil er det
eneste sted, hvor jeg beskriver, hvad jeg mener kunne være bedre.

**Afgrænsning mod nabofilen.** `docs/aabne-beslutninger-og-daekningshuller.md` er et *register* over forhold,
der venter på en beslutning eller mangler et værn. Denne fil er en *vurdering*: her argumenterer jeg for, at
noget burde laves om. To punkter optræder i begge, fordi de både er et hul og en svaghed — de er krydsrefereret.

Fundene er ordnet efter, hvor meget de betyder. Hvert fund har en vurdering af, om det er værd at gøre noget ved.

---

## 1. Værn, der er forsvundet sammen med det, de bevogtede

**Observation.** Under omlægningen blev der gentagne gange fundet værn, som var blevet inerte: mønsteret var
intakt, testen var grøn, men målmængden var tom. Et værn, der scanner efter otte komponentnavne, som alle er
slettet, kan ikke fejle — og ingen opdager det, fordi grøn er den forventede farve.

Problemet er strukturelt: **et værn og dets mål er koblet ved konvention, ikke ved konstruktion.** Slettes
målet, forsvinder koblingen tavst.

Der findes i dag en modforanstaltning — hver arkitekturregel bærer et `liveTarget`, som harnesset efterprøver.
Den dækker reglerne i `src/__tests__/quality/architecture/`. Den dækker **ikke** de frittstående guard-tests,
der scanner kildetekst med deres eget filglob.

**Vurdering.** Dette er efter min mening programmets mest værdifulde tilbageværende forbedring, fordi
konsekvensen er usynlig: man mister dækning uden at få besked. Det konkrete skridt ville være at flytte de
resterende frittstående tekstscannere ind under harnesset, så de arver liveness-kontrollen frem for at føre
deres eget gulv. Jeg har skrevet princippet ind i `src/__tests__/AGENTS.md` §2.5, men en regel i et dokument
er svagere end en mekanisme.

**Beslægtet hul:** tre fjernede mekanismer (`cellFocusPaths`, `useCellInvalidDraftChannel`, `onFieldError`) har
slet intet fraværsværn — se `aabne-beslutninger-og-daekningshuller.md` §2.4.

---

## 2. Renteberegning kører rækkemotoren to gange pr. række

**Observation.** `renteberegningReaderProjection.ts` kalder `computeRentekravRow` ét sted pr. række
(linje ~107, til rækkens egen projektion) og derefter **igen** for hver række inde i aggregatprojektionen
(linje ~129), hvor `pdfContext` og `anyRowHasError` udledes.

De to kald sker med samme argumenter og giver samme resultat. Aggregatet kunne i princippet læse
`rowProjections` frem for at regne forfra.

**Nuance, der taler imod at røre ved det.** De to projektioner har forskellige gates: rækkeprojektionen er
`ready|blocked` pr. række, mens aggregatet kræver, at *alle* rækker er læsbare. At lade aggregatet forbruge
rækkeresultaterne ville koble de to gates sammen, og det er netop den kobling, dependency-specifik gating er
bygget for at undgå. Adfærden er desuden præeksisterende — den kom ikke ind med omlægningen.

**Vurdering.** Lav prioritet. Det er dobbeltarbejde, ikke en fejl, og rentetabeller er små. Jeg ville kun tage
det, hvis nogen alligevel skulle ind i modulet. Nævnes for fuldstændighedens skyld.

---

## 3. `gridCells.tsx` samler seks celle-komponenter i én fil

**Observation.** Filen er 183 linjer og eksporterer seks celle-komponenter. Resten af felt-familien i
`src/inputCore/react/fields/` følger konventionen én komponent pr. fil (`TextField.tsx`, `DateField.tsx`, …).

**Vurdering.** Grænsetilfælde, og jeg hælder til at lade den være. 183 linjer for seks små, ensartede wrappers
er ikke uoverskueligt, og de deler kontekst. En opsplitning ville give seks filer på ~30 linjer og en
`index.ts` — mere ceremoni end gevinst. Nævnes, fordi filen afviger fra sin egen mappes konvention, og fordi
det er den slags, der bør besluttes bevidst frem for at glide.

---

## 4. Dokumentkontraktens audit-afsnit beskriver en flade, generatorer ikke kan nå

**Observation.** `document-output-contract.md` §B5, §B6, §B8 og §B10 opstiller regler mod `advanceY(...)`,
`setY(...)`, `doc.text(...)`, `setFont`/`setFontSize` og `MARGINS.left` i generatorer. Alle disse primitiver
findes i dag kun inde i PDF-kanalen, og AST-reglen `document/generator-cursor-access-boundary` spærrer
generatorer fra dem. En generator *kan* altså ikke bryde reglerne ad den vej.

Jeg har tilføjet en læsevejledning, der forklarer det, og reglerne gælder fortsat ubeskåret for kode inde i
kanalen selv.

**Vurdering.** Afsnittene fylder omtrent 60 linjer på at advare mod noget, compileren allerede afviser. De
kunne skæres til en tredjedel: behold definitionen af, hvad et cursor-/font-indgreb er, og hvor det er
tilladt; drop den detaljerede opremsning af, hvordan en generator kunne misbruge en API, den ikke har adgang
til. Jeg valgte at lade dem stå, fordi en nedskæring er en redaktionel beslutning om en normativ kontrakt, ikke
en faktuel rettelse — og fordi de stadig er sande for kanalen.

---

## 5. Kontrakternes fraværslister er navnebaserede

**Observation.** Flere kontrakter opremser navne, der ikke må genindføres. Listerne værner mod *de symboler, vi
kom fra* — ikke mod *det ansvar, de havde*. En ny fil, der genopfinder en parallel inputmodel under et nyt
navn, rammes ikke.

Det er ikke en teoretisk indvending: netop denne svaghed var grunden til, at page-grænsen under omlægningen
blev skrevet om fra at måle kald til at måle **imports** af descriptor-kataloger — en ansvarsbaseret grænse,
der ikke kan omgås ved at finde på et nyt navn.

**Vurdering.** Navnelisterne er stadig nyttige som dokumentation af, hvad der er væk, og de gør en utilsigtet
genindførelse dyr. Men de bør ikke forveksles med en grænse. Hvor et ansvar kan udtrykkes strukturelt — hvem
må importere hvad, hvem må producere hvilken type — er det den stærkere konstruktion. Jeg ser ingen akut
mangel i dag, men det er den rigtige retning, næste gang en fraværsregel skal skrives.

---

## 6. EO's krydsgående aggregat blokeres samlet

**Observation.** Når ét led i EO's samlede opgørelse er blokeret, blokeres hele det krydsgående aggregat
(`totals.samletTotalOre`, `canonicalOutput`, `pdfModel`) — også de led, der i sig selv er gyldige.

**Vurdering.** Dette er **ikke** en mangel, og jeg medtager det for at forhindre, at nogen "retter" det.
Begrundelsen er reel: en sum eller et dokument kan ikke være autoritativt, hvis et led mangler. Den delvise
visning findes allerede i inspektions-snapshottet, hvor den hører hjemme. En ændring her ville producere tal,
der ser komplette ud uden at være det — præcis den fejlklasse, hele arkitekturen er bygget for at udelukke.

---

## 7. Mindre observationer

Forhold, jeg noterede, men ikke mener bør ændres:

- **`resolveFieldIssueTooltip` er allowlist-baseret.** En ny `reason` falder automatisk i den generiske gren.
  Det er den sikre default og bevidst — nu dokumenteret i `error-contract.md` §4.
- **`PreparedDocument` og `createDocxTable` er modulprivate.** Begge omtales i dokumentationen, som om de var
  offentlige API'er. Det er de ikke, og det er korrekt, at de ikke er. Kontrakten nævner det nu eksplicit.
- **`src/__tests__/AGENTS.md` indledtes med et AI-artefakt** ("Her er min reviderede og strammede version…") i
  et dokument, der erklærer sig autoritativt. Fjernet under oprydningen. Nævnes, fordi det er værd at holde øje
  med i genererede dokumenter.
