# Brugerblik – Erstatningsopgørelse → EO-kontrol og Kontroltabel (12m)

- Rute/placering: `/erstatningsopgoerelse` → de to lodrette kontrolfaner i højre side, «EO-kontrol» og «Kontroltabel», som
  kun vises, når «Vis kontrolfaner på Erstatningsopgørelse-side» er slået til under Indstillinger (standard: fra).
  «Kontroltabel» rummer oversigten over intervaller, «Download tabel (CSV-format)», «Sammentælling» og dag-for-dag-tabellen.
- Gennemgået: 2026-10-30 · commit `e8173c8b`
- Afgjort og gennemført: 2026-10-30 – alle ti fund godkendt og gennemført samme dag
- Afprøvet i: Chrome headless, lyst tema, 1536×864, mod e2e-buildet. 13 sager indlæst gennem «Hent» (krypteret `.eo` bygget
  på den låste 3.14-testfil «REGULERING-FIKTIV»), en tom sag og to UI-forløb (fanerne slået fra og til, mens «Kontroltabel» er
  aktiv; piletaster og Tab fra hovedfanerne). For hver sag er «Beregning», «EO-kontrol» og «Kontroltabel» aflæst som tekst,
  CSV-filen hentet og læst, og de tvivlsomme afsnit fotograferet. **Grundsag:** som 12k/12l – skadedato `11-07-2025`,
  opgørelse nr. 3 lavet `25-09-2026`, «Vedrører perioden» `25-05-2026` – `20-09-2026`, beregningsperiode `01-07-2024` –
  `30-06-2025`, ét ansættelsesforhold «Fiktivt arbejdssted» med manuel regulering, seks sygedagpengerækker.

## Fladen kort

De to faner er sagens regnskab, slået fra som standard. «EO-kontrol» viser hver oplysning og hvert mellemresultat som en
række med ✓, gul trekant eller rødt kryds. «Kontroltabel» lægger sagen ud dag for dag – hverdag, SH-dag, ferie, arbejdsdag,
svie/smerte-dag, TAF-dag og løn/ydelser pr. dag – og sammenholder dagsummerne med beregningens tal i «Sammentælling». Fanen
er også målet for linket «Kontroltabel» i «Fejl og advarsler», når beregningen og tabellen er uenige (BB-290).

**Fladens bærende iagttagelse er, at kontrolfanerne taler programmets sprog, ikke brugerens.** Afsnittene hedder noget andet
end de sektioner, de kontrollerer (BB-383); værdierne skifter mellem «ok», «Ja» og «-» for samme tilstand (BB-384);
oversigten har «Tabelperiode (definerende)» (BB-387); og de spærrede tilstande taler om «snapshot» og «committed data»
(BB-389). **Det ene egentlige vildspor er tom-tilstanden:** «Kan ikke oprette kontroltabel» nævner skadedatoen som nok,
men tabellen bygges ikke af den (BB-380). **CSV-filen mister ansættelsesforholdenes navne** (BB-381).

**Tallene er ikke vurderet.** Sammentællingen stemte i alle målte sager; reglerne bag dagstyperne er de øvrige bidders.

**Afgrænsning.** Rækkernes indhold – fx «Første erstatningsopgørelse?» og svie/smerte-rækkerne – er afgjort i 12a–12l (M-28).
Her er prøvet fladernes form, navne, tomme og spærrede tilstande, CSV-eksporten og samspillet med Indstillinger.

## Fund

### BB-380 – «Kan ikke oprette kontroltabel» nævner skadedatoen, men tabellen bygges ikke af den

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:**
  1. Grundsagen uden «Vedrører perioden», uden beregningsperiode, uden TAF- og svie/smerte-perioder, uden lønindkomst og
     offentlige ydelser. Skadedatoen `11-07-2025` står.
  2. Åbn «Kontroltabel».
