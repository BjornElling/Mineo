# Brugerblik – Varige mén

Fladen har to faner og føres derfor som to kørsler. Dette dokument samler dem begge; `STATUS.md` har
én række pr. fane.

- Rute/placering: `/varigemen`
- Faner: **Ménberegning** (gennemgået 2026-08-20, alle fund afgjort) · **Satser** (gennemgået og
  afgjort 2026-08-21: to fund rettet, tre afvist)

---

# Fane 1 – Ménberegning

- Gennemgået: 2026-08-20 · commit `47c7739c`
- Tilbagemeldinger gennemført: 2026-08-20. Elleve fund rettet (BB-062, BB-063, BB-064, BB-065,
  BB-066, BB-068, BB-069, BB-070, BB-071, BB-072, BB-073 – se hver enkelt for detaljer), to afvist
  af brugeren (BB-067, BB-074, begge noteret under fundet).
- Afprøvet i: Chrome, 1536×864, headless via `playwright-cli`. Alle tal og tekster nedenfor er
  aflæst i den kørende app, ikke udledt af koden, medmindre andet står.
- Console under hele gennemgangen: 183 beskeder, **0 errors, 0 warnings.**

## Fladen kort

Fanen er programmets første flade med en reel beregning, og den er lille: to indtastningsfelter
(Méngrad, Beregningsdato), én hjælpeknap (Indsæt dags dato), tre spejlede stamdata-rækker
(Fødselsdato, Skadedato/Anmeldelsesdato, Alder på skadestidspunkt), en satsrække og tre
resultatrækker med en downloadknap. Der er ingen tabel, ingen rækker der kan tilføjes, og ingen
lokal tilstand ud over de to felter.

Alt, hvad brugeren ser i den øverste tredjedel, er **lånt fra Stamdata** – og netop lånet er, hvor
fladens fund bor. Fanen afhænger af Stamdatas fødselsdato og skadedato (begge påkrævede for at der
regnes noget som helst), og af satsdatasættets årsdækning 2005–2026, som fastsætter
beregningsdatoens ydre grænser. Ingen anden side afhænger af fanen; den er en blindtarm i sagen med
sit eget dokument.

## Fund

### BB-062 – Advarslen ved méngrad 5 % vises først, når tre andre felter er udfyldt

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
- **Prioritet:** Høj
- **Beslutning:** Agent afgør (genskaber den aftalte adfærd fra `BF-017` og `varigemen-contract.md` §2.8)
- **Sådan fremprovokeres det:**
  1. `Slet alt`, gå til Varige mén → Ménberegning.
  2. Skriv `5` i Méngrad og tryk Tab. (Méngrad er fanens første felt – det er den naturlige rækkefølge.)
  3. Udfyld derefter Fødselsdato og Skadedato i Stamdata, gå tilbage, og skriv en Beregningsdato.
- **Det sker:** I trin 2 er der **ingen** advarsel: feltrammen er neutral (målt
  `rgba(0, 0, 0, 0.12)`), og der er ingen tooltip. Værdien er `5` og er afsluttet. Først i det
  øjeblik den sidste af de tre andre datoer bliver gyldig, skifter rammen til gul (målt
  `rgb(245, 158, 11)`) og teksten «Der kan ikke tilkendes varige mén under 5 %» kommer frem – uden at
  brugeren har rørt Méngrad.
- **Det er uhensigtsmæssigt fordi:** advarslen er en oplysning **om méngraden**, og den udebliver
  præcis på det tidspunkt, hvor brugeren står med méngraden i hånden. Den kommer i stedet minutter
  senere, hængt op på et felt han lige har forlangt, hvad der ser ud som en advarsel om
  beregningsdatoen. En feltadvarsel, der tænder og slukker af noget, der ikke er feltets eget
  indhold, kan ikke læses som en advarsel om feltet.
- **Bedre ville være:** advarslen afgøres af méngradfeltets egen afsluttede værdi og er dermed
  uafhængig af, om resten af sagen er udfyldt. `resolveVarigeMenWarning` skal læse méngrad direkte
  gennem readeren (`evaluation.reader.read(mengradRef)`) i stedet for `projectionData?.mengrad`,
  som først findes, når hele beregningen er `ready`.
- **Andre steder det kan gælde:** enhver feltadvarsel, der læser sin værdi af en samlet projektion
  frem for af feltet. Konkret kandidat: EET-procenternes 15 %-advarsel (`BF-019`,
  `EetOplysningerTab.tsx`) – samme form, ikke efterprøvet, hører til flade nr. 11.

**Tilbagemelding**
Jeg er enig i dit fund. Den gule advarsel på feltet bør ikke være afhængig af andet end at brugeren har indtastet en værdi i feltet, der er lavere end 5%.

**Rettet (2026-08-20).** `resolveVarigeMenWarning` læser nu méngrad direkte via `evaluation.reader.read(mengradRef)` i stedet for `projectionData?.mengrad`.

### BB-063 – Méngrad 1–4 regner og kan hentes uden et ord, mens 5 advarer

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger (juridisk grænse og UI-tekst)
- **Sådan fremprovokeres det:** Udfyld sagen, og sæt Méngrad til `1`.
- **Det sker (målt):** «Grundbeløb: 1 % mén á 10.135,00 kr. → 10.135,00 kr.», «Aldersreduktion, 45 år
  = - 6 % → - 608,00 kr.», «Beregnet méngodtgørelse 9.527 kr.», og downloadknappen er aktiv. Ingen
  advarsel, ingen markering. Ved `5` – hvor mén **kan** tilkendes – kommer advarslen «Der kan ikke
  tilkendes varige mén under 5 %».
- **Det er uhensigtsmæssigt fordi:** programmet advarer ved den ene værdi, hvor sætningen ikke
  gælder, og er tavst ved de fire, hvor den gør. Brugeren, der har tastet 3 %, får et færdigt tal og
  en PDF med et beløb, der efter advarslens egen ordlyd ikke kan tilkendes.
- **Bedre ville være:** samme ikke-blokerende gule advarsel for 1–4 (ordlyden passer uændret dér).
  Advarslen ved præcis 5 bevares som den aftalte grænsepåmindelse (`BF-017`), så teksten står ved
  både grænsen og under den.
- **Andre steder det kan gælde:** EET's 15 %-advarsel (`BF-019`) – efterprøv om den ligeledes kun
  udløses ved præcis 15.

**Tilbagemelding**
Dette er en eklatant fejl. Der skal ikke gives advarsel ved 5 %. Kun når den indtastede méngrad er lavere end 5%, dvs. 1-4%, eftersom der kommer en egentlig fejlmeddelelse ved 5 %. Tooltip-meddelelsen ved 0 % bør i øvrigt ændres til, at værdien skal være mellem 5 og 120 %, og ikke mellem 1 og 120 som nu.

**Rettet (2026-08-20).** Advarslen vises nu kun for méngrad 1–4. Feltets nedre bounds-grænse (`MENGRAD_MIN` i `varigeMenDescriptors.ts`) er ændret fra 1 til 5, hvilket automatisk ændrer tooltip-teksten til "mellem 5 og 120" (afledt af grænserne, ikke en separat streng).

