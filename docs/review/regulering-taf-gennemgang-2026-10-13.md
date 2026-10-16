# Kritisk gennemgang af regulering af TAF-krav (2026-10-13)

**Status 2026-10-16:** AP1 er implementeret i `e5b3d78c`; AP2–AP9 er færdigimplementeret og verificeret.
Afklaringslog 8d præciserer den efterfølgende godkendelse af SFGG's egen KL-kæde.

**Implementeret:** Enheder og load-migration (AP1), fælles datoopslag uafhængigt af TAF-arbejdsdage (AP2),
blokerende historisk dækning med røde feltissues (AP3), nedregulering og baglæns KL-kæde (AP4),
offentlige ydelser fra beregningsperiodens slutdato (AP5), SFGG fra referenceperiodens slutdato (AP6),
Store Bededag-valgets relevans (AP7), motorbaseret visning og faktisk KL-kæde i PDF/Word (AP8) og
ILON12-note samt domænedokumentation (AP9).

**Supplerende regressionskontrol:** SFGG reguleres også for et job, hvis løn kun findes i SFGG-referenceperioden.
En SFGG-reference efter kildens nominelle udløb bruger samme fremførte sidste niveau som den tilladte TAF-periode.
Der indføres ingen yderligere ændring af filformat eller indlæsningsadfærd efter AP1.

**Sideobservation fra visuel kontrol:** Opgørelsens eksisterende standardtekst kan i en kort prøvesag efterlade
én linje på en næsten tom side før bilagene. En lang beskrivelse ved «Beregnes som» kan desuden støde sammen
med labelen i PDF. Begge er eksisterende generelle dokumentlayoutforhold; de nye reguleringstabeller og
SFGG-formler er kontrolleret særskilt i PDF og Word. De generelle layoutforhold indgår ikke i denne gennemgangs rettelser.

**Slutverifikation:** Alle release-gatens kontroller er gennemført. Den afsluttende Vitest-kørsel med coverage
bestod med **1.003 testfiler / 10.437 tests**. Den blev kørt med `npx vitest run --coverage --maxWorkers=6`,
fordi den fuldt parallelle kørsel overbelastede de tunge runtime-smokeprøver; ingen tidslofter er hævet.
App-, test-, E2E- og Node-typecheck, lint, encoding, casing, afhængigheder/advisories, kontraktstempler,
offentlige løndata, E2E-indlæsning/baner og inputregistre er kontrolleret. `npm run build:all` bestod for begge apps.
Den afsluttende `npm run test:e2e` bestod med **249 tests**, mens **2** native LaunchQueue-kapabilitetsprøver
som forventet sprang over i Firefox og WebKit. Store Bededag-/ILON12-forløbene er afprøvet uden runtimefejl
eller eksterne requests; desktop-skærmbilledet er inspiceret. De faktiske PDF-/Word-artefakter er kontrolleret
med håndfacitter og visuel rendering, inklusive begge retninger i KL-kæden og SFGG's egen kæde.

**Sådan læses dokumentet:** Afsnit A–D er de oprindelige fund med supplerende bemærkninger, bevaret som
begrundelse. Bindende er kun **«Afklaringslog»** og **«Implementeringsplan»** sidst i dokumentet. Er en ældre
bemærkning uenig med loggen, gælder loggen. Hvert fund har en linje **«Afgjort:»**, der henviser til loggen.
**Afgrænsning:** Situationer, hvor brugeren indtaster korrekt og forventeligt, men programmet regulerer forkert,
undlader at regulere eller viser noget andet, end det regner med. Brugerens egne fejlindtastninger er ikke med.
**Grundlag:** Kodelæsning ved commit `74e8103e`. Intet er afprøvet i appen eller med tests. Eksemplernes tal er
regnet ud fra koden og skal bekræftes, når fundet genskabes.

**Supplerende gennemgang (Codex, 2026-10-13):** Samme commit. De oprindelige bidrag er bevaret.
Bemærkninger nedenfor skelner mellem kodelæsning, kørt motor-/builderreproduktion og uafklarede principper.
Produktionsmoduler er kørt gennem Vites SSR-loader uden ændringer i beregningskoden. Der er ikke foretaget
browserverifikation eller visuel kontrol af genererede PDF-/Word-filer. Seks målrettede eksisterende testfiler
bestod med 181 tests; det beviser ikke de nye scenarier, som de eksisterende tests ikke dækker.

**Kvalitetssikring af udviklerens tilbagemeldinger (Claude, 2026-10-15):** Kommentarer står under
tilbagemeldingerne til B1, B2, B3 og D1, under A1, A2, A5 og C5 og i afsnittet «Enhedsspørgsmålet» under
Fælles mønstre. Grundlag: kodelæsning af det aktuelle arbejdstræ. Intet er kørt.

**Mærkning:**
- **Bekræftet:** kodestien er fulgt hele vejen fra input til resultat.
- **Mistanke:** mekanismen findes, men det er ikke eftervist, at en almindelig sag rammer den.

| Fund | Kort | Rammer | Alvor | Afgjort (log) | Arbejdspakke |
|---|---|---|---|---|---|
| A1 | Forhøjet grundløn (offentlig overenskomst) i forkert enhed | Beregning og visning | Høj | 10, 10a, 12 | AP1 |
| A2 | Anciennitetstillæg (offentlig overenskomst) i forkert enhed | Beregning | Høj | 10, 10a | AP1 |
| A3 | Offentlige ydelser reguleres fra et ansættelsesforholds særlige fra-dato | Beregning | Middel | 3a | AP5 |
| A4 | Sygeferiegodtgørelse ureguleret, når et lønsegment har 0 arbejdsdage | Beregning | Lav-middel | 8 | AP2, AP6 |
| A5 | Store Bededag-toggle ændrer også historisk overenskomstregulering | Beregning | Høj | 1, 11 | AP4 |
| B1 | TAF før reguleringsdatoen nedreguleres aldrig | Beregning | Høj | 1, 2, 5, 6, 7 | AP3, AP4 |
| B2 | Store Bededagstillæg virker ikke ved fire reguleringsformer | Beregning | Middel | 9–9d | AP7 |
| B3 | SFGG uden overenskomst reguleres imod domænedokumentets konstantregel | Beregning/principkonflikt | Middel | 8–8c | AP6 |
| C1 | KL-lønaftaler: bilaget udelader trin, der indgår i lønnen | Visning | Middel | Ingen spørgsmål | AP8 |
| C2 | ASL: tabellen «Maksimum årsløn» forsvinder | Visning | Lav | Følger af 1 | AP4, AP8 |
| C3 | EO-inspektion viser egen genberegning | Visning (kontrol) | Lav-middel | Ingen spørgsmål | AP8 |
| C4 | Bilagsteksten «Hertil kommer stigninger i …» bruger rå overenskomstsatser | Visning (tekst) | Lav | Ingen spørgsmål | AP8 |
| C5 | Offentlig månedsløn vises som timeløn og omvendt | Visning | Middel | 10a | AP1 |
| D1 | ILON12-serien blander én K4-værdi ind blandt K1-værdier | Data | Lav-middel | 4 (ingen datafejl) | AP9 |

---

## A. Fejl der giver et forkert beløb

### A1 – Forhøjet grundløn ud over løntrin regnes i forkert enhed (offentlig overenskomst)

- **Mærkning:** Bekræftet.
- **Hvor:**
  - Motoren: `src/domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstOffentligSegmenter.ts:49-53`.
  - EO-inspektionen har samme fejl: `src/domain/eoInspektion/eoInspektionRegulationCore.ts:632-636` og
    `src/domain/eoInspektion/eoInspektionLoenCoreModel.ts:147-152`.
- **Fejlen:**
  - Motoren går ud fra, at beløbet er indtastet i TAF-enheden: pr. måned ved TAF i måneder, pr. time ved TAF i
    arbejdsdage. Derefter omregner den til enheden for «Ansættelse» (Månedsløn/Timeløn).
  - Feltet viser dog «/ måned» eller «/ time» efter «Ansættelse», ikke efter TAF-enheden
    (`AnsaettelsesforholdCard.tsx:79`, `useEoOplysningerViewModel.ts:163`). Det gør PDF'en også.
  - «Ansættelse» og TAF-enheden vælges uafhængigt af hinanden. Ingen validering kobler dem.
- **Konsekvens:**
  - Ved Månedsløn og TAF i arbejdsdage bliver 1.000 kr./måned til ca. 160.330 kr./måned i både referencepakken og
    periodepakken.
  - Et trinløft på 600 kr. giver ca. 0,32 % regulering i stedet for ca. 1,94 %. Det er en underregulering på ca.
    85 %, og den sker uden advarsel.
  - Ved Timeløn og TAF i måneder bliver beløbet omvendt divideret med ca. 160, og reguleringen bliver lidt for høj.
- **Forskel mellem vist og beregnet:** PDF'en viser «Forhøjet grundløn: + 1.000 kr./måned». Reguleringen er regnet
  med ca. 160.330. Inspektionen regner med samme fejl, så kontrollen fanger det ikke.
- **Sådan genskabes det:**
  1. Ny sag. «Beregnes ud fra» = «Angivet dagsløn» (det giver TAF i arbejdsdage). Angiv dagsløn og en TAF-periode,
     fx 01-01-2022 – 31-12-2024.
  2. «Lønudvikling beregnes ud fra» = «Overenskomst». Vælg en KL-overenskomst.
  3. «Ansættelse» = Månedsløn. Vælg «Løntrin» og «Gruppe».
  4. «Forhøjet grundløn ud over løntrin» = `1.000` (feltet viser «/ måned»).
  5. Hent opgørelsen. Sammenlign reguleringsprocenten i «Beregnet regulering» med
     (trinløn(periode) + 1.000) / (trinløn(reference) + 1.000) − 1. Den viste procent er langt lavere.
  6. Gentag med «Forhøjet grundløn» tom. Procenten svarer nu til trinlønnens egen udvikling. Det viser, at det er
     beløbet, der forvrider beregningen.
  - **Alternativ:** «Beregningsperiode» med «Fuld løn under ferie» = Nej på kortet, så TAF går i arbejdsdage.
- **Spørgsmål:** Ingen spørgsmål.

- **Supplerende kontrol (Codex):** A1 er bekræftet ved kørsel gennem `buildLoenudviklingModel`.
  KL, trin 1, gruppe 0, Månedsløn, TAF i arbejdsdage, basis 01-04-2024, satsændring 01-10-2024,
  forhøjet grundløn 1.000 kr./måned: referencepakken bruger grundløn 179.681,75
  (= 19.351,75 + 160.330), og periodepakken 179.933,25. Anvendt regulering er 0,14 %.
  Med tillægget i feltets viste enhed er forholdet (19.603,25 + 1.000) / (19.351,75 + 1.000),
  svarende til 1,24 % efter den eksisterende afrundingspolitik. Tallene er et nyt, konkret eksempel,
  ikke en efterprøvning af alle tal i den oprindelige illustration. Løntype og TAF-enhed er uafhængige
  valg; den offentlige feltvalidering afviser ikke denne kombination.

- **Kommentar (Claude, 2026-10-15):** Rettelsen bør ikke være at omregne korrekt til TAF-enheden, men at
  fjerne TAF-enheden fra beløbet. Forhøjet grundløn lægges til løntrinssatsen og skal stå i dennes enhed,
  altså «Ansættelse», som feltet og PDF'en allerede viser. TAF-enheden har ingen betydning for
  reguleringsforholdet. Se «Enhedsspørgsmålet» under Fælles mønstre.
  Rettelsen ændrer resultatet for gemte sager med forhøjet grundløn, hvor «Ansættelse» ≠ TAF-enhed. Den gemte
  værdi er uændret, men programmet fortolker dens enhed anderledes. Det bør nævnes ved godkendelsen, jf.
  CLAUDE.md, selv om det blot får beregningen til at følge det, feltet har vist.
- **Afgjort:** log 10, 10a og 12. Implementeres i AP1.

### A2 – Anciennitetstillæg lægges til grundlønnen i forkert enhed (offentlig overenskomst)

