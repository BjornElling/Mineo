# Udtræk 1 – Brugerblik STATUS.md og TVAERGAAENDE.md

Kilder: `docs/testing/brugerblik/STATUS.md` (S) og `docs/testing/brugerblik/TVAERGAAENDE.md` (T).
Dækning er kontrolleret med grep i `src/contracts/`, `docs/architecture/`, `docs/domain/` og `AGENTS.md`.
Kun manglende eller ufuldstændigt beskrevne punkter er med. Et forbehold: flere afgørelser findes muligvis
uddybet i fladerapporterne (`erstatningsopgoerelse-12x.md` m.fl.). Teksten her bygger kun på S og T.

## A. Udviklerens afgørelser (UI/UX og beregning)

### Erstatningsopgørelse

1. «Nummer» er fritekst. Programmet afgør, om sagen er første opgørelse, ud fra feltets første alfanumeriske tegn:
   tom, `1`, `1A`, `A2` og `Nr. 2` giver første, mens `2`, `12` og `2A` ikke gør. Udledningen bevares bevidst,
   også selv om `2` og `Nr. 2` giver forskellige beløb. Kilde: S «Flade 12a's tre spørgsmål» (BB-202 afvist) og
   T M-01. Hjem: `input-field-behavior-contract.md` §4.1. Kontrakten nævner i dag ikke koblingen til beregningen.
2. En opgørelse, hvor alle tre krav står på «Nej», kan hentes. Den giver en ikke-blokerende advarsel, fordi en
   bevidst nulopgørelse er et legitimt produkt. Kilde: S, 12a-spørgsmål (3) (BB-215). Hjem:
   `eo-snapshot-contract.md` §3.3 eller en ny sektion om opgørelsens ramme.
3. Svie/smerte-sektionen viser bevidst ikke det beregnede beløb på skærmen. Fladen viser hvilke ydelser og hvilken
   periode, mens beregning og resultat hører til i dokumentet. Kilde: S 12b «Afvisningerne» (BB-226). Hjem:
   `eo-snapshot-contract.md`, ny § «Fladernes omfang».
4. «Indsæt årstal» forklarer ikke +1-måneds-reglen på skærmen. Brugeren kender reglen. Kilde: S 12b (BB-223
   afvist). Hjem: `input-field-behavior-contract.md` §4.6a, som en linje om at forklaringen bevidst er fravalgt.
5. For «Svie/smerte-krav i tidligere erstatningsopgørelser» behandles `0` og tomt ens, og papiret tier ved `0`.
   Tidligere perioder er opgjort, mens den aktuelle periode fradrages med det udbetalte beløb. Kilde: S 12b-afsnit
   (BB-220, BB-224). Hjem: `eo-snapshot-contract.md` §14 ved `svieSmerteTidligereTotal`, linje 825.
6. Én fælles klage over EET under «Øvrigt» er korrekt, fordi klagen åbner alt EET-relateret. Papiret trykker én
   EET-linje, og opdelingen skal ikke genrejses. Kilde: S «12d's fire beslutningspunkter» og T M-05/«Afgjort og
   gennemført samme dag» (BB-239). Hjem: `input-field-behavior-contract.md` §4.15, «Verserende klagesag».
7. Ordet «differencekrav» bruges også om en EAL-opgørelse uden endelig ASL-afgørelse. Det giver ingen advarsel
   om modstridende status. Kilde: T M-05 (BB-246 afvist). Hjem: `eo-snapshot-contract.md` (afsnit om status).
8. Huller i lønoplysningerne giver kun en gul advarsel, når hullet er helt uden indtægt. Dagpenge registreres
   som offentlig ydelse og fylder hullet. Kilde: S 12f «Afgjort» (BB-260). Hjem:
   `docs/domain/taf/tabt-arbejdsfortjeneste.md` under «Tillægssatser …», ved punktet om usandsynligt høje beløb.
9. Programmet ændrer ikke store og små bogstaver i brugerens tekst, fordi det ikke kan kende et egennavn. Kilde:
   S 12f (BB-272). Hjem: `input-field-behavior-contract.md` §2.5.
10. «Sidste dag i ansættelsesforholdet» er samme dato som sidste arbejdsdag. Feltet hedder sådan overalt og kan
    ikke ligge før skadedatoen. Kilde: S 12g (BB-283) og «12g's to faglige spørgsmål». Hjem:
    `docs/domain/taf/tabt-arbejdsfortjeneste.md` eller `eo-snapshot-contract.md`.
11. Et unavngivet ansættelsesforhold får reservenavnet «Ansættelsesforhold N» overalt. Beskeder om et kort
    navngiver kortet i linkets navn («Lønindkomst -> Ansættelsesforhold 2»), ikke foran beskeden. Ens
    arbejdsstedsnavne, og et navn der rammer et andet korts standardnavn, får kortets nummer i dokumenter, graf,
    beskeder, EO-kontrol, Kontroltabel og CSV. Kilde: S 12g «Bærende ændringer» (BB-278) og «Fejlrettet
    2026-11-24 (12m)» (BB-466), samt T M-59 «Afgjort». Hjem: `error-contract.md` og
    `document-output-contract.md` (navneregel).