- **Det sker:** Nederst, under «Sammentælling», står «Kan ikke oprette kontroltabel – Der mangler dato-oplysninger til at
  oprette tidslinjen. Kontroltabellen kræver mindst én af følgende: **Stamdata: Skadedato** · Erstatningsopgørelse: Periode
  (fra/til) · TAF-perioder … · Svie/smerte-perioder …». Skadedatoen er udfyldt. Øverst står alle intervaller `-`, og
  downloadknappen er grå med «Indtastning mangler». Tabellen bygges reelt af seks kilder – erstatningsperioden,
  beregningsperioden, lønindkomst, offentlige ydelser, svie/smerte og TAF – og skadedatoen er ikke én af dem
  (`eoInspektionKontrolModel.ts:511-520`). Feltet hedder «Vedrører perioden», ikke «Periode».
- **Det er uhensigtsmæssigt fordi:** Brugeren får at vide, at en oplysning, han har udfyldt, er det, der mangler, og
  listen udelader tre af de veje, der faktisk virker. Forklaringen står desuden længst nede, under to tabeller med `-`.
- **Bedre ville være:** Rette listen og flytte den op under oversigten, hvor knappen er grå: «Kontroltabellen dannes af
  sagens perioder. Udfyld mindst én af: «Vedrører perioden», beregningsperioden, en TAF- eller svie/smerte-periode,
  lønindkomst eller offentlige ydelser.» Downloadknappens tooltip: «Der er ingen perioder at vise».
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** forklaringen står under oversigten, lige over den grå knap: «Kontroltabellen dannes af
sagens perioder. Udfyld mindst én af: «Vedrører perioden», beregningsperioden, en TAF- eller svie/smerte-periode,
lønindkomst eller offentlige ydelser.» Knappens tooltip: «Der er ingen perioder at vise». Den gamle boks nederst er
fjernet; knappen og forklaringen afgøres af samme betingelse.

### BB-381 – CSV-filen med to ansættelsesforhold har samme kolonnenavne to gange og intet navn på ansættelsesforholdet

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Grundsagen med et ekstra ansættelsesforhold. Hent «Download tabel (CSV-format)».
- **Det sker:** På skærmen står ansættelsesforholdets navn over hver kolonnegruppe. I CSV-filen er første linje
  `…;TAF-regulering;Løn;Løn (2);ATP og anden løn u. tillæg;FP/FV/SH/ SO/St.B.;Arb.g. Pension;Samlet løn;TAF-regulering;Løn;
  Løn (2);…;Samlet løn;Sygedagpenge` – syv navne to gange, uden at det fremgår, hvilket ansættelsesforhold de hører til. Med
  ét ansættelsesforhold mangler navnet også, men kolonnerne er entydige.
- **Det er uhensigtsmæssigt fordi:** Filen findes for at blive lagt i et regneark. Dér kan brugeren ikke skelne to
  ansættelsesforholds løn, og et regneark, der slår op på kolonnenavn, tager den første.
- **Bedre ville være:** Ansættelsesforholdets navn foran hver af dets kolonner: «Fiktivt arbejdssted – Løn»,
  «Fiktivt arbejdssted – Samlet løn» (ved navnløse «Ansættelsesforhold 2 – Løn»).
- **Andre steder det kan gælde:** Ingen; CSV er programmets eneste tabeleksport.

**Gennemført 2026-10-30:** hver kolonne under et ansættelsesforhold hedder i CSV-filen «Fiktivt arbejdssted – Løn»,
«Fiktivt arbejdssted – Samlet løn» osv., også «… – TAF-regulering»; et navnløst hedder «Ansættelsesforhold 2 – Løn».
Har to ansættelsesforhold samme navn, får de nummeret bag navnet («Kommunen (1) – Løn»), så ingen to kolonner hedder
ens. Kolonnenavnene er de fulde navne uden skærmens linjeskift og forkortelser: «Ikke-pensionsgivende løn» (før
«Ikke-pens. giv. løn») og ydelser som «Ledighedsydelse» (før «Ledigheds- ydelse»).