- **Mærkning:** Bekræftet.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/overenskomstReguleringShared.ts:65-68`
  - `src/data/overenskomstRates.ts:1608-1620` (`getGrundloenAngivetPerForOverenskomst`)
  - `overenskomstOffentligSegmenter.ts:205-213`
- **Fejlen:**
  - For KL og RLTN returnerer `getGrundloenAngivetPerForOverenskomst` TAF-enheden. Tillægget omregnes derfor til
    TAF-enheden.
  - Tillægget lægges derefter til en grundløn, der står i «Ansættelse»-enheden (Månedsløn/Timeløn).
  - Når de to enheder er forskellige, lægges to forskellige enheder sammen.
- **Konsekvens:**
  - Timeløn, TAF i måneder, 500 kr. pr. måned: 500 kr. lægges oven i en timeløn på ca. 200 kr. Det giver ca.
    +250 % regulering fra anciennitetsdatoen.
  - Månedsløn, TAF i arbejdsdage, 500 kr. pr. måned: kun ca. 3,12 kr. lægges til, så tillægget forsvinder næsten
    helt.
  - Den private overenskomst-gren er ikke ramt.
- **Sådan genskabes det:**
  1. Som A1, trin 1–3, men med «Ansættelse» = Månedsløn og TAF i arbejdsdage («Angivet dagsløn»).
  2. Slå anciennitetstillæg efter skadedatoen til. «Dato for opnået anciennitetstillæg» skal ligge efter
     reguleringsdatoen og inden for TAF-perioden. «Anciennitetstillægssats» = `500`, «Satsen angives per» = Måned.
  3. Hent opgørelsen. Reguleringen fra anciennitetsdatoen stiger med ca. 0,01 % i stedet for de forventede ca.
     1,6 % (500 / ca. 30.000).
  4. Gentag med «Beregnes ud fra» = «Angivet månedsløn» (TAF i måneder) og «Ansættelse» = Timeløn. Reguleringen
     springer nu urealistisk højt op fra anciennitetsdatoen.
- **Spørgsmål:** Ingen spørgsmål.

- **Supplerende kontrol (Codex):** A2 er bekræftet ved kørsel. Den oprindelige lave reproduktion skal
  præciseres: ved «Angivet dagsløn» tvinger programmet anciennitetssatsens enhed til Time; ved
  «Angivet månedsløn» til Måned (`angivetLoenHelpers.ts:59-77`). Brugeren kan derfor ikke angive
  500 kr./måned på den første flade. På ansættelseskortet ved «Beregningsperiode» kan enheden vælges.
  En kørt offentlig form med månedsløn og TAF i arbejdsdage giver ved 500 kr./måned fra 01-05-2024
  grundløn 19.354,87 i stedet for 19.851,75, når basislønnen er 19.351,75: 0,02 % i stedet for 2,58 %.
  Den høje variant er kørt gennem `buildLoenudviklingModel` ved angivet månedsløn og offentlig Timeløn:
  basis 120,70 kr./time bliver 620,70 med 500 kr./måned og giver 414,25 %.
  Med korrekt omregnet tillæg er reguleringen ca. 2,58 %. Ingen ændring af domænets satsregler er
  forudsat i sammenligningen; den sammenholder blot beløb i samme enhed.

- **Kommentar (Claude, 2026-10-15):** Samme rod og samme rettelse som A1: `getGrundloenAngivetPerForOverenskomst`
  skal for KL/RLTN returnere «Ansættelse»-enheden, ikke TAF-enheden.
  Den tvungne enhed ved angivet løn (Time ved dagsløn, Måned ved månedsløn, `angivetLoenHelpers.ts:59`) er i
  praksis modellen «brugeren skal taste i TAF-grundlagets enhed». Den viser modellens svaghed: en månedslønnet
  KL-ansat med «Angivet dagsløn» må selv omregne et månedligt tillæg til timer uden for programmet, og
  omregningen fremgår ikke af bilaget.
  Anbefaling: lad «Satsen angives per» være et frit valg (Time/Måned) også ved angivet løn. Gemte sager
  indlæses med den enhed, der tvinges i dag, så valget i sig selv ikke ændrer noget.
- **Afgjort:** log 10 og 10a. Implementeres i AP1.

### A3 – Offentlige ydelser reguleres fra det første ansættelsesforholds særlige fra-dato

- **Mærkning:** Bekræftet.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts:117-141`
  - Validatoren spejler samme regel: `src/validators/erstatningsopgoerelseValidator.ts:611-620`.
- **Fejlen:**
  - Ved «Beregningsperiode» findes basisåret for reguleringen af offentlige ydelser i beregningsperioden via
    `resolveAktivEllerFoersteLoenudviklingKilde`.
  - Det er det første ansættelsesforhold med en anden reguleringsform end «Ingen», og dets «Evt. særlig fra-dato for
    regulering».
- **Konsekvens:**
  - En dato, der beskriver lønniveauet i ét job, flytter basisåret for fx sygedagpenge modtaget i beregningsperioden.
    Det har intet med det job at gøre.
  - Hvilket job der bestemmer basisåret, afhænger af rækkefølgen af kortene.
  - Ligger den særlige dato i et senere år end beregningsperiodens slutdato, mister ydelserne de mellemliggende
    årsreguleringer (typisk 2–4 % af ydelsesdelen). Ligger den tidligere, reguleres de for meget.
- **Sådan genskabes det:**
  1. «Beregnes ud fra» = «Beregningsperiode», fx 01-01-2022 – 31-12-2022. Skadedato fx 15-01-2023. TAF-periode
     01-02-2023 – 31-12-2025.
  2. Opret ansættelsesforhold 1 med lønindkomst i perioden og en reguleringsform, fx Statistik.
  3. Indtast en offentlig ydelse, fx sygedagpenge, i beregningsperioden. «Regulér offentlige ydelser» = Ja.
  4. Hent opgørelsen og notér ydelsernes reguleringstabel og beløb. Basisåret er 2022.
  5. Sæt «Evt. særlig fra-dato for regulering» = 01-06-2024 på ansættelsesforhold 1. Hent igen.
  6. Basisåret for ydelserne er nu 2024. Ydelsesbeløbene for 2023–2025 er lavere, selv om intet ved ydelserne er
     ændret.
  7. Med to ansættelsesforhold: sæt kun datoen på kort 2 og byt rækkefølgen. Resultatet for ydelserne skifter med
     rækkefølgen.
- **Spørgsmål:** Ingen spørgsmål. Den tilsigtede rettelse er, at basisåret for ydelserne altid tager udgangspunkt i
  beregningsperioden og aldrig i et ansættelsesforhold.

- **Bemærkning til konklusionen (Codex):** Kodestien er bekræftet, men udsagnet «Ingen spørgsmål» og
  den beskrevne «tilsigtede rettelse» er for stærke. En eksisterende test i `tafNettoBeregning.test.ts`
  kræver udtrykkeligt samme særlige reguleringsdato som den aktive lønudvikling. Der er ikke fundet
  en udtrykkelig regel om et selvstændigt basisår for ydelser i domænedokumentationen. At kortenes
  rækkefølge kan bestemme ydelsesreguleringen, er en konkret risiko; at basis altid skal være
  beregningsperiodens slutdato, er et løsningsforslag, der kræver udviklerens afgørelse.
  Afgræns desuden årseffekten: to forskellige datoer i samme kalenderår giver samme årsregulering.
  En meningsfuld regression skal flytte den særlige dato over et årsskifte og sammenligne samme
  ydelser før/efter ombytning af to jobkort, inklusive ydelsesdelen af TAF-nettokravet.
- **Kørt reproduktion (Codex):** `computeTafNettoBeregning`, beregningsperiode hele 2022,
  dagpenge 120.000 kr. i samme periode, to job med hver 10.000 kr. løn i januar 2022,
  Statistik/ILON12 på begge og særlige datoer henholdsvis 31-12-2022 og 01-06-2024.
  TAF hele 2025, fuld løn under ferie, pension/feriesats 0 og Store Bededag fravalgt.
  Med 2022-jobbet først er ydelsesdelen 132.912,00 kr. og TAF-netto 154.434,42 kr.
  Med 2024-jobbet først er ydelsesdelen 124.680,00 kr. og TAF-netto 146.202,42 kr.
  Løndelen er identisk: 21.522,42 kr. Kun kortenes rækkefølge ændres; resultatet flytter sig
  8.232,00 kr. Det er konkret bevis for ordensafhængigheden, ikke for hvilket basisår der skal vælges.
- **Afgjort:** log 3 og 3a. Basisåret er altid året for beregningsperiodens slutdato. Implementeres i AP5.

### A4 – Sygeferiegodtgørelse bliver ureguleret, når et lønsegment har 0 arbejdsdage

- **Mærkning:** Mekanismen er bekræftet. At en almindelig sag rammer den, er en mistanke.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts:242` (`if (arbejdsdage <= 0) continue;`)
  - `src/domain/erstatningsopgoerelse/engines/sfggSegmentering.ts:436-474`
  - `src/domain/erstatningsopgoerelse/engines/tafDaySets.ts:186-216`
  - `src/domain/erstatningsopgoerelse/engines/periodiseringsMotor.ts:77-98`
- **Fejlen:**
  - Lønudviklingen dropper segmenter uden TAF-arbejdsdage.
  - TAF-arbejdsdagene fratrækker løse feriedage, som lægges fra starten af TAF-perioden. Sygeferiegodtgørelsens
    dage (`buildLoenArbejdsdageSet`) fratrækker dem ikke.
  - Sygeferiegodtgørelsen slår op i de segmenter, der er tilbage. Finder den intet segment for en dato, bruges
    basissatsen uden regulering, og indekset vises tomt. Der kommer ingen fejl.
- **Konsekvens:** Sygeferiegodtgørelsen for dagene i det droppede segment reguleres ikke. Beløbet er typisk lille,
  men reguleringen udebliver uden fejl eller advarsel.
- **Sådan genskabes det:**
  1. Opsætning med sygeferiegodtgørelse beregnet ud fra referenceperioden og TAF i arbejdsdage.
  2. Brug en reguleringsform med et satsskift kort efter TAF-start, fx Statistik (kvartalsskift 01-04).
  3. TAF-periode 24-03-2025 – 31-12-2025 med «løse feriedage» = 6. De løse feriedage fylder dermed alle
     arbejdsdage før 01-04.
  4. Hent opgørelsen. Sygeferiegodtgørelsens linjer for 24-03 – 31-03 har tomt reguleringsindeks og basissatsen. De
     øvrige linjer er regulerede.
  - Kommer sygeferiegodtgørelsen ikke frem for de dage, er scenariet ikke nåeligt i praksis. Mekanismen bør
    alligevel lukkes.
- **Spørgsmål:** Ingen spørgsmål.

---

- **Supplerende kontrol (Codex):** A4 er bekræftet ved kørsel af `computeTafNettoBeregning`.
  En reproducerbar variant bruger KRL «KTO (kommuner)», angivet dagsløn 1.000 kr. pr. 01-01-2023,
  TAF 23-09-2024 – 04-10-2024, 6 løse feriedage og EO nr. 2. Jobbets SFGG er «Ferieloven»,
  reference 01-01-2023 – 31-01-2023 med løn 10.000 kr. og pension 0.
  De første seks arbejdsdage fjerner hele TAF-lønsegmentet før 01-10. SFGG har fortsat de samme
  seks dage og bruger referencesats 56,82 kr. uden indeks: 340,92 kr.
  Med 0 løse feriedage bruger de samme SFGG-dage indeks 105,60 og sats 60,00 kr.: 360,00 kr.
  SFGG-fradraget bliver således 19,08 kr. for lille, og TAF-nettokravet tilsvarende for højt,
  fordi reguleringssegmentet forsvinder. Sammenligningen gælder SFGG-delen; hele TAF-totalen ændrer
  naturligvis også antal erstatningsdage. Et kvartalsskift er ikke i sig selv et satsskift:
  SBLON2-serien har her årsværdier/K1 og giver ikke et nyt trin 01-04-2025.
- **Afgjort:** ingen principspørgsmål. Lukkes af reguleringsopslaget pr. dato (AP2), som SFGG bruger efter log 8 (AP6).

### A5 – Store Bededag-toggle ændrer også den historiske overenskomstregulering

- **Mærkning:** Bekræftet ved kørsel for både offentlig og privat overenskomst. Valget mellem
  nedregulering og uændret historisk løn er stadig et principspørgsmål; koblingen til togglen er en
  selvstændig inkonsistens.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstOffentligSegmenter.ts:185-196`
  - `src/domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstPrivatSegmenter.ts:144-169`
- **Fejlen:**
  - Grenene «før dækning» tester mod den effektive reference-start, som også kan være en senere
    reguleringsdato inden for kildens dækning. De skelner ikke mellem manglende kildedata og en
    historisk dato før den valgte lønreference.
  - Når Store Bededag er slået fra, får segmenter før reference-start 0 %.
  - Når togglen er slået til, tillades fra 01-01-2024 opslag af de faktisk historiske lønsatser og
    tillæg i de samme segmenter. Togglen ændrer dermed grundlønnens og pensionens regulering.
- **Konsekvens:** Brugeren kan ændre historisk lønregulering med flere procentpoint alene ved at
  tilvælge 0,45 %-tillægget, også når tillægget er ens i både reference og periode og derfor
  ikke selv forklarer forskellen. Fejlen følger med i TAF-beløb, årsfordeling og de
  referenceperiodebaserede SFGG-beregninger, som bruger lønsegmentets delta.
- **Sådan genskabes det:**
  1. Angivet månedsløn 30.000 kr. pr. 01-04-2025; offentlig KL, trin 1, gruppe 0, Månedsløn,
     feriesats 0, «Almindelig løn» på helligdage. TAF 01-04-2024 – 30-06-2025.
  2. Toggle fra: segmentet 01-04-2024 – 30-09-2024 får 0 %.
  3. Toggle til: samme segment får −1,28 %, baseret på 19.351,75 / 19.603,25.
     Store Bededagssatsen er 0,45 på begge sider af brøken og udgår af forholdet.
  4. Privat variant: «Bygge- og anlæg», basis 01-05-2025, samme TAF-periode og øvrige valg.
     Toggle fra giver 0 % før 01-05-2025; til giver −3,44 %.
     Grundlønnen skifter fra reference 146,40 til historisk 142,65, pension fra 11,15 til 10,15.
     Store Bededag er igen 0,45 på begge sider.
- **Spørgsmål:** Hvilket historisk reguleringsprincip skal gælde, jf. B1? Uanset valget skal togglen
  ikke bestemme, om andre lønelementer behandles historisk. Fra-datoen 01-01-2024 må heller ikke
  alene åbne for grundløns-/pensionsændringer, der vedrører et andet forhold.