12. Bilagenes rækker trykkes kronologisk i EO's og Årsløns dokumenter. Skærmens «Måned»-sortering uden år er
    bevidst uændret. Kilde: S 12h (BB-294 delvist) og T M-69. Hjem: `document-output-contract.md`.
13. En fremtidig lønperiode giver en gul ring i Årsløn og EO. Kilde: S 12h (BB-298). Hjem:
    `docs/domain/taf/tabt-arbejdsfortjeneste.md` (indtægtstabeller) og `aarsloen-contract.md`.
14. Afledte kolonner i løntabellen får ingen tooltips. Det gælder «FP/FV/SH/SO/St.B.» og «Arb.g. Pension».
    Kilde: S 12h (BB-299 «Tooltips afvist», BB-100). Hjem: `aarsloen-contract.md`.
15. Feriegodtgørelsen indtastes på hver manuel reguleringsrække, og programmet udfylder intet automatisk. Den grå
    pladsholder «0,00 %» i tomme celler bevares. Kilde: S 12i (BB-312 afvist, «valg A»). Hjem:
    `eo-snapshot-contract.md` §14, linje 874, ved manuel regulering.
16. To regler for lønudvikling og regulering mangler:
    - En forhøjet grundløn, der er større end trinlønnen, giver en gul advarsel.
    - En privat overenskomst uden satser giver én satslinje med link til «Vælg overenskomst».

    Kilde: S «12i's fire tillægsspørgsmål» (BB-306, BB-313). Hjem:
    `docs/domain/taf/tabt-arbejdsfortjeneste.md` «Tillægssatser fra en overenskomst».
17. Løntrin-finderen husker sine indtastninger på begge flader. Et resultat bliver uvirksomt, når opslagets
    oplysninger ændres. Indsættelse spærres med tooltip, når opslagets løntype afviger fra sagens «Ansættelse».
    Sagens løntype ændres aldrig af finderen. Kilde: S «Fund, der afventer …» (BB-310) og «Afgjort … 12h–12l»
    (BB-445), samt T M-67. Hjem: `keyboard-navigation.md` §«Overlay note: Løntrin-finder» eller
    `form-contract.md`.
18. Røde datoer bevarer visse afledte visninger bevidst, også i tidligere gemte `.eo`-filer:
    - Lønsatsernes indtastede reference bevares ved rød slutdato.
    - Fraværsrækkens «Feriedage» og EO-kontrols ferieoptælling bevares.
    - TAF-rækkens «TAF-arbejdsdage» bevares, mens kontrollen viser `– / –`.
    - Overlapkontrollen beholder `22 / 22`, når værdierne er ens, mens den røde TAF-gren viser `– / –`. Download
      er spærret.

    Kilde: S «Kritisk efterreview» (BB-338–BB-340) og T M-41. Hjem: `eo-snapshot-contract.md` §6/§6.1.
19. Sygedagpenge-hjælperen beder om bekræftelse, når den indsætter oven i eksisterende rækker. Overlappende
    rækker af samme ydelse lægges ellers sammen uden advarsel. Kilde: S 12k (BB-359 afvist som overlapregel,
    valg B). Hjem: `input-field-behavior-contract.md` §3.6.
20. Ved TAF «Nej» er felterne på Offentlige ydelser og Lønindkomst ikke relevante, og fanen forklarer det. Kilde:
    S 12k (BB-360, valg A). Hjem: `eo-snapshot-contract.md` §14.
21. En ydelsesperiode uden arbejdsdage giver gul ring på ydelser og lønindkomst. Kilde: S 12k (BB-365). Hjem:
    `docs/domain/taf/tabt-arbejdsfortjeneste.md`. Linje 59 dækker i dag kun TAF-perioden.
22. Tre ønsker til bilagsvalg og knapper er afvist:
    - Bilagsvalgene siger ikke, at de også styrer «TAF opreguleret til beregningsåret» (BB-377).
    - «Perioden» præciseres ikke (BB-378).
    - Den låste «Opgørelse» står grå uden tooltip (BB-379).

    Kilde: S 12l-tabellen. Hjem: `page-component-contract.md` ved bilagsvalg.
23. Kontrolfanerne er passive: kontroltabellens urenderede integritetstjek er fjernet. «Tom» i sammentællingen
    har én definition, som både sammenligning og visning læser. Kilde: S «Fund, der afventer …» (2026-10-30) og
    S 12m «Afgjort». Hjem: `eo-snapshot-contract.md` §6.1.
