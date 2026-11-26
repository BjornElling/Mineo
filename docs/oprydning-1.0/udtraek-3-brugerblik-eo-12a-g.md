# Udtræk 3 – Brugerblik EO 12a–12g

Kilder: `docs/testing/brugerblik/erstatningsopgoerelse-12a.md` … `-12g.md` (fork. 12a–12g nedenfor). De fund, der stod
som «Afventer udvikleren» i filerne (NY-12a/b/c-*, BB-425–BB-438), er alle afgjort i `STATUS.md` l. 23–24; deres
afgørelser er medtaget, hvor de mangler i kontrakterne.

Dækket er efterprøvet i `src/contracts/`, `docs/architecture/`, `docs/domain/`, `AGENTS.md` og stikprøvevis i koden.
Forkortelser: IFB = `input-field-behavior-contract.md`, EOS = `eo-snapshot-contract.md`,
TAF-dom = `docs/domain/taf/tabt-arbejdsfortjeneste.md`.

## A. Udviklerens afgørelser (mangler eller er ufuldstændige)

### Opgørelsens ramme (12a)

1. **«Nummer» afgør, om sagen er første opgørelse.** Feltet er fritekst. Det tæller som ikke-første, når første
   bogstav-eller-ciffer er et ciffer ≠ 1, eller er 1 efterfulgt af et ciffer: `2`, `12` og `2A` er ikke-første, mens
   tom, `1`, `1A`, `A2` og `Nr. 2` er første. Det er bevidst, at `2` og `Nr. 2` giver forskellige beløb. Afvist:
   en forklarende linje og et eksplicit Ja/Nej-valg.
   Kilde: 12a «BB-202». Hjem: IFB §4.1.
2. **«Skjul beregning efter første opgørelse» vises først fra 2. opgørelse og er allerede afkrydset (standard
   «Ja»).** Grundlaget fastsættes én gang og skal ikke ændres. Afvist: uafkrydset standard og forklarende linje.
   Kilde: 12a «BB-203». Hjem: EOS §14 «Bevidst undtagelse – komprimering».
3. **Statusoverskriften er «Status ved erstatningsperiodens udløb», så længe til-datoen mangler, og ellers
   «Status den <dagen efter>».** Den statiske tekst er kun en pladsholder. Afvist: at ensrette ordlyden.
   Kilde: 12a «BB-210». Hjem: IFB §4.8.
4. **Sektionen hedder «Eventuelle særlige bemærkninger» på indtastningsfladen.** Feltet og dokumentet siger
   «Særlige bemærkninger». «Eventuelle» signalerer valgfrihed og må ikke ensrettes væk.
   Kilde: 12a «BB-212». Hjem: IFB §4 (nyt punkt) og `document-output-contract.md` A6.
5. **Følgende forklares ikke på skærmen: valgene i «Erstatningsopgørelse afsluttes med» og kravvalgenes «Skjul».**
   Afvist: infoikon og forklaring. Udmøntningen er velkendt for brugeren.
   Kilde: 12a «BB-213», 12b «Overvejet uden fund». Hjem: IFB §4 (nyt punkt).
6. **Et tomt «Skadelidte» blokerer download, når «Underskrift-linje» er valgt.** Reglen gælder også ældre
   `.eo`-filer: de loades uændret uden preflight, men viser derefter fejlen.
   Kilde: 12a «BB-214», «BB-335». Kun i test: `eoRowStamdataModel.test.ts` og
   `e2e/erstatningsopgoerelse-tidligere-filer.spec.ts`. Hjem: IFB §4 og `document-output-contract.md` A2.
7. **«Vedrører perioden» har skadedatoen som nedre grænse.** Ved erhvervssygdom er grænsen anmeldelsesdatoen
   minus 5 år (fælles `skadedatoBoundedSpec`), og øvre grænse er 31-12 året efter. En ældre fil med en periode før
   skaden loades uændret og viser derefter en rød fejl, der blokerer download.
   Kilde: 12a «BB-209», «BB-334». IFB §4.4 nævner kun «universelle datoregler». Hjem: IFB §4.4.
