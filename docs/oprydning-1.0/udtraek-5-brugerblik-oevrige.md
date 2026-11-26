# Udtræk 5 – Brugerblik: globalshell, indstillinger, minprocesrente, om, satser, stamdata, varigemen, renteberegning

Kun punkter, der mangler eller er ufuldstændigt beskrevet i `src/contracts/`, `docs/architecture/`, `docs/domain/` eller `AGENTS.md`.

## A. Udviklerens afgørelser (UI/UX og beregning)

### Global shell
1. Sidemenuen (inkl. `Gem`/`Hent`/`Slet alt`) ligger bevidst uden for Containerens Tab-ring. Tab-ringen findes for hurtig indtastning på én side; navigation mellem sider og filhandlinger sker med mus. Foreslå ikke sidemenuen ind i ringen.
   Kilde: globalshell.md, BB-051. Hjem: `keyboard-navigation.md` §Container (ved afsnittet om `PageTabs`/`SideTab`, l. 46–56); i dag nævnes kun fanekontrollerne og (i §Ctrl+S) at `Hent`/`Slet alt` ingen genveje har.
2. Programmet viser ikke, om sagen er gemt, og heller ikke filnavnet (ingen «(ikke gemt)», ingen markering af `Gem`, intet filnavn i fanetitel eller menu). Brugeren gemmer selv. Browserens advarsel ved lukning eller navigation væk er den primære beskyttelse mod tab.
   Kilde: globalshell.md, BB-052. Hjem: `app-shell-contract.md` (nyt afsnit «Ugemt arbejde») eller `persistence-contract.md` §3.8a.
3. Exit-advarslen (`beforeunload`) vises, når der er afsluttede, ugemte ændringer, også ved F5, hvor sagen faktisk overlever. Platformen kan ikke skelne lukning fra genindlæsning, og lukningen vejer tungest. Der tilføjes ingen beroligende tekst om F5 (fx på Om-siden). Princip: en handling, der ikke sletter noget, giver ingen advarsel. En handling, der kan slette, advarer og kræver bekræftelse.
   Kilde: globalshell.md, BB-059. Hjem: samme sted som A2.
4. `Slet alt` viser altid den fulde advarsel og kvitterer altid med «Alle indtastninger slettet», også på en urørt sag. Der vises ingen særskilt «intet at slette»-besked. Handlingen garanterer, at alt er slettet. (`Gem` på en urørt sag svarer derimod «Ingen data fundet at gemme», fordi svaret ændrer handlingen.)
   Kilde: globalshell.md, BB-058. Hjem: `critical-action-contract.md` §8.
5. Der findes ingen «Log ud». Brugerne logger kun ind på egen eller en kollegas maskine, og «delt enhed» i §1 betyder en kollegas maskine, ikke en offentlig terminal. Formålssætningen er intet løfte om at kunne fjerne adgangen igen.
   Kilde: globalshell.md, BB-061. Hjem: `auth-gate-contract.md` §1 punkt 1.
6. 404-siden har ingen automatisk viderestilling (en forkert adresse skal ikke tavst «virke») og ingen egen knap (sidemenuen er vejen videre). Den er bevidst ikke med i `ALL_APP_PAGE_ROUTES`. I dag står kun gate-garantierne og (i testlisten) adressen i tilgængelighedsnavnet.
   Kilde: globalshell.md, BB-057. Hjem: `app-shell-contract.md` §2.2.

### Indstillinger
7. Standardværdier gælder kun nye sager (bootstrap og `Slet alt`). Der skal aldrig være en mulighed for at «anvende på denne sag», hverken automatisk eller som en handling, brugeren beder om. De beregningstekniske valg virker straks på den åbne sag. Ingen af de fire bokse må have forklarende tekst om, hvornår et valg virker. Formuleringen i app-settings.md l. 47 («eller ny brugerhandling») er tvetydig.
   Kilde: indstillinger.md, BB-023 + opfølgende spørgsmål 1–2. Hjem: `app-settings.md` §Kontrakter (kategori 2).