- **Strukturel løsning:** Adskil kildens dækningsstart fra reference-/basisdatoen. Beslut og
  evaluer det historiske lønforløb selvstændigt; anvend derefter det valgte indskudte tillæg på
  reference- og periodepakken. Samme regel skal bruges af begge overenskomstgrene.

- **Kommentar (Claude, 2026-10-15):** Udviklerens svar på B1 afgør også principspørgsmålet her. Begge
  overenskomstgrene skal regulere historisk efter kildens satser, uanset togglen. Togglen må kun styre
  Store Bededag-komponenten. Proxy-grenen `useFallbackBaseBeforeCoverage` (`overenskomstOffentligSegmenter.ts:191`)
  og basisklemmerne før dækning bør udgå til fordel for B1's dækningskrav, jf. kommentaren dér.
- **Afgjort:** log 1, 6 og 11. Implementeres i AP3 og AP4.

---

## B. Principper der strider mod udviklerens afgørelser

### B1 – TAF før reguleringsdatoen bliver aldrig nedreguleret

- **Mærkning:** Kodestien er bekræftet. Om resultatet er forkert, afhænger af svaret på spørgsmålet nedenfor.
- **Hvor:** Alle reguleringsformer giver 0 % for segmenter før basisindekset eller basisrækken:
  - `statistikForm.ts:98-100` (ASL: `year < baseYear`) og `statistikForm.ts:147-149` (ILON12/SBLON2)
  - `krlForm.ts:93-95`
  - `klLoenaftalerReguleretLoen.ts:86-93`
  - `manuelProcentsatsRegulering.ts:90`
  - `manuelForm.ts` (segmenter før første daterede række bruger basispakken)
  - Segmenter fra starten af basiskvartalet frem til reguleringsdatoen får også 0 %.
- **Konflikten:**
  - I BB-261 (`docs/testing/brugerblik/erstatningsopgoerelse-12f.md:166`) er det afgjort, at en beregningsperiode
    efter skaden er lovlig, og at man da «nedregulere[r] den til værdien i EO-perioden».
  - Det samme gælder «Det angivne beløb afspejler månedslønnen per dato» og «Evt. særlig fra-dato for regulering».
    Begge må ligge frem til dags dato, altså også efter TAF-start.
  - Ingen form kan i dag udtrykke en nedregulering. Rækker i de manuelle tabeller skal ligge efter basisdatoen.
- **Formerne behandler situationen forskelligt:**
  - For Statistik, KRL og KL-lønaftaler er der ingen fejl og ingen advarsel. Validatoren tjekker kun den øvre
    dækning (`erstatningsopgoerelseValidator.ts:1271`). Rækken «start-dato for TAF» (`eoRowIndkomstRows.ts:657-665`)
    er altid «Ja», fordi kilderne starter i 2005.
  - For de manuelle former blokerer samme situation med «Nej (først fra …)».
- **Konsekvens:** SBLON2, angivet månedsløn 40.000 kr. per 01-01-2025, TAF 01-03-2022 – 31-12-2025:
  - Motoren regulerer 2022–2024 med 0 %.
  - Med nedregulering ville det være ca. −10,8 % (2022), −7,7 % (2023) og −4,6 % (2024).
  - Kravet bliver ca. 100.000 kr. for højt.
- **Følgefejl:** C2 (ASL-tabellen forsvinder) opstår kun i denne situation.
- **Sådan genskabes det:**
  1. «Beregnes ud fra» = «Angivet månedsløn». «Månedslønnen udgør» = 40.000.
  2. «Det angivne beløb afspejler månedslønnen per dato» = 01-01-2025.
  3. TAF-periode 01-03-2022 – 31-12-2025.
  4. «Lønudvikling beregnes ud fra» = «Statistik», model SBLON2.
  5. Hent opgørelsen. «Beregnet regulering» viser indeks 100,00 (0 %) for alle segmenter før 2025. Ingen advarsel.
  6. Gentag med «Manuel procentsats». Nu blokerer programmet, så samme situation behandles forskelligt.
  - **Variant med beregningsperiode efter skaden (BB-261):** Beregningsperiode efter TAF-perioden. Reguleringsdatoen
    bliver periodens slutdato, og hele TAF-perioden regnes med 0 %.
- **Spørgsmål:**
  1. Skal TAF før reguleringsdatoen nedreguleres efter kildens forløb, som BB-261 beskriver?
     - Statistik og KRL kan det direkte ud fra indeksforholdet.
     - KL-lønaftaler regulerer i trin med afrunding. Her skal det afgøres, om kæden skal køres baglæns, eller om
       situationen skal spærres med en fejl.
     - De manuelle former kan ikke rumme rækker før basisrækken. Skal de spærre som i dag, eller skal de kunne
       nedregulere?
  2. Hvis 0 % fortsat er det tilsigtede: skal Statistik, KRL og KL-lønaftaler så mindst have en synlig, gul
     advarsel, når TAF starter før reguleringsdatoen? Det svarer til, at de manuelle former allerede melder det.

- **Bemærkning til afgrænsningen (Codex):** Den universelle formulering «TAF før reguleringsdatoen
  bliver aldrig nedreguleret» gælder ikke alle aktuelle kodestier. A5 viser, at begge
  overenskomstgrene faktisk nedregulerer historiske segmenter fra 2024, når Store Bededag er
  valgt. Med fravalgt tillæg giver de samme segmenter 0 %. Det skærper behovet for én besluttet
  historisk regel, frem for at vælge ud fra et tilvalg, der vedrører et andet lønelement.

**Tilbagemelding**
TAF før reguleringsdatoen skal nedreguleres. Kode og kontrakter, der angiver det modsatte, skal ændres. Dog skal manuel regulering ikke kunne indeholde datoer før reguleringsdatoen - manuel regulering kan dermed ikke anvendes til nedregulering. Sørg for at tage højde for situationer, hvor de tabeller, som regulering sker ud fra, ikke går helt tilbage til det tidspunkt, som TAF-kravet vedrører. Som udgangspunkt er min antagelse, at det vil være mest hensigtsmæssigt at give rød ring og blokerende fejl på feltet med den valgte regulering, hvis det ikke indeholder reguleringssatser for hele TAF-perioden, men jeg er åben for andre forslag - gerne løsninger, som ensarter med fremadrettet regulering, så vi har færrest mulige systemer, der gør det samme, og så vidt muligt kan eliminere fejlkilder.

**Kommentar (Claude, 2026-10-15)**

Enig i princippet og i den røde ring. Bemærkninger:

- **Ensretning med fremadrettet regulering er mulig uden ny mekanisme.** Statistik, KRL, ASL og overenskomst
  regner allerede forholdet sats(segment) / sats(basis). Samme formel giver et forhold under 1 før basis. Det
  eneste, der skal fjernes, er grenene «før basis → 0 %» (`statistikForm.ts`, `krlForm.ts`, overenskomstgrenene).
  Segmenter mellem kvartals-/satsstart og reguleringsdatoen får fortsat 0 %, fordi satsen er den samme.
- **Dækningskravet bør være én regel for alle former:** kilden skal dække fra den tidligste af TAF-start og
  reguleringsdato. Validatoren (`validateLoenudviklingDataCoverage`) tjekker i dag kun reguleringsdatoen mod den
  øvre grænse, og kun for Statistik, KRL og KL-lønaftaler. Overenskomst er bevidst udeladt
  (kommentaren ved `erstatningsopgoerelseValidator.ts:1269`). Overenskomst skal med, ellers er fx private
  overenskomster med satser fra 2011 og de offentlige løntrinstabeller ikke dækket af kravet.
- **Fjern de stille klemmer for en reguleringsdato før dækning.** Den offentlige gren bruger i dag første
  dækkede sats som basis (`resolveOffentligEffectiveBase`, «U4-clamp»), og den private bruger
  `max(reguleringsdato, dækningsstart)`. Begge er den neutrale fallback, rapporten ellers vil af med, og de
  strider mod den røde ring.
- **Afgræns «hele TAF-perioden» til den nedre grænse.** Opadtil virker programmet i dag sådan, at seneste sats
  videreføres for TAF efter sidste satsdato. Kun reguleringsdatoen skal ligge inden for kildens dækning. Gælder
  kravet bogstaveligt i begge ender, bliver enhver sag med TAF frem til i dag blokeret, så snart en tabel ikke er
  opdateret, og ILON12 kan ikke bruges til TAF efter 30-09-2026. Er det hensigten, bør det besluttes for sig.
- **KL-lønaftaler er ikke besvaret.** Kæden afrunder på hvert trin og efterligner bevidst Erstatningsnævnets
  praksis (`docs/domain/taf/kl-loenaftaler-regulering.md`). Der er to muligheder:
  - Baglæns kæde, løn₍ᵢ₋₁₎ = afrund(lønᵢ / (1 + satsᵢ)). Det er den naturlige spejling, men ikke en nøjagtig
    invers af den fremadrettede kæde.
  - Blokering som ved de manuelle former.

  Det skal afgøres, og §1.2 i dokumentet skal opdateres.
- **Blind vinkel: offentlige ydelser.** Ydelsesdelen af den hypotetiske indkomst reguleres med
  satsreguleringsprocenten fra basisåret. Den giver også 0 % for år før basisåret
  (`opregulerMedAkkumuleretReguleringssats`: `maalAar <= kildeAar` giver ingen regulering). I BB-261-situationen
  bliver løndelen dermed nedreguleret, men ydelsesdelen ikke. Tag stilling til, om svaret også gælder
  ydelserne. Det hænger sammen med det åbne basisårsspørgsmål i A3.
- **Blind vinkel: sygeferiegodtgørelse.** Nedreguleringen forstørrer en eksisterende datoforskydning i
  SFGG-reguleringen, se kommentaren til B3.
- **Manuel regulering:** svaret svarer til dagens adfærd. Blokeringen rammer dermed også BB-261 (beregningsperiode
  efter skaden) for begge manuelle former. Fejlteksten bør sige, at der skal vælges en anden reguleringsform.
- **Gemte sager:** Resultatet bliver lavere for gemte sager, hvor reguleringsdatoen ligger efter TAF-start.
  Sager med TAF før kildens dækning, som i dag kan hentes, bliver blokeret. Det er ikke en load-afvigelse, men
  den nye blokering af tidligere gyldige sager bør forelægges særskilt efter CLAUDE.md.

**Afgjort:** log 1, 2, 3, 5, 6, 7 og 12. Bemærk, at log 5 (altid blokering før tabellens første sats) afløser
den gule tolerance, som tilbagemeldingen åbnede for. Implementeres i AP3 og AP4.

### B2 – Store Bededagstillæg virker ikke ved Statistik, KRL, KL-lønaftaler og manuel procentsats

- **Mærkning:** Bekræftet (koden). Om det er forkert, afhænger af svaret på spørgsmålet nedenfor.
- **Hvor:**
  - Tillægget håndteres kun i `manuelForm.ts` og i de to overenskomst-grene (`overenskomstOffentligSegmenter.ts`,
    `overenskomstPrivatSegmenter.ts`).
  - `statistikForm.ts`, `krlForm.ts`, `klLoenaftalerForm.ts` og `manuelProcentsatsForm.ts` nævner det ikke.
    `krlForm.ts:63-65` siger udtrykkeligt, at KRL ikke modellerer det.
- **Konflikten:**
  - Togglen «Beregn Store Bededagstillæg fra 1. januar 2024» vises ved «Almindelig løn», uanset reguleringsform.
    Den står som standard til på nye sager (`indskudte-loentillaeg-contract.md` §2a pkt. 2).
  - Advarslen «Der vil sædvanligvis være krav på Store Bededagstillæg …» opfordrer brugeren til at slå den til, også
    når formen ikke bruger den.
  - Koden ved advarslen siger «Store Bededagstillægget indgår i lønpakken fra 1. januar 2024, uanset reguleringsform»
    (`eoRowIndkomstRows.ts:360`). Det passer ikke for de fire former.
- **Inkonsekvens uafhængigt af domænevurderingen:**
  - Ved «Beregningsperiode» kommer tillægget med i grundlønnen, hvis reguleringsdatoen ligger 1. januar 2024 eller
    senere (`indkomstSkadestidspunktBeregning.ts:84`, `loenindkomstSatser.ts:343`).
  - Ligger reguleringsdatoen i 2023, kommer det aldrig med.
  - Med samme reguleringsform og samme toggle afhænger resultatet altså af, hvilken side af 01-01-2024
    reguleringsdatoen ligger på.
- **Konsekvens:** Ved angivet månedsløn med fx KRL og TAF i 2024–2025 mangler 0,45 % på alle beløb fra 2024, selv om
  togglen står til.
- **Sådan genskabes det:**
  1. «Beregnes ud fra» = «Angivet månedsløn». «Løn på helligdage» = «Almindelig løn», togglen til. TAF-periode
     01-06-2023 – 31-12-2024. Reguleringsdato i 2023.
  2. «Lønudvikling beregnes ud fra» = «Overenskomst» (privat). Hent og notér: der er et brudpunkt pr. 01-01-2024, og
     Store Bededag er med i formlen.
  3. Skift til «KRL satstabel». Hent igen. Der er intet Store Bededag-brudpunkt, og tillægget indgår ikke. Togglen
     står stadig til.
  4. Beregningsperiode-varianten: Statistik, først med «Evt. særlig fra-dato for regulering» = 01-12-2023, derefter
     = 01-02-2024. Kun i det andet tilfælde indgår tillægget (via grundlønnen).
