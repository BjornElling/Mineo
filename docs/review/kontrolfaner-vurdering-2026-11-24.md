# Kontrolfanerne «EO-kontrol» og «Kontroltabel» – vurdering og anbefaling

Dato: 2026-11-24, revideret to gange samme dag efter udviklerens afgørelser (se «Afgørelser»). Grundlag: kildekoden i
`src/domain/eoInspektion/`, `src/domain/erstatningsopgoerelse/control/`, `src/domain/erstatningsopgoerelse/snapshot/`,
`src/contracts/eo-snapshot-contract.md` §6–6.2, brugerblik 12m og git-historikken for kontrollaget.

## Afgørelser

1. **Begge faner afvikles helt** i den rækkefølge, afsnit 7 beskriver.
2. **CSV-udtrækket bevares** som en særskilt download sammen med de øvrige downloads på Beregning-siden, med et kort,
   klart navn, hvor CSV indgår (afsnit 6.3).
3. **Facitsager indgår ikke.** Selv et større antal håndverificerede sager er for få og for sporadiske til at give en
   bred sikkerhed for programmet.
4. **Der bygges ingen uafhængig referenceberegning, og dermed heller ingen «clean room».** Begrundelsen står i
   afsnit 8.

## Konklusion

Ingen af fanerne opfylder formålet – en uafhængig, parallel kontrol af beregningen – og ingen af dem kan bringes til
det uden at blive noget andet end det, de er. De afvikles. Den sikkerhed, de var tænkt til at give, varetages i stedet af:

1. **Bevarelseslove i motoren** (runtime): regnestykker, der altid skal gå op, uanset hvordan reglerne læses. De
   overtager sammentællingens eneste reelle bidrag – at fange rørføringsfejl – bredere, og uden falske alarmer.
2. **Egenskabstests i runtime-fuzzen** (kun i testene): regler om, hvordan resultatet skal opføre sig, når inputtet
   ændres. De fanger samspilsfejl mellem funktionerne på tusindvis af automatisk dannede sager uden at kræve en anden
   beregning.
3. **CSV-udtrækket af dagsgrundlaget** på Beregning-siden: en ren gengivelse af beregningens data, sikret af en test,
   der kræver, at kolonnesummerne er lig opgørelsens tal.

## 1. Formålet

Formålet, som det er formuleret af udvikleren: tre parallelle gennemgange af beregningsgrundlaget – beregningen selv,
en logisk gennemgang (EO-kontrol) og en talmæssig dag-for-dag-opstilling ud fra virkelige forløb (Kontroltabel) – lavet
uafhængigt af hinanden, så systemtekniske, matematiske og logiske fejl fanges, før de når opgørelsen.

Kontrakten (§6.2 pkt. 5) har siden præciseret, at fanerne er et **passivt** kontrolmiddel: brugeren skal kun se dem, når
der er rejst en advarsel om uoverensstemmelse. Fanerne er slået fra som standard (`showEOInspektionMenu: false`).

Fanernes kontrolværdi står og falder derfor med ét spørgsmål: **kan sammenholdelsen melde en ægte fejl i motoren?**

## 2. Hvad fanerne faktisk gør

### 2.1 EO-kontrol

| Del | Kilde | Selvstændig beregning? |
|---|---|---|
| Rækker med ✓/gul/rød | `executeEoRowBuilderEntriesBySection` i `domain/eoRowEvaluation` – den samme motor, som afgør om PDF'en må hentes | Nej. Det er valideringen vist en gang til. |
| Mellemresultater (måneder, arbejdsdage, beløb) | `canonicalOutput` og `pdfModel` fra snapshottet | Nej. Motorens tal. |
| Reguleringstabeller | `buildRegulationTimeline` læser motorens `LoenudviklingModel`-segmenter | Nej, bevidst: «kontrolvisningen kan aldrig opfinde sit eget beregningsresultat» (`eoInspektionRegulationCore.ts:21`). |

