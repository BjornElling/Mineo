# Brugerblik – Erstatningsopgørelse → Sygeferiegodtgørelse (12j)

- Rute/placering: `/erstatningsopgoerelse` → fanen «Lønindkomst» → hvert ansættelsesforholds afsnit
  «Sygeferiegodtgørelse» (vises kun ved TAF-krav «Ja» og «Ansat på skadestidspunktet»): kildevalget, referenceperioden,
  fraværsdagene, de manuelle felter, satsvalget ved direkte overenskomstsatser, «Evt. allerede betalt …», de to
  bemærkninger (seks måneder og skade før 2015) – og opgørelsens bilag «Sygeferiegodtgørelse» samt linjen
  «Sygeferiegodtgørelse» under «Indtægter i erstatningsperioden».
- Gennemgået: 2026-10-24 · commit `2ab74987` · **afgjort og gennemført 2026-10-24** (alle 13 fund gennemført; de
  supplerende tilbagemeldinger på BB-319 og BB-321 er gennemført samme dag).
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620), mod e2e-buildet. 41 sager indlæst gennem
  «Hent» (krypteret `.eo` bygget til formålet), kildeskift foretaget i brugerfladen, hvor overgangen selv var genstand
  for prøven. Dokumenter hentet som `.pdf` og læst som tekst; feltfejl aflæst gennem automatiseringsbroen, links målt med
  `animationstart`. **Grundsag:** skadedato `01-03-2023` (arbejdsulykke), opgørelse nr. 1 lavet `01-02-2024`, TAF og
  «Vedrører perioden» `01-03-2023` – `31-12-2023`, beregningsperiode `01-03-2022` – `28-02-2023`, ét ansættelsesforhold
  «Firma A» med 12 månedsrækker à `30.000 kr.`, feriegodtgørelse `12,5`, pension `8`, lønudvikling «Ingen»,
  sygeferiegodtgørelse «Ferieloven» med referenceperiode `01-02-2023` – `28-02-2023`. Sagen opgøres i måneder, så
  sygeferiegodtgørelsen opgøres i kalenderdage: referencesats `133,93 kr.`, 305 dage, `44.116,54 kr.`, kravet
  `320.383,46 kr.` Med «Fuld løn under ferie» fra (arbejdsdage): `187,50 kr.`, 209 dage, `42.322,50 kr.`

## Fladen kort

Afsnittet afgør, hvor meget sygeferiegodtgørelse skadelidte ville have fået, og beløbet trækkes fra kravet under
«Indtægter i erstatningsperioden». Brugeren vælger kilden – Overenskomst, Ferieloven, Manuelt angivet eller Ingen – og
kilden åbner sine felter: ved Ferieloven (og en overenskomst, der følger ferieloven) en referenceperiode, hvis løn giver
satsen, ved en direkte overenskomstsats eventuelt uddannelse og arbejdssted, ved «Manuelt angivet» en dagssats. Skærmen
viser hverken satsen eller beløbet (BB-226); begge står kun i bilaget.

**Fladens bærende iagttagelse er, at referenceperioden er fri, og at programmet ikke siger, hvad den skal være.**
Skærmen forklarer den ikke, intet kontrollerer dens længde, og en periode uden løn giver en sats på `0,00 kr.` uden et
ord – det mest sandsynlige ved opgørelse nr. 2, hvor «4 uger før» naturligt læses som før den nye periode (BB-319,
**Høj**). Papiret skriver alligevel «Opgøres som den gennemsnitlige feriepengebetaling i 4 uger før sygeforløbet» over
en periode på et år, og «3 måneder» over 28 dage (BB-321). De grænser, programmet faktisk kender – før første TAF-dag,
højst så mange fraværsdage som perioden har – står kun i boksen, uden ring og uden link, og programmet har dem allerede
regnet ud til feltet uden at bruge dem (BB-322, BB-323). **Det tungeste regnefund ligger ved skader før 2015:** afsnittet
beder om alle TAF-perioder siden skaden, men perioder uden for opgørelsens egen periode tælles tavst ikke med i
4-månedersgrænsen (BB-320, **Høj**).

**Beregningerne er ikke vurderet.** Reguleringen af satsen er afklaret i afklaringsloggen fra 2026-10-13 (log 8–8d), og
den er bindende. Denne gennemgang har holdt skærm, boks og papir op mod hinanden og mod programmets egne løfter.

**Afgrænsning.** Lønrækkerne er 12h's, reguleringsformen 12i's, bilagsvalget «Sygeferiegodtgørelse» og sammendraget 12l's,
kontrolrækkerne 12m's.

## Fund