### BB-382 – CSV-filen hedder altid «kontroltabel.csv»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Hent CSV-filen i to sager.
- **Det sker:** Begge filer hedder `kontroltabel.csv`; browseren gør den anden til `kontroltabel (1).csv`. Alle andre
  dokumenter hedder `{journalnr} - {titel}` (`documentFileName.ts:41`). Kolonnen «FP/FV/SH/SO/St.B.» får desuden et
  mellemrum midt i navnet (`FP/FV/SH/ SO/St.B.`), fordi skærmens linjeskift bliver til et mellemrum.
- **Det er uhensigtsmæssigt fordi:** Filen kan ikke genfindes på sagen.
- **Bedre ville være:** `REGULERING-FIKTIV - Kontroltabel.csv`, samme regel som dokumenterne, og kolonnenavnet uden
  mellemrum.
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** filen hedder `{journalnr} - Kontroltabel.csv` (uden journalnr `Kontroltabel.csv`) efter
dokumenternes filnavnsregel, som nu er én fælles regel for alt, der hentes til en sag. «FP/FV/SH/SO/St.B.» står uden
mellemrum.

### BB-383 – EO-kontrols afsnit hedder noget andet end de sektioner, de kontrollerer

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Åbn «EO-kontrol» i grundsagen og sammenlign med «EO oplysninger».
- **Det sker:** «AES» (på EO oplysninger «AES-afgørelser»), «Svie og smerte» («Svie- og smertegodtgørelse») og «TAF
  beregningsgrundlag» («Indtægt før skadedatoen»). De øvrige afsnit hedder det samme begge steder.
- **Det er uhensigtsmæssigt fordi:** Fanen bruges til at finde ud af, hvor et kryds kommer fra. Navnet er den eneste
  forbindelse tilbage – rækkerne har intet link – og «TAF beregningsgrundlag» peger ikke på «Indtægt før skadedatoen».
- **Bedre ville være:** Samme navne som sektionerne på EO oplysninger.
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** «AES-afgørelser», «Svie- og smertegodtgørelse» og «Indtægt før skadedatoen» (ved
erhvervssygdom «Indtægt før anmeldelsesdatoen», som sektionen på EO oplysninger).

### BB-384 – Samme tilstand vises som «ok», «Ja» eller «-», og to rækker har etiket og værdi byttet om

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Grundsagen og den tomme sag på «EO-kontrol».
- **Det sker:** «Offentlige ydelser → Sygedagpenge: **ok** ✓», mens lønindkomstens tilsvarende række siger «Alle
  lønoplysninger indtastet korrekt: **Ja** ✓». «Eventuelle særlige bemærkninger» har én række med etiketten **«Ingen»** og
  værdien `-` (samme form i «Øvrige erstatningskrav» og «Bilagsnumre»). I den tomme sag står etiketten **«Advarsel»** med
  værdien «Advarsel (Der er ikke angivet nogen svie/smerte-periode i EO-perioden)».
- **Det er uhensigtsmæssigt fordi:** «ok» er det eneste engelske ord på fladen, og en etiket, der er selve svaret, eller
  et ord, der står to gange, får rækken til at ligne en fejl.
- **Bedre ville være:** «Sygedagpenge: Ja» (som lønindkomsten); «Bemærkninger: Ingen»; advarselsrækken får emnets navn som
  etiket: «Periode: Advarsel (…)».
- **Andre steder det kan gælde:** Rækker bygget med `formatStatusMessage` uden emne-etiket (uverificeret ud over de målte).