EO-kontrol rejser ingen invariant og indgår ikke i `control:sammentaelling_mismatch`. Den er en visning af beregningen,
ikke en kontrol af den. Den gennemsigtighed er i forvejen bilagets opgave (princippet «vist = beregnet»).

### 2.2 Kontroltabellen – række for række

Sammentællingen (`eoInspektionSammentaelling.ts`) er det eneste sted, hvor noget faktisk sammenholdes:

| Række | Beregnet side | Tabelside | Fælles kode | Hvad kan rækken fange? |
|---|---|---|---|---|
| Arbejdsdage i beregningsperiode | `calculateTafArbejdsdageBreakdown` (motoren) | Tæller arbejdsdage i dagtabellen minus fradrag | Dag-sæt for SH/ferie (`tafDaySets`), `resolveIndkomstFerieperioder` | At to måder at tælle samme dag-sæt på giver forskellige tal. Ikke at dag-sættet er forkert. |
| Arbejdsdage i TAF-periode | `computeTafArbejdsdageAggregation` (motoren) med motorens `tafRanges` | Tæller «Ja» i TAF-dagskolonnen, bygget af motorens `tafRanges` og `resolveTafCutoffDates` | Perioderne, afskæringerne, dag-sættene | Reelt intet: en periode forbi afskæringen er allerede en rød feltfejl, der spærrer TAF-grenen og tømmer rækken (12m, «Ikke ændret»). |
| Svie/smerte, sygedage og delvise | Motorens `svieSmerteEngine.sygedage` | Tæller dage i dagtabellen bygget af motorens `constrainedPeriods` | Perioderne | At motoren tæller dagene i sine egne perioder forkert. Ikke at perioderne er forkerte. |
| Indtægt pr. ansættelsesforhold og ydelse | `buildIncomeForRanges` | Summen af dagkolonner, fordelt med `periodiseringsMotor` | Periodiseringen og satsopslaget | At summen over dage afviger fra summen over perioder i samme fordeling. |
| Offentlige ydelser (hypotetisk udvikling) | `canonicalOutput.taf.offentligeYdelserUdviklingOre` | **Den samme værdi** (`tabel: { value: amount }`, linje 563) | Alt | Intet. Rækken er en tautologi. |
| Sygeferiegodtgørelse | `canonicalOutput.taf.sygeferiegodtgoerelseOre` | Summen af `sfggResult.perAnsaettelsesforhold` – motorens egne delresultater | Hele SFGG-motoren | Kun at motorens total ikke er summen af dens dele. |

### 2.3 Hvad der slet ikke kontrolleres

Det kanoniske output (`eoCanonicalOutput.ts`) består af svie/smerte, TAF før og efter forlig, øvrige krav, totalen og
TAF-delene (lønudvikling, indtægter, offentlige ydelser, tidligere modtaget, SFGG). Kontroltabellen holder **ingen** af
de beløb op mod en selvstændig beregning, bortset fra SFGG-totalens sum af dele. Lønudviklingen med regulering,
nettoberegningen af TAF og forligsskaleringen – de største og mest fejlfølsomme dele – er helt uden for dens rækkevidde.

## 3. Hvad fanerne har fundet

Jeg har gennemgået de commits, hvis besked handler om sammentællingens uoverensstemmelser
(`caba5d0e`, `484f7ffb`, `d5b7ecb9`, `ad970dfe`, `a640979f`, `18430843`, `9279a5bc`, `2b41d22a`, `58ec8979`):

- Rettelserne lå i kontrollaget eller i, hvordan de to sider slår op i de samme data. Typisk mønster: kontrollen
  krævede noget, motoren ikke krævede, og meldte fx «beregnet=289, tabel=-».
- `18430843` dokumenterer tre brugerfund (2026-09-17), hvor almindelig indtastning udløste en falsk
  `control:sammentaelling_mismatch`. Invarianten er `source: 'system'`, spærrer EO-PDF'en og TAF-pr.-år-PDF'erne og
  åbner «Teknisk fejl registreret». I det tredje tilfælde var den falske uoverensstemmelse den **eneste** besked,
  brugeren fik.