### BB-319 – En referenceperiode uden løn giver en referencesats på 0,00 kr. uden et ord

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-37--en-manglende-sats-regnes-som-0--uden-et-ord`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24. Fundets sidste sætning
  (grænsen ved skadedatoen) er **AFVIST** af udvikleren og gjort til et dokumenteret, test-sikret princip.
- **Sådan fremprovokeres det:**
  1. Grundsagen med referenceperiode `01-01-2021` – `28-01-2021` (før lønrækkerne).
  2. Opgørelse nr. `2`, TAF `01-01-2024` – `30-06-2024`, referenceperiode `01-12-2023` – `28-12-2023` – de fire uger før
     den periode, opgørelsen handler om.
- **Det sker:** Ingen ring, ingen linje, download aktiv. Papiret: «Lønnen i referenceperioden udgør 0,00 kr.»,
  «Referencesats (0,00 x 12,5 % / 28 kalenderdage) = 0,00 kr./kalenderdag», tabellen «0 + 8 % 182 0», og forsiden
  «Sygeferiegodtgørelse 0,00 kr.» – kravet stiger tilsvarende (i grundsagen fra `320.383,46` til `364.500,00 kr.`). Den
  eneste kontrol er, at perioden ligger før første TAF-dag i DENNE opgørelse; i 2 ligger den midt i sygeforløbet fra
  opgørelse nr. 1. En samlet negativ løn spærrer derimod med en navngiven fejl (BB-290).
- **Det er uhensigtsmæssigt fordi:** Brugeren har valgt Ferieloven og angivet en periode – en sats på 0 kr. er aldrig
  det, han mente. Ved opgørelse nr. 2 er fejlen næsten indbygget: «4 uger før sygeforløbet» står ingen steder på skærmen
  (BB-321), og de fire uger før den aktuelle periode er en sygeperiode uden løn.
- **Bedre ville være:** En referenceperiode uden løn spærrer som den negative: «Der er ingen løn i referenceperioden
  (01-12-2023 – 28-12-2023) – angiv perioden før sygeforløbet» med link til «Referenceperiode», og fra-feltet får rød
  ring. Overvej samtidig, at perioden skal slutte før skadedatoen frem for før denne opgørelses første TAF-dag.
- **Andre steder det kan gælde:** Ingen ud over sygeferiegodtgørelsen; de øvrige grundlag spærrer allerede en tom
  periode (BB-258).

**Tilbagemelding**
Enig

**Modsvar – fundets sidste sætning om skadedatoen** (besvaret nedenfor)

Spærringen af en referenceperiode uden løn er gennemført (se BB-319's gennemførelse nedenfor). Fundet sluttede dog med en
overvejelse om, at perioden skal slutte før *skadedatoen* i stedet for før *denne opgørelses første TAF-dag*. Dit «Enig»
kan læses som en godkendelse også af den, men jeg har ikke gennemført den, fordi den passer dårligt med dit svar under
BB-321 (perioden er fri) og vil spærre rigtige sager:

*Eksempel:* skade `01-03-2023`, sygemeldt marts–maj, tilbage i fuldt arbejde juni–december med normal løn, sygemeldt igen
fra januar 2024 (opgørelse nr. 2). Den naturlige referenceperiode er december 2023 – efter skadedatoen. Med en grænse ved
skadedatoen får den rød ring, og opgørelsen kan ikke hentes.

Den fejl, overvejelsen skulle fange – opgørelse nr. 2 med en referenceperiode midt i det første sygeforløb – fanges nu af
den nye spærring, fordi der normalt ikke er løn i den periode.

- *Valg A (anbefalet):* grænsen forbliver «før første TAF-periode i denne opgørelse».
- *Valg B:* grænsen flyttes til «før skadedatoen»; sagen i eksemplet kan da ikke bruge december 2023.

**Gennemført 2026-10-24:** en referenceperiode uden løn giver fra-datoen rød ring med «Der er ingen løn i
referenceperioden (01-12-2023 – 28-12-2023) – angiv perioden før sygeforløbet», og «Fejl og advarsler» viser samme
linje med link til datoen. Opgørelsen kan ikke hentes, før perioden er rettet. En samlet negativ løn spærrer som før
med sin egen besked (BB-290). Grænsen før første TAF-periode er uændret (se modsvaret).

**Supplerende tilbagemelding**
Referenceperioden skal ikke sættes til at slutte før skadesdatoen. Det er et væsentligt princip, der gerne må dokumenteres og test-sikres, så det aldrig igen foreslås eller lægges til grund. Det vil ofre ske, at den skadelidte arbejder videre i noget tid efter skaden, før vedkommende sygemeldes. Andre skadelidte sygemeldes straks men modtager fuld løn under sygdom i en periode. I de scenarier vil det ofte være relevant at have en beregningsperiode, der starter før skadesdagen og strækker sig ind over denne, eller i visse tilfælde først starter efter skadedatoen. Det er kun beregningsperioden og TAF-perioden, der ikke må overlappe.

**Gennemført 2026-10-24 (supplerende):** grænsen forbliver før første TAF-periode, og princippet står nu som bærende
regel i `sygeferiegodtgoerelse.md` §2.1: referenceperioden må ikke bindes til skadedatoen – den må begynde før og
strække sig hen over skadedatoen eller først begynde efter den; det må aldrig igen foreslås. Det er test-sikret i
`erstatningsopgoerelseReaderProjection.test.ts`, hvor en referenceperiode efter skadedatoen og før første TAF-periode
hverken giver feltfejl eller spærrer.

### BB-320 – Ved skader før 2015 tæller 4-månedersgrænsen kun opgørelsens egen periode, selv om afsnittet beder om alle TAF-perioder siden skaden

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Skadedato `01-03-2014`, opgørelse nr. `2`, «Vedrører perioden» `01-01-2015` –
  `30-06-2015`. TAF-perioder `01-03-2014` – `31-12-2014` og `01-01-2015` – `30-06-2015`, som afsnittets bemærkning
  beder om («Da skaden er før 01-01-2015, skal samtlige TAF-perioder siden skaden være indtastet på fanen med EO
  Oplysninger.»). Hent opgørelsen.
- **Det sker:** Ingen ring og ingen linje om perioden fra 2014. Bilaget: «Skaden er før 01-01-2015 og retten er begrænset
  til 4 måneder, som ophørte **30-04-2015**», «Periode med sygeferiegodtgørelse 01-01-2015 - 30-04-2015» og `17.357,33 kr.`
  Grænsen er talt fra `01-01-2015`; med sygdom fra `01-03-2014` ville den være nået `30-06-2014` (målt i opgørelse nr. 1:
  «ophørte 30-06-2014»). Mekanikken: TAF-perioderne klemmes tavst ind i opgørelsens periode (`buildTafRanges`, trin 3),
  før 4-månedersgrænsen tælles (`sfggEngine.ts:59-67`).
- **Det er uhensigtsmæssigt fordi:** Brugeren har gjort præcis, hvad programmet bad om, og papiret påstår en ret til
  sygeferiegodtgørelse, der efter programmets egne oplysninger ophørte et halvt år før perioden. Beløbet trækkes fra
  kravet, så kravet bliver for lavt, og intet på skærmen eller papiret antyder, at de indtastede 2014-perioder er
  ignoreret.
- **Bedre ville være:** 4-månedersgrænsen tælles over alle indtastede TAF-perioder, før de klemmes ind i opgørelsens
  periode – som bemærkningen lover og `sygeferiegodtgoerelse.md` §7 foreskriver. Kravet selv regnes fortsat kun for
  opgørelsens periode.
- **Andre steder det kan gælde:** Ingen – loftet er sygeferiegodtgørelsens eneste forbruger af perioder uden for
  opgørelsens.

**Tilbagemelding**
Enig. Alle TAF-perioder tæller med i fire-måneders begrænsningen før 1. januar 2015. Det er hele kernen i beregninger, som omhandler det beregningsprincip. Der starter ikke en ny 4-måneders periode i hver erstatningsopgørelse. Det er selve tilskadekomsten, der giver ret til sygeferiegodtgørelse i sammenlagt 4 måneder i alt, uanset omstændighederne, så længe vedkommende er sygemeldt, hvilket i programmet udtrykkes ved TAF-perioder.

**Gennemført 2026-10-24:** 4-månedersgrænsen tælles nu over alle indtastede TAF-perioder siden skaden; kravet
regnes fortsat kun for opgørelsens egen periode. I fundets sag står nu «… retten er begrænset til 4 måneder, som
ophørte 30-06-2014», perioden er «Ingen», og sygeferiegodtgørelsen er `0,00 kr.` – uden fejl, også ved «Manuelt
angivet», hvor en udløbet ret før gav den spærrende linje «Ingen kalenderdage i SFGG-perioden». Reglen står i
`sygeferiegodtgoerelse.md` §7 og som bindende invariant i `eo-snapshot-contract.md` §2.3 pkt. 6.

### BB-321 – Skærmen siger ikke, hvad referenceperioden skal være, og papiret påstår «4 uger før sygeforløbet» uanset hvad der er tastet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Mellem
- **Beslutning:** **AFGJORT** af udvikleren 2026-10-24: perioden er fri, og det dokumenteres som korrekt adfærd;
  papiret og skærmen efter modsvarets valg A. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:**
  1. Grundsagen med referenceperiode `01-03-2022` – `28-02-2023` (hele beregningsperioden).
  2. Kort med Elektrikeroverenskomsten, sygeferiegodtgørelse «Overenskomst», referenceperiode `01-02-2023` –
     `28-02-2023`.
- **Det sker:** Ved «Ferieloven» står kun «Referenceperiode [ ] til og med [ ]» – ingen forklaring, intet forslag. Ved
  overenskomsten står «Overenskomstens referenceperiode: Følger ferieloven (3 måneder)». Ingen af de to perioder giver en
  bemærkning. Papiret: 1 «Opgøres som den gennemsnitlige feriepengebetaling i **4 uger** før sygeforløbet. Referenceperiode
  01-03-2022 - 28-02-2023 … 365 kalenderdage» og 2 «… i **3 måneder** før sygeforløbet. Referenceperiode 01-02-2023 -
  28-02-2023 … 28 kalenderdage». `sygeferiegodtgoerelse.md` §8.3 kræver «forklarende tekst om referenceperiode på 4
  uger før sygefraværet» ved Ferieloven; den findes ikke.
- **Det er uhensigtsmæssigt fordi:** Satsen afhænger helt af perioden, og brugeren skal selv vide reglen. Papiret, der går
  til modparten, modsiger sig selv i to linjer, og en læser kan ikke se, om perioden eller teksten er forkert.
- **Bedre ville være:** Under kildevalget en linje med reglen og et konkret forslag: «Referenceperioden er de 4 uger før
  sygeforløbet, dvs. 01-02-2023 – 28-02-2023» (overenskomstens længde, hvor den afviger). En periode, der afviger fra
  reglen i længde eller ikke slutter dagen før sygeforløbet, får gul ring og en linje. Papiret beskriver den faktiske
  periode («Opgøres som den gennemsnitlige feriepengebetaling i referenceperioden») og nævner kun reglens længde, når
  perioden følger den.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
4-ugers perioden er kun vejledende, og der ikke krav om, at den skal ligge på et specifikt tidspunkt. Det kan potentielt være fire uger længe inden skaden, og der kan også - og vil også ofte - være tale om en periode, som afviger fra 4 uger. Når den skadelidte er månedslønnet, er det fx. forventlige og korrekt adfærd, at der i stedet for 4 uger benyttes en kalendermåned, da lønindkomsten indtastes månedsvist og beregningen dermed bliver let og gennemskuelig, fordi den afspejler nøjagtig én lønseddel. Og hvis den seneste lønseddel, der afspejlede den skadelidtes normale lønniveau, ligger langt tilbage, så benytter man en sådan langt tilbage i tid. Dette skal dokumenteres som korrekt og forventelig adfærd.

**Modsvar – papirets tekst og skærmens forklaring** (besvaret nedenfor)

Forstået og gennemført: referenceperioden er fri. Der kommer ingen gul ring eller advarsel om længde eller placering, og
det står nu som korrekt og forventet adfærd i sygeferiegodtgørelsens beskrivelse (`sygeferiegodtgoerelse.md` §8.3, som
før krævede en tekst om «4 uger før sygefraværet»). Den eneste grænse er fortsat, at perioden skal ligge før første
TAF-periode (BB-322).

Dit svar dækker ikke fundets to andre halvdele, og netop dit svar gør den første mere påtrængende:

1. **Papiret.** Bilaget skriver i dag «Opgøres som den gennemsnitlige feriepengebetaling i 4 uger før sygeforløbet» – også
   når referenceperioden er en kalendermåned eller et helt år – og ved en overenskomst «i 3 måneder før sygeforløbet» over
   en periode på 28 dage. Når perioden netop må afvige, påstår papiret over for modparten noget, der ofte ikke passer med
   linjen lige under («Referenceperiode 01-01-2023 - 31-01-2023 … 31 kalenderdage»).
   - *Valg A (anbefalet):* «Opgøres som den gennemsnitlige feriepengebetaling i referenceperioden.» Linjerne lige under
     viser allerede den faktiske periode og antallet af dage.
   - *Valg B:* som A, men med reglens udgangspunkt: «Opgøres som den gennemsnitlige feriepengebetaling i referenceperioden
     (efter ferieloven som udgangspunkt 4 uger før sygeforløbet).» – ved en overenskomst med dens længde.
   - *Valg C:* uændret.
2. **Skærmen.** Intet forklarer i dag, hvad referenceperioden er; brugeren skal kende reglen.
   - *Valg A (anbefalet):* et info-ikon ved «Referenceperiode» med tooltippen «Udgangspunktet er 4 uger før sygeforløbet.
     Ved månedsløn bruges typisk en hel kalendermåned, så perioden svarer til én lønseddel. Perioden kan ligge længere
     tilbage, hvis de seneste lønsedler ikke afspejler det normale lønniveau.» Ved en overenskomst med egen længde står
     dens længde i stedet for «4 uger».
   - *Valg B:* ingen forklaring på skærmen (uændret).

**Supplerende tilbagemelding**
Enig i begge dine anbefalinger i modsvar.

**Gennemført 2026-10-24 (supplerende):**
1. Bilaget skriver nu «Opgøres som den gennemsnitlige feriepengebetaling i referenceperioden.» – uden længde, også ved
   en overenskomst; linjerne lige under viser den faktiske periode og antallet af dage. Word-filen følger med.
2. «Referenceperiode» har fået et info-ikon med tooltippen «Udgangspunktet er 4 uger før sygeforløbet. Ved månedsløn
   bruges typisk en hel kalendermåned, så perioden svarer til én lønseddel. Perioden kan ligge længere tilbage, hvis de
   seneste lønsedler ikke afspejler det normale lønniveau.» Ved en overenskomst, der følger ferieloven med egen længde,
   står dens længde (fx «3 måneder») i stedet for «4 uger».

### BB-322 – En referenceperiode i TAF-perioden spærrer med to ens linjer uden link og uden rød ring

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning` og M-33
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen med referenceperiode `01-03-2023` – `28-03-2023` (første TAF-dag er
  `01-03-2023`).