- **Spørgsmål:**
  1. Skal Store Bededagstillægget lægges på uanset reguleringsform, altså som et selvstændigt lag oven på formens
     regulering fra 01-01-2024?
  2. Eller er din vurdering, at Statistik, KRL og KL-lønaftaler allerede rummer kompensationen i deres
     indeks/satser? I så fald skal togglen og advarslen skjules for de former. Hvordan skal manuel procentsats så
     håndteres, hvor brugeren selv angiver procenterne?
  3. Uanset svaret: skal tillægget ved «Beregningsperiode» så stadig indgå i grundlønnen, når reguleringsdatoen ligger
     i 2024 eller senere, også ved de former, hvor det ellers ikke lægges på?

**Tilbagemelding**
Det er korrekt og tilsigtet adfærd, at Store bededagstillæg ikke indregnes, når der benyttes statistiske lønmodeller samt KRL- og KL-lønaftaler til fremskrivning. De statistiske lønmodeller udgør beregnede udviklinger i det samlede lønniveau, og indeholder dermed i sig selv udvikling der skyldes store bededagstillæg. I forhold til manuel regulering er det et bevidst fravalg, at store bededagstillæg ikke indgår der - Det vil give for mange komplikationer, hvis det gør.

Når der benyttes beregningsperiode, og reguleringsdatoen ligger 1-1-24 og senere, skal store bededagstillæg indgå i beregningsgrundlaget.

**Kommentar (Claude, 2026-10-15)**

Svaret dækker Statistik, KRL og KL-lønaftaler. Fire huller:

1. **«Manuel regulering» kan betyde to ting.** Programmet har to manuelle former:
   - «Manuel procentsats» lægger ikke tillægget på. Det er fundets form, og svaret bekræfter adfærden.
   - «Manuelt angivet» (tabellen med grundløn og tillæg) lægger det derimod på i dag. `manuelForm.ts` tilføjer
     Store Bededag pr. segment fra 01-01-2024, og formen er ikke blandt fundets fire.

   Omfatter svaret også «Manuelt angivet», er det en ændring af adfærden for gemte sager og ikke kun en
   bekræftelse. Præcisér, hvilken form der menes.
2. **Svaret siger ikke, hvad brugerfladen skal gøre.** Togglen og advarslen «Der vil sædvanligvis være krav på
   Store Bededagstillæg …» vises uanset form. Kommentaren ved `eoRowIndkomstRows.ts:360` siger «uanset
   reguleringsform». Togglen kan dog ikke bare skjules for de fire former: ved «Beregningsperiode» afgør den i dag
   også, om tillægget indgår i grundlaget (`resolveStoreBededagPct` læser `beregnStoreBededagstillaeg`).
   Anbefaling: skjul togglen og advarslen via descriptorens relevansregel, når togglen ingen virkning har. Det
   gælder angivet løn med en af de fire former og «Beregningsperiode» med reguleringsdato før 2024 og en af de
   fire former. Ret samtidig kommentaren.
3. **Styrer togglen grundlaget ved beregningsperiode?** «Skal indgå» kan læses som «altid, når
   reguleringsdatoen er 2024 eller senere». I dag sker det kun, når togglen er slået til (og formentlig kun ved
   «Almindelig løn»). Præcisér, hvilken af de to der er tilsigtet.
4. **Angivet løn og beregningsperiode behandles forskelligt.** Ved «Beregningsperiode» lægges 0,45 % til
   grundlaget, når reguleringsdatoen er i 2024 eller senere. Ved «Angivet månedsløn» med samme form og en dato i
   2024 eller senere lægges intet til. Det hænger kun sammen, hvis det angivne beløb forudsættes at indeholde
   tillægget. Står det ikke i hjælpeteksten ved «Månedslønnen udgør»/«Dagslønnen udgør», får to brugere med
   samme løn forskellige resultater ad de to veje.

   Desuden: i «Beløb»-tilstanden læses satserne aldrig. Tillægget kommer kun med, hvis det indgår i de
   indtastede beløb. Ligger beregningsperioden i 2023 og reguleringsdatoen (via særlig fra-dato) i 2024, kommer
   det ikke med. Det er formentlig acceptabelt, men det er en undtagelse til svarets ordlyd.

**Afgjort:** log 9, 9a, 9b, 9c og 9d. Svaret «skal indgå» er præciseret: begge betingelser skal være opfyldt.
Implementeres i AP7.

---

### B3 – Ferielovsberegnet sygeferiegodtgørelse reguleres også uden overenskomstdækning

- **Mærkning:** Bekræftet kodesti og kørt motorreproduktion. Om adfærden skal ændres, kræver
  afklaring af modstridende principbeskrivelser.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/sfggSegmentering.ts:456-474`
  - `src/domain/erstatningsopgoerelse/engines/sfggKilde.ts:35-36` og `69-75`
  - `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md:194-207` (§4.2–4.3)
- **Fejlen/principkonflikten:** Domænedokumentet foreskriver TAF's overenskomstudvikling for
  et overenskomstdækket job med ferielovsberegnet referencesats; i øvrige tilfælde er satsen
  konstant. Motoren bruger alene «beregnes via referenceperiode» som betingelse for regulering,
  uden at kontrollere overenskomstdækning. Kilderegisterets kommentar beskriver samtidig
  regulering af alle referenceperiodebaserede kilder. Begge beskrivelser kan ikke være styrende.
- **Konsekvens:** Et job uden overenskomst og med SFGG efter «Ferieloven» får reguleret sats
  ved fx KRL eller manuel procentsats. SFGG trækkes fra TAF, så konflikten angår nettokravet.
- **Sådan genskabes det:** Brug A4's kørte KRL-eksempel med 0 løse feriedage og et job uden
  overenskomst. SFGG-referencesatsen 56,82 kr. bliver 60,00 kr. (indeks 105,60) før 01-10-2024
  og 60,78 kr. (106,97) derefter. Motoren giver 603,12 kr. for de ti arbejdsdage; konstant sats
  ville give 568,20 kr. Forskellen på 34,92 kr. påvirker SFGG-fradraget.
- **Spørgsmål:** Skal alle referenceperiodebaserede SFGG-satser følge den valgte TAF-regulering,
  eller kun de overenskomstdækkede tilfælde i §4.2? Skal et overenskomstdækket job med fx KRL
  følge den valgte TAF-form eller overenskomstens udvikling?
- **Strukturel løsning efter afgørelse:** Adskil referencesatsens kilde fra dens reguleringsregel.
  Kilderegisteret skal angive den besluttede regel eksplicit; brug af referenceperiode må ikke
  i sig selv afgøre, om en sats skal reguleres.

**Tilbagemelding**
Du må gerne udfordre og efterprøve denne vurdering, før du erklærer dig enig. Min grundlæggende præmis er, at sygeferiegodtgørelse beror på to adskilte faktorer:

1) Hvad udgør selve satsen. Dette kan være bestemt af overenskomsten, men kan også være beregnet - visse overenskomster indeholder særlige beregningsregler, og ellers faldes tilbage på ferielovens beregningsregel med 4 ugers referenceperiode. Formålet med dette led er alene at give en referencesats for selve den fremtidige beregning af sygeferiegodtgørelse.

2) Hvordan regulereres sygeferiegodtgørelse. Dette sker med den TAF-regulering, som er gældende for ansættelsesforholdet. Det har dermed som sådan intet at gøre med, hvordan referencesatsen er beregnet. Reguleringen af sygeferiegodtgørelse følger til enhver tid og på alle måder den procentuelle udvikling, der ville være sket af den almindelige løn.

**Kommentar (Claude, 2026-10-15)**

Premissen holder i sin kerne. Det er rigtigt at skille fastsættelsen af satsen fra dens udvikling, og det
forenkler motoren, fordi kontrollen af overenskomstdækning i §4.2–4.3 falder bort. Svaret afgør også Codex'
delspørgsmål: et overenskomstdækket job med fx KRL følger KRL. Premissen har dog tre huller, og det sidste er
væsentligt:

1. **Direkte overenskomstsats (§4.1, `overenskomst_direkte`).** Efter ordlyden omfatter pkt. 2 også den. Satsen
   slås i dag op pr. dato i overenskomstens satser og udvikler sig dermed af sig selv. Lægges TAF-reguleringen
   oven i, reguleres den dobbelt. Anbefaling: undtag udtrykkeligt direkte satser, så de følger overenskomstens
   egne datoer. Den faktiske sats er kendt og mere retvisende end en fremskrivning.
2. **Manuelt angivet dagssats.** Den er konstant i dag. Premissen siger ikke, om den også skal følge
   TAF-reguleringen. Skal den det, mangler den en referencedato, som brugeren i så fald skal angive.
3. **Udviklingen måles fra den forkerte dato.** `resolveAdjustedRate` (`sfggSegmentering.ts:454-474`) ganger
   referencesatsen med TAF-segmentets `deltaPct`. Det er reguleringen i forhold til TAF's reguleringsdato, ikke i
   forhold til SFGG-referenceperioden. Referenceperioden vælges frit (må ligge efter skaden, §2.1), og intet
   kobler den til reguleringsdatoen.
   - Eksempel: referenceperiode i 2022 og angivet løn «per dato» 2025. I dag står satsen i 2022-niveau og
     reguleres kun for udviklingen efter 2025, så udviklingen fra 2022 til 2025 mangler hele vejen.
   - Med nedreguleringen fra B1 bliver 2022-satsen desuden ganget med indeks(2022) / indeks(2025) og ender ca.
     10 % for lavt i 2022.
   - Den korrekte regel er sats × indeks(dato) / indeks(referenceperiode). «Den procentuelle udvikling» i
     premissen skal altså måles fra referenceperioden, ikke fra lønnens reguleringsdato.
   - Det kræver, at reguleringsforløbet kan slås op på referenceperiodens dato, også uden for TAF-perioden (jf.
     Fælles mønstre pkt. 2). Det kræver også et fast punkt i referenceperioden, fx til-datoen.
   - Ved manuel regulering med en referenceperiode før reguleringsdatoen skal der blokeres, som i B1.

Følgerettelser: domænedokumentets §4.2–4.3 skal omskrives, og eventuelle tests, der forudsætter den gamle regel,
skal ændres. A4-rettelsen bør bygge på samme opslag pr. dato.

**Afgjort:** log 8, 8a, 8b og 8c. Hul 1 (direkte satser) er løst ved en undtagelse (8b). Hul 2 (manuel dagssats)
er løst som en bevidst konstant (8c), ikke med en referencedato. Implementeres i AP6.

---

## C. Fejl i visningen (beregningen er korrekt)

### C1 – KL-lønaftaler: tabellen «Reguleringsværdier» udelader trin, som indgår i den regulerede løn

- **Mærkning:** Bekræftet.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts:548-552`. Kaldet til
    `resolveRelevantRealDatesForTafScope` mangler basisankeret. Statistik og KRL sender det med på linje 476-481 og
    511-516.
  - `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts:204-207`: `periodePct` sættes kun, når et
    segment starter præcis på en KL-dato.
- **Fejlen:**
  - Tabellen viser kun satsen i kraft ved TAF-start og satserne inden for TAF-perioden.
  - Motoren lægger alle KL-trin efter reguleringsdatoen oven på hinanden.
  - Omvendt vises et trin, der ligger før eller på reguleringsdatoen men før TAF-start, som gældende, selv om motoren
    springer det over.
- **Konsekvens:** Den regulerede løn i «Beregnet regulering» kan ikke efterregnes ud fra bilaget. Første række har
  tom lønudvikling.
- **Sådan genskabes det:**
  1. «Lønudvikling beregnes ud fra» = «KL-lønaftaler». Reguleringsdato fx 15-01-2022. TAF-periode fra 01-06-2024.
  2. Hent opgørelsen. «Reguleringsværdier» viser kun trinnet fra april 2024 (eller seneste trin før 01-06-2024).
  3. Den regulerede løn i «Beregnet regulering» indeholder også trinnene fra 2022 og 2023. Efterregn: basisløn ×
     de viste trin ≠ den viste regulerede løn.
- **Spørgsmål:** Ingen spørgsmål.

- **Supplerende analyse (Codex):** C1 bekræftes ved kodelæsning. At sende basisankeret til
  `resolveRelevantRealDatesForTafScope` er ikke tilstrækkeligt: helperen vælger basis, satsen ved
  TAF-start og ændringer inden for TAF. Den udelader fortsat de mellemliggende KL-trin mellem
  basis og TAF-start. Løsningen bør være, at motoren udstiller den faktisk anvendte kæde med
  satsprocent og afrundet løn før/efter hvert trin. De trin, der har skabt første viste løn,
  skal kunne genfindes i bilaget. Indeksmodeller, der alene bruger forholdet mellem to satser,
  behøver ikke samme historiske trinliste.
- **Afgjort:** ingen principspørgsmål. Kæden skal efter log 2 også rumme baglæns trin før reguleringsdatoen.
  Implementeres i AP8.

### C2 – ASL: tabellen «Maksimum årsløn» forsvinder helt

- **Mærkning:** Bekræftet.
- **Hvor:** `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts:452-454`.
- **Fejlen:** Har bare ét segment ikke `sourceKind: 'asl'`, returneres `null` for hele tabellen. Det sker for
  0 %-segmenterne fra `statistikForm.ts:98-100`, altså år før basisåret.