24. Fire regler for gule advarsler i EO mangler i kontrakterne:
    - Dækningsadvarslen venter, mens en relevant afskæringsdato er afvist (NY-12b-4, BB-426).
    - Et sammenklappet grundlag i opgørelse 2+ giver ingen gule advarsler (BB-431).
    - En dagsløn under 100 kr. giver en gul advarsel (BB-432).
    - Mangler TAF-rækker, giver det en gul besked (BB-429).

    Kilde: S «Afgjort af udvikleren 2026-11-22». Hjem: `eo-snapshot-contract.md` og
    `docs/domain/taf/tabt-arbejdsfortjeneste.md`.
25. Huller mellem TAF-rækker er forventelige og giver ingen advarsel. Kontroltabellens «TAF-perioder» viser
    første og sidste dato. Kilde: S «Afgjort … 12a–12g» (BB-428 afvist) og T M-60. Hjem:
    `eo-snapshot-contract.md` §6.2.
26. To fejlbeskeder mangler i kontrakterne:
    - Division med 0 i et beløbsudtryk giver én fælles, konkret besked. Udtrykket bevares, og blokeringen består.
    - En udfyldt, rød værdi meldes kun med sin konkrete fejl og ikke også som manglende.

    Kilde: S «Afgjort … 12h–12l» (BB-440) og T M-58/M-65. Hjem: `input-field-behavior-contract.md` §2.2 og
    `error-contract.md`.