- **Det sker:** «Fejl og advarsler»: «Referenceperioden skal ligge før første TAF-periode (01-03-2023)» to gange, uden
  link. Begge datofelter er neutrale (`aria-invalid = "false"`), download grå. Feltets egen grænse er systemrammen
  `01-01-2005` – `31-12-2027`. Programmet har den rigtige øvre grænse regnet ud – `sfggReferenceperiodeMaxDate` (dagen
  før første TAF-dag) i `loenindkomstDerivations.ts:332` – men intet bruger den.
- **Det er uhensigtsmæssigt fordi:** Brugeren ser to ens linjer og ingen rød dato, og han må selv finde kortet og
  felterne. Samme form som BB-305, der er rettet for anciennitetsdatoen.
- **Bedre ville være:** Datoerne bærer grænsen selv: rød ring på den dato, der ligger på eller efter første TAF-dag, med
  «Datoen skal ligge før første TAF-periode (01-03-2023)», og én linje med link til feltet.
- **Andre steder det kan gælde:** BB-323 (samme validator, samme form).

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** hver dato på eller efter første TAF-dag får rød ring med «Datoen skal ligge før første
TAF-periode (01-03-2023)», og «Fejl og advarsler» viser én linje – «Referenceperiode, fra: Datoen skal ligge før første
TAF-periode (01-03-2023)» – hvis link blinker datoen (målt med `animationstart` i
`e2e/erstatningsopgoerelse-sygeferiegodtgoerelse.spec.ts`). Er begge datoer røde, står linjen én gang. Reglen er flyttet
fra validatoren til `sfggReferenceperiodeRules.ts`; den ubrugte værdi i view-modellen er slettet. Samme vej får nu også
afsnittets øvrige røde felter (fx omvendt periode) en linje med link, og en referenceperiode, der slutter før
reguleringsgrundlagets første sats, får den røde ring, den manglede på kortet.