### BB-064 – En udfyldt stamdato meldes som «Mangler», mens samme skærm citerer dens værdi

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien`
- **Prioritet:** Høj
- **Beslutning:** Agent afgør for mekanikken (programmet har allerede løsningen, se nedenfor);
  **Afventer bruger** for ordlyden, hvis den skal være en anden end Forsørgertabs.
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadedato `10-06-2020` (gyldig), Fødselsdato `01-01-2035`.
  2. Gå til Varige mén → Ménberegning.
- **Det sker (målt, samme skærmbillede):**
  - «Fødselsdato → Mangler (angiv i **Stamdata**)»
  - «Skadedato → Mangler (angiv i **Stamdata**)» – selv om skadedatoen er udfyldt, gyldig og
    ubestridt `10-06-2020`. Den er kun rød, fordi datoordenen markerer begge parter (M-07).
  - «Alder på skadestidspunkt → Fødselsdatoen ligger efter den angivne skadedato (**10-06-2020**)»
  - «Beregningsdato → Datoen kan ikke være før skadedatoen (**10-06-2020**)»
  Samme mønster med en enkelt rød dato: Skadedato `31-12-2030` giver «Skadedato → Mangler (angiv i
  Stamdata)», mens beregningsdatoens fejl lyder «Der findes ingen gyldig dato her: tidligst tilladte
  (**31-12-2030**) ligger efter senest tilladte (31-12-2026). Grænserne kommer fra Skadedato og
  beregningsdatoens satsdækning.»
- **Det er uhensigtsmæssigt fordi:** fladen siger to modstridende ting om samme felt tre linjer fra
  hinanden – at det mangler, og hvad der står i det. «Mangler (angiv i Stamdata)» sender brugeren
  hen for at **indtaste** noget, der allerede er indtastet; det, han skal, er at **rette**. Og i
  tilfældet ovenfor peger fladen på det forkerte felt: skadedatoen er rigtig, fødselsdatoen er
  forkert, men de to rækker ser ens ud.
- **Bedre ville være:** at gøre som **Forsørgertab allerede gør** på sin tilsvarende flade
  (`ForsoergertabOplysningerSection.tsx` linje 34-40 og 62-70): vis feltets egen fejltekst, når der
  er en, og «Mangler (angiv i Stamdata)» kun når feltet virkelig er tomt
  (`{error ?? <>Mangler (angiv i Stamdata)</>}`). Så bliver rækken enten «01-01-2035 – ligger efter
  den angivne skadedato» eller «Mangler». Løsningen findes i programmet selv; fanen her er
  undtagelsen.
- **Andre steder det kan gælde:** EET efter EAL's spejlede stamdata-rækker (flade 11) og
  Erstatningsopgørelsens forudsætningsrækker (flade 12) – ikke efterprøvet. Forsørgertab er
  efterprøvet og er i orden.

**Tilbagemelding**
Jeg anerkender præmissen for din vurdering, men vil gerne afsøge en lidt anden løsning.
Generelt vil jeg gerne forsimplet orienteringerne til brugeren om fejl og mangler i tooltip-meddelelser og disse inline-meddelelser, så der konsekvent bruges to tilbagemeldinger om henholdsvis at indtastning mangler eller at der er fejl i indtastning, altså i tråd med hvad der sker i tooltip på download-knappen. Selve den udspecificerede fejlmeddelelse, hvis der er en, fremgår af det felt, hvor indtastningen faktisk er foretaget eller mangler. Så her kunne det være rart at inline-teksten sondrede mellem, om den indtastede værdi mangler eller om der er indtastet en ugyldig værdi, og da skriver det.

**Rettet (2026-08-20), efter brugerens alternative løsning.** Fødselsdato-, skadedato- og
alder-rækkerne viser nu ÉN af de to universelle standardbeskeder (`ACTION_BLOCKED_MISSING_INPUT_MESSAGE`
= "Indtastning mangler" / `ACTION_BLOCKED_INVALID_INPUT_MESSAGE` = "Fejl i indtastning", samme
konstanter som download-knappens tooltip bruger via `actionGate.ts`) i stedet for at citere feltets
specifikke fejltekst. Den udspecificerede fejl står stadig ordret i tooltip og i selve Stamdata-feltet.

### BB-065 – Satsrækken siger «Beregningsdato mangler» om en udfyldt, rød beregningsdato

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien`
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger (UI-tekst)
- **Sådan fremprovokeres det:** Skadedato `10-06-2020`; skriv Beregningsdato `01-01-2019`.
- **Det sker (målt):** Feltet bliver rødt med «Datoen kan ikke være før skadedatoen (10-06-2020)».
  Rækken nedenfor skifter label til «Sats per méngrad i beregningsåret» og viser teksten
  «Beregningsdato mangler». Hover på den tekst afslører en tooltip med den rigtige forklaring
  («Datoen kan ikke være før skadedatoen (10-06-2020)») – men den synlige tekst siger «mangler».
- **Det er uhensigtsmæssigt fordi:** den synlige tekst er den forkerte af de to, programmet har.
  Sandheden er i tooltippen, som kun findes med musen, og som brugeren ikke har nogen anledning til
  at lede efter, når rækken allerede har givet et svar.
- **Bedre ville være:** samme skelnen som BB-064: «Beregningsdato mangler» kun ved tomt felt,
  ellers en tekst der siger, at datoen skal rettes (fx «Ugyldig beregningsdato»), med feltets
  konkrete grænse i tooltippen som i dag.
- **Andre steder det kan gælde:** alle «<felt> mangler»-tekster, der er koblet til en `undefined`
  læsning frem for til et tomt felt. Søg på mekanismen `read(...).status === 'usable' ? … : '<felt>
  mangler'`.

**Tilbagemelding**
Samme som ovenfor. Hvis du er enig i præmissen kunne jeg godt tænke mig, at når der er tale om henvisninger til noget, der er foretaget i et andet felt, benyttes én af to meddelelser om enten manglende indtastnig eller fejl i indtastning, men ikke gengivelse af den udspecificerede fejl-årsag - den fremgår af selve feltet, hvor manglen/fejlen findes.

**Rettet (2026-08-20).** Samme mekanik som BB-064: satsrækken viser nu "Indtastning mangler" eller
"Fejl i indtastning" i stedet for at citere/fejlbenævne beregningsdatoens specifikke fejl.

### BB-066 – Alder-rækken viser fødselsdatoens fejl, men aldrig skadedatoens

- **Type:** Fornuft
- **Rækkevidde:** Lokal (samme mekanik som BB-064)
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør (retter en asymmetri i den samme række; ingen ny adfærdsklasse)
- **Sådan fremprovokeres det:** (a) Fødselsdato `99-99-9999`, gyldig skadedato. (b) Gyldig
  fødselsdato, Skadedato `31-12-2030`.
- **Det sker (målt):** (a) «Alder på skadestidspunkt → Der er udfyldt en ugyldig værdi i feltet
  'Fødselsdato'». (b) «Alder på skadestidspunkt → Indtastning mangler».
- **Det er uhensigtsmæssigt fordi:** de to datoer er ligeværdige forudsætninger for alderen, men
  kun den enes fejl bliver fortalt. Ved (b) får brugeren beskeden «Indtastning mangler» om en
  beregning, hvis to input beviseligt begge er indtastet. Skadedatoens fejltekst findes i forvejen
  i fladen – den bruges til at vælge, hvilket felt et blokeret download skal pege på, men vises
  aldrig.
- **Bedre ville være:** samme gren håndterer begge: er der en fejl på en af de to datoer, vises
  den fejl; er et af felterne tomt, vises «Indtastning mangler».
- **Andre steder det kan gælde:** ingen – asymmetrien er lokal.

**Tilbagemelding**
Accepteret efter tilbagevendende drøftelse: rettes. Situationen er ikke sjælden (almindelig top-til-bund udfyldning med en tastefejl i skadedatoen), og løsningen er samme forgrening som fødselsdato-grenen allerede har, blot spejlet til skadedatoen.

**Rettet (2026-08-20).** Alder-rækken viser nu skadedatoens fejl, hvis den findes, sideordnet med
fødselsdatoens (begge er nu underlagt den samme to-klasse-standardbesked som BB-064/BB-065).