8. Alle ni brevhoveder kan fravælges uden advarsel og uden forklarende tekst. Brevhovedet er et tilbud med registreringsdata, ikke en integritetsegenskab ved dokumentet. Et dokument uden brevhoved «mangler» ikke identifikation.
   Kilde: indstillinger.md, BB-026. Hjem: `app-settings.md` (brevhoved) eller `document-output-contract.md`.
9. «Beregningsteknisk» viser tolerancen først («Overenskomsten regnes for dækkende indtil [N] måneder efter udløb») og derefter toggle'n «Tillad regulering …». Rækkefølgen bærer betydning og må ikke byttes. «0 måneder» betyder «forældes straks» og vises som tallet 0, ikke som «Ingen tolerance». Står i dag kun som kommentar i `Indstillinger.tsx`.
   Kilde: indstillinger.md, BB-028 + BB-029. Hjem: `app-settings.md` §Kontrakter, undtagelsen om de to beregningstekniske valg (l. 64).

### MinProcesrente / Renteberegning
10. Fremtidige rentesatser: forbeholdet «Der er kun fastsat procesrente frem til … Beregning derefter er hypotetisk!» står kun i dokumenterne. Det vises ikke på skærmen ved resultatet (BB-040) og ikke som dækningslinje på satsfanen (BB-094). Dækningen kan læses af tabellens halvårsrækker. Sporet er lukket for hele programmet. Det genåbnes kun, hvis referencesatstabellen afkortes eller kollapses i visningen.
    Kilde: minprocesrente.md BB-040, renteberegning.md BB-094. Hjem: `renteberegning-contract.md` §2.8/§2.12.
11. Sortering af en tabel er permanent: der er ingen tredje tilstand, der genskaber indtastningsrækkefølgen, Ctrl+Z fortryder ikke sorteringen, og den sorterede rækkefølge gemmes som sagens rækkefølge (også i `.eo` og efter F5). En række kan flytte sig, mens den udfyldes. Gælder alle sorterbare tabeller (rentekrav, Årsløn, Lønindkomst, Offentlige ydelser, Svie og smerte).
    Kilde: minprocesrente.md BB-041. Hjem: `page-component-contract.md` (tabeller) eller `form-contract.md`.
12. «Samlet rentebeløb» vises på skærmen, når mindst to krav er beregningsklare. Teksten har almindelig skrift, ikke fed. En delvis eller fejlende række skjuler summen.
    Kilde: renteberegning.md BB-082. Hjem: `renteberegning-contract.md` §2.
13. En bekræftelsesdialogs overskrift gentager navnet på den knap, der åbnede den. Den globale «Slet alt» åbner dialogen «Slet alt», og den lokale «Slet alle indtastninger» har sin egen titel. Samme ordlyd må ikke betyde to handlinger.
    Kilde: renteberegning.md BB-086. Hjem: `critical-action-contract.md` §8.
14. Rentedokumenterne (specifikation og oversigt) skriver datoer som `dd-mm-åååå` ligesom skærmen. Oversigtens datokolonne hedder «Rentedato».
    Kilde: renteberegning.md BB-087, BB-081. Hjem: `renteberegning-contract.md` §2.9.
15. Sider med et beregning/sats-fanepar navngiver fanerne «Beregning» og «Satser», fordi sidetitlen bærer emnet (Varige mén, Renteberegning).
    Kilde: renteberegning.md BB-090. Hjem: `page-component-contract.md` (faner).
16. Negative referencesatser vises bevidst som `- 0,45 %` (med mellemrum) i `InterestRatesTable`. Det er en visuel undtagelse, der ikke må udbredes til `formatPercent` og ikke må «ryddes op». Står i dag kun som kodekommentar.
    Kilde: renteberegning.md BB-095. Hjem: `renteberegning-contract.md` §2.12.
17. Flersidede PDF-tabeller gentager ikke kolonneoverskrifterne på fortsættelsessider (udviklerens præference). Gælder den fælles PDF-renderer.
    Kilde: renteberegning.md BB-399. Hjem: `document-output-contract.md` (tabelrendering).