### BB-323 – For mange fraværsdage i referenceperioden: ingen ring, intet link – og det oplyste maksimum er selv ugyldigt

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning` og
  `TVAERGAAENDE.md#m-24--feltets-grænse-er-sat-af-feltets-art-ikke-af-det-tal-det-trækkes-fra`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24, også ordlyden. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen (28 kalenderdage i referenceperioden). «Evt. ferie- og fraværsdage i
  referenceperioden uden løn» `50`, derefter `28`. Klik linket.
- **Det sker:** `50`: «Ferie- og fraværsdage uden løn overstiger mulige kalenderdage i referenceperioden (maksimalt 28)» –
  feltet neutralt, ingen link. `28`: feltet neutralt, linjen «Ingen kalenderdage i **SFGG-perioden**» med link
  «Lønindkomst», der blinker hele kortet (94 elementer, målt) med fokus på `body`. Først `400` giver rød ring (366-loftet,
  BB-265). Programmet har maksimum regnet ud til feltet – `getSfggReferenceperiodeAvailability` med `maxFravaersdage` og
  `hasNoRelevantDaysError` (`loenindkomstDerivations.ts:229-246`) – men intet kalder den.
- **Det er uhensigtsmæssigt fordi:** Boksen kalder 28 for maksimum, og 28 er derefter en fejl med en ny tekst om en anden
  periode («SFGG-perioden» er erstatningsperioden, men fejlen handler om referenceperioden). Brugeren må gætte, at
  tallet skal være mindst én lavere.
- **Bedre ville være:** Feltet bærer grænsen: rød ring ved flere dage end perioden har MINUS én («Højst 27 fraværsdage –
  referenceperioden har 28 kalenderdage»), én linje med link til feltet, og «SFGG-perioden» udgår af teksten.
- **Andre steder det kan gælde:** Den samme regel i arbejdsdage (efter BB-329).