**Gennemført 2026-10-30:** «Sygedagpenge: Ja» (alle ydelsestyper); «Bemærkninger: Ingen» (med en bemærkning
«Bemærkninger: …»); «Øvrige krav: Ingen» og, når kravvalget er «Ja» uden poster, «Øvrige krav: Advarsel (Der er ikke
indtastet øvrige krav)»; «Bilagsnumre: Ingen». Alle 21 rækker med etiketten «Advarsel» fik emnets navn, ikke kun den
målte: «Periode» / «Perioder» (svie/smerte og TAF), «Midlertidigt EET», «Overenskomst», «Sidste dag i
ansættelsesforholdet», «Løn efter ophør», «Store Bededagstillæg», «Grundløn», «Anciennitetstillæg», «Reguleringsværdier»,
«Opsagt fra stillingen», «Referenceperiode» og «Sygeløn». Alle rækkerne har deres egen linje i «Fejl og advarsler», så
linjerne dér er uændrede.

### BB-385 – En tom beregningsperiode hedder «ugyldig» på EO-kontrol og «mangler» i «Fejl og advarsler»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Ny, tom sag; åbn «EO-kontrol».
- **Det sker:** «TAF beregningsgrundlag» har to røde rækker: «Periode til beregning af før-løn: Fejl (Ikke alle felter
  udfyldt)» og «Måneder: Fejl (Beregningsperioden er ugyldig)». «Fejl og advarsler» siger om samme forhold «Der mangler
  indtastninger i perioden til beregning af før-løn».
- **Det er uhensigtsmæssigt fordi:** Tre formuleringer for én mangel (prøvekatalogets A5), og «ugyldig» om noget, der ikke
  er tastet, får brugeren til at lede efter en forkert dato.
- **Bedre ville være:** Én rød række med «Fejl og advarsler»'s ordlyd; «Måneder» viser `-` uden kryds, så længe perioden
  mangler.
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** «Periode til beregning af før-løn: Fejl (Der mangler indtastninger i perioden til beregning af
før-løn)» – samme ordlyd som «Fejl og advarsler». «Måneder» og «Arbejdsdage» viser `-` uden kryds, så længe perioden ikke
er tastet færdig. En periode, der er tastet, men forkert (fx til før fra), hedder fortsat «ugyldig» på de to rækker.

