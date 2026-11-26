# Udtræk 4 – Brugerblik EO 12h–12m (indtægt, lønudvikling, SFGG, ydelser, Beregning, kontrolfaner)

Kilder: `docs/testing/brugerblik/erstatningsopgoerelse-12h.md` … `-12m.md`. Kun punkter, der mangler eller er
ufuldstændige i `src/contracts/`, `docs/architecture/`, `docs/domain/` og `AGENTS.md`. «Kun i kode/test» = reglen
findes i kode/test, men ikke i et dokument. Allerede dækket (udeladt): negative rækker og samlet negativ kilde,
delvise rækker under bilaget, ti-gange-advarslen (kort), identiske rækker (kort), sortering uden undo-trin,
Ydelse/Tillæg-navnene, SFGG-referenceperiodens frihed og skadedato-princippet, 4-månedersloftet før 2015,
seksmånedersadvarslen, sygeløn-togglens advarsel, fraværsfeltets enhed og loft (minus én), EET-importen (kun fejl
stopper, BB-358-advarslens betingelser), TAF-dokumenterne uafhængige af S/S og øvrige krav, kontrolfanerne som passivt
kontrolmiddel og TAF-afskæringen i kontroltabellen, paste/division med 0/autofill (input-field-behavior-contract).

## A. Udviklerens afgørelser (UI/UX og beregning)

1. **Identiske indtægtsrækker er aldrig røde eller spærrende – også på Årsløn.** Rækker, der er ens i periode, (ydelsestype)
   og alle beløb, giver gul ring og advarsel; dobbelt løn for samme periode kan være reel. Årsløn: gul ring og linje i
   sidens «Advarsler» (afløste rød/spærrende). Kilde: 12h BB-289. Hjem: `aarsloen-contract.md` (ny §Rækkeadvarsler) +
   præcisering i `docs/domain/taf/tabt-arbejdsfortjeneste.md` («aldrig rød»).
2. **Overlap og samme periode med forskellige beløb advares ikke (afvist overlapregel).** To rækker af samme type for
   samme dage er lovlige (efterbetalinger, to lønsedler); kun ordrette dubletter advares. Må ikke genforeslås.
   Kilde: 12h «Overvejet uden fund» (BB-096), 12k BB-359. Hjem: `tabt-arbejdsfortjeneste.md` ved «Identiske rækker».
3. **Ti-gange-advarslens detaljer og afvist «ti gange mindre».** Gruppe: Lønindkomst pr. ansættelsesforhold og periode
   (beregnings-, erstatnings-, øvrige), ydelser pr. type og periode, Årsløn hele tabellen; måned = Samlet løn, uge/dato/
   ydelser = beløb pr. kalenderdag; kræver mindst tre andre rækker; rækker under en uge, 0 kr. og negative vurderes ikke og
   indgår ikke i medianen. Ingen advarsel for små beløb (efterreguleringer, korte perioder giver falske positiver).
   Kilde: 12h BB-297. Hjem: `tabt-arbejdsfortjeneste.md` («Usandsynligt høje beløb») + `aarsloen-contract.md`. Kun i kode: `tableAmountOutlierDetection.ts`.
4. **Fremtidig lønperiode: gul ring, men ikke den igangværende måned** (lønsedler udstedes ofte forud). Uge/dato: den celle,
   der ligger efter dags dato. Gælder EO og Årsløn; spærrer intet. Kilde: 12h BB-298. Hjem: `tabt-arbejdsfortjeneste.md`
   §Indtægtsrækker + `aarsloen-contract.md`.
5. **Skærmens sortering er ren visning; dokumenterne trykker altid kronologisk.** «Måned» sorterer på månedsnummer uden
   at indfortolke år (bevidst, ingen skjult regel). Lønindkomst-bilaget, ydelsesbilaget og Årsløns dokument sorteres efter
   periodens start/slut; rækker med samme periode beholder tabellens orden. Kilde: 12h BB-294. Hjem:
   `document-output-contract.md` (ny regel om rækkefølge) – sorteringens persistens står i `undo-redo-contract.md` §1.