**Tilbagemelding**
Enig. Overvej dog gerne, om ikke der bør findes fælles, ensartede løsninger på de mange tilsvarende problemstillinger, fx. også med feriedage i beregnings- og TAF-perioden og så videre. Det er ikke et krav, blot en betragtning om, at der er mange steder, hvor der er behov for feedback til brugeren, hvis antallet af dage, som udtrækkes fra en periode er for stort, og måske også et sagligt hensyn bag ensartede info-ikoner og tooltips til at forklare, hvor det er relevant.

**Bemærkning (til orientering) – den fælles løsning**

Den fælles løsning findes allerede, og BB-323 er lagt ind i den frem for at få sin egen: et dagfelt, der trækkes fra en
periode, bærer selv grænsen som rød ring med det konkrete loft i tooltippen, og «Fejl og advarsler» får én linje med
feltets navn og et link, der fører til feltet. Sådan virker løse feriedage og fraværsdage i beregningsperioden (BB-258,
BB-264) og løse feriedage i TAF-rækkerne (BB-251) i forvejen. Sygeferiegodtgørelsens fraværsdage var det sidste dagfelt
uden for mønstret. Info-ikoner vurderer jeg felt for felt (som ved BB-329) frem for som en generel regel – et ikon ved
hvert felt ville gøre fladen tungere end den forklaring, det giver.

**Gennemført 2026-10-24:** feltet bærer loftet selv: flere fraværsdage end referenceperiodens dage minus én giver
rød ring med fx «Højst 27 fraværsdage – referenceperioden har 28 kalenderdage» (med «uden ferie», når en ferieperiode
er trukket fra), og én linje med link til feltet. «SFGG-perioden» er væk. Undervejs fandt jeg en fejl i den gamle
regel: i arbejdsdage blev fraværsdagene trukket fra to gange, så fx 11 fraværsdage i en periode på 20 arbejdsdage blev
afvist som for mange. Den er rettet.

### BB-324 – Advarslen om en referenceperiode mere end 12 måneder før reguleringsdatoen findes kun som en testet funktion, som intet kalder

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen med lønudvikling «Manuel procentsats» (`01-06-2023` `2`), en lønrække januar
  2022 og referenceperiode `01-01-2022` – `28-01-2022`. Reguleringsdatoen er `28-02-2023`.
- **Det sker:** Ingen ring, ingen gul linje – kun seksmånedersadvarslen. Papiret regner satsen som reguleringsdatoens
  niveau («127,55 x 100 / 100»), som log 8a foreskriver. Logens anden halvdel – «Gul, ikke-blokerende advarsel, når
  referenceperioden slutter mere end 12 måneder før reguleringsdatoen» – er skrevet som
  `findSfggManualReferenceWarningEmploymentIds` (`sfggWarnings.ts:45-69`) og testet (`sfggWarnings.test.ts`), men kaldes
  ingen steder i programmet.
- **Det er uhensigtsmæssigt fordi:** Ved de manuelle former regnes en gammel referenceperiodes løn som lønnen på
  reguleringsdatoen. Advarslen skulle fortælle brugeren det; uden den står satsen ureguleret over et år, og intet siger
  hvorfor.
- **Bedre ville være:** Som log 8a: gul ring på referenceperiodens til-dato og en gul linje, fx «Referenceperioden slutter
  mere end 12 måneder før reguleringsdatoen (28-02-2023) – satsen er regnet med lønnen på reguleringsdatoen uden
  regulering».
- **Andre steder det kan gælde:** Ingen anden ukoblet advarsel – prøvet med en søgning efter eksporterede advarsels- og
  grænsefunktioner, som kun deres test kalder (se M-38).

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** ved «Manuelt angivet» og «Manuel procentsats» får referenceperiodens til-dato gul ring,
og «Fejl og advarsler» viser den gule linje «Referenceperioden slutter mere end 12 måneder før reguleringsdatoen
(28-02-2023) – satsen er regnet med lønnen på reguleringsdatoen uden regulering» med link til datoen. Opgørelsen kan
hentes; beregningen er uændret.

### BB-325 – Seksmånedersbemærkningen står i næsten enhver sag, siger ikke hvad der skal kontrolleres, og linket blinker hele kortet

- **Type:** Fornuft
- **Rækkevidde:** Lokal (to ordlyde for samme advarsel: M-13)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen – lønrækker til februar 2023, TAF marts–december 2023. Klik linket.
- **Det sker:** Kortet: «Bemærk: Sygeferiegodtgørelsen i dette ansættelsesforhold løber mere end 6 måneder efter sidste
  indkomst. Kontrollér, om perioden er korrekt.» – i almindelig tekst. Boksen: gul linje «Der beregnes fortsat
  sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.» Linket «Lønindkomst» blinker hele kortet
  (94 elementer, målt), fokus på `body`, og skærmen viser kortets satser og lønrækker – bemærkningen står en skærmhøjde
  længere nede. Bemærkningen kom i 22 af gennemgangens 41 målte sager – alle de beregnede med mere end seks måneders
  sygeferiegodtgørelse: lønrækkerne dækker normalt kun beregningsperioden, så enhver sådan sag udløser den.
- **Det er uhensigtsmæssigt fordi:** Formålet er at fange et stiltiende ophørt ansættelsesforhold
  (`sygeferiegodtgoerelse.md` §9.3), men teksten nævner hverken ophør eller hvad brugeren kan gøre, og «perioden» kan
  være tre forskellige perioder. En advarsel, der står i de fleste sager, læses ikke.
- **Bedre ville være:** Én tekst begge steder, der siger hvad og hvorfor: «Der er ikke registreret løn fra Firma A efter
  februar 2023. Er skadelidte opsagt, angives det under «Opsagt fra stillingen» – retten til sygeferiegodtgørelse ophører
  da.» Linket fører til togglen «Opsagt fra stillingen», og kortets tekst får advarslens gule markering.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** kortet og «Fejl og advarsler» har nu samme tekst: «Der er ikke registreret løn fra Firma A