18. Stamdata er kun en dokumentafhængighed, når fladens brevhoved er slået til. Blokerer en afvist Stamdata-værdi, siger knappen «Ret fejlen i Stamdata». Undtagelse: EO's outputs læser stamdata ubetinget, fordi skadestype, skadedato og fødselsdato dér er beregningsinput – må ikke «ensrettes» med de øvrige. I dag står kun, at flaget afgør gate-relevansen (document-output l. 122).
    Kilde: renteberegning.md BB-080. Hjem: `document-output-contract.md` §Gate-deling.
19. En knap «Indsæt dags dato», hvis felt har en datasæt-afledt øvre grænse (satsdækning), er inaktiv med tooltippen «Der kan kun foretages beregninger frem til …», når dags dato ligger uden for intervallet (Varige mén, EET, Forsørgertab, Renteberegning). §4.6 beskriver kun EO's knap, der bevidst ikke disables.
    Kilde: varigemen.md BB-068. Hjem: `input-field-behavior-contract.md` §4.6 (generaliseres) eller §2.1.

### Om
20. Om er standard-startside af juridiske grunde: licensvilkårene står der, og visningen er garantien for, at brugeren har set dem. Om er ikke en «kom i gang»-side og skal ikke udpege et startsted. Startside-kontakten står kun på Om (ikke også på Indstillinger), fordi den er modstykket til den påtvungne visning.
    Kilde: om.md BB-020, BB-022. Hjem: `app-settings.md` l. 69 (startside) eller `page-component-contract.md`.
21. Navngivning: «Mineo» bruges i løbende tekst og overskrifter, «minEO.dk» hvor programmet står blandt søskendesiderne (bundlinje, login, hard-stop). Det er ét navn i to sammenhænge, ikke en inkonsistens.
    Kilde: om.md BB-021. Hjem: `AGENTS.md` §Sprogpolitik eller `app-shell-contract.md`.
22. Persondata-teksten lover kun, at der ikke indsamles persondata eller brugsstatistik, og at ingen oplysninger om bruger eller sag forlader computeren. Serverkontakt nævnes positivt (indlæsning, installation, opdateringer). Teksten må ikke påstå, at intet gemmes (indstillinger gemmes lokalt). Den skal nævne, at indtastninger forsvinder med fanen, og at kun Gem bevarer dem.
    Kilde: om.md BB-011, BB-012. Hjem: `page-component-contract.md` eller nyt afsnit i `app-shell-contract.md`.
23. Om-siden viser ikke på forhånd, om hjælpeprogrammet er installeret. Svaret kommer først som dialog ved klik, og overskriften «Installationsdialogen kunne ikke åbnes» bevares. Handlingen hedder «installere» overalt, og knappen hedder «Installér hjælpeprogram». Accent bruges kun i bydeform af -ere-verber, ikke i infinitiv. Ikonerne i sætningen om Chrome/Edge er en genkendelsesnøgle og har bevidst intet tekstalternativ.
    Kilde: om.md BB-017, BB-018, BB-019. Hjem: `AGENTS.md` §Sprogpolitik (accentreglen) og `page-component-contract.md` (Om).

### Satser (sidemenu) og satsfaner
24. Satser-siden og satsfanerne er rene opslagsværker uden kobling til sagen. Satsåret påvirker ingen beregning, og det siges ikke på siden. Der vises ingen advarsel om satsår langt fra skadedatoen. En satstabel markerer, fremhæver eller filtrerer aldrig efter sagens værdier (også Varige méns og Renteberegnings satsfaner).
    Kilde: satser.md åbne spørgsmål 1–2, varigemen.md BB-077. Hjem: `satser-contract.md` (nyt UI-afsnit).