- `58ec8979` gjorde tabellen «selvstændig» om TAF's afskæring – med afskæringen hentet fra samme opslag som motoren og
  bag en validering, der allerede gør dagen rød. Kontrollen kan ikke udløses af andet end en fejl i kontrollen selv.
- Brugerblik 12m: «Sammentællingen stemte i alle målte sager» og «En sammentælling med uoverensstemmelse (rødt kryds) er
  ikke fremprovokeret».

Jeg har ikke fundet et eksempel på, at kontroltabellen har fanget en fejl i motoren. Det udelukker ikke, at det er sket
uden at stå i en commitbesked, men mønsteret er tydeligt: kontrollens målbare output er dens egne fejl.

## 4. Hvad fanerne koster

| Post | Omfang |
|---|---|
| Domænekode (`src/domain/eoInspektion/` + `eoSnapshotToInspektionView.ts`) | ca. 3.600 linjer |
| UI (`EOInspektion*.tsx`, `EOKontrolTabel.tsx`, `eoInspektionRowRendering.tsx`) | ca. 1.200 linjer |
| Tests (unit, komponent, E2E) | ca. 7.900 linjer |
| Commits, der har rørt kontrollaget | 56 |
| Kontrakt | `eo-snapshot-contract.md` §6, §6.1, §6.2; `inspektionLayerIsolation`-værnet |
| Brugerens omkostning | Falske systemfejl, der spærrer PDF'en |
| Udviklingens omkostning | Enhver regelændring i motoren skal spejles i kontrollen, ellers falsk alarm |

Til sammenligning er hele `engines/`-mappen ca. 7.700 linjer. Kontrollaget er med tests større end den motor, det
kontrollerer.

## 5. Hvorfor nuværende form ikke kan nå formålet

### 5.1 Fælles kilder giver fælles fejl

En dobbeltberegning beskytter kun mod de fejl, de to beregninger **ikke** deler. Kontrakten har bevidst gjort dem
fælles: «Reglerne hentes fra samme kilde som motoren og valideringen, så de ikke kan drive fra hinanden» (§6.2 pkt. 1),
og «Enhver normalisering … skal ligge ét sted, som begge sider bruger» (§6.1). Det fjerner de falske alarmer, men det
fjerner samtidig den uafhængighed, der skulle fange de ægte fejl. En fejl i `periodiseringsMotor`, `tafDaySets`,
`resolveTafCutoffDates`, `buildIncomeForRanges` eller svie/smerte-motorens perioder går igennem begge sider og stemmer.

Kontrakten kræver altså to ting, der udelukker hinanden: at en uoverensstemmelse aldrig må være «en visnings- eller
opslagsforskel» (§6.2), og at tabellen er uafhængig. Det første er opnået på bekostning af det andet.

### 5.2 Runtime er det forkerte sted for ægte uenighed

En ægte uafhængig beregning vil være uenig med motoren i grænsetilfælde – ofte fordi reglen kan læses på to måder, ikke
fordi en af dem har en kodefejl. Sker det i runtime, står slutbrugeren med en spærret PDF og en «teknisk fejl», som
brugeren ikke kan gøre noget ved.

Den passive model (§6.2 pkt. 5) forstærker problemet: fanen ses kun ved en uoverensstemmelse, og med delte kilder kan en
uoverensstemmelse næsten kun opstå af en fejl i kontrollen selv. Fanen bliver dermed primært vist, når den tager fejl.

### 5.3 Fejlklasser og hvem der fanger dem