6. **Bilagstabeller indeholder kun deres værdier.** Ingen periodeoverskrifter, «I alt» eller «heraf»-linjer i
   Lønindkomst-/ydelsesbilagets tabeller; forklaring af delvise rækker står som én kort linje pr. række under tabellen og
   kun når relevant (kun trykte rækker, kun delvis andel, erstatningsperioden kun ved TAF-krav og efter beregningens
   TAF-perioder, beregningsperioden ikke når udregningen er komprimeret, ikke 0 kr.-rækker eller importeret midlertidigt
   EET). Kilde: 12h BB-293. Hjem: `tabt-arbejdsfortjeneste.md` (udvid punktet) eller `document-output-contract.md`.
7. **Afledte kolonners tooltips er afvist; forklaringslinjen om månedens satser fjernet.** Kolonnenavne ensrettes kun,
   hvor det ikke giver bredere kolonne eller flere ombrydninger; manuel ombrydning bevares. «Feriepenge m.v.» og
   «Arbejdsgivers pensionsbidrag» i beregningsgrundlaget er bevidst udskrevne former. Kilde: 12h BB-299 (BB-100 afvist).
   Hjem: `document-format-contract.md` (kolonnenavne) + `aarsloen-contract.md` (ingen tooltips). Delvist i TAF-dok l. 155–159.
8. **Skift af «Løn indtastes som» bevarer værdierne uden dialog** (afvist på Årsløn, gælder også EO). Kilde: 12h «Overvejet»
   (BB-105). Hjem: `form-contract.md` §7 (bevarede skjulte værdier) – bekræft at EO-tabellen er nævnt.
9. **«Ansættelse» kan aldrig være tom; Månedsløn er standard.** Ældre `.eo` med tom værdi indlæses som Månedsløn uden
   advarsel (udtrykkeligt godkendt ændret load-værdi 2026-10-30). Kilde: 12i BB-300. Hjem: `schema-evolution.md` (godkendt
   load-ændring) + `form-contract.md`. Kun i kode/test.
10. **Skjulte satsfelter og før-lønsperiode bruges ikke.** Ved «Tillæg angives som: Beløb» indgår de skjulte procentsatser
    hverken i overenskomstregulering eller SFGG-pension; ved TAF «Nej/Skjul» bruges «Periode til beregning af før-løn»
    ikke (spærrer ikke; bilaget slår ikke overenskomstsatser op på dens slutdato). Kilde: 12i BB-301. Hjem:
    `eo-snapshot-contract.md` §14 «Aktuelle relevans-regler» (mangler begge).
11. **Manuel lønudviklings «udløb» er en gul advarsel.** Sidste række + 12 måneder + Indstillingernes tolerance; derefter
    gul ring på sidste rækkes dato og linje «… lønnen er regnet uændret frem til …»; beregningen bruger sidste rækkes løn.
    Gælder begge manuelle former. Kilde: 12i BB-302. Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md` (regulering) eller
    `eo-snapshot-contract.md` §15. Kun i kode.
12. **Tom manuel tabel: Manuel procentsats spærrer, Manuelt angivet spærrer bevidst ikke.** Ved Manuelt angivet er
    basisrækken brugerens løn, og formen kan være vejen til Store Bededagstillæg på uændret løn (godkendt kompromis).
    Kilde: 12i BB-303. Hjem: `eo-snapshot-contract.md` §15. Kun i kode.
13. **Samme dato to gange i en manuel reguleringstabel er rød og spærrende** – bevidst modsat indtægtstabellerne (en løn
    kan ikke reguleres til to værdier samme dag). De to manuelle former deler regler (`manualRegulationIssues.ts`).
    Kilde: 12i BB-311. Hjem: `eo-snapshot-contract.md` §15.
14. **Ingen automatisk udfyldning i manuelle reguleringstabeller** (heller ikke feriegodtgørelse); brugeren skal selv
    taste hver regulering. Pladsholderen «0,00 %»/«0,00 kr.» bevares (et bart «%»/«kr.» er afvist). Kilde: 12i BB-312.
    Hjem: `eo-snapshot-contract.md` §15 + `input-field-behavior-contract.md` (pladsholderform).
15. **Rimelighedsadvarsler i lønudviklingen (gule, spærrer ikke):** procentsats over 10 % pr. række; grundløn over ti gange
    forrige række (datoorden); forhøjet grundløn omregnet til trinnets enhed større end trinlønnen; anciennitetstillæg
    omregnet større end grundlønnen; manuel SFGG-dagssats over den registrerede dagløn. Kilde: 12i BB-313, BB-446, 12j BB-450.
    Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md` + `sygeferiegodtgoerelse.md`. Kun i kode (anciennitet delvist i eo-snapshot).