### BB-386 – «Sammentælling» viser ✓ for ingenting og tomme tabeloverskrifter

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Den tomme sag og grundsagen med TAF «Nej».
- **Det sker:** Sammentællingen er fire tabeller. To af dem står kun som overskriften «Beregningsperiode | Beregnet | Tabel
  | Kontrol» henholdsvis «TAF-periode | …» uden rækker; to hedder «Enhed». Hver række med `-` / `-` får et grønt ✓ – også
  «Arbejdsdage i TAF-periode», når TAF-perioden er rød (BB-340's `– / –`). Etiketten skriver «1 SH-dage».
- **Det er uhensigtsmæssigt fordi:** Et grønt ✓ betyder «kontrolleret og i orden»; her er intet kontrolleret. Tomme
  tabeller ligner noget, der ikke er indlæst.
- **Bedre ville være:** Rækker uden tal får intet mærke i «Kontrol»; tomme grupper udelades; «1 SH-dag».
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** en række med `-` på begge sider får intet mærke; en række med et tal på en af siderne
får ✓ eller rødt kryds som før. Grupper uden rækker vises ikke. «1 SH-dag» og «1 feriedag» i ental.

Sikring mod at samme tomhed kan siges på to måder: «tom» er nu ÉN definition, som både sammenligningen og visningen
læser – en side, der vises som `-`, er tom for kontrollen, og omvendt. Før kunne et beløb under en halv øre stå som
«0,00» over for en tabelside «-» og give et rødt kryds (og en teknisk fejl i «Fejl og advarsler») mellem to sider, der
begge reelt var tomme. En test bygger sammentællingen i flere sager og kræver, at ingen række nogensinde er rød med `-`
på begge sider, og at en række kun er umærket med `-` på begge sider.

**Efterfølgende rettelse 2026-10-30** (flyttet fra «Efterfølgende rettelser»): **Sammentællingens to «Enhed».**
Sygeferiegodtgørelsens gruppe hedder nu «Beløb»; dagtællingerne øverst beholder «Enhed».

Samme princip («-» uden mærke) er bagefter ført over på EO-kontrol; se «Efterfølgende rettelser» nedenfor.

### BB-387 – Kontroltabellens oversigt bruger betegnelser, brugeren ikke kan afkode

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Åbn «Kontroltabel» i grundsagen.
- **Det sker:** «Laveste/højeste dato (beregnet)» `01-07-2024` – `20-09-2026` og, med fed, «Tabelperiode (definerende)»
  `01-07-2024` – `30-09-2026`. Dagtabellens kolonner hedder «S/H dag» og «S/S dag», sammentællingen «SH-dage» og
  «Svie/smerte, sygedage».
- **Det er uhensigtsmæssigt fordi:** «definerende» og «beregnet» siger ikke, at tabellen er udvidet til hele måneder, og to
  stavemåder for SH-dage på samme skærm ligner to begreber.
- **Bedre ville være:** «Sagens første og sidste dato» og «Tabellen viser (hele måneder)»; «SH-dag» og «Svie/smerte-dag»
  i dagtabellen, som i sammentællingen. Plads: kolonnerne er 120 px brede; «SH-dag» er kortere end «S/H dag», og «Svie/smerte-dag»
  skal måles mod bredden, før den vælges (ellers «S/S-dag»).
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** «Sagens første og sidste dato» og «Tabellen viser (hele måneder)»; dagtabellen siger
«SH-dag» og «Svie/smerte-dag». «Svie/smerte-dag» er målt i browseren: hele ordet kan ikke stå på én linje i 120 px, så
overskriften brydes efter bindestregen («Svie/smerte-» / «dag»), som de øvrige to-linjers overskrifter; i CSV-filen står
den samlet. «TAF dag» er ikke ændret (ikke en del af forslaget).

**Efterfølgende rettelse 2026-10-30** (flyttet fra «Efterfølgende rettelser»): **«TAF-dag».** Dagtabellens «TAF dag»
skrives som «SH-dag» og «Svie/smerte-dag».

### BB-388 – Uden TAF står en tom kolonne «TAF-regulering» under «Ansættelsesforhold 1»

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Grundsagen med TAF «Nej» eller «Skjul». Åbn «Kontroltabel».
- **Det sker:** Dagtabellen har én kolonne efter «TAF dag»: «TAF-regulering», tom, under gruppeoverskriften
  «Ansættelsesforhold 1». Ansættelsesforholdet hedder «Fiktivt arbejdssted» på Lønindkomst, og med TAF «Ja» står navnet.
  CSV-filen har samme tomme kolonne.
- **Det er uhensigtsmæssigt fordi:** Tabellen nævner et ansættelsesforhold under et andet navn i en sag, hvor det ikke
  indgår, og en tom kolonne ligner en mangel.
- **Bedre ville være:** Uden TAF ingen ansættelsesforholdskolonner.
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** uden TAF-krav har dagtabellen og CSV-filen ingen ansættelsesforholdskolonner.
Sammentællingens ansættelsesforholdsrækker læser de samme kolonner og følger derfor samme betingelse, så en række aldrig
kan stå med et beregnet beløb over for en manglende tabelkolonne. Kolonnen «TAF dag» står uændret.

### BB-389 – De spærrede tilstande taler om «snapshot» og lover noget, der ikke sker

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-30 (fund og forslag til rettelse). **GENNEMFØRT** 2026-10-30.
- **Sådan fremprovokeres det:** Kildeaflæst; tilstanden opstår kun, når beregningen er stoppet af en intern fejl eller
  data, der ikke består skemaet (`eoSnapshot.ts:389-413`). Ikke fremprovokeret – en sådan fil afvises ved «Hent».
- **Det sker:** «EO-kontrol» viser «EO-kontrol kræver et friskt snapshot – Åbn kontrolfanen igen fra Erstatningsopgørelse
  for at bygge snapshot på committed data» eller «… kræver et gyldigt kontrol-snapshot – Ret valideringsfejlene i sagen og
  åbn kontrolfanen igen for at bygge kontrolvisningen på korrekt committede data» (`eoSnapshotToInspektionView.ts:49-50,
  123-124`). «Kontroltabel» viser «Kontroltabellen er ikke opdateret endnu – Snapshottet bygges automatisk ved første visit
  til fanen» (`EOKontrolTabel.tsx:297-298`), mens fanen netop er besøgt; under den står sammentællingens tomme tabeller.
- **Det er uhensigtsmæssigt fordi:** Engelske fagord, og «bygges automatisk» er usandt: tabellen kommer ikke, før fejlen er
  væk.
- **Bedre ville være:** «Kontroltabellen kan ikke vises, fordi beregningen er stoppet. Se «Fejl og advarsler» under
  Beregning.» Samme tekst på «EO-kontrol»; sammentællingen skjules i tilstanden.
- **Andre steder det kan gælde:** Ingen.

**Gennemført 2026-10-30:** «EO-kontrol kan ikke vises, fordi beregningen er stoppet» / «Kontroltabellen kan ikke
vises, fordi beregningen er stoppet», begge med «Se «Fejl og advarsler» under Beregning.» Sammentællingen skjules i
tilstanden.

## Overvejet uden fund

- Fanerne slået fra, mens «Kontroltabel» er aktiv: man lander på «EO oplysninger» (efter indstillinger.md). Slået til igen
  åbner de ikke af sig selv.
- Kontrolfanerne kan ikke nås med Tab eller piletaster – bevidst navigationsform (globalshell.md, afgjort; M-08).
- Linket «Kontroltabel» i «Fejl og advarsler» tilbydes kun, når fanerne vises (BB-290) – ikke genprøvet med en
  uoverensstemmelse; ingen af de 13 sager gav én.
- Sammentællingen stemte i alle målte sager (beregnet = tabel), også med to ansættelsesforhold og uden skadedato.
- Dagtabellen er 1.920 px bred (to ansættelsesforhold: mere) mod en arbejdsflade på 1.294 px; hele arbejdsfladen ruller
  vandret, og rullebjælken står i vinduets bund. Tabellens hoved klæber, også efter vandret rul.
- Tilfældighedsfundet fra 12b («Svie/smerte-krav i tidligere erstatningsopgørelser» `0,00` uden «kr.») er rettet: `0,00 kr.`
- EO-kontrol skjuler svie/smerte- og TAF-afsnittene ved «Nej» og «Skjul»; øvrige krav står kun ved «Ja».
- Afvist input (`31-02-2026` i «Opgørelse lavet den») vises på EO-kontrol som «Fejl (Datoen findes ikke i kalenderen)»,
  samme ordlyd som «Fejl og advarsler»; resten af fanen beregnes.
- En sag uden skadedato bygger begge faner; skadedatoen står `-`, og «Fejl og advarsler» har linjen.
- Fanerne bygges af sagens aktuelle tilstand ved hvert besøg (kildeaflæst, `Erstatningsopgoerelse.tsx:119, 132`); en
  ændring og et nyt besøg er ikke målt i browseren.
- CSV: UTF-8 med BOM, semikolon, danske tal – åbner korrekt i dansk Excel. Beløb `0` er tomme celler som på skærmen.
- Rækken «Beregningsperiode: 12 måneder (0 fraværsdage uden løn) = 12 måneder» er en regnestykkeform; giver mening med fravær.
- Konsollen var tavs i alle forløb.
- Fladens navn: produktet siger «EO-kontrol»; «EO-gennemsyn» fandtes kun i gennemgangens egne noter (12a's
  tilfældighedsfund). Rettet i `flader.md` og `STATUS.md`.

## Dækningshuller

- Teksten «(< N måneder)» i «Reguleringsværdi på … slut-dato for TAF» (indstillinger.md, BB-029) er ikke set: den kræver
  en overenskomst-, KRL-, KL- eller statistiksag, hvis sidste sats ligger kort før TAF-slutdatoen. Kildeaflæst
  (`eoRowIndkomstRows.ts:900-915`): værdien er alene «(< 6 måneder)» uden «Ja», mens naborækkerne siger «Ja». Bør måles,
  hvis en sådan sag bygges. *Ordlyden er rettet 2026-10-30 (se «Efterfølgende rettelser»); målingen i browseren står
  fortsat åben.*
- En sammentælling med uoverensstemmelse (rødt kryds) er ikke fremprovokeret.
- Kildeaflæst, ikke målt: dagtabellens «TAF dag» og sammentællingens TAF-dage afskærer ved endeligt EET og differencekrav,
  men ikke ved midlertidigt EET hentet fra Erhvervsevnetab-siden, som valideringen gør (`resolveTafCutoffDates`). En
  TAF-periode forbi den afskæring er i forvejen rød, så forskellen ses kun i en sag med fejl. Teknisk – agentens bord.
  *Løst 2026-10-30: kontroltabellen håndhæver nu selv afskæringen; se «Kontroltabellen som selvstændig kontrolberegning».*
- Kun Chrome, lyst tema, 1536×864.

## Åbne spørgsmål

- Ingen ud over fundene.

## Efterfølgende rettelser (2026-10-30)

Med udviklerens tilladelse til at rette øvrige problematiske forhold og tilfældighedsfund:

- **EO-kontrol: «-» uden mærke.** En række med status ok og værdien `-` får intet grønt ✓ (fx «Måneder: -» og
  «Arbejdsdage: -» ved en tom beregningsperiode) – samme princip som sammentællingen (BB-386). Pladsen bevares, så
  værdierne står lige. Fejl- og advarselsrækker med `-` beholder kryds og trekant.
- **«TAF-dag»** er flyttet ind under BB-387 og **sammentællingens to «Enhed»** under BB-386.
- **«(< 6 måneder)» (Dækningshuller ovenfor).** Rækken «Reguleringsværdi på … slut-dato for TAF» siger nu «Ja (sidste værdi
  under 6 måneder før)» i stedet for kun «(< 6 måneder)», så den svarer på rækkens spørgsmål som naborækkerne. Ren
  ordlyd; status og beregning er uændrede. Ikke målt i browseren (kræver samme særlige sag som før).
- **Ikke ændret:** TAF-dagenes afskæring ved midlertidigt EET fra Erhvervsevnetab-siden (Dækningshuller). En TAF-periode
  forbi afskæringen er i forvejen rød og spærrer TAF-grenen, så sammentællingen tømmes, og forskellen kan ikke give en
  uoverensstemmelse. At flytte afskæringen ville ændre, hvilke dage tabellen viser som TAF-dage – det er beregningslogik
  og forelægges, hvis det ønskes. *Udvikleren krævede det samme dag; gennemført, se næste afsnit.*

## Kontroltabellen som selvstændig kontrolberegning: TAF's afskæring ved EET (2026-10-30)

Udviklerens krav: kontroltabellen er en særskilt, parallel opgørelse, som skal stemme nøjagtigt med den tekniske
beregning, og den skal selv håndhæve – og vise – TAF's afskæring ved EET. Gennemført samme dag; reglen står normativt i
`eo-snapshot-contract.md` §6.2.

- **Reglen** er programmets eksisterende (motor, validering og EO-kontrol): TAF ophører fra og med differencekravets
  dato, det endelige EET's dato og – kun for skader før 16-06-2011 – det midlertidige EET's dato. For senere skader
  fortsætter TAF uanset midlertidigt EET. Under verserende klage over EET afskærer ingen EET-dato. Skæringsdatoen i
  programmet er **16-06-2011** (`TAF_MIDLERTIDIG_EET_SKAERINGSDATO`).
- **Før** kendte kontroltabellen kun det endelige EET og differencekravet og stolede i øvrigt på motorens afgrænsede
  TAF-perioder. Den midlertidige EET-afskæring var dækningshullet ovenfor. Den endelige EET-afskæring krævede desuden
  «Verserende klage: Nej» udtrykkeligt, mens motoren afskærer, medmindre der ER en klage.
- **Nu** henter tabellen afskæringerne fra samme opslag som motoren (`resolveTafCutoffDates`) og anvender dem selv. Får
  den TAF-perioder, der ikke er afgrænset, tæller den ikke dagene efter afskæringen, og sammentællingen melder
  forskellen.
- **Synligt:** afskæringsdagen står i TAF-dagskolonnen som «Midlertidigt EET», «Endeligt EET» eller «Differencekrav».
  Under perioderne i oversigten står fx «TAF ophører: midlertidigt EET (skade før 16-06-2011)», og en EET-dato, der IKKE
  afskærer, står med grunden: «Midlertidigt EET – TAF fortsætter (skade fra 16-06-2011)» eller «… (verserende klage)».
- **TAF-dagskolonnen** vises nu, når der er TAF-krav, også uden et ansættelsesforhold (angivet løn). Før manglede den
  dér, selvom sammentællingen talte dens dage. Uden TAF-krav vises den ikke.

## Kontroltabellens urenderede integritetstjek (forelagt 2026-10-30)

Fundet har intet BB-nummer; det blev rejst som henvisning fra 12k («Henvisninger til andre bidder») og konstateret ved
dokumentgennemgangen 2026-10-30.

**Forelagt:** kontroltabellens model byggede en liste af tekst-issues (`integrityIssues`) – fx «Offentlig ydelse (række
‹internt id›): Beløb er angivet uden ydelsestype …», «… kan ikke periodiseres/vises», «Lønindkomst: En lønrække kan ikke
periodiseres …» og selvtjek af, at kolonnernes summer svarede til de indtastede totaler. Listen blev aldrig vist nogen
steder. Valg A: vise linjerne med rækkens navn i stedet for id. Valg B: fjerne de urenderede tjek.

**Udviklerens svar (ordret):** «6. Vi går med B. Kontrolfanen skal være et passivt kontrolmiddel, og det skal
dokumenteres, at forudsætningen for dets eksistens er, at brugeren kun vil se det, når der opstår advarsler om
uoverensstemmelser. Det er dermed afgørende at kontrolfanen beregner forholdene effektivt og ud fra et princip om
dobbelte beregninger, der sammenholdes - men at beskrivende tekst alene kan have til formål at tydeliggøre en fejl, som
brugeren i forvejen er blevet advaret om.»

**Gennemført 2026-10-30:**
- Hele `integrityIssues`-kanalen er fjernet: kilderne var offentlige ydelser, lønindkomst og en kontrol af
  kolonne-id'er; ingen af dem blev læst uden for modellen. Med dem forsvandt selvtjekkenes tolerancekonstant og
  hjælpemodulet `mathUtils.ts`, som kun de brugte.
- Kolonnerne, dag-for-dag-fordelingen og sammentællingen (den dobbelte beregning, der sammenholdes med motoren) er
  uændrede. Rækker uden ydelsestype, med ukendt type, med ugyldigt interval eller uden periodiseringsdage giver som før
  ingen kolonne; de står i forvejen med egne fejl i «Fejl og advarsler».
- Princippet er gjort normativt i `src/contracts/eo-snapshot-contract.md` §6.2 pkt. 5: kontrolfanerne er passive,
  findes for at efterprøve med dobbelte beregninger, og tekst må kun tydeliggøre en fejl, brugeren allerede er advaret
  om.
- Samtidig hentes kontroltabellens ménafskæring af svie/smerte fra motorens eget opslag (`resolveSvieSmerteCutoffDate`)
  i stedet for en egen kopi af betingelsen (§6.2 pkt. 4). Betingelserne var i praksis ens, fordi «Verserende klage
  (mén)» altid har værdien «Nej» eller «Ja»; ændringen fjerner muligheden for, at de driver fra hinanden.