8. **En opgørelse uden et eneste rejst krav giver en ikke-blokerende advarsel og kan hentes.** En bevidst
   nulopgørelse er et legitimt produkt.
   Kilde: 12a «BB-215». Kun i kode: `eoRowOverviewRows.ts`. Ingen test fundet. Hjem: EOS (nyt afsnit om
   EO-oversigtsrækker).
9. **Bilagsnumrene har højst 12 tegn.** En inkonsistent bilagsadvarsel vises som gul ring ved feltet med boksens
   ordlyd. Et bilag med advarsel udelades af dokumentet; det er bevidst, og kun advarslen fortæller det.
   Kilde: 12a «BB-206», «BB-207»; 12a fornyet gennemgang. Kun i test: `fieldCharLengthPolicy.test.ts` og
   `BilagsnumreSection.advarsel.test.tsx`. Hjem: IFB §4 (nyt punkt «Bilagsnumre»).
10. **Er dags dato loftet, skriver alle grænsetekster «… og dags dato (DD-MM-ÅÅÅÅ)».** Grenen genkendes på
    `maxBoundKind: 'dagsDato'`, ikke på grænsens oprindelse. Datoen for et angivet lønbeløb og «Evt. særlig
    fra-dato for regulering» har også dags dato som loft.
    Kilde: 12a «BB-208»; 12f «BB-261» del 2; 12g «BB-282». Hjem: `date-contract.md` (grænsetekster) og IFB §2.1.

### Svie/smerte (12b)

11. **Det er samme tilstand, når brugeren angiver maksimum som nået, og når et indtastet tidligere beløb udtømmer
    det.** Dokumentet skriver begge steder ordret «Maksimum for svie- og smertegodtgørelse er nået i tidligere
    erstatningsopgørelse.» og nævner ikke beløbet. «Nej» skriver «Ingen».
    Et tidligere beløb over det forligsreducerede maksimum giver en gul, ikke-blokerende ring og linje.
    Lighed advares ikke (NY-12b-2). Ophørsgrunden i EO-kontrol følger dokumentet (NY-12b-1). Ved forlig skriver
    takstlinjen «50 %, svarende til 115 kr. pr. sygedag, dog højst 44.250 kr.».
    Kilde: 12b «BB-219», «BB-221»; STATUS l. 23. EOS §14 nævner kun «den eksisterende tekst». Hjem: EOS (nyt §17
    «Svie/smerte-maksimum») eller en S/S-domænefil.