| Fejlklasse | Eksempel | Fanger kontroltabellen den? | Hvad fanger den efter afviklingen |
|---|---|---|---|
| Fortolkning af reglen | Midlertidigt EET afskærer TAF for skader efter 2011 | Nej – begge sider bruger samme fortolkning | Udviklerens faglige gennemgang (brugerblik) og regelbeskrivelserne i `docs/domain/`. Kode kan ikke fange den. |
| Forkerte satsdata | Forkert KRL-sats, forkert svie/smerte-takst | Nej – samme data | Kontrol mod kildepublikationen (`satserDownstreamIndependentOracle` findes allerede) |
| Dato- og grænsefejl | Inklusiv/eksklusiv slutdato, skudår, årsskifte | Kun hvis tællemåderne er forskellige; dag-sættene er fælles | Eksisterende oracle-tests pr. komponent + egenskabstests |
| Samspil mellem funktioner | Ferie på en SH-dag i en TAF-periode, der krydser et reguleringsskift | Nej | Egenskabstests i fuzzen |
| Afrunding | Øre/kroner, afrunding pr. segment eller pr. total | Delvist, for indtægtssummerne | Bevarelseslovene (segment = enhed × mængde × regulering) og CSV-kolonnesum-testen |
| Rørføring | Rigtigt tal i forkert felt, forkert sum af dele | Ja, for de få summer den dækker | Bevarelseslovene – billigere og bredere |

## 6. Det, der kommer i stedet

### 6.1 Bevarelseslove i motoren (runtime)

Identiteter, som skal holde uanset fortolkning, og som derfor aldrig kan give en falsk alarm:

- Totalen er summen af komponenterne: `samletTotalOre = svieSmerteOre + tabtArbejdsfortjenesteOre + oevrigeKravOre`.
- TAF fordelt på år summerer til TAF (findes allerede som TAF-pr.-år-afstemningen).
- Hvert lønudviklingssegment = enhedsløn × mængde × (1 + regulering) (findes allerede som schema-tjek i
  `eoCanonicalOutput.ts:53-90`).
- Reguleringen i hvert segment svarer til forholdet mellem periodens og referencens værdi i motorens egen serie. Det er
  det aritmetiske krydstjek af indeksforholdet, som `eo-snapshot-contract.md` §6 i dag pålægger kontrollaget; det skal
  ikke forsvinde med fanerne, men flyttes hertil (først verificeres, om og hvor det i dag faktisk udføres).
- SFGG-total = summen pr. ansættelsesforhold (i dag en «kontrolrække»; hører hjemme her).
- Svie/smerte = summen over satsår af dage × sats.
- Forlig: efter-forlig = faktor × før-forlig; uden forlig er beløbet uændret.
- Ingen komponent er negativ efter clamping; ingen dagstælling overstiger kalenderdagene i perioden.

En brudt identitet er altid en kodefejl og må fortsat være `source: 'system'` og spærre PDF'en. Det er den ærlige
version af det, `control:sammentaelling_mismatch` forsøger i dag.

### 6.2 Egenskabstests i runtime-fuzzen (kun i testene)

Runtime-fuzzen (`eoInputRuntimeFuzz*`) danner allerede tilfældige og sammenhængende sager og kører dem gennem hele
motoren. I dag holder den motoren op mod sammentællingen; i stedet skal den kontrollere regler om, hvordan resultatet
opfører sig, når inputtet ændres – uden at kende svaret:

- At dele en TAF-periode i to tilstødende perioder ændrer ikke TAF.
- At bytte om på rækkefølgen af rækker (ferie, TAF, indtægter) ændrer intet.
- At gange alle lønninger med k ganger de lønafhængige komponenter med k (før clamping).
- At flytte en feriedag ind på en weekend eller en SH-dag ændrer intet i arbejdsdage-enheden.
- At tilføje input, der ligger helt uden for alle perioder, ændrer intet.
- At forlænge en TAF-periode kan aldrig gøre TAF mindre (før modregning af indtægter i den forlængede del).
- At gemme og genindlæse `.eo`-filen giver samme kanoniske output (persistensgrænsen).

Hver regel afprøves på alle de sager, fuzzen danner. Det er her bredden kommer fra: ingen anden beregning skal
skrives eller vedligeholdes, og en brudt regel er altid en ægte fejl.

### 6.3 CSV-udtræk af dagsgrundlaget (Beregning-siden)