efter 28-02-2023. Er skadelidte opsagt, angives det under 'Opsagt fra stillingen' – retten til sygeferiegodtgørelse
ophører da.» På kortet står den med advarslens gule ikon, og linket blinker togglen «Opsagt fra stillingen». Feltnavnet
står i apostroffer efter din afgørelse under BB-331 (fundet foreslog «»). Advarslen står stadig i de samme sager som
før; det har fundet ikke bedt om at ændre.

### BB-326 – «Først sygeferiegodtgørelse efter ophør af sygeløn» virker kun gennem lønrækker i erstatningsperioden – uden dem gør «Ja» ingenting

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-35--et-synligt-felt-som-den-aktuelle-beregningsmåde-ikke-læser`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** «Manuelt angivet», dagssats `250`, «Først sygeferiegodtgørelse efter ophør af sygeløn»
  slået til. Først uden lønrækker efter skaden, derefter med rækker marts–maj 2023 à `30.000 kr.`
- **Det sker:** Uden rækker: `56.430,00 kr.` for hele perioden, og papiret nævner ikke valget. Med rækker: «Der beregnes
  ikke sygeferiegodtgørelse på dage, hvor der betales arbejdsgiverbetalt sygeløn.», perioden begynder `01-06-2023`, og
  beløbet er `40.500,00 kr.` Programmet læser enhver lønrække med positivt beløb i erstatningsperioden som sygeløn; det
  står ingen steder. Samme afhængighed gælder overenskomster med bortfald under sygeløn (Bygge-/anlægsoverenskomsten:
  «I medfør af overenskomsten beregnes ikke sygeferiegodtgørelse på dage, hvor der betales sygeløn.» trykkes, og
  beløbet regnes for hele perioden).
- **Det er uhensigtsmæssigt fordi:** Brugeren har sagt, at arbejdsgiveren betalte sygeløn, og forventer, at programmet
  trækker de dage fra. At sygelønnen skal tastes som lønrækker på kortet, kan han ikke vide, og forskellen i eksemplet er
  15.930 kr.
- **Bedre ville være:** Ved «Ja» (og ved en overenskomst med bortfald) uden lønrækker i erstatningsperioden en gul
  linje: «Der er ikke registreret sygeløn i erstatningsperioden – angiv sygelønnen som lønrækker, ellers beregnes
  sygeferiegodtgørelse for hele perioden», og en info-tooltip ved togglen, der siger det samme.
- **Andre steder det kan gælde:** Overenskomsterne med `bortfalderUnderArbejdsgiverbetaltSygeloen` (otte i dag).

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** når «Først sygeferiegodtgørelse efter ophør af sygeløn» er slået til – eller
overenskomsten lader retten bortfalde under sygeløn – og der ingen lønrækker er i erstatningsperioden, viser «Fejl og
advarsler» den gule linje «Der er ikke registreret sygeløn i erstatningsperioden – angiv sygelønnen som lønrækker,
ellers beregnes sygeferiegodtgørelse for hele perioden». Ved «Manuelt angivet» fører linket til togglen, ved en
overenskomst til kortet. Togglen har fået en info-tooltip: «Sygelønnen angives som lønrækker på kortet for de måneder,
hvor arbejdsgiveren betalte sygeløn. Uden lønrækker i erstatningsperioden beregnes sygeferiegodtgørelse for hele
perioden.»

### BB-327 – Bilaget viser «Regulering af referencesatsen … x 1 / 1», også når satsen ikke reguleres

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen (lønudvikling «Ingen»), eller Elektrikeroverenskomsten. Hent opgørelsen.
- **Det sker:** «Kravet beregnes per kalenderdag med referencesatsen.» – og to linjer længere nede «Regulering af
  referencesatsen 02-03-2023 - 31-12-2023: 133,93 x 1 / 1 = 133,93 kr.» (to gange ved overenskomsten, én pr. pensionsperiode).
  Overskriften trykkes, når et segment HAR et reguleringsgrundlag; sætningen ovenover vælges efter, om indekset er
  forskelligt fra 100 – to forskellige prøver.
- **Det er uhensigtsmæssigt fordi:** Modparten læser en regulering, der ikke findes, lige under en sætning, der siger, at
  der ingen er.
- **Bedre ville være:** Afsnittet «Regulering af referencesatsen» trykkes kun, når mindst ét segment faktisk ændrer
  satsen – samme prøve som sætningen.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** «Regulering af referencesatsen» trykkes kun, når satsen faktisk ændres – samme prøve
som sætningen «… reguleret efter lønudviklingen fra referenceperiodens slutdato».

### BB-328 – Bilaget skriver «12,5 %», «+ 8 %», «250» og «56.430» – uden de to decimaler og «kr.», som resten af opgørelsen bruger

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (BB-318's princip)
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen og «Manuelt angivet» `250`. Hent opgørelsen.
- **Det sker:** Forsiden: «Feriegodtgørelse/-tillæg (12,50 %)», «Sygeferiegodtgørelse 56.430,00 kr.» Bilaget:
  «Referencesats (30.000,00 x 12,5 % / …)», tabellen «250 + 8 % 209 56.430» og under «Beregnet krav» «56.430,00» uden
  «kr.» Ledeteksten «Feriepenge modtaget i perioden (+ AG-pension) =» slutter med et lighedstegn foran et fradrag.
- **Det er uhensigtsmæssigt fordi:** Samme beløb står som `56.430` og `56.430,00` i samme bilag, og bilagets beløb mangler
  den enhed, forsiden har.
- **Bedre ville være:** Procenter med to decimaler, beløb med øre og «kr.» i tabellen og under «Beregnet krav», og uden
  «=» i ledeteksten.
- **Andre steder det kan gælde:** Ingen ud over bilaget.

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** bilaget skriver «12,50 %» og «+ 8,00 %», og tabellens beløb og linjerne under «Beregnet
krav» har øre og «kr.» («250,00 kr.», «56.430,00 kr.»). Ledeteksten hedder «Feriepenge modtaget i perioden (+
AG-pension)» uden «=». Word-filen følger med, da den deler bilagets opbygning.

### BB-329 – «Evt. ferie- og fraværsdage i referenceperioden uden løn» siger ikke, om det er kalender- eller arbejdsdage

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24 med valg af form til mig. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Grundsagen med `5` fraværsdage; derefter med «Fuld løn under ferie» fra.
- **Det sker:** Med fuld løn under ferie trækkes `5` fra 28 kalenderdage («… / 23 kalenderdage) = 163,04 kr./kalenderdag»),
  uden fra 20 arbejdsdage («… / 15 arbejdsdage) = 250,00 kr./arbejdsdag»). Feltet hedder det samme i begge tilfælde; kun
  boksens loftlinje og papiret nævner enheden.
- **Det er uhensigtsmæssigt fordi:** En uges fravær er 7 kalenderdage eller 5 arbejdsdage. To fagfolk taster forskelligt,
  og enheden skifter med et valg længere oppe på kortet.
- **Bedre ville være:** Enheden står ved feltet og følger opgørelsen: «… uden løn (kalenderdage)» / «(arbejdsdage)».
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig, men undersøg gerne, om teksten kan være der og at det ikke bliver for visuelt tung med for meget tekst. Overvej gerne i stedet et alternativ med et info-ikon og en kort, beskrivende tooltip.

**Gennemført 2026-10-24:** enheden står synligt ved feltet: «Evt. ferie- og fraværsdage uden løn (kalenderdage)»
eller «(arbejdsdage)», efter opgørelsen. Jeg valgte teksten frem for et info-ikon, fordi enheden afgør, hvilket tal
der skal tastes – en tooltip skal man vide, at man skal holde musen over. For at teksten ikke bliver tungere, er «i
referenceperioden» udeladt; feltet står lige under «Referenceperiode». Linjen er nu kortere end før (50 mod 55 tegn)
og kortere end nabofeltet «Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode» (set på
skærmbillede ved 1536×864).

### BB-330 – «Overenskomst» uden overenskomst: «(angivet ovenfor)» peger på ingenting, og linket blinker hele kortet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-24. **GENNEMFØRT** 2026-10-24.
- **Sådan fremprovokeres det:** Kort uden overenskomst («Overenskomst» fra). Vælg sygeferiegodtgørelse «Overenskomst».
  Klik linket.
- **Det sker:** Afsnittet: «Overenskomst (angivet ovenfor) – Ingen overenskomst valgt». Boksen: «Det er angivet, at SFGG
  fastsættes efter overenskomst, men ingen overenskomst er valgt». Linket blinker hele kortet (90 elementer, målt), fokus
  på `body`; overenskomstfeltet, det peger på, er skjult, fordi togglen er fra.
- **Det er uhensigtsmæssigt fordi:** Brugeren skal selv finde ud af, at han enten skal slå «Overenskomst» til på kortet
  eller vælge en anden kilde, og «SFGG» står ingen andre steder på skærmen.
- **Bedre ville være:** «Sygeferiegodtgørelse beregnes ud fra overenskomst, men ansættelsesforholdet har ingen
  overenskomst – slå «Overenskomst» til, eller vælg «Ferieloven»», med link til togglen «Overenskomst».
- **Andre steder det kan gælde:** BB-331.

**Tilbagemelding**
Enig

**Gennemført 2026-10-24:** linjen hedder «Sygeferiegodtgørelse beregnes ud fra overenskomst, men
ansættelsesforholdet har ingen overenskomst – slå 'Overenskomst' til, eller vælg 'Ferieloven'», og linket blinker
togglen «Overenskomst». Er togglen slået til uden en valgt overenskomst, står der i stedet «… men der er ikke valgt en
overenskomst – vælg en under 'Vælg overenskomst', eller vælg 'Ferieloven'» med link til overenskomstfeltet.
Apostrofferne følger din afgørelse under BB-331.

### BB-331 – Afsnittets beskeder bruger «SFGG» og andre navne end felterne

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** **Delvist godkendt** af udvikleren 2026-10-24 (feltnavne i apostroffer; «SFGG» må bruges, hvor
  pladsen kræver det). **GENNEMFØRT** 2026-10-24 med apostroffer.
- **Sådan fremprovokeres det:** Lad kilden stå tom; vælg «Manuelt angivet» uden dagssats; hold musen over
  informationsikonet ved «Evt. allerede betalt …»; skadedato før 2015.
- **Det sker:** «Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt» (feltet hedder «Sygeferiegodtgørelse beregnes
  ud fra»); «Dagssats er ikke angivet» (feltet: «Dagssats for sygeferiegodtgørelse (mandag-fredag)»); tooltippet «Angiv kun
  faktisk SFGG. Feriegodtgørelse af sygeløn beregnes automatisk.»; «… være indtastet på fanen med EO Oplysninger.»
  (fanen hedder «EO oplysninger»). BB-330 og BB-323 bærer «SFGG» i to linjer mere.
- **Det er uhensigtsmæssigt fordi:** Brugeren skal oversætte forkortelser og navne til det, han ser (BB-316's afgørelse:
  linjerne bruger feltets navn).
- **Bedre ville være:** «Sygeferiegodtgørelse beregnes ud fra er ikke valgt», «Dagssats for sygeferiegodtgørelse er ikke
  angivet», «Angiv kun faktisk udbetalt sygeferiegodtgørelse …» og «… indtastet på fanen EO oplysninger.»
- **Andre steder det kan gælde:** Validatorens parallelle tekster («Beregningsgrundlag for SFGG ikke valgt»), som ikke
  når boksen.

**Tilbagemelding**
Delvist enig. Mange gange er SFGG valgt som forkortelse for ikke at gøre indholdet for langt og teksttungt, så dette behov skal tages med i betragtningerne. Derudover, når der henvises til en tekst, som fremgår af programmet og er på flere ord, forekommer det mest korrekt, at teksten sættes i apostrof, altså så
- **Bedre ville være:** «Sygeferiegodtgørelse beregnes ud fra er ikke valgt», «Dagssats for sygeferiegodtgørelse er ikke
  angivet», «Angiv kun faktisk udbetalt sygeferiegodtgørelse …» og «… indtastet på fanen EO oplysninger.»

bliver til:
- **Bedre ville være:** «'Sygeferiegodtgørelse beregnes ud fra' er ikke valgt», «'Dagssats for sygeferiegodtgørelse' er ikke
  angivet», «Angiv kun faktisk udbetalt sygeferiegodtgørelse …» og «… indtastet på fanen EO oplysninger.»

**Gennemført 2026-10-24 (din version):** «'Sygeferiegodtgørelse beregnes ud fra' er ikke valgt», «'Dagssats for
sygeferiegodtgørelse' er ikke angivet», tooltippen «Angiv kun faktisk udbetalt sygeferiegodtgørelse. Feriegodtgørelse
af sygeløn beregnes automatisk.» og bemærkningen «… indtastet på fanen EO oplysninger.» Apostrofferne er samme form,
som «Fejl og advarsler» allerede bruger for flerordsnavne. Validatorens parallelle tekster og feltnavnene bag
afsnittets linjer («Referenceperiode, fra», «Dagssats for sygeferiegodtgørelse» m.fl.) er rettet til skærmens navne.
«SFGG» står fortsat kun på kontrolfanen (12m's flade), hvor tabellens bredde kræver det; ingen af de nye linjer bruger
forkortelsen.

## Overvejet uden fund

- **De fire kilder** åbner hver deres felter; et skift Ferieloven → Manuelt angivet → Ferieloven bevarer
  referenceperioden (målt). **M-32 bestået:** en rød (omvendt) referenceperiode bag «Manuelt angivet» eller ved TAF «Nej»
  spærrer ikke (BB-301 virker).
- **Tom kilde** giver «… er ikke valgt» med link, der blinker netop valget; ingen rød ring (BB-274's afgørelse).
- **Omvendt referenceperiode** giver begge felter rød ring med hver sin spejlvendte tekst (M-07 bestået); `2030` giver
  systemrammens grænse på begge.
- **Direkte overenskomstsats** (Bygge-/anlægsoverenskomsten): satsvalget vises, en tom værdi giver «Uddannelse og
  arbejdssted for sygeferiegodtgørelse er ikke valgt» med link; papiret skriver «Skadelidte var faglært og ansat uden for
  København, og satsen udgør 190,75 kr./arbejdsdag» og skifter pension med overenskomsten.
- **Ansættelsesophør** `30-06-2023`: «Retten bortfaldt ved ansættelsesforholdets ophør 30-06-2023», perioden afkortes, og
  seksmånedersbemærkningen udgår.
- **Skade før 2015 i opgørelse nr. 1:** «retten er begrænset til 4 måneder, som ophørte 30-06-2014», og første sygedag
  medregnes. Efter 2015: «først krav … fra anden sygedag», perioden begynder `02-03-2023`; ved opgørelse nr. 2 medregnes
  første dag.
- **Feriegodtgørelse 15 %:** noten «Satsen udgør 12,5 % af den ferieberettigede løn.» står i bilaget (§2.0).
- **Sygeløn ved Ferieloven** trækkes fra som «Feriepenge modtaget i perioden (+ AG-pension) = - 11.974,06».
- **To kort** giver to afsnit i bilaget med hvert sit navn og to boks-linjer med «Ansættelsesforhold 1/2» (BB-278).
- **Dagssats `0`** tages imod og giver `0,00 kr.` med et helt bilag. Det er brugerens egen oplysning, og resultatet er
  det samme som «Ingen»; ikke et fund.
- **«Evt. allerede betalt» større end kravet** (`100.000 kr.` mod `44.116,54 kr.`): papiret skriver «- 100.000,00» og
  «Beregnet sygeferiegodtgørelse 0,00». Nullet er beregningens velkendte resultatform (BB-119's skel i M-24), ikke et
  plaster; ikke et fund.
- **«Beløbet er i henhold til»** med 60 tegn trykkes på én linje i bilaget; første bogstav gøres stort («Forlig …») –
  for småt til et fund.
- **M-36's 12j-kandidat** (`sfggSegmentering.ts`): fraværsdage lig periodens dage og dagssats `0` giver ingen intern
  fejl – kun BB-323's linje henholdsvis et nul.
- **M-09 bestået:** ved 1244×620 er `scrollWidth = clientWidth = 1244`.
- **Konsollen** var tavs: ingen runtime-fejl i 41 målte forløb.

## Henvisninger til andre bidder

- **12k:** sygeferiegodtgørelsen står under «Indtægter i erstatningsperioden» sammen med ydelserne; summen er 12l's.
- **12l:** bilagsvalget «Sygeferiegodtgørelse» er aktivt, selv når satsen er `0,00 kr.` (BB-319).
- **12m:** kontrolrækkerne «Referencesats», «Periode» og «Varighedsbegrænset» bærer svarene på BB-319 og BB-320, men vises kun
  på kontrolfanen (M-28).

## Dækningshuller

- Kun Chrome, lyst tema; kun PDF-kanalen er læst (Word deler dokumentmodellen).
- Lønudvikling med Overenskomst, Statistik, KRL og KL er ikke afprøvet for satsens regulering (afklaringslog 8 og 8d er
  bindende); kun «Ingen» og «Manuel procentsats».
- Gem/Hent-rundturen, tastaturrækkefølgen gennem afsnittet og undo/redo efter et kildeskift er ikke afprøvet.
- Erhvervssygdom («anmeldelsesdatoen») og skader før 2015 i arbejdsdage er ikke afprøvet.

## Åbne spørgsmål

Ingen. Modsvarene på BB-319 og BB-321 er besvaret og gennemført 2026-10-24; BB-323's bemærkning var til orientering.