- **Konsekvens:** Bilaget skriver «Ingen reguleringsværdier.», mens «Beregnet regulering» viser ASL-brøker for de
  senere år.
- **Sådan genskabes det:**
  1. «Lønudvikling beregnes ud fra» = «Statistik», model «ASL-årslønsmaksimum».
  2. Reguleringsdato i et senere år end TAF-start, fx «Det angivne beløb afspejler månedslønnen per dato» =
     01-01-2024 med TAF fra 01-06-2023.
  3. Hent opgørelsen. «Reguleringsværdier» mangler, men «Beregnet regulering» viser ASL-brøker for 2024 og frem.
- **Spørgsmål:** Ingen spørgsmål. Rettelsen afhænger dog i praksis af svaret på B1. Bliver 2023 nedreguleret, får
  alle segmenter ASL-kilde, og tabellen kommer tilbage af sig selv.
- **Afgjort:** følger af log 1. Kontrolleres i AP4; den alt-eller-intet-grenen i `reguleringsPresentation.ts`
  rettes i AP8, så et enkelt ikke-ASL-segment ikke kan fjerne hele tabellen.

### C3 – EO-inspektionen viser sin egen genberegning i stedet for motorens tal

- **Mærkning:** Mekanismen er bekræftet. At sektionen også forsvinder via ASL-grenen, er en mistanke.
- **Hvor:**
  - `src/domain/eoInspektion/eoInspektionRegulationViewModel.ts:290-305`
  - `src/domain/eoInspektion/eoInspektionRegulationCore.ts:158-236` og `627-940`
- **Fejlen:**
  - Kan den fælles tabelbygger ikke bygge «Reguleringsværdier», falder inspektionen tilbage på `buildRegulationTimeline`.
    Den slår selv overenskomstsatser op og fortolker selv de manuelle rækker.
  - Det sker fx ved C2, når alle pakkesegmenter er 0 %-segmenter, eller for et ansættelsesforhold uden indkomst i
    beregningsperioden.
  - Genberegningen ser bort fra den private overenskomsts dækningsgrænse (`useInputPctBasisForMissingBase`).
  - Mistanke: ASL-grenen kan give `null` for hele sektionen, hvis en ASL-værdi mangler for et år frem til «vedrører
    perioden til». Motoren skal kun bruge årene frem til TAF-slut.
- **Konsekvens:** Kontrolfanen kan vise satser og indeks, som motoren ikke har regnet med, fx indeks ≠ 100, hvor
  motoren har brugt 0 %.
- **Sådan genskabes det:**
  1. Genskab C2. Åbn EO-kontrol, fanen med regulering.
  2. Sammenlign «Reguleringsværdier» med opgørelsens «Beregnet regulering». Værdierne for årene før basisåret kommer
     fra inspektionens egen genberegning og stemmer ikke med motorens 0 %.
- **Spørgsmål:** Ingen spørgsmål.

- **Bemærkning til reproduktionen (Codex):** Den oprindelige C2-reproduktion beviser ikke, at
  kontrolfanen viser egne indeks før ASL-basisåret. ASL-timeline starter ved basisåret, og
  fallbacktabellen viser ikke indekskolonnen. «Beregnet regulering» bruger de canonical
  motorsegmenter; den parallelle udledning vedrører «Reguleringsværdier» og selve udvælgelsen
  af kontrolsektioner. Den forskel skal bevares i vurderingen af C3.
- **Bekræftet følgefejl (Codex):** Den beskrevne ASL-mistanke er kørt og bekræftet.
  TAF 01-01-2024 – 30-06-2025 med ASL-basis i 2024 producerer to gyldige motorsegmenter.
  Med EO-periodens slutdato 31-12-2026 giver `buildRegulationInspektionSections` én sektion.
  Med samme motorsegmenter og EO-slut 31-01-2027 giver den nul sektioner.
  `eoInspektionRegulationCore.ts:297-301` kræver ASL-satser helt frem til EO-slut; den manglende
  2027-sats fjerner jobbet på linje 954. ViewModelens linje 191 returnerer derefter tom visning.
  2027-datoen er inden for det tilladte slutdatointerval, mens selve TAF-perioden er fuldt dækket.
  Et korrekt beregnet krav mister dermed sin reguleringskontrol på grund af en irrelevant dato.
- **Strukturel løsning:** Udvælg kontrolsektioner fra de autoritative beregningsresultater.
  En sekundær kildekontrol må hverken skjule et beregnet forløb eller kræve satsdækning ud over
  de perioder, der faktisk reguleres. Manglende sekundært kontrolgrundlag skal være eksplicit.
- **Afgjort:** ingen principspørgsmål. Implementeres i AP8.

### C4 – Bilagsteksten «Hertil kommer stigninger i …» bruger overenskomstens rå satser

- **Mærkning:** Bekræftet.
- **Hvor:** `src/document/generators/eo/sections/reguleringSection.ts:230-260` (bruges også for «Manuelt angivet»,
  linje 597).
- **Fejlen:**
  - Viser tabellen ingen stigning i fritvalg, SH/SO eller pension, slår teksten overenskomstens rå satser op ved
    TAF-start og TAF-slut.
  - Opslaget måler fra TAF-start, ikke fra motorens referencedato.
- **Konsekvens:** Ved «Manuelt angivet» med en aktiv overenskomst og konstante tillæg i de manuelle rækker kan teksten
  sige, at fritvalg stiger. Beregningen bruger et konstant fritvalg.
- **Sådan genskabes det:**
  1. «Beregningsperiode». Ansættelsesforhold med en privat overenskomst, hvis fritvalg stiger i TAF-perioden.
  2. «Lønudvikling beregnes ud fra» = «Manuelt angivet». Opret en dateret række med ny grundløn og samme fritvalg som
     basisrækken.
  3. Hent opgørelsen. Bilaget nævner en stigning i fritvalg, som ikke findes i «Beregnet regulering».
- **Spørgsmål:** Ingen spørgsmål.

---

- **Supplerende analyse (Codex):** C4 bekræftes ved kodelæsning. Forklaringsteksten bør afledes
  direkte af motorens numeriske reference- og periodekomponenter. Både nye rå satsopslag og
  genparsing af formatterede tabelceller skaber en parallel fortolkning af samme beregning.
  Den fælles dokumentsektion bruges af både PDF og Word, så rettelse og paritet skal omfatte begge.
- **Afgjort:** ingen principspørgsmål. Implementeres i AP8.

### C5 – Offentlig månedsløn vises som timeløn og omvendt

- **Mærkning:** Bekræftet ved kørt motor-/tabelbuilderreproduktion; ingen visuel dokumentkontrol.
- **Hvor:**
  - `src/domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstOffentligSegmenter.ts:96-99`
  - `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts:203-229` og `396-400`
- **Fejlen:** Motorens offentlige grundløn følger valgt «Ansættelse». Tabellen
  «Reguleringsværdier» vælger derimod overskriften efter TAF-enheden.
- **Konsekvens:** En korrekt månedssats står som timeløn eller omvendt i PDF, Word og EO-inspektion.
  Det er en selvstændig visningsfejl, også uden forhøjet grundløn eller anciennitet. Selve
  forholdstallet mellem to lønsatser ændres ikke af en fælles enhedsfaktor, så fejlen beviser
  ikke et forkert beløb i de tilfælde, hvor A1/A2 ikke udløses.
- **Sådan genskabes det:** Vælg offentlig KL, trin 1, gruppe 0, Månedsløn og TAF i arbejdsdage.
  Uden ekstra grundløn og anciennitet har motorens referencekomponent værdien 18.607,42 kr./måned.
  Den fælles tabelbuilder returnerer overskriften «Timeløn» og rækkerne
  01-10-2023: 18.607,42; 01-04-2024: 19.351,75; 01-10-2024: 19.603,25.
  Den omvendte kombination giver timeløn under «Månedsløn».
- **Spørgsmål:** Ingen spørgsmål om fejlmekanismen; satsen skal navngives med den enhed, den har.
- **Strukturel løsning:** Lad reguleringsbeviset bære satsenhed, som alle visninger læser.
  Enheden må ikke udledes igen fra TAF's mængdeenhed. Samordnes med enhedsrettelsen for A1/A2.

- **Kommentar (Claude, 2026-10-15):** Samme regel som i A1/A2 løser det: pakkens enhed er altid
  løntrinssatsens enhed («Ansættelse»). Bærer reguleringsbeviset den enhed, kan tabellen ikke tage fejl, og
  TAF-enheden indgår ikke længere nogen steder i reguleringslaget.
- **Afgjort:** log 10a. Implementeres i AP1.

---

## D. Data

### D1 – ILON12-serien blander én K4-værdi ind blandt K1-værdier

- **Mærkning:** Mistanke (data, ikke kode).
- **Hvor:** `src/data/statistiskeRates.ts:141-172`.
- **Fejlen:** Serien har K1-værdier for hvert år plus `2025K4` (165,2). Modellen er beskrevet som «ikke-
  sæsonkorrigeret». Et skift fra et K1-tal til et K4-tal kan derfor rumme en sæsoneffekt og ikke kun lønudvikling.
- **Konsekvens:** Med basis i 2025K1 og TAF fra 01-10-2025 regner motoren +2,29 % (165,2 / 161,5).
- **Sådan genskabes det:**
  1. «Statistik», model ILON12, reguleringsdato i 2025 før 01-10-2025, TAF-periode der løber over 01-10-2025.
  2. Hent opgørelsen. «Beregnet regulering» får et ekstra brudpunkt pr. 01-10-2025 baseret på K4-værdien.
- **Spørgsmål:**
  1. Er det tilsigtet, at ILON12 indeholder en enkelt K4-værdi som seneste tal? Eller skal serien kun bære
     K1-værdier, så sæsonen er ens på begge sider af brøken?

**Tilbagemelding**
ILON12-indekset bliver ikke længere vedligeholdt fra udgangen af 2025. Det er derfor korrekt og tilsigtet adfærd, at reguleringen indeholder den sidste reguleringssats, der vil blive offentliggjort for indekset. Skriv gerne dette og forudsætningerne ind i programmets dokumentation, så det ikke igen bliver fremført som en fejl. Overvej desuden, om ikke det kunne være hensigtsmæssigt i selve programmet (men ikke i de genererede opgørelser) at indsætte en linje neden under reguleringsfeltet, som angiver, at ILON12-indekset ikke længere opdateres efter udgangen af 2025, når brugeren har valgt dette som reguleringsform. Hvis der er flere steder i programmet, hvor man kan vælge det som reguleringsform, så tilføj dette begge steder.

**Kommentar (Claude, 2026-10-15)**

Enig i, at dataene er korrekte. Bemærkninger:

- **Ophøret er allerede beskrevet i koden.** `statistiskeRates.ts:141-142` siger det, og kontinuitetsværnet
  i `statistiskeRates.ts:208-225` tillader udtrykkeligt den ekstra K4-værdi. Det, der mangler i dokumentationen,
  er to ting:
  - Begrundelsen for, at en K4-værdi bevidst står blandt K1-værdier: den er det sidste offentliggjorte niveau.
  - Følgen for TAF og reguleringsdato. ILON12 dækker til 30-09-2026 (seneste kvartal + 12 måneder − 1 dag),
    så en reguleringsdato derefter afvises. TAF efter 01-10-2025 reguleres ikke yderligere, fordi 165,2
    videreføres.

  Begge dele bør stå i domænedokumentationen og i linjen under feltet.
- **Bilaget indeholder allerede en note.** `ILON12_DISCONTINUED_NOTE` («ILON12 opdateres ikke længere efter
  2025K4. Danmarks Statistik anbefaler herefter i stedet at benytte SBLON2.») skrives i både PDF og Word
  (`reguleringSection.ts:624`, `reguleringDocument.ts:399`). Dit «men ikke i de genererede opgørelser» kræver
  derfor en afgørelse: skal den eksisterende bilagsnote fjernes eller blive? Brug under alle omstændigheder samme
  konstant til teksten i programmet, så de to ikke kommer til at sige noget forskelligt.
- **Ét sted dækker begge flader.** Modelvalget ligger i den delte `LoenudviklingFields.tsx`, som bruges af både
  «Indtægt før skaden» (angivet løn) og ansættelseskortet. Linjen skal derfor kun placeres ét sted.

**Afgjort:** log 4. Tilbagemeldingens «men ikke i de genererede opgørelser» er trukket tilbage: bilagsnoten
bevares. Implementeres i AP9.

---

## Fælles mønstre og strukturelle løsninger

Fejlen fra 2026-10-12 (fritvalg og pension antaget 0 i basis), A4, B1, C2 og C3 har samme rod: når noget mangler,
falder programmet stille tilbage til en neutral værdi (0 %, ureguleret sats, 0 %-segment eller ingen tabel). A1 og
A2 skyldes beløb uden enhed.

1. **Ingen stille neutral fallback i reguleringslaget.**
   - Et fravær af regulering skal være et udtrykkeligt udfald med en grund på `Reguleringsbevis`, fx
     `kind: 'ingen'` med `grund: 'foer-basis' | 'ikke-valgt'`.
   - Et opslag, der ikke finder en regulering for en dato, skal kaste en fejl i stedet for at bruge basissatsen.
   - Kan håndhæves med en arkitekturregel i `src/__tests__/quality/architecture/rules/formRules.ts` mod `?? 0` og
     `parsePercentInput` i regulerings-modulerne.