- **Placering:** i samme gruppe som erstatningsopgørelsen, «TAF fordelt på kalenderår», «TAF opreguleret til
  beregningsåret» og grafen, med samme livscyklus: samme spærring ved fejl, samme filnavnsregel, samme friskhedskrav
  til snapshottet. CSV er ikke en af dokumentkanalerne (PDF/Word), så den får sin egen renderer.
- **Navn:** knappen hedder **«Download dagsgrundlag som CSV-udtræk»**, og filen `{journalnr} - Dagsgrundlag.csv`.
  Siden har flere downloads, og de følger mønstret «Download {dokument} som {format}» (`DocumentDownloadButton.tsx`);
  uden ordet «dagsgrundlag» ville knappen ikke sige, hvad der hentes.
- **Indhold:** samme kolonner som i dag (dato, ugedag, hverdag, SH-dag, ferie, arbejdsdag, svie/smerte-dag, TAF-dag,
  løn og ydelser pr. dag), men bygget som en **ren projektion af snapshottet**. Den håndhæver ingen regler selv og har
  ingen sammentælling. Afskæringsmarkeringerne («Endeligt EET» osv.) bevares som visning af motorens afskæring.
- **Sikring af «vist = beregnet»:** en test i fuzzen kræver, at udtrækkets kolonnesummer er lig opgørelsens tal. Det er
  sammentællingens eneste reelle bidrag, flyttet derhen, hvor en afvigelse rammer udvikleren og ikke brugeren.
- **Genbrug:** dagmodellen i `eoInspektionKontrolModel.ts`, `eoInspektionLoenColumns.ts` og
  `eoInspektionOffentligeYdelserColumns.ts` samt `eoInspektionCsv.ts` (inkl. kolonnenavnsreglen fra BB-381) – flyttet
  ud af `domain/eoInspektion/` og renset for egen regelhåndhævelse og kontrolsemantik.

## 7. Afvikling – rækkefølge

1. **Bevarelseslovene** som snapshot-invarianter (6.1), inkl. indeksforholdet og SFGG-summen.
2. **CSV-udtrækket** på Beregning-siden som ren projektion med kolonnesum-testen (6.3). Udtrækket er dermed sikret,
   før fanen, det ligger på i dag, fjernes.
3. **Egenskabstestene** i runtime-fuzzen (6.2), som erstatning for fuzzens nuværende sammentællingskontrol.
4. **Fjern** `control:sammentaelling_mismatch`, sammentællingen, Kontroltabel-fanen og EO-kontrol-fanen (UI, resten
   af `domain/eoInspektion/`, `inspektionSnapshot` i `eoSnapshot.ts`, `EoProjectionTarget`-værdien `'inspektion'`,
   linket «Kontroltabel» i «Fejl og advarsler», `inspektionLayerIsolation`-værnet). `domain/eoRowEvaluation/` bevares
   – det er download-gaten, ikke kontrolfanen.
5. **Kontrakt og dokumentation:** omskriv `eo-snapshot-contract.md` §6–6.2 til bevarelseslovene og CSV-projektionen;
   opdatér `AGENTS.md`, hvis den nævner fanerne, og memoryen om kontroltabellen.
6. **Indstillinger:** `showEOInspektionMenu` og rækken «Vis kontrolfaner på Erstatningsopgørelse-side» udgår. Det er
   en app-indstilling, ikke en del af `.eo`-filen, så persistensgrænsen berøres ikke; indstillingsparseren skal blot
   ignorere nøglen stille i gamle indstillinger.

## 8. Fravalgt: uafhængig referenceberegning og «clean room»

Udvikleren har ikke behov for en referenceberegning og fandt clean room omstændeligt og fejlbehæftet, men bad om min
vurdering, hvis jeg er uenig. Jeg er enig i fravalget – dog ikke fordi en referenceberegning er overflødig i
princippet, men fordi gevinsten her ikke står mål med omkostningen:

- **Komponenterne er allerede uafhængigt testet.** Der findes `…IndependentOracle.test.ts` for årsløn, EET,
  forsørgertab, procesrente, varigt mén og satser, og håndregnede forventede værdier i over hundrede testfiler. Det en
  fuld referenceberegning ville tilføje, er primært samspillet mellem funktionerne – og det dækker egenskabstestene
  (6.2) for en brøkdel af prisen.
- **Det, kun den kunne fange, kan den kun delvist fange.** Dens særlige bidrag ville være fortolkningsfejl. Men skrevet
  ud fra de samme regelbeskrivelser og af den samme modeltype ville den dele mange af motorens fortolkninger, selv i
  clean room. Fortolkningsfejl fanges reelt af udviklerens faglige gennemgang.
- **Omkostningen er en anden motor.** Motoren er ca. 7.700 linjer; selv en naiv anden version ville være et stort
  stykke kode, som skal ændres ved hver regelændring, og hver uenighed kræver udviklerens afgørelse.

**Hvornår vurderingen bør tages op igen:** hvis der i praksis dukker fejl op i opgørelsens beløb, som er gået igennem
alle tests. Så bør der bygges et målrettet orakel for netop det område – efter det mønster, repoet allerede bruger
(`…IndependentOracle.test.ts`) – ikke en fuld referenceberegning.

**Det, fravalget forudsætter:** at bevarelseslovene (6.1) og egenskabstestene (6.2) faktisk bygges. Uden dem er
programmet efter afviklingen ikke svagere end i dag, men heller ikke stærkere; med dem er det stærkere end i dag.

## 9. Supplerende vurdering – afvikl begge faner, og bevar de kontroller, der finder fejl

**Jeg anbefaler at fjerne EO-kontrol og afvikle Kontroltabel med en afgrænset erstatning for dens sammentælling.**
EO-kontrol viser motorens mellemresultater og de vurderinger, der allerede bruges i opgørelsen og dens
downloadkontrol. Den kan hjælpe med at læse en sag, men jeg kan ikke udpege en fejl i beregningen, som den selv
ville opdage. Kontroltabellen giver en vis ekstra sikkerhed, fordi dens dagfordeling og optælling kan afvige fra
motorens. Bidraget er smalt og kan flyttes til tests. Bevar dagsgrundlaget som CSV til brugerens egen gennemgang.
Jeg ville heller ikke fra en blank tavle bygge to ekstra produktionsberegninger.

### 9.1 Kontroltabellen har faktisk fanget en fejl