16. **Anciennitetstillæg:** slået til uden dato/sats spærrer med linje og link, uden rød ring; dato før reguleringsdatoen er
    rød feltfejl; dato efter erstatningsperioden gul («indgår ikke»); blokken vises kun ved Overenskomst. Kilde: 12i BB-304/305.
    Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md`.
17. **Privat overenskomst før første satsperiode giver én linje** – «… har ingen satser før X – vælg en senere
    reguleringsdato» med link til «Vælg overenskomst» (eller rød ring på særlig fra-dato); lønudviklingens dækningslinje
    undertrykkes. Kilde: 12i BB-306. Hjem: `tabt-arbejdsfortjeneste.md` l. ~150 (tilføj undertrykkelsen og linkmålet).
18. **«Løn på helligdage» under angivet løn vises og læses kun ved Overenskomst og Manuelt angivet.** Kilde: 12i BB-315.
    Hjem: `eo-snapshot-contract.md` §14.
19. **KRL Satstabeller viser alle fire tabeller** med den anvendte fremhævet «(anvendt)»; alle tre satsdokumenter ældste
    først (forslag om kun den valgte afvist). Kilde: 12i BB-317. Hjem: `document-output-contract.md`.
20. **Talformer i opgørelsen:** procenter med to decimaler, beløb med øre (også i omregninger); bevidst undtagelse:
    offentlige ydelsers og KRL's reguleringsprocent med kildens fire decimaler. Kilde: 12i BB-318, 12j BB-328. Hjem:
    `document-format-contract.md`.
21. **Reguleringssætningen beskriver retningen:** «… reguleret efter lønudviklingen før og efter denne dato», når dele af
    perioden ligger før reguleringsdatoen; «Opgøres på baggrund af lønnen …» uden regulering. Kilde: 12i BB-314. Hjem:
    `eo-snapshot-contract.md` §15 (dokumentordlyd). Kun i kode.
22. **Løntrin-finderen:** dato starter på reguleringsdatoen; nyeste tabel navngives; ens beløb samles («alle grupper») og
    indsætter kun løntrin (gruppen gættes ikke); «55+» kan ikke indsættes; indsættelse spærres med tooltip, når opslagets
    løntype afviger fra sagens «Ansættelse» (sagens løntype ændres aldrig); resultater ryddes ved ændret dato/løn/løntype;
    begge indgange husker beløb/dato/løntype pr. nøgle indtil «Slet alt»; knappernes tilgængelige navn indeholder trin, gruppe,
    beløb; ét Ctrl+Z fortryder indsættelsen. Kilde: 12i BB-310, BB-444/445/448. Hjem: `form-contract.md` (transiente
    hjælpere, l. ~461). Kun i kode/test.
23. **Enhedsskift for SFGG-fraværsdage:** et valg, der flytter fraværsdagenes enhed (kalender↔arbejdsdage), kræver
    bekræftelse; tallet omregnes ikke. Enhedsskift via datoer, lønrækker eller sletning af et ansættelsesforhold er bevidst
    uden bekræftelse. Kilde: 12j BB-449 (afgjort 2026-11-24). Hjem: `sygeferiegodtgoerelse.md` (fraværsfeltet). Kun i kode/test.
24. **SFGG-bilag ved manuelle reguleringsformer** siger «fra reguleringsdatoen (…)», når der reguleres derfra; afsnittet
    «Regulering af referencesatsen» trykkes kun, når satsen faktisk ændres. Kilde: 12j BB-327, BB-453. Hjem:
    `sygeferiegodtgoerelse.md` (bilag).
25. **Beskeders feltnavne står i enkelte apostroffer** («'Sygeferiegodtgørelse beregnes ud fra' er ikke valgt»), og
    korte former («SFGG», «EO-perioden») er tilladt, hvor pladsen kræver det – kort tekst prioriteres. «EO-perioden» bruges i
    «Fejl og advarsler», bilagsvalg og tooltips; feltnavne og papiret siger «erstatningsperioden». Kilde: 12j BB-331, 12l BB-375.
    Hjem: `error-contract.md` (udvid skabelonreglen l. 126–129 til alle EO-linjer + ordvalg).
26. **Info-ikoner vurderes felt for felt**, ikke som generel regel; enhed, der afgør tastningen, står som synlig tekst.
    Kilde: 12j BB-323/BB-329. Hjem: `page-component-contract.md` eller `mineo-field-pattern.md`.
27. **Sygedagpenge-hjælperen:** overlap med eksisterende sygedagpenge giver kun en bekræftelsesdialog («Indsæt alligevel»/
    «Annuller») – ingen linje under hjælperen; dialogen kommer kun, når en dag faktisk får beløb fra begge rækker; hjælperens
    datoer er bundet til satsdækningen, tabellens rækker til sagens ydre ramme. Kilde: 12k BB-359, BB-362, BB-456. Hjem:
    `form-contract.md` / `periodisering-contract.md`. Kun i kode/test.
28. **TAF «Nej»/«Skjul»: Lønindkomst- og Offentlige ydelser-fanerne er ikke relevante.** Felterne spærrer ikke, trykkes
    ikke (heller ikke med «Alle»); fanen viser kun forklaringen; røde celler ryddes ved skiftet (fortrydeligt); alle seks
    bilagsvalg inaktive med samme grund. Kilde: 12k BB-360, 12l BB-373. Hjem: `eo-snapshot-contract.md` §14. Kun i kode/test.
29. **Ydelseskommentaren trykkes altid præcis ét sted:** nederst i bilaget, ellers under «Indtægter i erstatningsperioden»
    som «Kommentarer til offentlige ydelser»; ikke ved TAF «Nej». Kilde: 12k BB-363. Hjem: `document-output-contract.md`.
30. **Periode uden arbejdsdage:** gul ring og linje i TAF-perioder, Lønindkomst og Offentlige ydelser (beløbet medregnes,
    dagkolonner viser fald-tilbage-dagene); rød fejl i beregningsperioden og SFGG-referenceperioden (ingen dagsats mulig) –
    bevidst forskel. Kilde: 12k BB-365. Hjem: `periodisering-contract.md` §3A.
31. **«Midlertidigt EET» (med t) er navnet overalt for ydelsen, bilaget og bilagsvalget**; bilaget slutter med «I alt» ved
    mere end én række. «Midlertidig EET-afgørelse» bøjes efter «afgørelse». Kilde: 12k BB-367. Hjem:
    `eo-snapshot-contract.md` §13 (l. 731 siger stadig «Midlertidig EET»-bilaget – forældet).
32. **Tom virkningsdato = afgørelsesdatoen overalt på Erhvervsevnetab-siden; lig afgørelsesdatoen giver aldrig fejl/advarsel.**
    `resolveAslVirkningsdato` er eneste læsning; kolonnens tooltip «Udfyldes kun, hvis den er forskellig fra
    afgørelsesdatoen.»; gælder ikke Forsørgertab. Kilde: 12k BB-368. Hjem: `eet-snapshot-contract.md` +
    `docs/domain/eet/loebende-eet.md`. Kun i kode/test (`eetVirkningsdatoFallback.test.ts`).
33. **Togglen uden «Midlertidigt EET-afgørelse: Ja»:** to gule linjer (intet hentet / afgørelse findes på EET-siden);
    fradraget sker alligevel (valg A); bilagsvalget er inaktivt, når intet hentes. Kildeskiftets bekræftelse siger, når
    intet fradrag hentes. Kilde: 12l BB-372, 12k BB-457. Hjem: `eo-snapshot-contract.md` §13. Kun i kode/test.
34. **Bilagsvalgene gælder også «TAF opreguleret til beregningsåret»; «TAF fordelt på kalenderår» og grafen har aldrig
    bilag** (afvist ændring). Ingen forklaring på «Perioden» og ingen tooltip på den låste «Opgørelse» (begge afvist som
    overforklarende). Kilde: 12l BB-377/378/379. Hjem: `document-output-contract.md`.
35. **TAF-dokumenternes spærregrunde og navne:** tooltip nævner dokumentet; uden TAF-krav/periode bilagsvalgenes ordlyd;
    graf uden indtægt «Der er ingen indtægter at vise i grafen»; knap, titel og fil hedder ens («TAF fordelt på kalenderår»,
    «TAF opreguleret til beregningsåret»). Kilde: 12l BB-370/371/376, BB-461. Hjem: `document-output-contract.md` §A5.
36. **Sammendraget skelner tom tabel og perioder uden for EO-perioden** («Ingen perioder angivet» vs. «Ingen periode i
    EO-perioden»; «Fejl» når en række har fejl, også kun afvist dato); svie/smerte får TAF's advarsel. Kilde: 12l BB-374, BB-462.
    Hjem: `page-component-contract.md` (EO Beregning) eller `eo-snapshot-contract.md`.
37. **Kontrolfanernes form:** sektionsnavne som på EO oplysninger; «Ja»/«Ingen» i stedet for «ok»; etiket = emnet;
    sammentællingens «-»/«-» uden mærke og tomme grupper udeladt (én definition af «tom» for sammenligning og visning);
    uden TAF ingen ansættelsesforholdskolonner; tom-tilstandens forklaring over knappen; stoppet beregning «… kan ikke vises,
    fordi beregningen er stoppet»; «Ugedag»/«Dato» fast ved vandret rul; kun en hel, ordnet erstatningsperiode afgrænser
    tabellen; CSV-kolonner «<ansættelsesforhold> – <kolonne>», filnavn `{journalnr} - Kontroltabel.csv`. Kilde: 12m
    BB-380–389, BB-465/467. Hjem: `eo-snapshot-contract.md` §6 (ny §6.3 Visning). Kun i kode/test.
38. **Ens ansættelsesforholdsnavne bruger Lønindkomsts kortoverskrift** i EO-kontrol, Kontroltabel, CSV, dokumenter og
    bilag. Kilde: 12m BB-466. Hjem: `document-output-contract.md` eller `eo-snapshot-contract.md`. Kun i kode/test.

## B. Varige regler for adfærd og udvikling

1. **Rækkelinjer i «Fejl og advarsler»:** én linje pr. række med fejl/advarsel, alle på én gang, navngivet med rækkens
   periode («Lønrækken 06-2017», «Ydelsen Dagpenge …») eller «Række N», når perioden selv er rød/mangler; cellens egen tekst;
   link blinker netop cellen. En rød værdi kaldes aldrig «ikke angivet». Huller i beregningsperioden meldes ikke, før
   rækkefejlen er rettet. Kilde: 12h BB-291, 12i BB-307. Hjem: `docs/architecture/eo-row-evaluation-architecture.md` +
   `error-contract.md`. Mangler.
2. **Én linje pr. problem:** kontroltabellens rækker står kun i «Fejl og advarsler», når intet felt melder problemet;
   ringen sidder på det felt, brugeren skal ændre. Ens tekster foldes kun ved eksplicit gruppe (Fra+Til i samme
   ansættelsesforhold for SFGG «før første TAF-periode»); ens fejl på forskellige felter/ansættelsesforhold får hver sin
   linje og label efter det felt, linket åbner. Kilde: 12i BB-306, 12j BB-341/345. Hjem: `eo-row-evaluation-architecture.md`.
3. **Den præcise årsag vinder over den generiske følge:** en samlet negativ kilde, en rød eneste indtægtsrække eller en rød
   lønrække i SFGG-referenceperioden giver kun den navngivne fejl – ikke «Ingen indkomst i beregningsperioden»/«ingen løn i
   referenceperioden»; et afvist udtryk giver kun feltets fejl, ikke også «mangler». Kilde: 12h BB-290/BB-442, 12j BB-451/452,
   12i BB-447. Hjem: `error-contract.md` §3 (missing vs. rød) – delvist i `input-architecture.md` l. 214. Kun i kode/test.
4. **Link til «Kontroltabel» tilbydes kun, når kontrolfanerne vises.** Kilde: 12h BB-290. Hjem: `eo-snapshot-contract.md` §6.
5. **Visningen af «Samlet løn» bruger beregningens fald-tilbage-dage**, når rækken ingen arbejdsdage har; en række med kun
   tillæg/pension (Beløb) kommer med i bilaget. Kilde: 12h BB-292. Hjem: `periodisering-contract.md` §3A. Mangler.
6. **Ydelsestype gemt som label forstås som nøglen alle steder** (celle, dagkolonner, dublet, sortering, forslag, status,
   bilag, EET-togglens sletning); filen ændres først ved nyt valg. Kilde: 12k BB-364. Hjem: `eo-snapshot-contract.md` §6.1
   nævner kun kontrollen – udvid. Ufuldstændig.
7. **Afledte tal-kolonner sorterer numerisk** (antal dage, dagsbeløb). Kilde: 12k BB-454. Hjem: `form-contract.md`
   (sortering). Kun i kode/test.
8. **En afvist dato i transiente hjælpere (sygedagpenge-hjælper, løntrin-finder) bliver stående synligt med rød markering**;
   hjælperens «ingen sygedagpengedage»-besked ryddes, når en dato ændres. Kilde: 12k BB-455/458/459. Hjem:
   `input-field-behavior-contract.md` (transiente felter). Kun i kode/test.
9. **Datoordenens tekst siger «på eller før/efter»**, hvor samme dato er tilladt. Kilde: 12h BB-443. Hjem:
   `date-contract.md` – kun i kode/test.

## C. Åbne punkter

1. Sygedagpenge-hjælperens datoer efter sideskift og genindlæsning: bevaret i produktionsbuild 20-11, blanke i
   dev-serveren; seneste produktionsbuild uafklaret. Kilde: 12k «Fornyet gennemgang» → Dækningshuller. Hjem: e2e-backlog/`docs/aabne-beslutninger-og-daekningshuller.md`.
2. Kontroltabellens «Ja (sidste værdi under 6 måneder før)» er kun kildeaflæst, aldrig set i browser; en
   sammentællingsuoverensstemmelse er aldrig fremprovokeret. Kilde: 12m Dækningshuller (begge runder). Hjem: samme.
3. Grafens bortfald af et kort lønudsving mellem to positive niveauer er kun kildeaflæst (dagpengevarianten BB-460 er
   rettet). Kilde: 12l «Fornyet gennemgang» → Dækningshuller. Hjem: samme.

Alle BB-fund i 12h–12m (inkl. BB-439–467) er afgjort/gennemført efter `STATUS.md` l. 30–34; ingen afventer udvikleren.

Undersøgte kandidater: 72; allerede dækket: 22.