2. **Reguleringsforløbet adskilt fra antallet af dage.**
   - Motoren udsender ét reguleringsforløb pr. dato, uafhængigt af TAF-arbejdsdage.
   - TAF og sygeferiegodtgørelse slår begge op i det. Lukker A4 og fejlklassen.
3. **Beløb med enhed som type.**
   - Kr./måned og kr./time som branded typer, og én omregningsfunktion for den offentlige gren, styret af
     «Ansættelse».
   - Motor, inspektion og PDF bruger den samme. Inspektionen må ikke dele netop den primitiv, den skal kontrollere.
     Ellers fanger den ikke en fejl som A1.
4. **Basisåret for offentlige ydelser** tager udgangspunkt i beregningsperioden, aldrig i et ansættelsesforhold.
5. **Store Bededag som et selvstændigt lag** oven på formens regulering, eller togglen skjult for de former, hvor
   tillægget anses for at være indeholdt. Afhænger af svaret på B2.

**Afgjort:** Punkt 4 er bekræftet (log 3a). Punkt 5 er afgjort som «togglen skjult, hvor den ingen virkning har»
(log 9b). Punkt 3 er præciseret i log 10a: kanonisk enhed er pakkens enhed. Punkt 1's arkitekturregel mod `?? 0`
erstattes af Codex' smallere værn (Supplerende vurdering, pkt. 4).

### Enhedsspørgsmålet: tvungen ensartet enhed eller fri enhed med omregning (Claude, 2026-10-15)

Spørgsmålet fra udvikleren: skal brugeren tvinges til at angive tillæg i samme enhed som TAF-grundlaget (fx
dagsløn), eller skal programmet tillade fx et månedligt tillæg ved angivet dagsløn og selv omregne med
«÷ 160,33 × 7,4»?

**Hvor enhederne faktisk mødes i dag**

1. Reguleringen er et forhold mellem to lønpakker (`buildReguleringsbevis(basePackage, packageValue)`).
   Forholdet ganges derefter på TAF-grundlaget, uanset om det er måneds- eller dagsløn. Pakkens enhed er
   ligegyldig for resultatet, så længe alle led i pakken har samme enhed. TAF-enheden indgår ikke i pakken.
2. Enhederne mødes kun, når et indtastet kronebeløb lægges til en tabelsats. Det sker for forhøjet grundløn og
   anciennitetstillæg, som lægges til løntrinssatsen. For offentlig overenskomst er satsens enhed
   «Ansættelse»; for privat er det overenskomstens `grundloenAngivetPer`. Det er de eneste to kronefelter i
   reguleringslaget. Resten er procenter.
3. Programmet har ingen faktor mellem dag og time (7,4) og behøver ingen. Et tillæg når aldrig dagslønnen
   direkte, kun gennem forholdet.
4. Programmet har allerede en faktor mellem dag og måned, og den stemmer ikke med 7,4 / 160,33.
   `TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR = 0,048` måned pr. arbejdsdag, dvs. ca. 20,83 arbejdsdage pr. måned,
   bruges til «Øvrigt fravær uden løn». 160,33 / 7,4 giver ca. 21,67. Indføres «÷ 160,33 × 7,4», har programmet
   to forskellige svar på, hvor mange arbejdsdage en måned har.

**Hvad det betyder for spørgsmålet**

A1 og A2 skyldes ikke, at brugeren taster i en anden enhed end TAF-enheden. De skyldes, at programmet udleder
beløbets enhed fra et andet felt (TAF-enheden) end det, der står ved beløbet («Ansættelse»). At tvinge brugeren
til TAF-enheden ville flytte fejlen, ikke fjerne den. Løntrinssatsen er stadig i måned eller time, så en
dagsværdi skal alligevel omregnes til pakkens enhed, nu med en ny 7,4-faktor. Den tvungne enhed ved angivet løn
(A2) er et eksisterende eksempel: omregningen lægges over på brugeren, uden for programmet og uden for bilaget.

**Anbefaling**

- **Enhed:** et kronetillæg skal have enheden for den sats, det lægges til (pakkens enhed), ikke TAF-enheden.
  Det fjerner TAF-enheden fra reguleringslaget og løser A1, A2 og C5 med én regel.
- **Frit valg mellem Time og Måned:** tillad brugeren at vælge enheden pr. kronefelt, men kun Time og Måned, som
  er de enheder, lønsedler og overenskomster bruger.
  - Gem enheden sammen med beløbet, og udled den aldrig af et andet felt.
  - Omregn ét sted med den eksisterende `convertAnciennitetSats`.
  - Vis omregningen i bilaget, som `formatAnciennitetConversion` allerede gør for anciennitet. Forhøjet
    grundløn mangler i dag både enhedsvalg og omregningstekst.
- **Tilbyd ikke «dag» som enhed for tillæg.** Det kræver 7,4-faktoren og kolliderer med 0,048-faktoren. Det
  forudsætter også fuld tid. Programmet kender ikke den ugentlige arbejdstid, så for en deltidsansat er en dag
  ikke 7,4 timer. Pakkemodellen tåler deltid, fordi begge led i summen er fuldtidssatser, og forholdet derfor
  er uafhængigt af arbejdstiden.
- **Kobl ikke «Ansættelse» og TAF-enheden med en validering.** De er uafhængige af gode grunde. En månedslønnet
  med «Fuld løn under ferie» = Nej får fx TAF i arbejdsdage.

**Kompleksitet og nye fejlkilder**

Med pakkemodellen er tilvæksten lille: ét nyt enhedsfelt (forhøjet grundløn), én omregningsfunktion og én
visningstekst, som begge findes. I dag afgør tre steder enheden: TAF-enheden via
`getGrundloenAngivetPerForOverenskomst`, «Ansættelse» i visningen og den tvungne enhed ved angivet løn. Det
bliver til ét. De reelle risici er:

- **Kontrollen kan blive blind.** Inspektionen bruger samme `resolveOffentligLoenEkstraGrundloen` som motoren,
  og det er derfor, den ikke fanger A1. Deler den også den nye omregning, kan den ikke opdage en enhedsfejl.
  Sikringen bør være håndregnede facitter i tests, ikke en egen kopi af funktionen.
- **Afrunding:** omregnede satser afrundes i dag til øre før brug (`round2`), og bilaget viser den samme
  afrundede værdi. Det skal bevares, så det viste er det beregnede.
- **Gemte sager:** et nyt enhedsfelt skal ved indlæsning have den enhed, feltet hidtil har vist. For forhøjet
  grundløn er det «Ansættelse»; for anciennitet ved angivet løn er det Time eller Måned efter «Beregnes ud fra».
  For forhøjet grundløn ændrer det resultatet, når «Ansættelse» ≠ TAF-enhed. Det er selve A1-rettelsen, men
  som ny fortolkning af en gemt værdi skal den forelægges efter CLAUDE.md.

**Hvis tillæg skal lægges absolut oven i dagslønnen**

Fx «500 kr./md. ÷ 160,33 × 7,4 = 23,08 kr./dag» lagt direkte til dagslønnen. Det er en anden beregningsmodel,
ikke blot en anden enhed. I dag virker et tillæg procentvis gennem pakken, så en angivet løn over
løntrinssatsen får et forholdsmæssigt større kronebeløb. De to modeller giver forskellige resultater, når den
angivne løn afviger fra løntrinssatsen.

Det er en domæneafgørelse, som bør træffes for sig og før enhedsspørgsmålet. Den absolutte model kræver desuden:

- en regel for, om og hvordan selve tillægget reguleres over tid
- én fastlagt faktor mellem dag og måned (0,048 eller 7,4 / 160,33)
- stillingtagen til deltid.

Kompleksiteten og antallet af nye fejlkilder ville være markant større. Anbefalingen er at bevare pakkemodellen.

### Supplerende vurdering af løsningen (Codex)

1. **Én evalueret reguleringsmodel før beløbsberegningen.** Det eksisterende `Reguleringsbevis` er et
   godt udgangspunkt og bør udvides inden for det nuværende flow. Det skal bære de anvendte
   komponenter, deres enhed og kilde-/referencedatoer samt et udtrykkeligt udfald, når regulering
   ikke anvendes. TAF og SFGG skal have adgang til samme relevante forløb, før nogen forbruger
   filtrerer dage med mængde 0 fra. Der er ikke brug for en parallel inputmodel.
2. **Dækning, reference og tillæg er forskellige oplysninger.** A5 viser, at en neutral fallback
   ikke er den eneste rod: en forkert betingelse kan også åbne for regulering. Kildens første
   gyldige sats må ikke forveksles med brugerens lønreferencedato. Store Bededag må ændre netop
   tillæggets komponent, uden samtidig at åbne/lukke historisk grundløn og pension.
3. **Visning og uafhængig kontrol har forskellige ansvar.** Bilag, kontrolfanens viste tabeller
   og forklaringstekster skal læse det faktisk beregnede grundlag, inklusive KL-kædens anvendte
   trin. En uafhængig numerisk kontrol er værdifuld, men skal rapportere en afvigelse eksplicit;
   den må ikke erstatte den viste beregning med sine egne tal eller skjule beregnede sektioner.
   Enhedsfejl bør desuden fanges af konkrete testfacitter fra håndregnede eksempler, så motor og
   kontrol ikke blot bliver enige om den samme fejl.
4. **Fail-closed skal være præcist afgrænset.** Et manglende segment for en dato, som en valgt
   beregning faktisk kræver, skal give et udtrykkeligt fejludfald. Lovligt fravalg, tomt valgfrit
   tillæg og datoer uden beregningsmæssig relevans er ikke samme situation. Et generelt AST-forbud
   mod `?? 0` eller en parser lukker ikke A5 og kan ramme lovlige tomværdier. Den primære sikring
   bør være typed udfald og forbrugernes dækningskontrol; et smalt arkitekturværn er supplement.
5. **Udviklerafgørelser før beregningsrettelser.** Punkt 4 i det oprindelige løsningsforslag er
   ikke en allerede dokumenteret basisårsregel, jf. bemærkningen til A3. B1, B2 og B3 skal have
   afklarede principper. En ændring af SFGG's reguleringsregel må ikke skjules i rettelsen af A4.
   Ingen af forslagene kræver i sig selv at ændre `.eo`-format eller persisterede feltadresser;
   en eventuel sådan ændring skal vurderes særskilt.

### Målrettet regressionsbeskyttelse efter godkendelse (Codex)

- A1/A2/C5: offentlig Månedsløn og Timeløn krydset med begge TAF-enheder; forhøjet grundløn og
  anciennitet hver for sig. Kontroller basispakke, periodeløn, reguleringsprocent, TAF-beløb og
  dokumentets satsenhed mod konkrete facitter. Medtag både KL og RLTN samt angivet løn og
  beregningsperiode, hvor de relevante inputvalg er tilgængelige.
- A3: ombyt to korrekte jobkort med forskellige referenceår. Samme ydelser og de samme jobs skal
  efter den besluttede regel give samme ydelsesregulering og nettokrav. En test med to datoer i
  samme år kan ikke opdage fejlen.
- A4/B3: samme SFGG-dage med og uden et TAF-segment, der får 0 arbejdsdage; adskil manglende
  dækning fra den besluttede ret til regulering. Kontroller sats, indeks, SFGG-fradrag og nettokrav.
- A5/B1/B2: TAF før og efter basis, på begge sider af 01-01-2024, Store Bededag til/fra, privat og
  offentlig overenskomst. Når tillægget er ens på begge sider af brøken, må togglen ikke ændre
  andre lønkomponenters historiske behandling. Medtag flere job, hvor kun ét rammes.
- C1–C4: sammenlign motorgrundlag, fælles PDF-/Word-dokumentmodel og kontrolvisning. KL-facittet
  skal indeholde flere reguleringstrin før TAF-start; ASL-kontrollen skal overleve en EO-slutdato
  efter sidste kendte ASL-år, når selve TAF-forløbet er dækket. Kontroller forklaringsteksten
  ved manuel regulering med en valgt overenskomst, hvis rå satser afviger fra de manuelle rækker.

**Kontrollens grænser:** De nye kørte eksempler beviser de beskrevne motor-/buildermekanismer.
De er ikke en gennemført UI-, load- eller dokumenteksporttest. A2's lave variant er kørt direkte
i reguleringsformen med en ansættelseskort-kontekst; de øvrige nævnte motorreproduktioner bruger
lønudviklingsmotoren eller nettomotoren. D1's eksterne data-/sæsonspørgsmål er ikke verificeret.
Pensionsvirkningen i SFGG blev også undersøgt: regulering med hele lønpakkens delta og efterfølgende
pensionstillæg følger de aktuelle formuleringer i SFGG-dokumentets §4.2 og §5. Der er derfor ikke
registreret en selvstændig fejl alene på grund af den kombination.

**Kørte eksisterende tests:** `reguleringsbevis.test.ts`, `reguleringsPresentation.test.ts`,
`loenudviklingBeregning.test.ts`, `tafNettoBeregning.test.ts`, `sfggSegmentering.test.ts` og
`reguleringSilentPathAlignment.test.ts` i `src/__tests__/domain/erstatningsopgoerelse/`:
6 filer, 181 tests bestået med `npx vitest run … --maxWorkers=2`.

---