BB-290 ændrer vurderingen i afsnit 3. Da en negativ lønrække på 2.000 kr. blev lagt ind som efterregulering,
sprang motoren rækken over, mens kontroltabellen fik den med. Sammentællingen fangede forskellen, før brugeren
kunne hente opgørelsen. Udvikleren afgjorde, at rækken skulle medregnes, og motoren blev rettet. Den tekniske
fejlbesked var uhensigtsmæssig, men forskellen var reel. Den eksisterende regression fastholder kravet på
402.750 kr. og i et andet forløb et fradrag på 7.875 kr. De beløbscheck skal overleve fanerne. TD-016 viser
den modsatte situation. Her var motorens beløb korrekt, mens en weekendydelse manglede i tabellen.
[BB-290](../testing/brugerblik/erstatningsopgoerelse-12h.md#bb-290--en-negativ-lønrække-standser-opgørelsen-med-kontroluoverensstemmelser-og-linket-fører-ingen-steder-hen) ·
[Beløbsregressioner](../../src/__tests__/domain/erstatningsopgoerelse/indtaegtsoplysningerBrugerblik12h.test.ts#L191) ·
[Fundregister, TD-016](../testing/testdaekningsgennemgang.md#9-fundregister-og-beslutningslog)

Det skel er afgørende. Et beløb kan gå tabt **før** motoren summerer sine dele, og alle de efterfølgende summer
kan stadig stemme. Omvendt kan visningen miste et beløb, selv om opgørelsen er korrekt. En kontrol skal vise,
hvilket led den kan finde fejl i. TAF-rækken illustrerer grænsen. Dens «Beregnet»-tal tælles særskilt til
sammentællingen med en motorhelper. De to tællinger kan afsløre forskellig anvendelse af samme afskæring,
men de får allerede afgrænsede perioder fra motoren og kontrollerer hverken det fælles datoopslag eller de
enheder, der faktisk blev brugt i lønbeløbet.
[Sammentælling](../../src/domain/eoInspektion/eoInspektionSammentaelling.ts#L426) ·
[Dagmodellens periodevalg](../../src/domain/eoInspektion/eoInspektionKontrolModel.ts#L535)

Indstillingen skjuler i praksis begge faner. Når den slås til, kan brugeren åbne dem uden en uoverensstemmelse.
Sammentællingen laves i begge tilfælde og kan spærre opgørelsens PDF og begge TAF-års-PDF'er. Det er den
kobling, jeg ville afvikle, når erstatningskontrollerne er på plads.
[Fanernes synlighed](../../src/components/pages/erstatningsopgoerelse/useErstatningsopgoerelseViewModel.ts#L42) ·
[Snapshot](../../src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts#L667) ·
[Downloadspærring](../../src/domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants.ts#L276)

### 9.2 Sådan ville jeg dække fejlene fra en blank tavle

| Hvad kan gå galt? | Hvad jeg ville kontrollere |
|---|---|
| En lovlig post forsvinder, eller en regel bruger en forkert dato eller sats | Test den konkrete overgang fra afsluttet input til opgørelsens beløb. Bevar BB-290 og weekendydelsen, og brug samme mønster til afgrænsede regelgrænser, hvor der mangler et selvstændigt forventet resultat. En test af satsvalget skal forvente, hvilken sats og dato der skal bruges. En test af divisionen mellem to leverede satser dækker et andet trin. |
| Rigtige delresultater kombineres forkert | Afstem særskilt dannede delbeløb ved den grænse, hvor de føres videre til næste trin. Vælg kun en spærrende kontrol i brugerens browser, hvis begge størrelser findes, enhed og afrunding er fastlagt, og et brud gør det pågældende dokument upålideligt. SFGG-total mod summen pr. ansættelsesforhold er en kandidat, hvis den kan brydes af en reel fejl i overførslen. |
| Flere regler virker hver for sig, men fejler sammen | Brug genererede par af gyldige sager til at teste én veldefineret ændring ad gangen. Fastlås forudsætningerne og mål, hvor mange par hver test faktisk sammenligner. Frys dato og relevante indstillinger ved en save/load-sammenligning. |
| Beregningen er rigtig, men bilaget eller CSV viser en forkert værdi | Afstem hvert output mod den præcise del af snapshot, det viser. Test bl.a. at en lønpost havner under det rigtige ansættelsesforhold, og at de viste datoer svarer til perioden bag beløbet. |

Flere forslag i afsnit 6.1 kræver præcisering. `eoCanonicalOutput.ts` kontrollerer allerede indeksforholdet ud
fra reguleringsbeviset samt procenten og segmentbeløbet, inklusive særtilfældet for KL med nulbasis. EO-kontrol
viser den anvendte procent. Bevar det eksisterende check. TAF fordelt på år afstemmes inklusive den særskilte
afrundingspost. Svie/smerte bruger én valgt sats, en særskilt delvis sats, maksimum, tidligere betaling og
slutafrunding. For TAF anvendes forligsfaktoren på et mellemresultat, før tidligere modtaget TAF trækkes fra
og beløbet afgrænses ved nul. Et check skal angive, præcis hvilket trin det gælder.
[Reguleringscheck](../../src/domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts#L51) ·
[Forlig og total](../../src/domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts#L173) ·
[Årsafstemning](../../src/domain/erstatningsopgoerelse/engines/tafPerYearDerived.ts#L449) ·
[Svie/smerte](../../src/domain/erstatningsopgoerelse/engines/svieSmerteEngine.ts#L282)

For de genererede sager ville jeg begynde med at bytte om på uafhængige indtægtsrækker og lægge en post helt
uden for både reference- og erstatningsperioden. En opsplitning af en TAF-periode kræver afklaring af bl.a.
løst fravær, der hører til den enkelte række, og afrunding. Proportionalitet ved ændring af løn kræver bl.a.
at faste tillæg, grænser og afrunding er taget ud af sammenligningen. Bredden kommer fra gyldige forløb med
målbare forventninger. Det nuværende standardkørselsgrundlag er 2 × 150 seeds, og flere seeds giver ingen
ekstra dækning af en regel, hvis de aldrig når frem til sammenligningen.
[Fuzzens opsætning](../../src/__tests__/domain/erstatningsopgoerelse/helpers/eoRuntimeFuzzShard.ts#L6)

Jeg deler fravalget af en bred samling facitsager og en komplet referencemotor. Jeg ville fastholde små,
uafhængige forventninger som ved BB-290. Indvendingen om sporadisk dækning gælder især hele sager valgt som
stikprøver. Et kendt grænsetilfælde med et på forhånd fastlagt resultat kan ramme en konkret fejl, som tusind
internt konsistente summer kan overse. Regelgrundlaget kræver stadig udviklerens faglige stillingtagen.

### 9.3 CSV og betingelser for afvikling

Jeg anbefaler CSV på Beregning-siden. I dag kan brugeren hente CSV, når tabellen har dage, også når en fejl i
en anden gren spærrer opgørelsen. Eksempelvis kan en ufuldstændig svie/smerte-periode stoppe PDF'en, selv om
TAF-grundlaget kan vises. Jeg ville lade brugeren hente det gyldige dagsgrundlag i den situation og gøre det
tydeligt, hvilken del filen dækker. Hvis beregningen er stoppet uden brugbart dagsgrundlag, er filen utilgængelig.
Den fælles PDF-spærring foreslået i afsnit 6.3 vil fjerne denne mulighed og bør behandles som et særskilt valg.
[Nuværende CSV-knap](../../src/components/pages/erstatningsopgoerelse/EOKontrolTabel.tsx#L264) ·
[Snapshot ved fejl i en anden gren](../../src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts#L589)

Byg eksporten af motorens anvendte grundlag. En flytning af de nuværende dagskolonner vil i sig selv videreføre
deres særskilte fordeling. Kontrollér den CSV, regnearket faktisk modtager, med samme beløbstype, periode og
afrunding på begge sider. Tre dage vist som 33,33 kr. giver 99,99 kr. i CSV, selv om den bagvedliggende post er
100 kr. Hvis filen skal kunne summeres præcist i et regneark, skal det aftales, hvordan restøret vises. Det
gælder også den allerede dokumenterede forskel mellem rå periodisering og afrundet fradrag for hentet
midlertidigt EET. CSV'en har her værdi som spor tilbage til grundlaget.
[CSV-formatering](../../src/domain/eoInspektion/eoInspektionCsv.ts#L46) ·
[Afrunding ved importeret midlertidigt EET](../../src/contracts/eo-snapshot-contract.md#L708)

Før sammentællingen fjernes, ville jeg i en isoleret testkørsel genindføre den gamle udeladelse af negative
rækker og se, om beløbschecket bliver rødt, også uden sammentællingen. Gør tilsvarende for en forskudt
afskæringsdag og et beløb ført til forkert ansættelsesforhold. Bevar validerings- og dokumenttestene, herunder
adfærd for en gyldig TAF-gren ved en fejl i svie/smerte. Kontrollér ved afviklingen, at en bruger med en tidligere
valgt kontrolfane lander på en gyldig fane, og at gamle `.eo`-filer giver samme grundlag og beløb. Jeg ville
godkende fjernelsen ud fra de dokumenterede fejl, som de tilbageværende kontroller kan afsløre, og de konkrete
downloads, brugeren stadig har adgang til.