27. Urealistisk store satser for anciennitetstillæg og sygeferiegodtgørelsens dagssats giver gule advarsler.
    Kilde: S (BB-446, BB-450). Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md` og
    `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md`.
28. Et valg, der flytter enheden for et indtastet tal, kræver bekræftelse. Eksemplet er «Løn på helligdage», som
    gør fraværsdage til arbejdsdage. Enhedsskift via datoer, lønrækker eller sletning af et ansættelsesforhold er
    bevidst uden bekræftelse. Kilde: S (BB-449) og T M-68. Hjem:
    `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` og `critical-action-contract.md`.
29. Tekster i bilag, bekræftelser og graf mangler i kontrakterne:
    - SFGG-bilaget siger «fra reguleringsdatoen (…)», når der reguleres derfra (BB-453).
    - EET-kildeskiftets bekræftelse siger, når skiftet ikke henter noget fradrag (BB-457).
    - Grafen siger «Der er ingen indtægter at vise i grafen» (BB-461).
    - Korte udsving i et positivt indtægtsniveau vises i grafen (BB-460, M-71).

    Kilde: S «Afgjort … 12h–12l» og T M-71. Hjem: `document-output-contract.md` og
    `input-field-behavior-contract.md` §3.5.
30. Kun en hel, ordnet erstatningsperiode afgrænser EO-kontrols dagtabel og CSV-filen. Dagtabellens «Ugedag» og
    «Dato» bliver stående ved vandret rul. Kilde: S «Fejlrettet/Gennemført 2026-11-24 (12m)» (BB-465, BB-467).
    Hjem: `eo-snapshot-contract.md` §6.
31. Tekst uden for standardfontens tegnsæt translittereres i PDF'en, og der indlejres ingen font. Kilde:
    S «Afgjort … 2026-11-22» (NY-12a-2/NY-12c-1). Hjem: `document-output-contract.md` §336. Teknikken står der
    allerede, men det står ikke, at en indlejret font er fravalgt.
32. Indsættelse følger tastning, også når et fortegn fjernes uden besked. Afvisningen står i S «Afgjort …
    2026-11-22» (NY-12c-2). Samtidig er det kopierede minus (U+2212) og tankestregen i beløb rettet (BB-430,
    M-61). Hjem: `form-contract.md` §8.2 og `input-field-behavior-contract.md` §1.2a. Afgrænsningen mellem de to
    skal efterprøves mod koden.
33. Beløbsfelter vedrørende overenskomst, filtre og visning:
    - En tom filtreret overenskomstvælger viser «Ingen overenskomster matcher de valgte filtre» og bevarer
      valget.
    - Låste satser er læsbare i mørkt tema.

    Kilde: S «Afgjort … 2026-11-22» (BB-435, BB-436) og T M-63/M-64. Hjem: `page-component-contract.md`.
34. Et hurtigt efterfølgende klik på «Tilføj nyt ansættelsesforhold» eller «Flyt» må hverken flytte et andet
    kort eller udløse en anden handling. Kilde: S «Fejlrettet 2026-11-22» (BB-434, BB-437) og T M-62. Hjem:
    `page-component-contract.md`.
35. En afvist rettelse til et hjælpedatofelt bevares synligt med rød fejl og bliver ikke blank. Det gælder
    sygedagpenge-hjælperen og Find løntrin. Kilde: S (BB-458, BB-459) og T M-70. Hjem:
    `input-field-behavior-contract.md` §3.6 og `form-contract.md` (transient).
36. Sorterbare talkolonner sorterer på talværdien, ikke på den formaterede tekst. Kilde: S (BB-454) og T M-69.
    Hjem: `page-component-contract.md`.

### Erhvervsevnetab og Forsørgertab

37. Differencekravet lægger sagens forhold på beregningsdatoen til grund. «EET efter EAL» opgør den sluttelige
    tilstand, og løbende ydelser regnes til og med dagen før. Bilag og nabofane må derfor vise forskellige tal
    under samme titel. Kilde: S 11e «(2)» og T M-31 «Afgjort 2026-09-09» (BB-185, BB-186 afvist). Hjem:
    `eet-snapshot-contract.md`. Domænedokumentet `docs/domain/eet/differencekrav.md` linje 57 beskriver kun
    mekanikken, ikke afvisningen.
38. Kapitalisering-fanen er bevidst uafhængig af beregningsdatoen. Folkepensionsalderen slås op på
    kapitaliseringstidspunktet, så to bokse kan vise forskellig alder. Kapitalbeløbene får ingen sum. Kilde: S 11c
    «(1)» og tabellen (BB-166 trukket, BB-169 og BB-174 afvist). Hjem: `eet-snapshot-contract.md`.
39. Programmet påstår aldrig, at en beregning «ikke er lovmæssig». Konstanten med lovmæssighedshalen er fjernet,
    og en test låser fraværet. Kilde: S 11c «(2)» (BB-173). Hjem: `error-contract.md`.
40. «EET efter EAL» viser ikke, hvilken kilde der blev brugt til årsløn og EET-procent. Fallbacken er velkendt for
    målgruppen. «Kapitaliseringsfaktor» er samme begreb i ASL og EAL og omdøbes ikke. Kilde: S 11d-tabellen
    (BB-180, BB-184 afvist). Hjem: `docs/domain/eet/eal-beregning.md`.
41. 10 %-trinnene for EET-procent gælder kun ASL. Efter EAL gælder mindst 15 % og derefter 5 %-trin op til 100.
    Kilde: S «Flade 11d – 10 %-trinnene» og «Tidligere: 2026-09-04». Hjem: `eet-snapshot-contract.md`. Ingen
    forekomst fundet i kontrakter eller domænedokumenter.
42. Fem visningsønstre fra 11b og 11e er afvist eller delvist gennemført:
    - Linjen «Ikke kapitaliseret.» beholdes for sin pædagogiske værdi (BB-201).
    - Et forlig på 100 % udgår af specifikationen (BB-197). Det står allerede i `differencekrav.md` linje 237.
    - «Reguleringsprocent (dato)/(år)» i to nabobokse er ikke en fejl (BB-198).
    - Niveauskift-noten vises kun ved 2003-niveau med rækker før og fra 2024 (BB-157).
    - To toggles må styre samme udvidede specifikation (BB-164).

    Kilde: S 11e- og 11b-tabellerne. Hjem: `docs/domain/eet/loebende-eet.md` og
    `docs/domain/eet/differencekrav.md`.
43. Fem afgørelser om EET oplysninger mangler:
    - Fanen viser kun egne fejl som rød eller gul ring (BB-142). Det er dækket i `error-contract.md`.
    - Rækken hedder «Køn» uden «skadelidtes» (BB-137).
    - De to «EET %»-felter må behandle 0 forskelligt (BB-143).
    - Fejlbeskeder bruger fulde feltnavne frem for kolonneforkortelser (BB-145).
    - «Bemærk»-boksens forbehold trykkes ikke i de fire EET-dokumenter.

    Kilde: S 11a-tabellen og «Flade 11a's spørgsmål». Hjem: `eet-snapshot-contract.md`.
44. En række er ikke udfyldt, hvis kun en required-choice-dropdown er ændret. Det gælder i hele programmet, for
    eksempel EET's afgørelsestabel og rentekravene. Ved dubletrækker markeres begge rækker. Kilde: S «Flade 11a
    … (1), (3)» (BB-147, BB-140). Hjem: `input-field-behavior-contract.md` §1.0a. Den dækker afvist input, men ikke
    dropdown-princippet.
45. Kapitalisering ved højst 2 år til folkepension følger en fast regel. Kap.dato er afgørelsesdatoen eller en
    senere dato med gul advarsel. Kap. % er hele det resterende EET. Tomme felter er blokerende mangler uden rød
    ring, og begge beskeder navngiver den lovlige værdi. Kilde: T M-29 «Afløst 2026-11-13». Hjem:
    `eet-snapshot-contract.md`. `docs/domain/eet/under-to-aar-til-fp.md` skal efterprøves.
46. En EAL-beregning stopper ikke på grund af en fejl i en kapitalisering, der ikke påvirker EAL-kravet. Den
    stopper kun, når fejlen kan ændre afgørelsesvalg eller procent. Kilde: T M-57 (BB-419, gennemført).
    Hjem: `eet-snapshot-contract.md`.
47. Forsørgertabserstatningen vises som 0 kr., når regnestykket bliver negativt. Der vises hverken difference
    eller forklarende linje, og forslaget må ikke genrejses. «(afrundet)» forklares heller ikke. Kilde: S
    «Forsørgertab … To afvisninger» (BB-119, BB-131) og T M-24. Hjem: `forsoergertab-snapshot-contract.md`.
    Domænedokumentet linje 522 nævner kun clampingen.
48. EAL-årslønnen har intet loft. Loftet ligger på det beregnede beløb. Kilde: S «Åbne spørgsmål»-tabellen.
    Hjem: `docs/domain/forsoergertab/forsoergertab-beregning.md`.

### Årsløn, Satser, Varige mén og Renteberegning

49. Fem ønsker for Årsløn er afvist:
    - Skift af lønperiode tømmer perioden uden særskilt markering (BB-105).
    - En sats på 0 % i dokumentet (BB-109). Afvisningen modsiger M-13's bindende «0 vises begge steder».
    - Dokumentet skriver «0» for et tomt feriedagefelt (BB-110). Det modsiger T M-19's forslag.
    - «Løn»/«Løn (2)» uden forklaring (BB-116).
    - Indstillingernes standardværdier for samme felter gælder ikke Årsløn (BB-106).

    Status for BB-109 og BB-110 skal efterprøves mod `aarsloen.md` og koden. Kilde: S «Årslønsberegning»-tabellen
    og «Fire historiske spørgsmål». Hjem: `aarsloen-contract.md`.
50. Seks satsvisninger er afvist:
    - Satser-siden er et opslagsværk. Den markerer ikke sagens række og advarer ikke om et satsår langt fra sagen.
    - Dækningsintervallet annonceres ikke (BB-032).
    - «Satser» kan bruges om forskellige visningsformer (BB-033).
    - «(fra 2024)» forklares ikke (BB-034).
    - Grundlaget for fri proces-beløb trykkes ikke (BB-035).
    - Varige méns satsfane henfører satsen til begge love, viser ikke beregningsåret og markerer ikke sagens år
      (BB-075–BB-077).

    Kilde: S «Satser – afgjort» og «Varige mén → Satser». Hjem: `satser-contract.md` og `varigemen-contract.md`.
51. Satsfanen skriver ikke, hvor langt satserne er fastsat, og skærmen gentager ikke dokumentets forbehold om
    fremtidige satser (BB-040, BB-094). Negative satser vises bevidst som «- 0,45 %» (BB-095). Sortering i
    tabeller kan ikke slås fra (BB-041). Kilde: S «Renteberegning → Satser» og «MinProcesrente», og T M-15/M-13.
    Hjem: `renteberegning-contract.md` §2.12. Kun 7 %-rækken og to andre forhold står der i dag.
52. «Mangler»-linjer nedtones ikke, så fejllinjer ikke overses (BB-067). Pladsholderen «0» bruges, også hvor 0
    er ugyldig (BB-074). Kilde: S «Varige mén → Ménberegning» og «Noter til rækkefølgen». Hjem:
    `page-component-contract.md`.
53. Lange PDF-tabeller gentager ikke kolonneoverskrifterne på fortsættelsessider. Kandidaterne skal ikke
    genforelægges. Kilde: S linje 8 og T M-48 «Afvist 2026-11-17» (BB-399). Hjem:
    `document-output-contract.md`.

### Shell, Om og Indstillinger

54. Tab-ringen findes til hurtig indtastning på én side. Sidemenu, `PageTabs`, `SideTab` og de tre filhandlinger
    skal ikke ind i ringen (BB-051). `keyboard-navigation.md` dækker eksterne links og knapper, men ikke
    sidemenuen eller fanerne. Kilde: S «Global shell» og T M-08. Hjem: `keyboard-navigation.md`.
55. Shellen har fem bevidste begrænsninger:
    - Gemt/ugemt-tilstand og filnavn vises ikke (BB-052).
    - Der er ingen «Log ud» (BB-061).
    - «Slet alt» advarer også, når der intet er at slette (BB-058).
    - «Slet alt» og «Erstat» kan ikke fortrydes (BB-060).
    - F5 udløser browserens ekstra advarsel (BB-059).

    Kilde: S «Global shell – afgjort». Hjem: `app-shell-contract.md` og `auth-gate-contract.md`.
56. Ctrl+Z i et åbent felt er browserens egen tekstfortrydelse, og programmet spærrer ikke tasten (BB-054).
    Kilde: S og T M-18. Hjem: `keyboard-navigation.md`. Den nævner overlay-stakken, men skal efterprøves for
    reglen om åbent felt.
57. Om-sidens afgørelser:
    - Søskendesider åbner i ny fane (BB-013).
    - Rul-op-knappens overlap accepteres (BB-014).
    - Browserikoner står uden tekst (BB-019).
    - Startsidevalget står under «Teknisk» (BB-020).
    - «Mineo» og «minEO.dk» står side om side (BB-021).
    - Forsiden peger ikke ind i programmet (BB-022).
    - Hjælpeprogrammets tilstand vises først ved klik (BB-017).

    Kilde: S «Tidligere flader» (Om). Hjem: `app-shell-contract.md`.
58. Indstillinger forklarer ikke, hvornår deres virkning indtræder. Standardværdier gælder nye sager og tilstanden
    efter Slet alt, aldrig en åben sag. Beregningstekniske valg virker straks. Brevhovedet er et tilbud, ikke en
    integritetsegenskab, og «0 måneder» betyder straks. Kilde: S «Indstillinger»-tabellen og T M-12 (BB-023,
    BB-026, BB-029). Hjem: `app-settings.md`.
59. Mineo er en samling selvstændige værktøjer, og brugeren forventes at vide det. Et fund om formodet sammenhæng
    kræver en faktisk kobling, der virker anderledes end den ser ud. Kilde: S «Satser … lukket spor 5» og T. Hjem:
    `app-shell-contract.md` (principper) eller `AGENTS.md`.

### Tværgående

60. Felter med tal har to regler for rimelighed og nul:
    - En advarsel om en usandsynlig værdi gives kun, hvor værdien er usandsynlig i sagens egen sammenhæng. Den
      gives aldrig på opslagsfelter.
    - Et klampet nul, der er ydelsens velkendte resultatform, er ikke en fejl. Et nul, der dækker over en umulig
      mellemregning, forhindres af en grænse på feltet.

    Kilde: T M-05 og M-24. Hjem: `input-field-behavior-contract.md` §1.3 eller `error-contract.md`. Kun
    `varigemen-contract.md` linje 60 nævner M-05.
61. En værdi på 0 vises både på skærmen og i dokumentet. En `> 0`-prøve på synlighed er forkert. Undtagelsen er
    tillægskolonner i reguleringsbilaget, der udgår, når overenskomsten slet ikke har tillægget. Kilde: T M-13
    «Afgjort 2026-08-18» og «Status 2026-10-30». Hjem: `document-output-contract.md`.
62. Skærm og dokument må ikke være uenige om form, regneled eller operatorer for samme tal. Varige méns nul
    decimaler er en særregel for den ydelse og må ikke udbredes. Kilde: T M-13. Hjem:
    `document-output-contract.md` og `amount-contract.md` §5. Afgrænsningen står kun i `varigemen-contract.md`.
63. Bilagsvalg og dokumentgate har tre regler:
    - Et bilagsvalg er kun aktivt, når bilagets indhold faktisk trykkes.
    - Et utilgængeligt valg skjules aldrig. Det vises inaktivt og umarkeret med årsag.
    - Gaten spærrer bredt på severity, mens listen over konkrete inputfejl afgør teksten. Allowlists er forbudt.

    Kilde: T M-25. Hjem: `document-output-contract.md`. `page-component-contract.md` linje 416 dækker kun toggles.
64. Kun en fejl stopper importen af midlertidigt EET. En advarsel følger med. En tom import uden fejl giver gul
    advarsel, og en tom virkningsdato læses som afgørelsesdatoen. Kilde: T M-43 (BB-357, BB-358, BB-368). Hjem:
    `eo-snapshot-contract.md` §13. Efterprøv, om §13 allerede siger det; grep fandt BB-357 og BB-358 i
    kontrakterne.
65. Gentagne række-fejl foldes kun ved en eksplicit `summaryDeduplicationGroup`, hvor hver række er synligt
    markeret. Ellers får hver række sin linje og sit fokusmål. Kilde: T M-40. Hjem: `error-contract.md` eller
    `docs/architecture/eo-row-evaluation-architecture.md`. Ingen forekomst fundet.
66. Øvrige krav har én vurdering pr. række, som rækkebygger og validator deler, og datoen er valgfri. Kilde: T
    M-33 «Rettet for øvrige krav». Hjem: `eo-snapshot-contract.md` eller
    `docs/architecture/eo-row-evaluation-architecture.md`.
67. «Indsæt dags dato» afprøver dags dato mod både øvre og nedre grænse. Uden for grænsen er knappen inaktiv med
    tooltip. EO's «Opgørelse lavet den» er undtaget, fordi grænsen ikke kan rammes. Det gælder også
    Renteberegnings rentedato. Kilde: T M-49. Hjem: `input-field-behavior-contract.md` §4.6. Den siger i dag
    generelt det modsatte, nemlig at datoen indsættes rødt.
68. Fem gennemførte afgørelser fra T M-59 mangler, for det meste, i kontrakterne:
    - Månedsbrøken afrundes aldrig i beregningen og vises med fem decimaler. Undtagelsen er TAF-tabellens «Antal
      måneder» med to decimaler.
    - SH-dage-dokumentet blokeres kun af periodeceller og «Løn på helligdage».
    - EO's TAF-dokumenter blokeres ikke af svie/smerte, øvrige krav, særlige kommentarer og bilagsnumre.
    - Bilaget «Regulering» viser kun ansættelsesforhold med løn i beregningsperioden.
    - Årslønnens rækkeadvarsler linker til cellen.

    Kilde: T M-59 «Afgjort». Hjem: `document-output-contract.md`, `aarsloen-contract.md` og
    `eo-snapshot-contract.md`. Kun fem decimaler for Forsørgertab og Differencekrav er dækket.
69. Gamle `.eo`-filer får nye regler. En ny blokerende regel må gælde tidligere gemte filer uden load-advarsel og
    uden ændring af gemte værdier, men det er en særskilt godkendelsesgate. Udvikleren har bekræftet princippet:
    ændringer, der gælder tidligere gemte filer, skal gælde dem. Kilde: S «Kritisk efterreview» og T M-39. Hjem:
    `schema-evolution.md` eller `persistence-contract.md`. Efterprøv, om CLAUDE.md-gaten allerede dækker
    princippet.
70. Et skjult felt er ikke udfyldt i hele programmet. Det påvirker hverken beregning eller fejl, og et valg, der
    skjuler et rødt felt, rydder det. Validatoren læser kun relevante værdier. Komprimering ved EO 2+ er den
    eneste bevidste undtagelse. Kilde: T M-32. Dækket for EO (`eo-snapshot-contract.md` §14,
    `form-contract.md` §7). Hjem for programdækkende ordlyd: `form-contract.md` §7.

## B. Varige udviklings- og testregler

1. Et felt, der kun er synligt i én beregningstilstand, skal skjules eller gøres relevant via descriptorens
   `relevance`. Før et felt skjules, findes alle læsere af værdien. Kilde: T M-35. Hjem: `form-contract.md` §7.
2. Advarsler om en brugerindtastet tabel bor i tabellens eget modul som rene funktioner af rækkerne. De ligger
   ikke i den motor, der først fik brug for dem. Ret ved at flytte reglen, ikke ved at kopiere prædikatet. Kilde:
   T M-30. Hjem: `docs/architecture/calculation-architecture.md`.
3. En motorafvisning, som feltmodellen ikke kender, rettes i feltmodellen som `rule`-validator på det felt,
   brugeren skal ændre. Den rettes ikke ved at differentiere gatens besked. En ren mangel i en halvfærdig række
   forbliver gate-feedback uden rød ring. Kilde: T M-16. Hjem: `docs/architecture/input-architecture.md`.
4. Filtrerer en aggregator et issue væk, skal den efterprøve issuets bivirkninger, for eksempel en
   `computation: null`, der fjerner et bilag. Kilde: T M-25 (BB-188). Hjem:
   `docs/architecture/document-output-architecture.md`.
5. To tomhedsprædikater for samme række, for eksempel persistens mod regler, skal holdes op mod hinanden på
   værdien 0 og på et defaultet valg. Kilde: T M-16 (BB-098, BB-147). Hjem: `form-contract.md`.
6. En normalisering lægges dér, hvor den eksisterende normalisering bor, så alle led i samme beslutning
   normaliserer ens. Kilde: T M-06. Hjem: `AGENTS.md` §Konvergens.
7. Identitet: brug den identitet, der allerede findes på objektet, for eksempel `handle.name`, frem for en
   parallel kopi. Sagsnære oplysninger må ikke deles over lagre med forskellig rækkevidde. Kilde: T M-17. Hjem:
   `persistence-contract.md` §5, der dækker filhåndtaget, men ikke den generelle regel.
8. Omdøbninger og navnerettelser søges som begreb i hele `src/` og på hver flade, der deler komponenten. Ny
   ordlyd søges også, før den tages i brug. Kilde: S «Renteberegning → Satser» og T M-02/M-38. Hjem: `AGENTS.md`.
9. En afgørelse gennemføres og verificeres på hver flade, der deler komponenten. Eksporterede regel- og
   advarselsfunktioner, som kun deres egen test kalder, er ufuldstændige. Kilde: T M-38. Hjem: `AGENTS.md`.
   Contract-topology har liveness for symboler, men ikke for denne regel.
10. Fire regler om tests:
    - En test, der låser en tekst, låser også dens sandhedsværdi, så fixturen kontrolleres mod påstanden.
    - En prøve på et fravær kræver en modprøve, der viser, at nærværet var muligt.
    - Prøven skal hvile på en synlig virkning.

    Kilde: S 11e «(3)» og T M-18. Hjem: `src/__tests__/AGENTS.md`. `AGENTS.md` nævner fixtures, men skal
    efterprøves.
11. Indtastningsregler ligger på draft-prædikatet (`onDraftChange`), og keydown-filteret afledes af samme
    prædikat (`keyFilterFromAdmission`), så paste, tabelceller og transiente felter følger samme regel. Kilde:
    S «Efterprøvning af de fem udbredte tilbagemeldinger». Dækket i `input-field-behavior-contract.md` §1.2, dog
    uden navnet på afledningen.
12. To formler for samme begreb skal afledes af hinanden, ikke genberegnes hver for sig. Kilde: S «Tidligere:
    2026-09-04» (forsørgertab). Hjem: `AGENTS.md` §Konvergens.
13. Farver på `row--*`-typografi sættes med to-klasse-modifikatorer, for eksempel `row--text-error`, aldrig med
    MUI-`color`/`sx`, som altid taber. Kilde: T M-21. Hjem: `page-component-contract.md`.
14. En forudsætningsrække må ikke ligge i en sektion, som en kalder slår fra med et `include*Header`-flag. En
    rettelse søges på computation-typen, ikke på én generator. Kilde: S 11d «(3)» og T M-13 (BB-182). Hjem:
    `docs/architecture/document-output-architecture.md`.
15. `eoValues` er en læseprojektion. En consumer, der udleder tælling, label eller selector af en context-rød
    dato, skal have en typet projektion med issues. Bevidste undtagelser dokumenteres ved consumeren. Kilde: T
    M-41 «Rettelsesregel». Hjem: `docs/architecture/eo-row-evaluation-architecture.md`. Efterprøv, om reglen er
    implementeret.
16. En normal browserbegrænsning eller en valgfri, tom sagsdel må aldrig gå til den tekniske fejlalarm. Dækket
    for mappevalget i `app-settings.md` §125. Den generelle regel og Gem uden Stamdata (BB-393) mangler. Kilde:
    T M-45. Hjem: `error-contract.md`.
17. Beskyttelsen mod tab tæller faktisk ændret tekst i et åbent felt (`hasDraftChanges`) med, uden at teksten
    går videre til beregning. Kilde: T M-47. Hjem: `persistence-contract.md` ved `unsavedWork`, linje 153.
18. Når to layoutbeslutninger hviler på forskellige kriterier, skal der kun være ét. MinProcesrentes opstilling
    følger enheden, ikke vinduet. Kilde: T M-09. Dækket i `app-shell-contract.md` linje 248.
19. En parameters ejer og en grænses placering er domæneoplysninger. De afklares med udvikleren og udledes ikke
    af koden. En umålelig påstand som en lovhenvisning rejses som spørgsmål. Kilde: S «Åbne spørgsmål» og T M-11.
    Hjem: `AGENTS.md` §Kommunikation/roller.

## C. Åbne punkter

1. Dokumentationen modsiger sig selv på to punkter, som skal afstemmes med koden:
    - BB-109 (0 %-sats i Årsløns dokument) står som afvist i S, mens T M-13 kalder reglen bindende.
    - BB-110 (`?? 0` for tomme feriedage i Årslønsdokumentet) er afvist, mens M-19 foreslog rettelse.
2. M-17 og BB-049: Den manuelle efterprøvning af Gem med to faner og to rigtige filer står åben. Mekanismen er
   kun mutationstestet.
3. M-36: Reguleringsformerne (`regulering/forms/*.ts`) er ikke prøvet for interne undtagelser ved lovlige
   indtastninger.
4. M-45: Tre kandidater er uverificerede: persistent storage i `fileHandleStorage.ts`, mappevælgerens øvrige
   afvisninger og forkert filendelse i `fileSystemAccess.ts`.
5. M-47: Tre kandidater er kun kodeaflæst: standalone MinProcesrentes exit-guard, åbne tabelceller og PWA-Hent.
6. M-44: Om-sidens startsidevalg og de øvrige indstillinger er ikke prøvet på tværs af faner.
7. M-41: Det er uklart, om rettelsesreglen om en typet projektion for afledte consumers er gennemført eller kun
   formuleret.
8. M-33: «Sygeferiegodtgørelse beregnes ud fra» mangler muligvis i rækkebyggeren. Kandidaten er uverificeret.
9. M-02: Filnavnenes brug af journalnummer ved fravalgt brevhoved er et uafprøvet spor på Varige mén,
   Forsørgertab og Satser.
10. M-21: Døde `color`-props står tilbage. Det gælder `ForsoergertabOplysningerSection.tsx`, `Satser.tsx:30`,
    `CannotComputeAggregationNotice.tsx:13` og `DefaultDirectoryRow.tsx`. Kun fejlbeskeden er rettet.
11. 11e: TAF-halvdelen afgrænser ikke TAF med EET's `kapDato`, og EO kender kun to afgørelseskategorier. Spørgsmålet
    er forelagt som fund uden kodeændring. Efterprøv `docs/domain/eet/differencekrav.md` §«Åbne forhold».
12. Tre punkter fra 12j og M-49 er uafklarede:
    - BB-321 var «delvist» i S-tabellen og står senere som gennemført. Status skal bekræftes.
    - M-49's nedre grænse for Varige mén og Erhvervsevnetab bruger fortsat kun den øvre kontrol. Udfaldet er
      «sikre».
    - Testkoblingen for `resolveInsertTodayDisabledReason` er ikke beskrevet i kontrakten.

Undersøgte kandidater: ca. 150. Allerede dækket: ca. 60. På hovedlisten: A 70, B 19 og C 12. Nogle punkter i B
er markeret delvist dækket.