### BB-067 – De nedtonede «mangler»-tekster er ikke nedtonede: farven bliver overskrevet

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-21--en-css-klasse-slår-komponentens-egen-farve-ihjel`
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør (genskaber den hensigt, koden udtrykker; ingen ny UI-beslutning)
- **Sådan fremprovokeres det:** Åbn fanen med tom sag og aflæs farven på de tre «mangler»-tekster.
- **Det sker (målt):** Alle tre – «Mangler (angiv i Stamdata)» (to gange), «Indtastning mangler» og
  «Beregningsdato mangler» – rendres i `rgba(0, 0, 0, 0.87)`, altså **præcis samme farve som en
  rigtig, indtastet værdi**. Koden beder om noget andet fire steder
  (`color="text.secondary"`, `color="text.disabled"`, `color={skadedato ? 'text.primary' :
  'text.disabled'}`), og de to rækker med hver sin farveangivelse ender med **samme** emotion-klasse
  (`css-1xzufyv-MuiTypography-root`), hvis eneste farveregel er standardfarven. Mekanismen er målt to
  gange: (1) ingen klasse i hele dokumentet udsender `text.secondary`/`text.disabled` fra en
  `color`-prop; (2) en syntetisk enkeltklasse-regel (`.bb-probe { color: rgb(1,2,3) }`), indsat
  **efter** app-stylesheetet, taber alligevel til `.MuiTypography-root.row--text`, fordi den
  regel har to klasser. Enhver enkeltklasse-farve – både `color`-proppen og `sx={{ color }}` – er
  derfor død på et `row--text`-element.
- **Det er uhensigtsmæssigt fordi:** fladen mister sin eneste visuelle skelnen mellem «her står en
  værdi» og «her mangler en værdi». Ved et hurtigt blik ser en tom sag udfyldt ud: syv rækker med
  sort tekst i samme vægt. Det er også en fælde for al fremtidig kode – den næste, der skriver
  `color="…"` på en rækketekst, får ingen fejl og ingen virkning.
- **Bedre ville være:** brug programmets egne klasser til formålet (`text-muted` /
  `body-text-secondary` findes og virker, fordi de har samme to-klasse-specificitet) i stedet for en
  farve-prop, og fjern de fire døde props. Værn: et AST-tjek, der afviser `color`/`sx`-farve på et
  element med en `row--*`-klasse.
- **Andre steder det kan gælde:** samme døde `color`-prop: `ForsoergertabOplysningerSection.tsx`
  (2 steder). Samme døde `sx`-farve: `Satser.tsx:30`, `CannotComputeAggregationNotice.tsx:13`,
  `DefaultDirectoryRow.tsx:27-30` og – mest alvorligt, ikke efterprøvet i drift –
  `DocumentOutcomeMessage.tsx:34`, der beder om `color: 'error.main'` til en **fejlbesked**, som
  dermed ikke er rød.

**Tilbagemelding**
Jeg er ikke afvisende over for din anbefaling, men jeg er bange for, at resultatet kan blive det modsatte. At brugeren ser de almindelige linjer med almindelig tekstfarve og ikke rigtig registrerer at der er nedtonede linjer, som indeholder fejl. Fejlene er jo vel nærmest det væsentligste for brugeren at forholde sig til.

### BB-068 – «Indsæt dags dato» vil indsætte en afvist dato fra 1. januar 2027

- **Type:** Edge case
- **Rækkevidde:** Lokal (men se kandidatlisten)
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger (hvad knappen skal gøre, når dags dato ikke er en lovlig værdi)
- **Sådan fremprovokeres det:** Beregningsdatoens tilladte interval slutter ved den sidste dag i
  det seneste år med méngrad-sats, i dag `31-12-2026`. Målt: `01-01-2027` afvises med «Dato skal
  være mellem 10-06-2020 og 31-12-2026». Knappen «Indsæt dags dato» indsætter dags dato uden at
  spørge om intervallet.
- **Det sker:** I dag (2026-08-20) virker knappen fint – målt `20-08-2026` og en gyldig beregning.
  Fra 1. januar 2027, og indtil satsdatasættet får 2027, vil knappen indsætte en dato, feltet gør
  rød i samme øjeblik. Brugeren har trykket på programmets egen genvej og får en fejl.
- **Det er uhensigtsmæssigt fordi:** en knap, programmet selv tilbyder, må ikke kunne producere en
  værdi, programmet selv afviser. Formen er værre end en manuel fejlindtastning, fordi brugeren
  ikke har valgt værdien og derfor ikke kan se, hvad der er galt med den.
- **Bedre ville være:** to muligheder, og valget er brugerens: (a) knappen er inaktiv med
  årsagen i tooltippen, når dags dato ligger uden for feltets interval (samme grammatik som alle
  andre grå knapper, `actionGate.ts`), eller (b) fladen oplyser dækningsgrænsen, så snart den er
  overskredet. Uanset valget bør satsdatasættets sidste år og «dags dato» ikke kunne komme i
  konflikt uden et ord.
- **Andre steder det kan gælde:** de fem flader med «Indsæt dags dato». Prøven er generel: **er
  dags dato altid inden for feltets erklærede interval?** Felter med `max: getToday()` er sikre;
  felter som dette, hvor maksimum er et **datasæt**, er ikke.

**Tilbagemelding**
Jeg anerkender problemet. Jeg vil gerne have den foreslåede mulighed a), altså at knappen gøres inaktiv med en relevant tooltip, hvis dags dato ligger uden for det mulige spænd, fx. at "Der kan kun foretages beregninger frem til DD-MM-ÅÅÅÅ" eller noget i den stil.

**Rettet (2026-08-20).** `InsertTodayDateButton` har fået en ny, valgfri `disabled`/`disabledReason`-prop
(additiv, ingen anden af de otte kaldssteder påvirket). Varige méns knap er nu inaktiv med tooltippen
"Der kan kun foretages beregninger frem til {sidste dækkede dato}", når dags dato ligger uden for
beregningsdatoens interval. De øvrige fire flader med samme knap (nævnt under "Andre steder det kan
gælde") er IKKE efterprøvet eller rettet her – kun Varige mén var i scope for denne gennemgang.

### BB-069 – Et blokeret klik på en aktiv downloadknap giver intet svar, og fokus ryger til siden

- **Type:** Fejl
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør (den tilsigtede feedback er beskrevet i koden og virker ikke)
- **Sådan fremprovokeres det:**
  1. Færdig, gyldig sag – downloadknappen er aktiv («Download som PDF»).
  2. Dobbeltklik Méngrad og skriv `121`. Knappen er stadig aktiv (korrekt: en åben draft ændrer
     ikke gaten).
  3. Klik direkte på downloadknappen.
- **Det sker (målt):** Preflighten afslutter feltet, `121` bliver rødt med «Værdi skal være mellem
  1 og 120», resultatrækkerne forsvinder, og knappen bliver grå. Men: **nul** blink-animationer
  (`animationstart` målt til 0; modprøven med samme opstilling og klassen sat manuelt gav 1, så
  målingen kan se et blink), **ingen** fokus på det felt der skal rettes, og `document.activeElement`
  ender som `BODY`. Samme resultat med en åben Beregningsdato-draft.
- **Det er uhensigtsmæssigt fordi:** fladens eget svar på en blokeret aktivering – «fokusspringet er
  bevaret», som koden skriver – findes ikke i den ene situation, hvor det kan nås. Årsagen er, at
  `focusFirstBlockingField` læser render-tilstanden fra **før** settlet: på klik-tidspunktet er
  beregningen stadig gyldig, så alle fire grene er falske, og der sker ingenting. Samtidig mister
  brugeren sit tastaturfokus helt, fordi knappen han netop trykkede på blev deaktiveret under
  fingeren.
- **Bedre ville være:** feedbacken afgøres af udfaldet af preflighten frem for af render-tilstanden
  – `download()` kender de blokerende årsager – og fokus lægges (og bliver) på det felt, brugeren
  skal rette, frem for at blive kastet på `BODY`.
- **Andre steder det kan gælde:** alle sider med samme «fokusér det første blokerende felt»-kode
  efter et afvist download. Søg på `outcome.rejection.kind === 'gate-blocked'`.

**Tilbagemelding**
Accepteret efter tilbagevendende drøftelse: rettes. Fundet handler ikke om knappens udseende under indtastning (det er vi enige om skal være uændret), men om at et klik EFTER afsluttet, ugyldig indtastning ikke giver noget svar og kaster fokus til BODY. Rød ring + tooltip hjælper ikke, når brugeren ikke længere har fokus på feltet.

**Rettet (2026-08-20).** Fejlen var TO ting i samspil, ikke én:

1. Selve klikket kunne forsvinde: et museklik flytter native fokus til knappen FØR `click` affyres,
   hvilket blurrer en åben, ugyldig draft, committer den synkront, og gør knappen `disabled` – FØR
   click-eventet når frem. En disabled knap fyrer intet `onClick`. To uafhængige modelvurderinger
   (Opus 5 thinking og Codex/gpt-5.6-terra high) blev indhentet om løsningen: den ene forslog en
   arkitektonisk rodfix (fjern native `disabled` fra den delte `DownloadIconButton` globalt), den
   anden en lokal patch (`onMouseDown={(e) => e.preventDefault()}` kun på denne knap). Et
   opfølgende sundhedstjek hos Codex konkluderede entydigt, at den globale ændring ville være
   overkompliceret (ny to-vejs disabled-semantik, risiko for Tab-kontrakten på alle andre
   download-knapper i programmet) for et snævert, lavfrekvent scenarie. Brugeren valgte den lokale
   patch. Implementeret som en ny, valgfri `onMouseDown`-prop på `DownloadIconButton`/
   `DocumentDownloadButton` (additiv, ingen anden kaldsside påvirket), brugt kun på Varige méns
   aktive downloadknap.
2. Selve fokus-feedbacken (`focusFirstBlockingField`) læste closure-værdier fra renderet FØR
   settle. Rettet til at læse en frisk `InputReader`-snapshot (`readPort.getEvaluation()`) taget
   EFTER settle.

Regressionstest tilføjet i `MenberegningTab.integration.test.tsx`.

### BB-070 – Skærmen og dokumentet skriver slutbeløbet forskelligt

- **Type:** Fornuft
- **Rækkevidde:** Mønster (M-13-familien: to udgaver af samme tal)
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (hvilken af de to former der er den rigtige)
- **Sådan fremprovokeres det:** Hent PDF'en for en færdig sag og sammenlign nederste linje med
  skærmen.
- **Det sker (målt i en hentet PDF):** Dokumentet skriver «Beregnet méngodtgørelse **364.155,00
  kr.**»; skærmen skriver «**364.155 kr.**» for samme beregning. Alle øvrige linjer er ens i de to
  udgaver.
- **Det er uhensigtsmæssigt fordi:** beløbet er pr. konstruktion **rundet op til hele kroner**, så
  de to decimaler i dokumentet lover en præcision, tallet ikke har – og det er sagens vigtigste tal,
  der står forskelligt i de to udgaver, brugeren sammenligner.
- **Bedre ville være:** samme form begge steder. Mit forslag er dokumentets uden decimaler
  (`0` decimaler som på skærmen), fordi tallet er et helt kronebeløb; mellemregningerne
  (grundbeløb og reduktion) beholder deres to decimaler, hvor de er reelle.
- **Andre steder det kan gælde:** enhver generator, der bruger `formatAsAmount(x)` uden at angive
  præcision, mens skærmen angiver den. Prøven er, om kaldet mangler sit andet argument.

**Tilbagemelding**
Jeg anerkender fejlen og er enig. Løsningen bør være ensartet udseende på side og i PDF-dokumentet. Jeg vil gerne have, at beløbene i PDF-dokumentet også vises uden decimaler.

**Rettet (2026-08-20).** `varigeMenDocument.ts` formaterer nu "Beregnet méngodtgørelse" med
`formatAsAmount(beregningsResultat.beregnetGodtgoerelse, 0)` – samme 0-decimalers form som skærmen.

### BB-071 – Samme sats hedder tre ting på én side

- **Type:** Fornuft
- **Rækkevidde:** Lokal (går på tværs af sidens to faner)
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (UI-tekst)
- **Sådan fremprovokeres det:** Læs satsrækken på Ménberegning, og skift derefter til fanen Satser.
- **Det sker (målt):** Ménberegning: «Sats **per** méngrad i år 2026 → 11.035 kr.». Fanen Satser:
  kolonnerne «**Opgørelsesår**» og «Sats **pr.** méngrad» → «2026 | 11.035 kr.». Samme tal, samme
  side, to stavemåder af labelen – og året hedder Beregningsdato/beregningsåret på den ene fane og
  Opgørelsesår på den anden. «Opgørelsesår» findes i øvrigt kun dette ene sted i hele programmet.
- **Det er uhensigtsmæssigt fordi:** de to faner er de to halvdele af samme opslag – brugeren
  vælger en beregningsdato på den første og kontrollerer satsen på den anden. Når året skifter navn
  undervejs, skal han selv oversætte, og «Opgørelsesår» kan læses som noget andet end
  beregningsåret (fx opgørelsesdatoen på Erstatningsopgørelse, som er et selvstændigt begreb).
- **Bedre ville være:** ét ord for satsen («Sats pr. méngrad» begge steder, i overensstemmelse med
  programmets almindelige forkortelse) og ét ord for året. Da satsen slås op på **beregningsdatoens**
  år, er «Beregningsår» det oplagte.
- **Andre steder det kan gælde:** ingen; «Opgørelsesår» er unikt for denne tabel.

**Tilbagemelding**
Jeg er enig.

**Rettet (2026-08-20).** Begge flader bruger nu "Sats pr. méngrad i beregningsår {år}" (Ménberegning)
og "Beregningsår" (Satser-tabellens kolonneoverskrift, tidligere "Opgørelsesår"). PDF-dokumentet
havde den samme "per méngrad i år"-formulering og er rettet til samme tekst som skærmen.

### BB-072 – «Alder på skadestidspunkt» står uændret, når datoen hedder Anmeldelsesdato

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger (navngivning er brugerens regel)
- **Sådan fremprovokeres det:** Stamdata: Skadestype = `Erhvervssygdom`, dato `01-06-2020`.
  Gå til Ménberegning.
- **Det sker (målt):** Rækken hedder korrekt «Anmeldelsesdato → 1. juni 2020», og
  beregningsdatoens fejl siger korrekt «Datoen kan ikke være før **anmeldelsesdatoen** (01-06-2020)».
  Rækken imellem hedder stadig «Alder på **skadestidspunkt**» – og alderen er regnet på præcis den
  anmeldelsesdato, linjen ovenover netop omdøbte. Samme label står i den hentede PDF.
- **Det er uhensigtsmæssigt fordi:** brugerens regel (M-02) er, at «Skadedato» og «Anmeldelsesdato»
  er de to eneste korrekte betegnelser for den dato, og at **alle** tekster om den skal følge
  skadestypen. Feltet og fejlbeskederne gør det; de afledte labels blev ikke omfattet. For en
  erhvervssygdom findes der ikke noget «skadestidspunkt», og linjen fortæller derfor brugeren, at
  alderen er regnet på et tidspunkt, sagen ikke har.
- **Bedre ville være:** labelen følger samme navneregel som datoen: «Alder på skadestidspunkt» /
  «Alder på anmeldelsestidspunkt» – eller en formulering, der er rigtig i begge tilfælde
  («Alder på skadedatoen/anmeldelsesdatoen» hentet fra samme kilde som rækken ovenover,
  `resolveSkadestypeDatoLabel`).
- **Andre steder det kan gælde:** samme faste ordlyd findes i `EetEfterEalTab.tsx` («Alder på
  skadestidspunkt», «Årsløn på skadestidspunktet»), `ForsoergertabEalSection.tsx` («Skadelidtes
  alder på skadestidspunkt», «Skadelidtes årsløn på skadestidspunktet») og i tre dokumenter
  (`eetEfterEalDocument.ts`, `forsoergertabDocument.ts`, `varigeMenDocument.ts`). Ingen af dem er
  efterprøvet; de hører til flade 10 og 11.

**Tilbagemelding**
Du har fundet en regulær fejl, og jeg er enig i både præmissen og løsningen. Alle steder i programmet må der ikke ukritisk blot bruges udtrykket 'skadedato' eller 'anmeldedato'. De skal altid udledes af den indtastede skadetype, således at den sættes til 'anmeldt...' hvis skadetypen er en erhvervssygdom, og ellers til 'skade...'

**Rettet (2026-08-20), kun for denne flade.** "Alder på skadestidspunkt"/"Alder på
anmeldelsestidspunkt" udledes nu af `resolveStamdataDatoReference(skadestype).kind` på skærmen, og
af samme betingelse i `varigeMenDocument.ts` for PDF'en. De øvrige nævnte forekomster
(`EetEfterEalTab.tsx`, `ForsoergertabEalSection.tsx`, `eetEfterEalDocument.ts`,
`forsoergertabDocument.ts`) er IKKE rettet her – de hører til flade 10/11 og er uden for denne
gennemgangs scope.

### BB-073 – Aldersreduktionen vises som «- 0 %» og «- 0,00 kr.» for alle under 40 år

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (UI-tekst; **ikke** et forslag om at skjule rækken)
- **Sådan fremprovokeres det:** Fødselsdato `01-01-1995`, Skadedato `01-06-2020` (alder 25), Méngrad
  `33`.
- **Det sker (målt på skærm og i PDF):** «Aldersreduktion, 25 år = **- 0 %** → **- 0,00 kr.**», og
  slutbeløbet er identisk med grundbeløbet.
- **Det er uhensigtsmæssigt fordi:** «minus nul kroner» er en regnestørrelse, ikke en oplysning.
  Rækken **skal** blive stående (M-13: nul er en oplysning – at der ikke er nogen aldersreduktion,
  er netop noget sagen afhænger af), men fortegnet foran et nul gør linjen til et regnestykke, der
  ser ufærdigt ud, og det rammer hver eneste skadelidt under 40 år.
- **Bedre ville være:** samme række uden fortegn, når reduktionen er nul: «Aldersreduktion, 25 år =
  0 %» → «0,00 kr.». Rækken er dermed stadig der og siger stadig det samme.
- **Andre steder det kan gælde:** andre reduktions-/fradragslinjer, der sætter et fast `-` foran en
  værdi, der kan være nul. Søg på formen `- ${formatAsAmount(...)}`.

**Tilbagemelding**
Jeg er enig.

**Rettet (2026-08-20).** Både skærmen og PDF-dokumentet viser nu "Aldersreduktion, {alder} år = 0 %"
→ "0,00 kr." uden foranstillet minus, når reduktionen er nul.

### BB-074 – Méngradfeltets pladsholder er «0», og 0 er den ene værdi feltet afviser

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (synlig tekst)
- **Sådan fremprovokeres det:** Se det tomme Méngrad-felt; skriv derefter `0` og tryk Tab.
- **Det sker (målt):** Det tomme felt viser den grå pladsholder `0`. Værdien `0` afsluttes rødt med
  «Værdi skal være mellem 1 og 120».
- **Det er uhensigtsmæssigt fordi:** pladsholderen er programmets forslag til, hvad der hører i
  feltet, og her viser den den eneste ikke-negative værdi, feltet ikke tager imod. Pladsholderen
  `0` er rigtig på de øvrige elleve felter, der bruger den (procent- og beløbsfelter, hvor 0 er en
  lovlig værdi) – méngrad er undtagelsen, fordi dens interval starter ved 1.
- **Bedre ville være:** ingen pladsholder på méngrad, eller en der er indenfor intervallet.
- **Andre steder det kan gælde:** de øvrige `placeholder="0"`-felter er kun et fund, hvis deres
  interval også udelukker 0. Efterprøv `EetOplysningerTab.tsx:159` og
  `BeregnetRenteTable.tsx:173` (rentebeløbet har efter BB-038 grænsen «større end 0» – samme
  konflikt, ikke efterprøvet, hører til flade 8).

**Tilbagemelding**
Jeg forstår dit synspunkt men afviser det. Der anvendes placeholders i meget vid udstrækning, og jeg vil også gerne have det her. Og tallet nul er en fin placeholder. Programmet giver klar tilbagemelding til brugeren, hvis brugeren selv prøver at indtaste nul.

## Overvejet uden fund

- **Beregningen selv.** Kontrolregnet i browseren: sats 2024 = 10.135, méngrad 5 → 50.675,00;
  alder 45 → 6 % (1 % pr. år over 39); 50.675 × 0,94 = 47.634,50 → oprundet 47.635 kr.; reduktionen
  vises som differencen (3.040,00), så de tre linjer går nøjagtigt op. Samme kontrol ved méngrad 120
  og ved 2026-satsen. Aldersfradragets lofter holder (69 år og derover giver 40 %).
- **Méngrad over 100** giver en beregning uden indvending – bevidst domænebeslutning
  (`varigemen-contract.md` §2.5), efterprøvet ved 120.
- **Grænserne 0/121** afsluttes canonical, bliver røde med konkret tekst «Værdi skal være mellem 1
  og 120» og blokerer download. Et fjerde ciffer kan slet ikke tastes (`maxlength=3`).
- **Downloadgatens tre klasser** svarer som dokumenteret: tomt méngrad → «Indtastning mangler»; ét
  rødt felt → feltets egen tekst («Værdi skal være mellem 1 og 120»); to røde felter → «Fejl i
  indtastning». Ingen af dem citerer et forkert felt.
- **Beregningsdatoens nedre grænse** (BF-012) er korrekt og konkret: `09-06-2020` med skadedato
  `10-06-2020` afvises med «Datoen kan ikke være før skadedatoen (10-06-2020)», og grænsen følger
  skadestypen (BB-072's label er det eneste, der ikke gør).
- **Beregningsdatoens øvre grænse annonceres, når den rammes:** `01-01-2027` → «Dato skal være
  mellem 10-06-2020 og 31-12-2026». Satser-fladens lukkede spor 1 (et interval behøver ikke
  annonceres på forhånd) er dermed respekteret, uden at brugeren efterlades i tvivl ved en fejl.
- **Paste i méngrad** følger tegn-for-tegn-reglen (`normalizeIntegerPaste` er et filter, ikke en
  fortolker) – M-14 er ren her. `05` normaliseres til `5` ved settle; tocifret årstal i
  beregningsdatoen (`01-01-24`) bliver `01-01-2024` efter den ene gennemgående regel (M-05).
- **Escape** i beregningsdatoen ruller tilbage til værdien ved editorens åbning, ikke til tom.
- **Undo (Ctrl+Z)** efter et méngrad-skift ruller værdien tilbage, fokuserer feltet og opdaterer
  beregningen i samme skridt.
- **Faneskift med åben draft** afslutter feltet (målt: draft `33` var committet, da fanen Satser var
  besøgt og forladt) – BF-066 virker her.
- **Navigation til Stamdata og tilbage** bevarer begge felters afsluttede værdier, også de røde.
- **Tab-ringen** er komplet og lukket: Méngrad → Beregningsdato → Indsæt dags dato → Download →
  Méngrad. «Indsæt dags dato» beholder fokus efter aktivering (BF-056).
- **«Stamdata»-linkene** i de to mangler-rækker er prikket understreget og skifter farve ved hover –
  programmets egen `icon-text-link`-affordance, altså synlige som klikbare. At de ikke er i
  Tab-ringen er dækket af det lukkede spor fra Global shell (navigation må være mus-drevet).
- **Den grå downloadknap** kan hverken klikkes eller nås med Tab (`disabled`, `tabindex=-1`), og et
  klik er tavst. Det er den aftalte grammatik for enhver grå knap (BF-059, `actionGate.ts`) og er
  derfor ikke registreret som fund – BB-069 handler om den **aktive** knap.
- **M-15 (skærmen tier, hvor dokumentet taler):** efterprøvet på den hentede PDF. Dokumentet
  indeholder ingen forbehold, note eller advarsel, som skærmen ikke har – de to udgaver har de samme
  ni linjer. Kun formen på slutbeløbet afviger (BB-070).
- **M-13 (nul er en oplysning):** nul-rækken (aldersreduktion 0 %) vises **både** på skærmen og i
  dokumentet. Ingen `> 0`-prøve på synlighed nogen af stederne.
- **M-16 (en komplet række, programmet ikke vil regne på):** gaten har en `no-result`-gren
  («Beregning kan ikke dannes») for et gyldigt input uden lovsats. Den er uopnåelig, fordi
  beregningsdatoens interval er udledt af præcis det satsdatasæt, motoren slår op i – der findes
  ingen gyldig beregningsdato uden en sats. Ingen fund; men se BB-068, hvor den samme kobling giver
  et problem fra den anden ende.
- **Console** er tavs gennem hele gennemgangen (0 errors, 0 warnings ud af 183 beskeder), inklusive
  de fem afviste settles og det blokerede download.
- **Ikke registreret som fund, bevidst:** at overskriften «Beregnet méngodtgørelse» og den sidste
  rækkes label er ordret den samme tekst tre linjer fra hinanden (både på skærm og i PDF). Det er
  mikro-æstetik uden konsekvens for forståelsen (§4).
- **Ikke registreret som fund, bevidst:** at resultatrækken er den eneste, der er **tavs** når den
  er tom (de tre andre skriver «mangler»), mens dens årsag kun står i knappens tooltip. Det er en
  bevidst beslutning, taget for ikke at vise samme besked to gange, og den er dokumenteret i koden.
  Bemærk dog sammenhængen: hvis BB-064/BB-065 rettes, er resultatrækken det eneste sted på fanen,
  hvor et fravær ikke forklarer sig.

## Dækningshuller

- **BB-068 er ikke målt med en flyttet ur-tid.** Mekanismen er målt i to dele (feltet afviser
  `01-01-2027`; knappen indsætter dags dato uden at spørge om intervallet), men selve situationen
  kræver en systemdato i 2027. Efterprøv med en faked clock, eller manuelt efter nytår.
- **`DocumentOutcomeMessage`s røde fejlbesked (BB-067's alvorligste kandidat) er ikke set i drift.**
  Specificitets-mekanismen er målt syntetisk på netop `row--text`, så konklusionen følger, men den
  konkrete besked kræver et fejlende download at fremprovokere.
- **Dokumentet er kun kontrolleret som PDF.** Word-udgaven deler generator og bør have samme
  indhold, men er ikke hentet. Brevhoved var slået fra (standard), så brevhovedets indhold er ikke
  set på denne flade.
- **Kun Chrome, kun 1536×864.** Ingen af fundene afhænger af motor eller viewport; BB-067's
  farvemåling er dog aflæst i lyst tema alene.

## Åbne spørgsmål

1. **Skal Beregningsdato være forudfyldt med dags dato ved første besøg?** Fanen har samme felt og
   samme «Indsæt dags dato»-knap som MinProcesrente, hvor spørgsmålet står åbent fra 2026-08-19.
   Svaret bør være det samme på begge flader, og på Varige mén er argumentet for forudfyldning
   stærkere: beregningsdatoen er sagens opgørelsestidspunkt og er i praksis næsten altid «i dag».
   Registreres her som det samme åbne spørgsmål, ikke som et nyt.
2. **Skal fanen advare, når beregningsdatoen ligger langt fra skadedatoen?** En sag med skadedato
   2006 og beregningsdato 2026 regner uden indvending med 2026-satsen, hvilket er korrekt. Men M-05's
   grænse er, at en advarsel kan foreslås, hvor værdien er usandsynlig **i sagens egen sammenhæng**.
   Tyve år mellem de to datoer er lovligt og forekommer; jeg har ikke fagligt grundlag for at afgøre,
   om det også er usandsynligt. Spørgsmålet forelægges uden forslag.

---

# Fane 2 – Satser

- Gennemgået: 2026-08-21 · commit `a5806c1b`
- Tilbagemeldinger gennemført: 2026-08-21. **To fund rettet** (BB-078 og BB-079 – samme rettelse),
  **tre afvist** (BB-075, BB-076, BB-077 – hver med et lukket spor, noteret under fundet).
- Afprøvet i: Chrome, 1536×864 og 1244×620, headless via `playwright-cli`. Alle tal og tekster
  nedenfor er aflæst i den kørende app, ikke udledt af koden, medmindre andet står.
- Console under hele gennemgangen: 15 beskeder, **0 errors, 0 warnings.**

## Fladen kort

Fanen er programmets mindste hidtil: en overskrift, én forklarende linje og én tabel med to
kolonner og 22 rækker – «Beregningsår» 2026 ned til 2005 over for «Sats pr. méngrad» 11.035 kr. ned
til 6.450 kr. Ingen felter, ingen knapper, ingen tilstande, intet dokument. Hele edge case-blikket
(B1–B6a) er derfor uden genstand her; det er noteret under «Overvejet uden fund».

Fanen er den anden halvdel af sidens ene opslag: brugeren vælger en beregningsdato på fane 1 og
kontrollerer satsen her. Årsdækningen 2005–2026 er **ikke** en tilfældighed – beregningsdatoens
ydre grænser udledes af præcis dette datasæt (`dateRanges.ts`, `dateRanges_varigemen.beregningsdato`),
så der findes ingen lovlig beregningsdato uden en række i tabellen, og ingen række i tabellen,
brugeren ikke kan ramme. Det er efterprøvet i drift i begge ender.

Fundene her handler derfor ikke om tabellen, men om de to sætninger omkring den: hvor satsen kommer
fra, og hvad «Beregningsår» betyder.

## Fund

### BB-075 – Fanen henfører satsen til to love; resten af programmet henfører den til én

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger (juridisk grundlag)
- **Sådan fremprovokeres det:**
  1. Åbn Varige mén → fanen Satser og læs linjen over tabellen.
  2. Gå til sidemenuens **Satser** (satsår 2026) og find den samme sats.
- **Det sker (målt):** Varige mén → Satser skriver «Jf. **erstatningsansvarslovens § 4** og
  arbejdsskadesikringslovens § 18.» over en tabel, hvis 2026-række er `11.035 kr.` Satser-siden
  viser præcis samme tal – `11.035 kr./méngrad` – men under sektionsoverskriften
  **«Arbejdsskadesikringsloven»**, som en af ni ASL-satser. Sektionen «Erstatningsansvarsloven»
  lige ovenover har fem satser, og **ingen af dem er en méngodtgørelse**. De to sider læser samme
  ene datasæt: programmet har kun ét sæt méngrad-satser, og strengen «§ 4» findes præcis dette ene
  sted i hele kildekoden.
- **Det er uhensigtsmæssigt fordi:** de to sider giver hvert sit svar på, hvilken lov satsen
  stammer fra, og begge svar kan ikke være rigtige. Der er to udfald, og de er lige alvorlige hver
  sin vej:
  - **Er satsen fælles for begge love**, mangler oplysningen på Satser-siden. En bruger, der slår
    méngodtgørelsen op dér til en EAL-sag, finder den ikke i EAL-sektionen og kan konkludere, at
    Mineo ikke dækker den.
  - **Er satsen kun ASL § 18's**, regner fanen EAL-sager med en ASL-sats uden et ord om det, og
    linjen inviterer direkte til det. Det er et forkert tal, brugeren ikke har nogen anledning til
    at betvivle (§5 punkt 2), og det havner i et dokument, der bruges i sagen.

  Jeg afgør ikke, hvilken af de to der er den rigtige – det er en juridisk vurdering (§6). Men
  fanen kan ikke blive stående med et grundlag, resten af programmet modsiger.
- **Bedre ville være:** ét svar, skrevet begge steder.
  - Er satsen fælles: Satser-sidens EAL-sektion får den samme række (eller sektionen får en linje
    om, at méngodtgørelsen er fælles), så opslaget kan gøres begge veje.
  - Er satsen ASL's alene: linjen på fanen mister «erstatningsansvarslovens § 4 og» og kommer til
    at hedde «Jf. arbejdsskadesikringslovens § 18, stk. 3.» – og så skal det afgøres separat, hvad
    en EAL-sag skal have at vide, da programmet i så fald ingen EAL-méngodtgørelsessats har.
- **Andre steder det kan gælde:** enhver anden lovhenvisning, der står ved siden af et tal. Konkret
  uefterprøvet: Renteberegning → Rentesatser («jf. rentelovens § 5» og «§ 5, stk. 2», flade 8) og
  Satser-sidens egne sektionsoverskrifter, som er den eneste henførsel af 20 satser. Prøven er
  billig: **find samme tal to steder i programmet, og sammenlign den lov, de hver især henføres
  til.**

**Tilbagemelding**
Satsen er fælles for de to love. Det er forskelligt fra ydelse til ydelse, om det beregnes ens efter de to love eller forskelligt. Brugerne er professionelle og ved dette. Jeg afviser dit fund.

**Afvist (2026-08-21).** Præmissen var rigtig – satsen ER fælles – men konsekvensen var det ikke:
det er ikke en mangel, at Satser-siden placerer den under ét af de to love, når målgruppen ved,
hvilke ydelser der beregnes ens efter dem. **Lukket spor:** en sats, der optræder under ét lovsted
på Satser-siden og henføres bredere på sin egen flade, er ikke i sig selv et fund. Skærpelsen af
M-11 står ved magt som prøve (find samme tal to steder og sammenlign henførslen), men et fund
kræver, at de to henførsler er *uforenelige* – ikke blot forskelligt afgrænsede.

### BB-076 – «Beregningsår» siger ikke, hvilken af sagens datoer det er året for

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (synlig tekst)
- **Sådan fremprovokeres det:** Åbn fanen Satser uden først at have været på fane 1, og læs
  kolonneoverskriften «Beregningsår».
- **Det sker (målt):** Tabellens eneste forklarende linje er lovhenvisningen; ordet «Beregningsår»
  står ellers alene. På fane 1 er koblingen derimod tydelig: satsrækken hedder «Sats pr. méngrad i
  beregningsår 2026» og står tre linjer under feltet **Beregningsdato**.
- **Det er uhensigtsmæssigt fordi:** flere satser i arbejdsskadesager følger **skadeårets** sats,
  ikke opgørelsesårets, og en bruger, der ikke husker reglen for netop méngodtgørelsen, kan læse
  tabellen med skadedatoen i hånden og finde et forkert beløb. Fanen kender svaret og siger det kun
  på den anden fane. Til sammenligning forklarer Renteberegnings tilsvarende satsfane hver af sine
  to tabeller i en hel sætning («Nationalbankens udlånsrente pr. 1. januar og 1. juli, jf.
  rentelovens § 5»), så formen findes i programmet.
- **Bedre ville være:** at linjen over tabellen også bærer koblingen, fx «Satsen følger
  beregningsdatoens år, jf. …». Ét led i en sætning, der står der i forvejen.
- **Andre steder det kan gælde:** ingen efterprøvede. Bemærk, at fundet kan være dækket af
  Satser-fladens lukkede spor 3 (en fagligt velkendt regel behøver ingen forklaring); det er
  registreret, fordi tvivlen her ikke handler om lovkundskab, men om **hvilket af Mineos egne
  felter** der styrer opslaget.

**Tilbagemelding**
Der er tale om en velkendt og entydig ydelse. Brugerne er professionelle og ved dette. Jeg afviser dit fund.

**Afvist (2026-08-21).** Fundets eget forbehold holdt: Satser-fladens lukkede spor 3 dækker også
dette. **Lukket spor, udvidet:** en fagligt entydig ydelse behøver hverken forklaring af sin
lovhenvisning ELLER af, hvilken af sagens datoer der styrer satsopslaget.

### BB-077 – Tabellen viser 22 år og markerer ikke det ene, sagen bruger

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (UI)
- **Sådan fremprovokeres det:**
  1. Sæt Beregningsdato til `01-01-2026` på fane 1 (satsrækken viser «… i beregningsår 2026 →
     11.035 kr.»).
  2. Skift til fanen Satser.
- **Det sker (målt):** 22 identiske rækker. Intet på fanen viser, at netop 2026 er sagens år; 2026
  står øverst, fordi listen er sorteret med nyeste først, ikke fordi det er sagens.
- **Det er uhensigtsmæssigt fordi:** brugeren skifter til fanen netop for at kontrollere sin egen
  sats, og programmet kender rækken. Han skal selv huske årstallet fra den anden fane og finde det
  i en liste, hvor alle rækker ligner hinanden – en lille, men helt unødvendig arbejdsopgave, som
  gentages hver gang.
- **Bedre ville være:** at rækken for sagens beregningsår fremhæves (fed eller svag baggrund), når
  der er en gyldig beregningsdato – og at tabellen ser ud præcis som i dag, når der ikke er nogen.
  Ingen ny oplysning, ingen ny kontrol; kun en markering af den række, programmet allerede har
  regnet med.
- **Andre steder det kan gælde:** Renteberegning → Rentesatser (flade 8) har samme fravær med samme
  forudsætning – dér er den relevante række endda afhængig af hele periodetabellen. Et ja her bør
  derfor afgøres for begge flader på én gang. Satser-siden er **ikke** en kandidat: den er afgjort
  som et opslagsværk uden sagssammenhæng.

**Tilbagemelding**
Jeg afviser dit fund. Satser-siden har ingen indbyrdes kobling til den konkrete sag. Det er en ren påmindelse til brugere, som ønsker et historisk tilbageblik over, hvad satserne har været på et tidligere tidspunkt.

**Afvist (2026-08-21).** Afgørelsen udvider Satser-fladens lukkede spor 5 fra sider til **faner**:
også en satsfane INDE på en beregningsside er et rent opslagsværk uden kobling til sagen.
**Lukket spor:** foreslå ikke, at en satstabel markerer, fremhæver eller filtrerer efter sagens
egne værdier – heller ikke på Renteberegnings Rentesatser-fane (flade 8b), hvor fundet ellers var
udpeget som næste kandidat.

### BB-078 – Tre steder viser samme sats med hver sin talformatering

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Agent afgør (rent teknisk; ingen synlig ændring i dag)
- **Sådan fremprovokeres det:** Kan **ikke** fremprovokeres med de nuværende data – alle 22 satser
  er hele kroner, så de tre steder viser i dag det samme. Fundet er den latente uenighed bag.
- **Det sker:** Fanen Satser formaterer satsen med `formatAsAmountTrimmed(sats, 2)`, fane 1 og
  PDF-dokumentet med `formatAsAmount(sats, 0)`, Satser-siden med `formatKr(sats, 0)`. En sats med
  ører – fx `11.035,50` – ville derfor blive vist som `11.035,5 kr.` her, `11.036 kr.` på fane 1 og
  i dokumentet og `11.036 kr./méngrad` på Satser-siden: tre former af samme tal, hvoraf de to er
  afrundet væk fra den sats, beregningen faktisk bruger.
- **Det er uhensigtsmæssigt fordi:** det er præcis den uenighed, BB-070 fik rettet mellem skærm og
  dokument, blot endnu ikke udløst af datasættet. M-13's egen lære er, at en uenighed mellem to
  udgaver skal lukkes, når den findes – ikke først når dataene udløser den.
- **Bedre ville være:** at de tre steder deler ét formateringskald for méngrad-satsen. Formen med
  nul decimaler er den, brugeren ser i dag, og den, dokumentet bruger.
- **Andre steder det kan gælde:** enhver sats, der vises både på sin egen flade og på Satser-siden.
  Prøven er at finde de kald, der viser **samme** værdi, og sammenligne præcisionsargumentet.

**Tilbagemelding**
Jeg er enig i dit fund. Varige mén skal konsekvent beregnes i hele, afrundede krone-beløb uden decimaler. Det er imidlertid unikt for denne specifikke ydelse og må ikke bare ukritisk udbredes til andre ydelser.

**Accepteret – gennemført (2026-08-21).** Alle beløbsvisninger i varige mén går nu gennem den
kanoniske `formatKr` med nul decimaler – satstabellen, satsrækken, grundbeløbet, aldersreduktionen
og slutbeløbet, i både skærm og dokument. De inline `" kr."`-strenge er væk med, så enheden har ét
sted. Reglen er skrevet ind som **`varigemen-contract.md` §2.9** med den afgrænsning, du satte:
den er unik for varige mén, og `amount-contract.md` §5's to-decimal-standard gælder fortsat alle
andre domæner.

**Beregningen er bevidst IKKE ændret.** Kun slutgodtgørelsen afrundes (op), som hidtil. Det var
fristende at afrunde mellemregningerne med, men det ville ændre resultater, hvis en fremtidig sats
får ører – og det er en beregningsbeslutning, ikke en visningsbeslutning. Afstemningen holder
alligevel: `aldersreduktionBeloeb` er defineret som differencen mod den oprundede godtgørelse, så
grundbeløb og reduktion har samme decimaldel og forskydes ens af visningens afrunding. De tre viste
linjer går derfor op, også med en øre-sats. Det er dækket af en test.

### BB-079 – Samme sats står med og uden ører tre linjer fra hinanden på fane 1

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger (synlig tekst)
- **Sådan fremprovokeres det:** Fødselsdato `01-01-1980`, Skadedato `01-01-2020`, Méngrad `10`,
  Beregningsdato `01-01-2026`. Læs fane 1 ovenfra.
- **Det sker (målt):** «Sats pr. méngrad i beregningsår 2026 → **11.035 kr.**» og tre linjer længere
  nede «Grundbeløb: 10 % mén á **11.035,00 kr.** → 110.350,00 kr.» Samme sats, samme skærm, to
  former. Det samme gælder ordret i PDF-dokumentet, som er enigt med skærmen linje for linje.
- **Det er uhensigtsmæssigt fordi:** to skrivemåder af det samme tal på samme skærm får en læser,
  der kontrolregner, til at standse og lede efter forskellen. Fundet hører til **fane 1** og blev
  overset ved dennes gennemgang: BB-070 sammenlignede skærm mod dokument, og de to var her enige om
  begge former.
- **Bedre ville være:** samme form begge steder. Nul decimaler er den, satsrækken og fanen Satser
  bruger, og satserne er hele kroner.
- **Andre steder det kan gælde:** de øvrige beregningsflader, der viser en sats både som eget
  grundlag og inde i en «á»-formulering. Prøven er bredere end BB-070's: sammenlign **alle**
  visninger af samme tal, også inden for én skærm – ikke kun skærm mod dokument.

**Tilbagemelding**
Jeg er enig i dit fund. Varige mén skal konsekvent beregnes i hele, afrundede krone-beløb uden decimaler. Det er imidlertid unikt for denne specifikke ydelse og må ikke bare ukritisk udbredes til andre ydelser.

**Accepteret – gennemført (2026-08-21) sammen med BB-078.** Satsrækkens «11.035 kr.» og
grundbeløbets «á 11.035,00 kr.» er nu samme form begge steder, både på skærmen og i dokumentet.
Se BB-078 for den fulde rettelse og for afgrænsningen mod andre ydelser.

## Overvejet uden fund

- **Tallene selv.** Alle 22 rækker aflæst i drift og sammenholdt med datasættet: 2026 ned til 2005
  uden huller, sorteret med nyeste år først (samme konvention som Renteberegnings to satstabeller),
  strengt faldende beløb 11.035 → 6.450 kr., dansk tusindseparator, «kr.» skrevet ud på hver række.
- **Fanens sats = beregningens sats.** Efterprøvet i begge ender af intervallet: beregningsdato
  `01-01-2005` gav «Sats pr. méngrad i beregningsår 2005 → 6.450 kr.», som er tabellens nederste
  række; `01-01-2026` gav 11.035 kr., som er den øverste. Fane 1's opslag og fane 2's tabel læser
  samme ene datasæt, og der findes hverken en række uden en lovlig beregningsdato eller en lovlig
  beregningsdato uden en række.
- **Hele edge case-blikket B1–B6a er uden genstand.** Fanen har ingen felter, ingen knapper, ingen
  rækkehandlinger, ingen sortering, intet der kan indtastes, indsættes, tømmes eller fortrydes, og
  ingen tilstand ud over hvilken fane der er valgt. Der er derfor ingen grænser at prøve (B0),
  intet «tomt»-begreb (B6a) og ingen rækkefølgeafhængighed (B4).
- **Faneskift og rulning.** Rulning til bunden af Satser-fanen og skift tilbage til Ménberegning
  sætter rullepositionen på plads igen (målt: 298 → 0), så brugeren lander ikke midt på den kortere
  fane. Den valgte fane huskes i `sessionStorage` – altså pr. browserfane, hvilket er den rigtige
  rækkevidde for et rent visningsvalg (M-17 er ikke i spil).
- **M-10 (flydende knap dækker indhold):** efterprøvet ved 1536×864 med siden rullet i bund.
  Tabellen er 485 px bred og ligger i indholdssøjlens venstre side (x 346–831), mens rul-til-toppen-
  knappen står omkring x 1448–1504. Sidste række (2005) er fri. Ingen overlapning.
- **M-09 (fast indholdsbredde):** målt ved kontraktens nedre grænse 1244×620. Tabellen skaleres til
  395 px, står helt inden for viewporten, og dokumentets scrollWidth er lig clientWidth – ingen
  vandret rulning, ingen afskæring, ingen ombrydning af de to kolonneoverskrifter.
- **M-21 (en CSS-klasse slår komponentens farve ihjel):** ingen af fanens elementer beder om en
  farve – hverken `color`-prop eller `sx={{ color }}`. Mønsteret kan ikke ramme her.
- **M-15 (skærmen tier, hvor dokumentet taler):** fanen har intet dokument, og Satser-dokumentet
  skriver ingen forbehold til méngrad-satsen, som fanen mangler.
- **Lovhenvisningen er ikke et link.** Renteberegnings satsfane citerer renteloven som ren tekst på
  samme måde, og Satser-sidens retsinfo-links står i deres egen «Referencer»-sektion. Formen er
  ensartet; ikke et fund.
- **«Godtgørelse for varige mén» (Satser-siden) mod «Sats pr. méngrad» (her) er bevidst IKKE
  registreret som et navnefund.** Satser-siden skal kunne skelne ni ASL-satser fra hinanden og må
  derfor navngive **hvad** satsen er; fanen står allerede i sammenhængen og navngiver **enheden**.
  Det følger Satser-fladens lukkede spor 2 (formen må følge et fagligt behov). BB-071's rettelse
  gjorde de to faner indbyrdes ensartede, og det er den kobling, brugeren faktisk går mellem.
- **Tre steder hedder «Satser» på skærmen samtidig** (sidemenuen, fanen, sektionsoverskriften).
  Afgjort som ikke-fund af BB-033; ikke rejst igen.
- **Ingen download på fanen.** Renteberegnings satsfane har heller ingen, og fanens indhold er en
  ren gengivelse af et lovbestemt datasæt. Ensartet; en downloadknap ville desuden være ny
  funktionalitet (§4).
- **Kolonneoverskriften «Sats pr. méngrad» er centreret, mens beløbene er højrestillede**, så
  overskriften rager ca. 19 px længere ud til højre end tallene. Mikro-æstetik uden konsekvens for
  forståelsen; ikke registreret (§4).
- **Console** er tavs gennem hele gennemgangen (0 errors, 0 warnings ud af 15 beskeder).

## Dækningshuller

- **Kun Chrome, lyst tema.** To viewporter er målt (1536×864 og 1244×620). Ingen af fundene
  afhænger af motor eller tema.
- **Det juridiske spørgsmål i BB-075 er ikke afgjort, kun målt.** Jeg har fastslået, at programmet
  siger to forskellige ting om samme tal, ikke hvilken af dem der er rigtig; det kræver en vurdering
  af EAL § 4 over for ASL § 18, som ligger uden for skillens mandat (§6).
- **BB-078 er pr. konstruktion ikke målt i drift** – den kræver en sats med ører, og datasættet har
  kun hele kroner. Mekanismen er læst i de tre formateringskald.

## Åbne spørgsmål

Ingen ud over de to, fane 1 allerede har rejst (forudfyldt beregningsdato; advarsel ved tyve år
mellem skadedato og beregningsdato). Fanen tilføjer ingen nye – BB-075 er ikke et åbent spørgsmål,
men et fund med to mulige udfald, som begge kræver en rettelse.