12. **I «Svie/smerte opgjort i tidligere erstatningsopgørelser» behandles `0` som tomt.** Advarslen om manglende
    beløb står fortsat, og dokumentet tier ved 0 som ved tomt. Begrundelse: brugeren taster ofte 0 i tvivl.
    Kilde: 12b «BB-220». Hjem: EOS §7 (søsterregel til TAF's isometri).
13. **Ordbrug: For tidligere perioder indtastes det opgjorte beløb, og det fradrages i maksimum.** For den
    aktuelle periode tæller kun det udbetalte, og det fradrages i beløbet. Ordene «opgjort», «udbetalt» og «krav»
    må ikke ensrettes på tværs. Underoverskriften er «Tidligere svie/smerte-beløb».
    Kilde: 12b «BB-224», «BB-225». Hjem: EOS §17 (ny) eller en S/S-domænefil.
14. **EO-fladerne viser ingen beløb, kun hvilke ydelser der indgår og for hvilken periode.** Beregninger og
    resultater står først i dokumentet og på EO-kontrol. Afvist: sluttal på Beregning.
    Sammendragets rækker skelner mellem «Ikke rejst», «Ikke rejst (skjult)», «Maksimum nået i tidligere
    opgørelse», «Ingen perioder angivet» og, for øvrige krav, «N poster»/«Ingen poster angivet»/«Fejl». De tre
    krav bruger samme ordlyd.
    Kilde: 12b «BB-226», «BB-227»; 12c «BB-234». Hjem: `error-contract.md` §9.
15. **En ufuldstændig S/S-række med en cutoff-fejl viser både manglen og cutoff-beskeden.** Linket peger på den
    udfyldte røde dato. Cutoff-tekster siger «på eller efter», og en periodelinje nævner hver afskæring én gang,
    eller «Hele perioden ligger efter …».
    Kilde: 12b «BB-342», «BB-343», «BB-346»; 12d «BB-244». Kun i test: `svieSmerteCutoffDateIssues.test.ts` og
    `tafPeriodeCutoffMessage.test.ts`. Hjem: EOS §2.2.

### Øvrige erstatningskrav (12c)

16. **I øvrige krav er datoen valgfri, mens «Udgift til» og «Beløb» er påkrævet og blokerer.** En udateret post
    trykkes uden datopræfiks og tælles med i «I alt». Beløbet 0 er en rød fejl: «Beløbet skal være større end
    0 kr.».
    Kilde: 12c «BB-229», «BB-232». Ingen kontrakt dækker sektionen. Hjem: IFB nyt §5a «Øvrige erstatningskrav».
17. **En dato uden for «Vedrører perioden» giver gul ring og linje og må aldrig blive blokerende.** Kvitteringer
    fra en tidligere periode kan legitimt medregnes senere. Har rækken også en fejl, vises kun fejlen.
    Kilde: 12c «BB-235». Kun i kode og test: `oevrigeKravRowValidation.ts` og `OevrigeKravTable.test.tsx`.
    Hjem: IFB §5a.
18. **«Ja» uden poster giver en ikke-blokerende advarsel: «Der er ikke indtastet øvrige krav».** En ny sag
    starter bevidst på «Skjul».
    Kilde: 12c «BB-236», «Overvejet uden fund». Hjem: IFB §5a.
19. **Forbeholdene om verserende EET-klage og om kontanthjælp/ressourceforløb står sidst i TAF-afsnittet** under
    «Forbehold», hver på sin egen linje. De trykkes kun, når TAF er «Ja», og aldrig under «Øvrige krav».
    Kilde: 12c «BB-233». Kun i test: `tafForbehold.test.ts`. Hjem: TAF-dom §PDF eller
    `document-output-contract.md` A6.

### AES-afgørelser (12d)

20. **Én klagetoggle, «Verserende klagesag over EET-afgørelse?», gælder alle EET-afgørelser og står under
    «Øvrigt».** En klage sætter alt EET-relateret til fuld prøvelse. TAF-afsnittet trykker kun én EET-linje.
    Afvist: en toggle pr. afgørelse og en anden placering.
    Kilde: 12d «BB-239». Hjem: IFB §4.15.
21. **Et differencekrav uden EET-afgørelse er lovligt og giver ingen advarsel.** Betegnelsen bruges også om EET
    efter EAL uden en endelig ASL-afgørelse.
    Kilde: 12d «BB-246». Hjem: IFB §4.16.
22. **Er afskæringsdatoerne ens, bruger EO-kontrol samme ophørsgrund som dokumentet** (BB-425). En dækningsadvarsel
    venter, mens en relevant dato er afvist (BB-426, NY-12b-4).
    Kilde: 12d nederst; STATUS l. 23–24. Hjem: EOS §6 og `error-contract.md` §9.

### Tabt arbejdsfortjeneste og ferie (12e)

23. **EOS §2.2 er forkert om ferieperioder.** Den siger, at de «lægges ukritisk til grund» og ikke begrænses. Den
    gældende afgørelse er, at en ferie før skadedatoen, efter dags dato eller på/efter en afskæring giver en rød
    celle og blokerer (BB-248). TAF-dom l. 53 har den rigtige regel.
    Kilde: 12e «BB-248». Hjem: ret EOS §2.2 «Ferieperioder i EO-oplysninger».
24. **Er «allerede modtaget TAF» større end kravet, sættes kravet til 0 uden advarsel og uden note i dokumentet.**
    Det er normalt, at selskabet har betalt mere. Beløbet fradrages efter forligsreduktionen. Feltet hedder i
    dokumentet «Allerede modtaget tabt arbejdsfortjeneste».
    Kilde: 12e «BB-254», «BB-255», fornyet gennemgang. Hjem: EOS §7.
25. **Maksimum for løse ferie-/feriefridage regnes kun mod TAF-afsnittets egne ferieperioder.** Beskeden navngiver
    den afgrænsede del af perioden (BB-427).
    Kilde: 12e «BB-252»; STATUS l. 24. Hjem: TAF-dom §Arbejdsdage-optælling.
26. **Huller mellem TAF-rækker advares ikke.** Det er forventeligt. Afvist: BB-428.
    Kilde: 12e «BB-428»; STATUS l. 24. Hjem: TAF-dom §Periodeafgrænsning.
27. **En ferierække med kun fra-dato og uden en TAF-række giver en gul, ikke-blokerende besked med link.**
    Kilde: 12e «BB-429»; STATUS l. 24. Hjem: TAF-dom og EOS §2.2.

### Beregningsgrundlaget (12f)

28. **Værn for beregningsgrundlaget:**
    - Alt, der giver nævneren 0, er en rød feltfejl. Det gælder også månedsløn og dagsløn på 0 kr.
    - Fradrag, der efterlader under en fjerdedel af periodens arbejdsdage eller måneder, giver gul ring og linjen
      «Fradragene efterlader kun …».
    - Angivet dagsløn over 10.000 kr. eller under 100 kr. og angivet månedsløn under 2.500 kr. giver gul ring.
    - Er der hverken løn eller ydelser i dele af perioden, giver det en gul linje, men kun for huller med
      arbejdsdage.
    - Har en kilde en samlet negativ indtægt, vises kun den navngivne fejl, ikke «Ingen indkomst».

    Kilde: 12f «BB-258», «BB-259», «BB-260», «BB-268», «BB-333»; STATUS l. 24 (BB-432). EOS §3.1 nævner kun
    BB-258. Kun i kode og test: `beregningsgrundlagFeltAdvarsler.ts` og
    `beregningsgrundlagGraenserOgAdvarsler.test.ts`. Hjem: TAF-dom (nyt afsnit «Beregningsgrundlagets værn»).
29. **Et sammenklappet grundlag i opgørelse 2+ giver ingen gule advarsler.** «Skjult» og «advarer ikke» dækker
    samme rækker.
    Kilde: 12f «BB-431»; STATUS l. 24. Kun i kode: `indkomstBeregningSkjulning.ts`. Hjem: EOS §14 «Bevidst
    undtagelse».
30. **En beregningsperiode efter skadedatoen er lovlig.** Den bruges, når der ikke findes en periode før skaden, og
    lønnen nedreguleres. Afvist: loft ved skadedatoen.
    Kilde: 12f «BB-261» del 1. TAF-dom l. 416 omtaler kun nedreguleringen. Hjem: TAF-dom §Periodeafgrænsning.
31. **Lønindkomstens og offentlige ydelsers rækker må bevidst overlappe.** Alle andre periodepar følger den ene
    overlapsregel, også beregningsperioden mod TAF-perioder.
    Kilde: 12f «BB-262». Hjem: EOS §2.3 pkt. 5a.
32. **En rød kontekstdato bevarer de afledte visninger:**
    - Satsreferencen følger beregningsperiodens røde slutdato (BB-338).
    - En fraværsrække med rød dato beholder sit feriedagstal (BB-339).
    - En TAF-række med rød slutdato beholder sit dagstal, mens Kontroltabellen viser «– / –» (BB-340).
    - Ved overlap viser Kontroltabellen «22 / 22», uden `sammentaelling_mismatch`.

    Reglerne gælder også ældre filer.
    Kilde: 12f «BB-262» (eftermåling), «BB-338», «BB-339», «BB-340». Hjem: EOS §6.2.
33. **Relevansgrænser i beregningsgrundlaget:**
    - I måneder skjules «Ferie i beregningsperioden» og løse ferie-/feriefridage (BB-263).
    - Mode-felterne har relevans efter deres gren (BB-266).
    - «Fuld løn under ferie» skjules ved angivet løn (BB-285).
    - En fejl i periodens slutdato må ikke rydde en anden ferieindtastning (BB-433).

    Kilde: 12f «BB-263», «BB-266», «BB-433»; 12g «BB-285». EOS §14's liste dækker kun TAF's løse dage. Hjem: EOS
    §14 «Aktuelle relevans-regler».
34. **Øvrigt fravær uden løn giver én linje pr. mangel.** Et 0 i «Antal fraværsdage» og en tom «Årsag til fravær»
    giver gul ring med linjens tekst. Er «Antal fraværsdage» tomt, blokeres der uden ring.
    Kilde: 12f «BB-269». Hjem: TAF-dom (beregningsgrundlag).
35. **«- baseret på» har pladsholderen «fx lønsedler for 2017».** Dokumentet fjerner et indledende «baseret på»
    og ændrer aldrig store/små bogstaver, fordi egennavne ikke kan skelnes. «per dato» er bevidst fagsprog.
    Kilde: 12f «BB-271», «BB-272». Hjem: `document-output-contract.md` A6.
36. **Angivet månedsløn og angivet dagsløn har hver sit sæt «baseret på»- og datofelter.** Et skift starter forfra,
    fordi det betyder en anden metode. Afvist: fælles felter.
    Kilde: 12f «BB-273». Hjem: EOS §14 eller IFB.
37. **Afvist: at varsle ved indsættelse, når et fortegn eller tusindtalspunktum tavst fjernes.** Indsættelse følger
    tastning (NY-12c-2).
    Kilde: 12c NY-12c-2; STATUS l. 24. Hjem: `form-contract.md` §8.2 (som afvist ønske).

### Ansættelsesforhold (12g)

38. **Navngivning af kort i fejlboksen:**
    - Fejlboksens link navngiver kortet («Lønindkomst -> Ansættelsesforhold 2») kun ved flere kort. Ved ét kort
      står der blot «Lønindkomst», og kortnavnet sættes ikke foran beskeden.
    - Et unavngivet kort hedder «Ansættelsesforhold N» (positionen) overalt.
    - Et rødt felt på kortet giver sin egen linje med feltnavn og link.
    - Er beregningen spærret, viser sammendraget de indtastede TAF-perioder.

    Kilde: 12g «BB-277», «BB-278», «BB-279». Hjem: `error-contract.md` §9 og TAF-dom.
39. **«Sidste dag i ansættelsesforholdet» må gerne ligge før skaden.** Er skadelidte samtidig angivet som ansat på
    skadedatoen, er det en rød, blokerende fejl. «Sidste arbejdsdag» betyder det samme, og feltets betegnelse
    bruges overalt.
    Kilde: 12g «BB-283». Kun i test: `ansaettelsesforholdSatserOgDatoer.test.ts`. Hjem: EOS §14 eller TAF-dom.
40. **Bilaget «SH-dage» medtager beregningsperioden, når grundlaget opgøres i arbejdsdage.**
    Kilde: 12g «BB-280». Hjem: TAF-dom §PDF.
41. **Kortets handlinger og hjælpetekster:**
    - «Tilføj ansættelsesforhold» sker uden dialog og ruller det nye kort frem; Ctrl+Z fortryder.
    - Låste satser har tooltippen «Fastsat af overenskomsten på <dato>».
    - «L:»/«A:» har tooltippen «Lønmodtagerorganisation»/«Arbejdsgiverorganisation».
    - Et hurtigt andet klik på samme plads har ingen virkning på et andet kort (BB-434, BB-437).
    - En tom, filtreret overenskomstliste forklarer sig (BB-435).
    - Sletedialogen viser kortets overskrift (BB-438).

    Kilde: 12g «BB-287», «BB-288»; STATUS l. 23–24. Hjem: `page-component-contract.md` eller
    `critical-action-contract.md` (kortliste).

## B. Varige regler for adfærd og udvikling

1. **Fejlboksen på EO's Beregning («Fejl og advarsler»):**
   - Hver tabelrække giver højst én linje, som navngiver rækken og alle dens mangler og linker til første celle.
     Rækkens navn er beskrivelsen, derefter dato/beløb og til sidst «Øvrigt krav N».
   - En rød celle meldes med sin egen tekst, aldrig som «mangler».
   - Ens linjer foldes kun, når rækkemodellen angiver `summaryDeduplicationGroup` (overlap pr. tabel, fordi hver
     række da har røde celler med modpartens periode).
   - Samme felt må aldrig give to linjer. En blokerende invariant giver knapteksten «Opgørelse kan ikke hentes,
     når der er fejl ovenfor».

   Kilde: 12b «BB-218», «BB-336»; 12c «BB-229»–«BB-231», «BB-332»; 12e «BB-251», «BB-253»; 12f «BB-265». Kun i kode
   og test. Hjem: `docs/architecture/eo-row-evaluation-architecture.md` §12 og `error-contract.md` §9.
2. **En regel, der afhænger af ét felts værdi plus ét valg, vises ved feltet med samme tekst som i boksen.**
   Teksten hentes ét sted, så de to kanaler ikke kan drive fra hinanden.
   Kilde: 12a «BB-207»; 12b «BB-219». Hjem: `error-contract.md` §3.
3. **Brugervendte beskeder henviser til et sted på skærmen med skærmens navn i «»** (fx «Udgift til»).
   Descriptorens `label` er den synlige etiket og bruges både som tilgængeligt navn og i fejltekster.
   Kilde: 12a «BB-211»; 12b «BB-224»; 12c «BB-237»; 12d «BB-243»; 12f «BB-270». Hjem: `mineo-field-pattern.md` og
   `error-contract.md` §3.
4. **En ny blokerende regel eller advarsel ændrer adfærden for ældre `.eo`-filer og skal godkendes særskilt.**
   Ved godkendelse loades filen uændret uden preflight og viser fejlen eller advarslen bagefter. Det bevises med
   den låste 3.14-fil i `e2e/erstatningsopgoerelse-tidligere-filer.spec.ts`.
   Kilde: 12a «BB-334», «BB-335»; 12d «BB-242»; 12f «BB-262», «BB-339», «BB-340». Hjem: `AGENTS.md` (persistensgate)
   og `persistence-contract.md`.
5. **Dokumentfund kontrolleres i både PDF og Word.** En strengfejl kan være synlig i den ene kanal og ikke i den
   anden: HTML og filnavnet kollapser blanktegn. Titler samles af de udfyldte led, ikke ved skabelon-interpolation
   af valgfrie led.
   Kilde: 12a «BB-204». Hjem: `document-output-contract.md` C2.

## C. Åbne punkter

1. **2011-grænsen for midlertidig EET ved erhvervssygdom er ikke dokumenteret.** Afskæringen ved 16-06-2011 læser
   feltet `skadedato`, som ved erhvervssygdom er anmeldelsesdatoen. Koden formulerer det bevidst
   («Skaden er anmeldt før 16. juni 2011», `stamdataCalculations.ts`), men ingen kontrakt eller domænefil siger,
   at anmeldelsesdatoen er den rigtige dato for reglen. Det blev aldrig afprøvet og står som åbent i 12d
   «Dækningshuller». Udvikleren skal bekræfte reglen, og den skal skrives ind i TAF-dom §Periodeafgrænsning.

Alle «Afventer udvikleren»-fund i 12a–12g (NY-12a-1–5, NY-12b-1–4, NY-12c-1–4, BB-425–BB-438) er afgjort ifølge
`STATUS.md` l. 23–24. Der er ingen andre åbne punkter.

---
Undersøgte kandidater: 96. Allerede dækket: 47. Det gælder bl.a. relevans og skjulte felter (EOS §14,
`form-contract.md` §7), satsår (EOS §16), komprimering af gyldigt grundlag, AES-felterne og NY-12a-3/4/5 (IFB
§4.8–4.16) samt S/S-tabellen (IFB §5). Fra TAF-dom: afledte kolonner og tooltip, BB-247, BB-257, BB-238, BB-240,
BB-275 og BB-276. Desuden Store Bededag ved dagsløn (`indskudte-loentillaeg-contract.md` §2a–2b), feriesats
(`feriepenge-begreber-contract.md` §2b), translitteration (`document-output-contract.md` A9), ferietabeller i egen
periode (`periodisering-contract.md`) og engine-throws (EOS §3.4).