25. Fravalgte forbedringer på satsflader:
    - Satsårets dækkede interval annonceres ikke på forhånd. Det oplyses først, når grænsen rammes.
    - «Satser» må gerne være navn på flere forskellige visningsformer.
    - Velkendte lovhenvisninger og etiketter (fx «(fra 2024)», «skader før/fra 1.7.2024») får ingen forklarende tooltip.
    - En tooltips uddybende indhold (fri proces' indkomstgrundlag) skal ikke med i dokumentet.
    - Méngodtgørelsessatsen er fælles for EAL og ASL og må stå under ASL på Satser-siden.
    - «Beregningsår» forklares ikke.

    Kilde: satser.md BB-032–BB-035, varigemen.md BB-075/BB-076. Hjem: `satser-contract.md` (samme afsnit).
26. Et år med delvis satsdækning vises med de satser, der findes. Skærm og specifikation siger konkret, hvilke kategorier der mangler (`describeMissingSatserCoverage`). Der bruges intet fallback til et tidligere års tal. En helt tom sektion udelades også på skærmen. En sats på 0 er en oplysning og vises i både skærm og dokument; en række skjules kun, når satsen mangler (`hasRateValue`), og fri proces filtreres pr. linje.
    Kilde: satser.md BB-392, BB-030. Hjem: `satser-contract.md`.

### Stamdata
27. Der er ingen nedre aldersgrænse og ingen advarsel ved lav alder: nyfødte og små børn kan være skadelidte. De aldersafhængige beregninger skal regne korrekt for dem.
    Kilde: stamdata.md BB-005. Hjem: `input-field-behavior-contract.md` §6.1.
28. «Advokat/Sagsbehandler» beholder én fælles etiket og samme pladsholder «(init.)» i begge felter.
    Kilde: stamdata.md BB-008. Hjem: `input-field-behavior-contract.md` §6.1.

### Varige mén
29. Rækker, der viser «mangler» eller fejl, tones ikke ned. De bruger almindelig tekstfarve, så netop fejllinjerne ikke overses. Fejllinjer er røde via `row--text-error`. Foreslå ikke nedtoning igen.
    Kilde: varigemen.md BB-067. Hjem: `page-component-contract.md` (rækketekst) eller `error-contract.md` §3.1.
30. En nulreduktion vises uden fortegn: «Aldersreduktion, 25 år = 0 %» → «0,00 kr.» (i dag «0 kr.» efter §2.9). Rækken bevares.
    Kilde: varigemen.md BB-073. Hjem: `varigemen-contract.md` §2.9.
31. Méngradfeltets pladsholder er «0», selvom 0 afvises. Pladsholdere bruges bevidst bredt.
    Kilde: varigemen.md BB-074. Hjem: `varigemen-contract.md` §2.
32. Terminologi: «Sats pr. méngrad i beregningsår {år}» og kolonnen «Beregningsår» (ikke «per», ikke «Opgørelsesår») på skærm og i dokument.
    Kilde: varigemen.md BB-071. Hjem: `varigemen-contract.md` §2.

## B. Varige adfærds- og udviklingsregler

1. Et dokument læser skadestypens datoord fra sagens egen skadestype (`readStamdataDatoReference`), aldrig fra brevhovedets stamdata, der er tomme ved fravalgt brevhoved. `DocumentBrevhovedStamdata` udelader derfor skadestype, skade-/anmeldelsesdato og fødselsdato. Står i dag kun i TVAERGAAENDE.md.
   Kilde: varigemen.md BB-398. Hjem: `document-output-contract.md` §Gate-deling/brevhoved samt `error-contract.md` §3.1 punkt 5.
2. Gem af en sag med tomme Stamdata giver ingen advarsel om manglende sektioner og ingen teknisk alarm. Reelle skrive- og integritetsfejl giver fortsat fejl.
   Kilde: satser.md BB-393. Hjem: `persistence-contract.md` (save-verifikation).
3. «Datoen er efter dags dato» bruges kun, når grænsen faktisk er kalenderen (`bounds.kind === 'static'`). En udledt grænse, der tilfældigvis er i dag, navngiver sin kilde («Datoen er efter beregningsdatoen (…)»).
   Kilde: minprocesrente.md BB-043. Hjem: `input-field-behavior-contract.md` §1.3 eller §2.1.
4. Feedback efter et blokeret klik på en aktiv downloadknap afgøres af udfaldet efter settle (frisk `readPort.getEvaluation()`), ikke af render-tilstanden før klikket. Fokus lægges på det blokerende felt og må ikke ende på `BODY`. Varige méns aktive knap bruger lokalt `onMouseDown` + `preventDefault()`, så klikket ikke tabes, når knappen disables under blur. Det er bevidst ikke gjort globalt for `DownloadIconButton`.
   Kilde: varigemen.md BB-069. Hjem: `page-component-contract.md` §11 (blokeret download).
5. Tekstbaserede knapper uden for MUI-IconButton får fokusmarkering via `.text-action-button`: en udfyldt, afrundet flade i `--color-active-bg-hover`, ingen ring, kun `:focus-visible`. Hover og fokus skal se forskellige ud. To varianter er afprøvet og forkastet: primærfarvet ring og neutral grå.
   Kilde: indstillinger.md BB-036. Hjem: `page-component-contract.md` (styling) eller `keyboard-navigation.md`.
6. Slås «Vis kontrolfaner» fra, mens brugeren står på en kontrolfane, føres brugeren til «EO oplysninger». Der efterlades ingen aktiv skjult fane. Ikke efterprøvet mod kontrakt eller test i dette udtræk.
   Kilde: indstillinger.md (overvejet uden fund). Hjem: `app-settings.md` eller `eo-snapshot-contract.md` §kontrolfaner.

## C. Åbne punkter og kendte huller

1. **Kontrakt mod kode (varige mén):** `varigemen-contract.md` §2.5–2.6 siger, at méngrad 1..120 er gyldigt, og §2.8 siger, at 1–4 giver en ikke-blokerende advarsel. Koden har `MENGRAD_MIN = 5` (`varigeMenDescriptors.ts:42`), så 1–4 er røde bounds-fejl, og `VARIGE_MEN_FEM_PROCENT_WARNING` bruges kun i policy-filen og dens test (død advarsel). Udviklerens BB-063-svar («fejlmeddelelse ved [under] 5 %», tooltip «mellem 5 og 120») taler for koden. Kontrakten skal rettes, og den døde konstant skal afklares (forelægges, hvis det er tvivlsomt).
2. **BB-060's afvisning er overhalet:** `critical-action-contract.md` §8 kræver nu «Handlingen kan ikke fortrydes.» i `Slet alt`/`Erstat`, og koden viser det (`MainLayout.tsx:353/388`). Afvisningen må ikke udtrækkes som gældende afgørelse.
3. Uverificerede kandidater: de øvrige tekstknapper uden fokusflade (`InlineActionButton`, `LazyChunkRecoveryNotice`, `Overlay`-knappen, `SpecifikationDownloadBox`), som BB-036 udelod.
4. Uafprøvet spor: generatorernes brug af `stamdata.journalnr` i filnavnet ved fravalgt brevhoved (Varige mén, Forsørgertab, Satser).
5. Dækningshuller, der ikke er lukket:
   - Den afledte røde markering efter skift af skadestype (Erhvervssygdom → Arbejdsulykke med svie/smerte-dato i 5-årsvinduet) er ikke browserprøvet.
   - Aldersafhængige beregninger for meget unge skadelidte (kapitalisering, pensionsalder, forsørgertab) er ikke kontrolleret.
   - PWA-filåbning (dobbeltklik på `.eo`) og native filvælgere er ikke set i drift.
6. Kodekommentar: `src/domain/policies/satserCalculations.ts`'s JSDoc henviser til det slettede `usePersistedForm` (fase 3-oprydning).

---
Undersøgte kandidater: 104. Allerede dækket: 63 (bl.a. Stamdata BB-001–004, 006, 007, 009, 010; persistence §5; keyboard-navigation for overlay-genveje, Ctrl+S, beskeder og Ctrl+Z i editor; app-settings for tema, .eo-forbud, undo, faner og mappe; renteberegning-contract §2.7–2.12; input-field §1.0a/§1.2/§1.2a/§2.9; error-contract §3.1; varigemen §2.9–2.11; app-shell for device-lås og 404-gates; linkregel).