## Afklaringslog (udvikler og Claude, fra 2026-10-15)

Afgørelser truffet i den efterfølgende dialog. Hver linje er bindende for implementeringen og går forud for
tidligere kommentarer i dokumentet, hvor de er uenige.

| # | Emne | Afgørelse |
|---|---|---|
| 1 | B1: nedregulering | TAF før reguleringsdatoen nedreguleres for alle former undtagen de to manuelle, som fortsat blokerer. |
| 2 | B1: KL-lønaftaler | Skal kunne nedregulere. Metode: samme som opregulering, spejlet: trin for trin fra reguleringsdatoen og bagud, løn₍ᵢ₋₁₎ = afrund(lønᵢ ÷ (1 + satsᵢ)), afrundet til øre efter hvert trin. Bilaget oplyser, at perioder før reguleringsdatoen er regnet baglæns fra den efterfølgende periode. `docs/domain/taf/kl-loenaftaler-regulering.md` §1.2 opdateres. |
| 3 | B1: offentlige ydelser | Ydelsesdelen af den hypotetiske indkomst skal også kunne nedreguleres (den årlige satsregulering spejlet bagud fra basisåret). |
| 3a | A3: ydelsernes basisår | Ved «Beregningsperiode» er basisåret altid året for beregningsperiodens slutdato. Et jobs «Evt. særlig fra-dato for regulering» påvirker aldrig ydelserne, og kortenes rækkefølge må ikke have betydning. Testen i `tafNettoBeregning.test.ts`, der kræver det modsatte, ændres. Angivet løn er uændret. (Bekræftet efter drøftelse af alternativet «følg den anvendte reguleringsdato», som er tvetydigt ved flere job og forkert, så snart et job har en særlig fra-dato.) |
| 4 | D1: ILON12 | Data er korrekte. Bilagsnoten (`ILON12_DISCONTINUED_NOTE`) bevares i PDF og Word. Desuden en linje under modelvalget i programmet (den delte `LoenudviklingFields.tsx`), med samme konstant. Domænedokumentationen skal beskrive, hvorfor 2025K4 står blandt K1-værdierne, og at ILON12 dækker til 30-09-2026. |
| 5 | B1: TAF før tabellens første sats | Altid blokering (rød ring på reguleringsfeltet og rød kontrolrække), også når «Tillad regulering med overenskomst, der ikke dækker hele perioden» er slået til. Ingen værdi føres bagud. Fremadrettet tolerance («Overenskomsten regnes for dækkende indtil») er uændret. (Ændret fra «første sats føres bagud» samme dag.) |
| 6 | B1: reguleringsdato før tabellens første sats | Altid blokering med rød ring på reguleringsdatoen, uanset indstillingen. Den offentlige basisklemme (`resolveOffentligEffectiveBase`, «U4-clamp») og den private `max(reguleringsdato, dækningsstart)`-klemme fjernes. |
| 7 | Indstilling | «Tillad regulering med overenskomst, der ikke dækker hele perioden» gælder herefter kun TAF-periodens slutning. Teksten ændres, fx til «Tillad regulering, når tabellen udløber før TAF-periodens slutning». Nøglen i `localStorage` bevares. |
| 8 | B3: SFGG-udvikling | Fastsættelse af satsen og dens udvikling er adskilt. Satser beregnet via referenceperiode (Ferieloven og overenskomst efter ferieloven) følger den reguleringsform, der gælder for ansættelsesforholdet, uanset overenskomstdækning. Udviklingen måles fra referenceperiodens slutdato: sats × indeks(dag) ÷ indeks(referenceperiodens slutdato), ikke fra lønnens reguleringsdato. Reguleringsforløbet skal derfor kunne slås op uden for TAF-perioden. Ligger referenceperiodens slutdato før kildens første sats, blokeres der (jf. 5–6). `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` §4.2–4.3 omskrives. |
| 8a | B3: SFGG ved manuel regulering | De manuelle former har ingen værdier før reguleringsdatoen. Slutter referenceperioden før reguleringsdatoen, regnes den for at have reguleringsdatoens niveau. Gul, ikke-blokerende advarsel, når referenceperioden slutter mere end 12 måneder før reguleringsdatoen. |
| 8b | B3: direkte overenskomstsats | Undtagelse fra 8: en direkte overenskomstsats (`overenskomst_direkte`, §4.1) følger overenskomstens egne daterede satser og reguleres ikke yderligere med TAF-reguleringen, heller ikke når jobbets reguleringsform er en anden. |
| 8c | B3: manuel dagssats | Bevidst designbeslutning: en «Manuel dagssats» er konstant i hele perioden og reguleres ikke. Begrundelse: en manuelt angivet SFGG-sats vil typisk være fastlagt ved forlig med skadevolder, og et sådant rummer ikke mulighed for senere udvikling. Undtagelse fra 8. Skrives ind i `sygeferiegodtgoerelse.md` §4.3 og ved `SFGG_KILDE_REGISTRY` (`manuel`), så det ikke senere fremføres som en fejl. |
| 8d | B3: selvstændig KL-kæde for SFGG | Godkendt af udvikleren 2026-10-16: ved KL-lønaftaler udvikles SFGG-dagssatsen i sin egen kæde fra referenceperiodens slutdato med øreafrunding efter hvert trin. Reglen gælder ens i alle sager, uanset TAF-lønnens størrelse, reguleringsdato og om jobbet har løn i beregningsperioden. Der anvendes ikke et forhold mellem to TAF-kædelønninger. Bilaget viser SFGG-kædens faktisk anvendte trin. Facit: 250,00 kr. pr. 31-01-2022 → 256,38 kr. fra 01-10-2022 → 257,15 kr. fra 01-04-2023 → 260,36 kr. fra 01-10-2023. |
| 9 | B2: Store Bededag og reguleringsform | Tillægget lægges ikke på ved Statistik, KRL, KL-lønaftaler og «Manuel procentsats» (indeholdt i indeks/satser, hhv. bevidst fravalg). «Manuelt angivet» beholder tillægget som et lag fra 01-01-2024, ligesom overenskomstformerne. Kommentaren ved `eoRowIndkomstRows.ts:360` («uanset reguleringsform») rettes. |
| 9a | B2: grundlaget ved beregningsperiode | Ved «Beregningsperiode» med reguleringsdato 01-01-2024 eller senere indgår tillægget i grundlaget for alle reguleringsformer, men kun når «Løn på helligdage» = «Almindelig løn» og knappen «Beregn Store Bededagstillæg» står til (dagens `harValgtStoreBededagstillaeg`). Udviklerens oprindelige svar var for kategorisk. |
| 9b | B2: knap og advarsel | Knappen «Beregn Store Bededagstillæg» og advarslen «Der vil sædvanligvis være krav på Store Bededagstillæg …» skjules via descriptorens relevansregel, når knappen ingen virkning har. Den har virkning ved Overenskomst og «Manuelt angivet» samt ved «Beregningsperiode» med reguleringsdato 01-01-2024 eller senere. Den gemte værdi bevares og læses ikke, mens den er skjult. |
| 9c | B2: angivet løn | «Månedslønnen udgør»/«Dagslønnen udgør» er den samlede løn på datoen inkl. alle lønandele, herunder Store Bededagstillæg, hvis det blev udbetalt på datoen. Programmet lægger intet til. Ingen hjælpetekst: brugeren beregner beløbet ud fra alle lønandele. |
| 9d | B2: «Beløb»-tilstand | Undtagelse fra 9a: i «Beløb»-tilstand bestemmer de indtastede beløb alene. Programmet lægger hverken Store Bededag eller andre tillæg til, heller ikke når reguleringsdatoen ligger i 2024 eller senere og beregningsperioden før. |
| 10 | Enheder: model | Pakkemodellen bevares: forhøjet grundløn og anciennitetstillæg lægges til løntrinssatsen og virker procentvis på TAF-grundlaget. De lægges aldrig absolut oven i dags- eller månedslønnen. Der indføres ingen omregning mellem dag og time (7,4). |
| 10a | Enheder: valg og omregning | Et kronetillæg regnes altid om til pakkens enhed: «Ansættelse» ved offentlig overenskomst, overenskomstens `grundloenAngivetPer` ved privat. TAF-enheden indgår ikke (retter A1, A2 og C5; `getGrundloenAngivetPerForOverenskomst` mister TAF-parameteren for KL/RLTN). Både «Forhøjet grundløn» og «Anciennitetstillæg» får frit valg mellem Time og Måned på begge flader, også ved angivet løn. Enheden gemmes med beløbet og udledes aldrig af et andet felt. Én omregning (`convertAnciennitetSats`, faktor 160,33), afrundet til øre før brug, vist i bilaget som i dag for anciennitet. «Dag» tilbydes ikke. Gemte sager får ved indlæsning den enhed, feltet hidtil har vist: forhøjet grundløn = «Ansættelse»; anciennitet ved angivet løn = Time ved dagsløn, Måned ved månedsløn (se faldgruben i AP1: den persisterede værdi kan ikke bruges for ældre filer). |
| 11 | A5: følger af 1 | Begge overenskomstgrene regulerer historisk efter kildens satser uanset Store Bededag-knappen. Knappen styrer kun tillæggets egen komponent. Proxy-grenen `useFallbackBaseBeforeCoverage` udgår. |
| 12 | Gemte sager | Godkendt af udvikleren 2026-10-15 (7a), jf. CLAUDE.md's godkendelsesgate: gemte sager genberegnes efter de nye regler, herunder nye blokeringer (5–6) og den ændrede enhedsfortolkning af forhøjet grundløn (10a). Ingen besked ved indlæsning (7b, begrundelse: sjældne, helt undtagelsesvise grænsetilfælde); ændringerne nævnes kun i release-noten. |

---

## Implementeringsplan

Planen omsætter afklaringsloggen til arbejdspakker (AP). Rækkefølgen er valgt efter afhængigheder: AP1 er
uafhængig og har den højeste alvor; AP2 er fundament for AP4 og AP6; AP3 skal være på plads, før AP4 åbner for
opslag før reguleringsdatoen. Hver AP afsluttes grøn efter AGENTS.md's rækkefølge før commit (`typecheck`,
`typecheck:test`, `lint`, relevante tests) og committes for sig. Efter sidste AP køres `npm run verify:release`
inkl. E2E, fordi flere AP'er ændrer komponenter og moduler, som kun Playwright ser.

**Fælles krav til alle AP'er**

- Ingen stille neutral fallback: en dato, som en valgt beregning kræver, men som kilden ikke dækker, giver et
  udtrykkeligt fejludfald. Lovligt fravalg og tomme valgfrie felter er ikke fejl (Codex' supplerende vurdering pkt. 4).
- Tests bruger håndregnede facitter fra dette dokument, ikke motorens egen udregning, så motor og inspektion ikke
  bliver enige om samme fejl.
- Rød ring kræver et `FieldIssue` på feltets adresse. En `ValidationError` med streng-`path` blokerer download,
  men tegner ingen ring (`docs/architecture/input-architecture.md` §185-202).
- PDF og Word deler dokumentmodellen; enhver tekst- eller tabelændring kontrolleres i begge.
- Vist = beregnet: afrundede mellemresultater, der vises i bilaget, er de samme, som der regnes med.

### AP1 – Enheder for kronetillæg (A1, A2, C5; log 10, 10a, 12)

**Mål:** Forhøjet grundløn og anciennitetstillæg regnes om til pakkens enhed med én funktion. TAF-enheden indgår
ikke nogen steder i reguleringslaget.

**Ændringer:**
- `overenskomstOffentligSegmenter.ts:49-53`: kildeenheden er feltets gemte enhed, målenheden er «Ansættelse»
  (`offentlig.loenType`), ikke TAF-enheden.
- `overenskomstRates.ts:1608-1620` (`getGrundloenAngivetPerForOverenskomst`): for KL/RLTN returneres
  «Ansættelse»-enheden; TAF-parameteren udgår. Kaldet i `overenskomstReguleringShared.ts:65-68` og i
  `reguleringSection.ts:317-324` følger med.
- `angivetLoenHelpers.ts:59`: den tvungne enhed fjernes; den gemte værdi læses.
- Inspektionen (`eoInspektionRegulationCore.ts:632-636`, `eoInspektionLoenCoreModel.ts:147-152`) følger samme
  regel.
- C5: reguleringsbeviset bærer satsens enhed, og `reguleringsPresentation.ts:203-229` og `396-400` læser den i
  stedet for at udlede den af TAF-enheden.
- UI: «Forhøjet grundløn» får enhedsvalg (Time/Måned) på begge flader (`AnsaettelsesforholdCard.tsx:79`,
  `useEoOplysningerViewModel.ts:163`). Anciennitet får valget også på EO-fladen; kommentaren i
  `AnciennitetstillaegFields.tsx:17-27` opdateres, da forskellen nu er besluttet væk.
- Bilaget viser omregningen for begge felter, som `formatAnciennitetConversion` gør for anciennitet i dag
  (`reguleringDocument.ts:99`, `366`).

**Persistens og faldgruber:**
- Nyt felt for enheden af forhøjet grundløn i `loenudviklingOgSatserShape`
  (`erstatningsopgoerelseSchemas.ts:263`). Default for ældre filer afhænger af `offentligLoenType` og kan derfor
  ikke være en statisk zod-default; den sættes i load-adapteren.
- **Faldgrube:** `eoAngivetLoenLoenudviklingSchema.anciennitetstillaegSatsAngivesPer`
  (`erstatningsopgoerelseSchemas.ts:341`) findes allerede som persisteret felt med schema-default `'Måned'`, men
  det er aldrig blevet vist eller læst ved angivet løn. For filer gemt før rettelsen kan værdien ikke bruges: en
  dagslønssag med den gemte default `'Måned'` ville ændre tillægget med faktor 160,33. Værdien skal ved
  indlæsning overskrives efter `beregnesUdFra` (Time ved dagsløn, Måned ved månedsløn) for filer med en ældre
  `persistedDataVersion`. Versionsstyret migration efter `src/contracts/schema-evolution.md`.
- Ansættelseskortets anciennitetsenhed er allerede vist og gemt og skal ikke migreres.

**Accept:**
- Matrix: offentlig Månedsløn/Timeløn × TAF i måneder/arbejdsdage × forhøjet grundløn/anciennitet hver for sig,
  KL og RLTN, angivet løn og beregningsperiode.
- Facitter: A1 (Codex) 1,24 % i stedet for 0,14 %; A2 (Codex) 2,58 % i stedet for 0,02 % og 414,25 %.
- C5: overskriften «Månedsløn» over 18.607,42 / 19.351,75 / 19.603,25.
- Load-test af ældre `.eo` for begge migrationsregler: anciennitet ved angivet dagsløn giver uændret resultat.

### AP2 – Reguleringsopslag pr. dato (fundament; A4)

**Mål:** Ét opslag pr. ansættelsesforhold, `regulering(d)`, der gælder for enhver dato inden for kildens dækning,
uafhængigt af TAF-arbejdsdage. TAF-segmenter og SFGG bruger det samme opslag.

**Ændringer:**
- Udvid det eksisterende `Reguleringsbevis`-flow (Codex' supplerende vurdering pkt. 1); ingen parallel inputmodel.
- Definition: indeks- og pakkeformer giver pakke(d) ÷ pakke(basis); KL-lønaftaler giver kædeløn(d) ÷ basisløn.
- Udfaldet er typed: en værdi eller «uden for dækning», aldrig en stille basissats.
- SFGG må ikke længere afhænge af de segmenter, der overlever `loenudviklingBeregning.ts:242`
  (`if (arbejdsdage <= 0) continue;`).

**Accept:** A4 (Codex): de seks SFGG-dage giver 360,00 kr. med indeks 105,60, også når de løse feriedage fjerner
TAF-segmentet.

### AP3 – Dækning og blokering (log 5, 6, 7)

**Mål:** Én dækningsregel for alle former, inkl. Overenskomst: kilden skal have en sats på reguleringsdatoen og på
TAF-start. Altid blokerende; indstillingen påvirker kun slutningen.

**Ændringer:**
- `validateLoenudviklingDataCoverage` (`erstatningsopgoerelseValidator.ts` fra linje 1246): Overenskomst tages
  med, og den nedre grænse kontrolleres for både reguleringsdato og TAF-start.
- `eoRowIndkomstRows.ts:640-665`: rækkerne «Reguleringsværdi på …» og «start-dato for TAF» er altid `error`;
  `allowIncompleteOverenskomst` læses kun i slutrækken (`670-692`).
- Rød ring (`FieldIssue`): ved TAF-start før dækning på reguleringsformens valgfelt; ved reguleringsdato før
  dækning på det felt, der leverer datoen (`saerligFraDatoRegulering`, `angivet…OpreguleresFraDato` eller
  `tafBeregningsperiodeTil`).
- Klemmerne fjernes: `resolveOffentligEffectiveBase` (`overenskomstOffentligSegmenter.ts:62-84`) og den private
  `max(reguleringsdato, dækningsstart)`-klemme. Motoren kaster, hvis den alligevel nås.
- De manuelle former: TAF før reguleringsdatoen blokerer som i dag. Fejlteksten siger, at der skal vælges en
  anden reguleringsform.
- Indstillingen: ny tekst i `Indstillinger.tsx:409`; `src/contracts/app-settings.md` og kommentaren ved
  `appSettingsSchema.ts:144-150` beskriver, at den kun gælder TAF-periodens slutning.

**Accept:**
- TAF-start før første sats (privat overenskomst med satser fra 01-03-2011) blokerer med og uden indstillingen.
- Reguleringsdato før første sats blokerer.
- TAF-slut efter udløb opfører sig som i dag med og uden tolerance.

### AP4 – Nedregulering (B1, A5, C2; log 1, 2, 11)

**Mål:** Segmenter før reguleringsdatoen reguleres efter kildens forløb med samme formel som fremad.

**Ændringer:**
- Grenene «før basis → 0 %» fjernes: `statistikForm.ts:98-100` (ASL) og `147-149` (ILON12/SBLON2),
  `krlForm.ts:93-95`, `overenskomstOffentligSegmenter.ts:185-198` inkl. `useFallbackBaseBeforeCoverage`, og
  `overenskomstPrivatSegmenter.ts:144-169`.
- KL-lønaftaler (`klLoenaftalerReguleretLoen.ts:86-93`): baglæns kæde efter log 2. `deltaPct` afledes fortsat af
  den afrundede kædeløn (invariant 2 i `kl-loenaftaler-regulering.md` §5), og `reguleretLoenOre` sættes også før
  basis.
- Store Bededag-knappen må ikke åbne eller lukke historiske opslag; den styrer kun tillæggets komponent (log 11).
- De manuelle former ændres ikke; de blokeres af AP3.
- Kontrollér `roundReguleringDeltaPct` med negative værdier: afrundingsretningen skal være symmetrisk og
  dokumenteret.

**Dokumentation:** `kl-loenaftaler-regulering.md` §1.2 (baglæns kæde), `tabt-arbejdsfortjeneste.md`
(nedregulering, med henvisning til BB-261), `src/contracts/indskudte-loentillaeg-contract.md` (knappen påvirker
ikke historisk regulering).

**Accept:**
- B1: SBLON2, 40.000 kr. pr. 01-01-2025, TAF fra 01-03-2022 giver ca. −10,8 % (2022), −7,7 % (2023), −4,6 % (2024).
- A5: med knappen til og fra er grundløn og pension i historiske segmenter ens, offentlig og privat; flere job,
  hvor kun ét rammes.
- KL baglæns: et facit med flere trin før reguleringsdatoen, hvor hver periodes løn = afrund(næste periodes løn ÷
  (1 + sats)).
- C2: ASL-tabellen vises, når TAF starter før basisåret.

### AP5 – Offentlige ydelser (A3; log 3, 3a)

**Ændringer:**
- `tafNettoBeregning.ts:117-141`: ved «Beregningsperiode» er basis altid `tafBeregningsperiodeTil`; jobbenes
  særlige fra-dato og `resolveAktivEllerFoersteLoenudviklingKilde` bruges ikke. Validatoren
  (`erstatningsopgoerelseValidator.ts:611-620`) spejler det.
- Nedregulering: `offentligeYdelserUdviklingBeregning.ts` giver år før basisåret den spejlede faktor, og
  præsentationstabellen (`offentligeYdelserUdviklingBeregning.ts:86-123`) viser også årene før basisåret.
- **Faldgrube:** `opregulerMedAkkumuleretReguleringssats` (`src/domain/satser/opreguleringsmotorer.ts:164`)
  bruges også af `eetEalCalculation.ts`, `erhvervsevnetabDescriptors.ts`, `tafPerYearOpreguleretDerived.ts` og
  validatoren. Reglen `maalAar <= kildeAar → ingen regulering` må ikke ændres globalt; indfør en eksplicit
  baglæns variant, så de øvrige brugere er uændrede.

**Accept:**
- Codex' A3-kørsel: ombyttede jobkort giver samme ydelsesdel (132.912,00 kr.) og samme TAF-netto.
- BB-261: ydelser i en beregningsperiode efter skaden nedreguleres til TAF-årene.
- Testen i `tafNettoBeregning.test.ts`, der kræver jobbets særlige dato, ændres.

### AP6 – Sygeferiegodtgørelse (B3, A4; log 8, 8a, 8b, 8c)

**Ændringer:**
- `resolveAdjustedRate` (`sfggSegmentering.ts:454-474`): sats × regulering(d) ÷ regulering(referenceperiodens
  slutdato) via AP2, for kilderne `ferielov` og `overenskomst_ferielov` uanset overenskomstdækning.
- `overenskomst_direkte` er uændret (8b); `manuel` er konstant (8c).
- Manuel reguleringsform: en referenceperiode, der slutter før reguleringsdatoen, får basisniveau; gul,
  ikke-blokerende advarsel, når afstanden er over 12 måneder (8a).
- Referenceperiodens slutdato før kildens første sats blokerer efter AP3's regel.
- KL-lønaftaler følger den senere godkendelse i log 8d: referencesatsen udvikles i sin egen kæde fra
  referenceperiodens slutdato med øreafrunding efter hvert trin. Der bruges ingen TAF-kædelønsratio;
  de faktisk anvendte SFGG-trin bæres til bilagets forklaring.

**Dokumentation:** `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` §4 omskrives (4.1 direkte sats
følger overenskomsten; 4.2 referenceperiodesats følger jobbets reguleringsform fra referenceperiodens slutdato;
4.3 manuel dagssats er bevidst konstant med begrundelsen fra log 8c). `sfggKilde.ts`: beskrivelsen af
`referenceperiode` (linje 35) og begrundelsen ved `manuel` i `SFGG_KILDE_REGISTRY`.

**Accept:**
- Dialogens eksempel: SBLON2, sats 250,00 kr. fra januar 2022, reguleringsdato 01-01-2025 giver 250,00 / 258,49 /
  267,20 / 280,16 for 2022–2025.
- Manuel regulering: advarsel ved 13 måneders afstand, ingen ved 11.
- Direkte overenskomstsats ved KRL: overenskomstens sats, ingen KRL-faktor.
- Manuel dagssats: konstant i alle år.
- Egen KL-kæde: 250,00 → 256,38 → 257,15 → 260,36 på datoerne i log 8d, også med forskellige
  TAF-løngrundlag og når jobbet ingen løn har i beregningsperioden.

### AP7 – Store Bededag (B2; log 9, 9a, 9b, 9c, 9d)

Beregningen er allerede som besluttet i 9, 9a, 9c og 9d. Ændringerne er brugerflade og dokumentation.

**Ændringer:**
- Relevans på descriptoren for knappen og advarslen (9b): relevant, når «Løn på helligdage» = «Almindelig løn» og
  enten reguleringsformen er Overenskomst eller «Manuelt angivet», eller beregningen sker ud fra
  «Beregningsperiode» med anvendt reguleringsdato 01-01-2024 eller senere.
- **Faldgrube:** en skjult værdi gives som tomværdi til alle læsere. Relevansen skal derfor være præcis
  virkningsbetingelsen; er den smallere, forsvinder et valgt tillæg tavst.
- Kommentaren ved `eoRowIndkomstRows.ts:360` rettes; advarslen (`eoRowIndkomstRows.ts:381`) bruger samme
  prædikat.

**Dokumentation:** `indskudte-loentillaeg-contract.md` (hvilke former tillægget gælder for); 9c og 9d i
`tabt-arbejdsfortjeneste.md`.

**Accept:**
- Angivet løn + Statistik: knappen er skjult.
- Beregningsperiode + Statistik: knappen er synlig ved reguleringsdato i 2024 og skjult ved 2023.
- Grundlaget får +0,45 % kun med begge betingelser.
- «Beløb»-tilstand: intet tillæg lægges til.
- «Manuelt angivet»: tillægget fra 01-01-2024 som i dag.

### AP8 – Visning og kontrol (C1, C2, C3, C4)

Ingen principspørgsmål. Følg de strukturelle løsninger under hvert fund:
- **C1:** Motoren udstiller den faktisk anvendte KL-kæde med sats og afrundet løn før/efter hvert trin, også de
  baglæns trin (log 2). Bilaget får linjen om baglæns beregning.
- **C2:** `reguleringsPresentation.ts:452-454` må ikke fjerne hele tabellen for ét segment.
- **C3:** Kontrolsektioner udvælges fra motorens resultater og kræver ikke satsdækning ud over de regulerede
  perioder.
- **C4:** Forklaringsteksten afledes af motorens reference- og periodekomponenter.

**Accept:** Codex' regressionspunkt for C1–C4, med PDF/Word-paritet.

### AP9 – ILON12, dokumentation og release (D1; log 4, 12)

- En linje under modelvalget i `LoenudviklingFields.tsx`, når ILON12 er valgt, med teksten fra
  `ILON12_DISCONTINUED_NOTE`. Konstanten ligger i dag i `src/document/generators/eo/reguleringNotes.ts`; flyt den
  til et fælles modul, hvis arkitekturreglerne ikke tillader komponenten at importere derfra. Bilagsnoten bevares.
- Domænetekst om de statistiske modeller i `docs/domain/taf/`. Den findes ikke i dag. Den skal beskrive, at
  2025K4 bevidst står blandt K1-værdierne som sidste offentliggjorte niveau, at ILON12 dækker til 30-09-2026, og
  at TAF efter 01-10-2025 ikke reguleres yderligere.
- Release: repoet har ingen release-note-fil. Ændringerne i gemte sagers resultater (log 12) beskrives i
  commit-beskederne og meddeles brugerne af udvikleren.
- Til sidst: `npm run verify:release`.
