# Brugerblik – Erstatningsopgørelse → Offentlige ydelser (12k)

- Rute/placering: `/erstatningsopgoerelse` → fanen «Offentlige ydelser»: ydelsestabellen, «Tilføj særligt» («Indsæt
  maksimal sygedagpengesats for perioden», «Midlertidigt EET indsættes fra Erhvervsevnetab-siden», «Offentlige ydelser i
  beregningsperioden reguleres») og «Kommentarer» – samt opgørelsens linjer under «Indtægter i erstatningsperioden», bilaget
  «Offentlige ydelser» (`offentligeYdelserSection`) og bilaget «Midlertidig EET» (`renderMidlertidigtEetSection`).
- Gennemgået: 2026-10-29 · commit `bd236954`
- Afgjort og gennemført: 2026-10-29 – ni fund gennemført, BB-359 afvist som overlapregel; fire modsvar og det nye BB-368
  afventer udvikleren (se «Åbne spørgsmål»)
- Afprøvet i: Chrome headless, lyst tema, 1536×864, mod e2e-buildet. 24 sager indlæst gennem «Hent» (krypteret `.eo` bygget
  til formålet på den låste 3.14-testfil), to UI-forløb (sygedagpenge-hjælperen, EET-togglen, sortering, en ugyldig celle,
  kommentarfeltet). Dokumenter hentet som `.pdf` og læst som tekst; feltfejl aflæst gennem automatiseringsbroen.
  **Grundsag** (testfilen «REGULERING-FIKTIV»): skadedato `11-07-2025`, opgørelse nr. 3 lavet `25-09-2026`, «Vedrører
  perioden» `25-05-2026` – `20-09-2026`, TAF `01-08-2025` – `20-09-2026`, beregningsperiode `01-07-2024` – `30-06-2025`
  (komprimeret fra tidligere opgørelse), seks sygedagpengerækker `01-04-2026` – `20-09-2026`. Papiret: «Sygedagpenge
  78.395,00 kr.», kravet `110.044,38 kr.`

## Fladen kort

Fanen samler de offentlige ydelser, skadelidte har fået. Ydelser i erstatningsperioden trækkes fra kravet – én linje pr.
ydelsestype under «Indtægter i erstatningsperioden» – og ydelser i beregningsperioden lægges til før-lønnen og fremskrives.
Ved siden af tabellen kan brugeren indsætte maksimal sygedagpengesats for en periode, hente midlertidigt erhvervsevnetab
direkte fra Erhvervsevnetab-siden og skrive en kommentar, der trykkes i bilaget.

**Fladens bærende iagttagelse er, at det midlertidige EET kan forsvinde helt af opgørelsen uden et ord.** Togglen
«Midlertidigt EET indsættes fra Erhvervsevnetab-siden» viser aldrig, hvad den henter. Er der en almindelig, ikke-blokerende
advarsel på Erhvervsevnetab-siden – fx en procent uden for 10 %-trinnene – fradrages intet; i den målte sag er kravet
`58.387 kr.` for højt, og den eneste linje handler om EET-sidens procent (BB-357, **Kritisk**). Har EET-siden ingen midlertidig
afgørelse, fradrages heller intet, og der er slet ingen linje (BB-358). **Det andet tunge fund er overlap:** to rækker af
samme ydelse for samme dage lægges sammen uden en bemærkning – og sygedagpenge-hjælperen lægger sine rækker oven i dem, der
står (BB-359).

**Beregningerne er ikke vurderet.** Gennemgangen har holdt skærm, boks og papir op mod hinanden og mod programmets egne
løfter.

**Afgrænsning.** Negative rækker og dubletter er afgjort i 12h (BB-289, BB-290) og prøvet igen kun som nabotilfælde.
Bilagsvalgene og forsiden er 12l's, kontrolrækkerne 12m's.

## Fund

### BB-357 – En ikke-blokerende advarsel på Erhvervsevnetab-siden fjerner hele det midlertidige EET fra opgørelsen

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-43--en-advarsel-får-en-import-til-at-give-nul`
- **Prioritet:** **Kritisk**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29. Den udvidede undersøgelse fandt ét
  hul mere, BB-368 nedenfor, som forelægges.
- **Sådan fremprovokeres det:** Grundsagen med «Midlertidigt EET indsættes fra Erhvervsevnetab-siden» slået til og på
  Erhvervsevnetab-siden én afgørelse (afgørelsesdato `15-01-2026`, virkningsdato `01-08-2025`, Midlertidig, ASL-årsløn
  `450.000 kr.`), skiftevis med:
  1. EET `50 %` (sammenligningsgrundlaget).
  2. EET `55 %`.
  3. EET `50 %` og en endelig afgørelse `01-12-2025` på `50 %` før den midlertidige.
- **Det sker:** I 1 trykker papiret «Midlertidigt EET 58.387,00 kr.», kravet er `51.657,38 kr.`, og bilaget «Midlertidig
  EET» viser perioden. I 2 og 3 står kun EET-sidens egen advarsel i «Fejl og advarsler» – «Erhvervsevnetab fastsættes i trin
  af 10 % for skader fra 1. juli 2024 (indtastet 55 %).» henholdsvis «Der er angivet en midlertidig afgørelse efter en
  endelig afgørelse.» – med link til «EET oplysninger». Download er aktiv. Papiret har ingen linje «Midlertidigt EET»,
  kravet er `110.044,38 kr.`, og bilaget «Midlertidig EET» mangler, skønt det er valgt. Erhvervsevnetab-siden regner selv
  løbende ydelser af begge afgørelser. Mekanikken: importen opgiver alle perioder, så snart der er én linje fra EET-siden –
  også en advarsel (`midlertidigtEetTransientInjection.ts:58`).
- **Det er uhensigtsmæssigt fordi:** Kravet bliver `58.387 kr.` for højt, og intet på skærmen eller papiret siger, at
  fradraget er faldet bort. Advarslen læses med god grund som en bemærkning om EET-siden – den siger det samme på
  EET-siden, hvor ydelsen ER regnet. Udvikleren har tidligere fastslået, at programmet regner på en procent uden for
  trinnene (BB-173), og at en senere midlertidig afgørelse kan fortrænge en endelig (BB-178).
- **Bedre ville være:** En advarsel fra EET-siden følger med som advarsel og stopper ikke importen; fradraget er det
  samme, som EET-siden regner. Kun en fejl stopper importen – og så spærrer den med en linje, der siger følgen: «Midlertidigt
  EET kan ikke hentes fra Erhvervsevnetab-siden: <årsag>» med link til EET-siden.
- **Andre steder det kan gælde:** Forsørgertabs ASL-ydelser stopper ved `issues.length > 0`
  (`forsoergertabAslYdelser.ts:331`, uverificeret, om der kan være advarsler i listen); EET-importens indgang
  `eetImportPort.ts:167`.

**Tilbagemelding**
Enig. Alt i programmet, der medfører risiko for, at beløb, som burde indgå, eller som brugeren forventer vil indgå, men som tavst forsvinder ud, skal betragtes som en alvorlig fejl. Undersøg gerne grundigt og tilbudsgående, om der kunne være nogen andre tilsvarende fejl, og sørg for effektiv sikring, så tavst tab af beløb fra erhvervsevnetab aldrig vil kunne forekomme.

**Gennemført 2026-10-29:** kun en FEJL fra Erhvervsevnetab-siden stopper importen. En advarsel følger med som gul linje,
og fradraget er det, EET-siden selv regner – i sag 2 og 3 trykker papiret nu «Midlertidigt EET», og bilaget står der.
Spærrer en fejl importen, siger linjen følgen først: «Midlertidigt EET kan ikke hentes fra Erhvervsevnetab-siden: der er
en afgørelse uden afgørelsesdato» med link til feltet på EET-siden. Hullet ramte i praksis langt flere sager end
10 %-trinnene: også enhver afgørelse under 15 % og en midlertidig afgørelse efter en endelig gav en advarsel, der opgav
alt (`midlertidigtEetTransientInjection.ts`; unit- og browsertests).

*Sikringen mod tavst tab* er todelt: (1) importen kan kun komme tom tilbage med en blokerende fejl, og (2) kommer den tom
tilbage UDEN fejl, mens EO oplysninger har en midlertidig afgørelse, og TAF-perioden ligger på eller efter dens dato, står
BB-358's gule advarsel. Uanset hvorfor intet hentes, står der altså en linje.

*Den udvidede undersøgelse* gennemgik alle veje, hvor beløb fra Erhvervsevnetab-siden når videre: EO-importen,
forsørgertabets ASL-ydelser (`forsoergertabAslYdelser.ts:331` indeholder kun fejl og spærrer – ikke et fund),
differencekravet, kapitaliseringen og dokumenterne. Ét hul mere er fundet: BB-368.

### BB-358 – «Midlertidigt EET indsættes fra Erhvervsevnetab-siden» viser aldrig, hvad der hentes – og tier, når intet hentes

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-25--gaten-spørger-findes-der-noget-ikke-findes-det-brugeren-bad-om`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29 uden linjen under togglen, sammenlignet med TAF-perioden og kun
  fra afgørelsens dato. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:**
  1. Grundsagen, «Midlertidigt EET-afgørelse» `Ja` på EO oplysninger, togglen slået til, og ingen midlertidig eller delvist
     endelig afgørelse på Erhvervsevnetab-siden.
  2. Slå togglen til i en sag, hvor importen virker (BB-357's sag 1).
- **Det sker:** I 1 er der ingen «Fejl og advarsler»-boks, download er aktiv, papiret har kun «Sygedagpenge», og bilaget
  «Midlertidig EET» udgår tavst, skønt det er valgt. Advarslen «Der er angivet en midlertidig EET-afgørelse men ikke
  indtastet ydelser», som ellers ville melde netop denne tilstand, tier, fordi togglen i sig selv tæller som ydelser. I 2
  ændrer fanen sig ikke: ingen række, intet beløb, ingen linje om antal afgørelser – fradraget ses først i papiret.
- **Det er uhensigtsmæssigt fordi:** Brugeren har bedt programmet om at trække EET fra og får ingen kvittering. Det
  udfald, hvor intet trækkes fra, ser ud præcis som det, hvor fradraget er gjort.
- **Bedre ville være:** Giver togglen ingen perioder i erstatningsperioden, får den gul ring og linjen «Erhvervsevnetab-siden
  har ingen midlertidig afgørelse med ydelser i erstatningsperioden – der fradrages intet midlertidigt EET» med link til
  EET-siden. Overvej desuden én kort linje under togglen, når den virker: «Henter 1 afgørelse (15-01-2026, 50 %)» – uden
  beløb, så BB-226's skel (skærmen viser ikke resultater) holdes.
- **Andre steder det kan gælde:** Bilagsvalget «Midlertidig EET» er aktivt uden noget at trykke (12l).

**Tilbagemelding**
Enig, dog uden linje under togglen. Bemærk, at det er TAF-perioden, som er det relevante at sammenligne med, ikke EO-perioden. Jeg vil også gerne have det som en ikke-blokerende advarsel på eoberegning-siden, hvis togglen er slået til, og der ikke indgår nogen løbende ydelser i TAF-perioden. Jeg forudsætter, at der i forvejen laves kontrol for, at der skal være angivet en midlertidig EET-afgørelse på EOoplysninger, når brugeren vælger at slå togglen med at trække EET ind, og jeg vil have, at der kun advares og gives gul ring om manglende EET-indtræk, hvis TAF-perioden helt eller delvist ligger efter den angivne start-dato for den midlertidige EET-afgørelse (altså, hvis der er angivet en virkningsdato, da denne, og ellers afgørelsesdatoen). Formålet er, at der ikke skal gives advarsler for manglende EET-indtræk for en TAF-periode som ligger før det tidspunkt, hvor de midlertidige EET-ydelser faktisk løber.

**Gennemført 2026-10-29:** henter togglen ingen løbende ydelse i TAF-perioden, får den gul ring med tooltippen
«Erhvervsevnetab-siden har ingen midlertidig afgørelse med ydelser i TAF-perioden – der fradrages intet midlertidigt EET»,
og samme ikke-blokerende linje står i «Fejl og advarsler» på Beregning-fanen med link til «EET oplysninger». Advarslen
kræver, at «Midlertidigt EET-afgørelse» er `Ja` på EO oplysninger, og at TAF-perioden helt eller delvist ligger på eller
efter virkningsdatoen (ellers afgørelsesdatoen). TAF-perioden er den, beregningen trækker fra i – den samme, importens
slutdato udledes af. Ingen linje under togglen.

*Din forudsætning holder:* slår brugeren togglen til uden en midlertidig afgørelse på EO oplysninger, står allerede den
gule linje «Der er indtastet midlertidige EET-ydelser, men ikke angivet en afgørelse» med link til feltet. Den er
ikke-blokerende (BB-240's mønster: afgørelsen er en oplysning, ydelsen en forventning).

*Tidligere gemte filer:* en sag med togglen slået til og en tom import viser den nye gule advarsel efter indlæsning.
Ingen preflight og ingen ændret sagsdata (jf. det bekræftede princip om, at ændringer også gælder ældre filer).

### BB-359 – To rækker af samme ydelse for samme dage lægges sammen uden et ord – også når sygedagpenge-hjælperen indsætter dem

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-23--aggregatet-af-dublerer-tiden-men-ikke-pengene`
- **Prioritet:** **Høj**
- **Beslutning:** **AFVIST** af udvikleren 2026-10-29 som overlapregel; reglen for ens rækker gælder uændret. Modsvar om
  sygedagpenge-hjælperen nedenfor.
- **Sådan fremprovokeres det:**
  1. Grundsagen plus Kontanthjælp `01-06-2026` – `30-06-2026` `10.000`, `01-07-2026` – `31-07-2026` `10.000` og en
     samlerække `01-06-2026` – `31-07-2026` `20.000` (den typiske dobbeltindtastning: månedsrækker og en samlet udbetaling).
  2. Grundsagen; «Indsæt maksimal sygedagpengesats for perioden» `01-06-2026` – `30-06-2026` → «Indsæt».
- **Det sker:** I 1 ingen ring, ingen linje, aktiv download; papiret «Kontanthjælp 40.000,00 kr.» og kravet `70.044,38 kr.`
  mod `90.044,38 kr.` uden samlerækken. I 2 indsættes «01-06-2026 | 30-06-2026 | 22.539,00 | 940,00 | Sygedagpenge» oven i
  de to rækker, der allerede dækker juni (`25-05-2026` – `21-06-2026` og `22-06-2026` – `26-07-2026`), uden en bemærkning.
  Først en ordret gentagelse af indsættelsen giver den gule dublet-advarsel (BB-289).
- **Det er uhensigtsmæssigt fordi:** Beløbet trækkes fra kravet to gange, og intet giver brugeren anledning til at tvivle.
  Hjælperen, der skal gøre indtastningen sikrere, gør fejlen let: den naturlige brug er at «fylde ud» i en tabel, der
  allerede har rækker fra udbetalingsspecifikationerne.
- **Bedre ville være:** Rækker af samme ydelsestype, hvis perioder overlapper, får gul ring på datoerne og linjen «Ydelsen
  Kontanthjælp 01-06-2026 - 31-07-2026 overlapper Ydelsen Kontanthjælp 01-06-2026 - 30-06-2026 – kontrollér, at perioden ikke
  er indtastet to gange» – ikke-blokerende, som dubletterne (udviklerens afgørelse ved BB-289: to rækker for samme dage
  kan være reelle).
- **Andre steder det kan gælde:** Lønindkomstens rækker (12h har kun ordrette dubletter); Årsløns tabel (BB-096).

**Tilbagemelding**
Perioden kan aldrig være den eneste definerende faktor. Det sker meget ofte ved sociale ydelser, at der fx. efterbetales et beløb af samme art for en periode, og at der derved - fuldt berettiget - er to ydelser af samme type for samme periode. Men hvis perioden, ydelserne og beløbene er ens, skal der i samtlige tilfælde gives gul ring med tooltip og advarsel - det er en klar indikation for, at brugeren ved en fejl har dobbeltindtastet den samme ydelse. Samme regel er vist nok allerede implementeret for lønindkomst, hvor kriteret skal være det samme.

**Svar 2026-10-29:** reglen, du beskriver, findes allerede for begge tabeller (BB-289, `tableDuplicateRowDetection.ts`):
gul ring og linje, når periode, ydelsestype og alle beløbsceller er ens. Kriteriet er det samme for lønindkomst. Én
forskel er rettet: en række gemt med ydelsestypens label («Kontanthjælp») og en med nøglen blev ikke set som ens (BB-364).
Der er ingen ny overlapregel.

### BB-360 – Ved TAF «Nej» spærrer en ufærdig ydelsesrække opgørelsen, selv om intet fra fanen bruges – og «Alle» trykker bilaget alligevel

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-32--et-skjult-felt-er-ikke-udfyldt--men-kun-nogle-af-dets-læsere-ved-det`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29 for Offentlige ydelser. Modsvar om
  Lønindkomst nedenfor.
- **Sådan fremprovokeres det:**
  1. «Krav på tabt arbejdsfortjeneste» `Nej`, og en ekstra række `01-06-2026` – `30-06-2026` `5.000` uden ydelsestype.
  2. Samme med en dagpengerække med omvendte datoer.
  3. TAF `Nej` uden ekstra rækker og «Lønindkomst og offentlige ydelser, der indsættes som bilag» `Alle`.
- **Det sker:** I 1 står «Ydelsen 01-06-2026 - 30-06-2026: Ydelsestype er ikke valgt», og «Hent opgørelse» er grå. I 2
  spærrer de røde datoer. Med «Perioden» (standard) bruges intet fra fanen: ingen TAF, intet bilag. I 3 har papiret intet
  TAF-afsnit, men trykker bilaget «Offentlige ydelser» med alle seks sygedagpengerækker (og lønindkomstbilaget).
- **Det er uhensigtsmæssigt fordi:** En opgørelse, der alene handler om svie og smerte, kan ikke hentes på grund af en
  oplysning, den ikke bruger – og omvendt får modtageren i 3 en ydelsesoversigt til et krav, der ikke er rejst. Fanen siger
  ikke, at den er uden betydning ved TAF «Nej».
- **Bedre ville være:** Ved TAF «Nej» står rækkerne urørte, men læses som ikke relevante: de spærrer ikke, trykkes ikke (heller
  ikke med «Alle»), og fanen viser øverst «Der er ikke krav på tabt arbejdsfortjeneste – ydelserne indgår ikke i opgørelsen».
- **Andre steder det kan gælde:** Lønindkomst-fanen ved TAF «Nej» (uverificeret); bilagsvalget med «Alle» (12l).

**Tilbagemelding**
Enig

**Gennemført 2026-10-29:** ved TAF «Nej» (og «Skjul») er fanens felter – ydelsesrækkerne, midlertidigt-EET-togglen og
kommentaren – ikke relevante for nogen læser: de spærrer ikke, trykkes ikke (heller ikke med «Alle»), og togglen kan ikke
længere spærre med «… slutdato mangler». Fanen viser i stedet kun «Der er ikke krav på tabt arbejdsfortjeneste –
ydelserne indgår ikke i opgørelsen.» Rækkerne står gemt og vises igen ved «Ja».

### BB-361 – Anden beløbskolonne hedder «Tillæg» på skærmen, men «Ydelse (2)» i «Fejl og advarsler» og bilaget

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29 med ét ords afvigelse i tooltippen –
  se modsvaret.
- **Sådan fremprovokeres det:** Se kolonneoverskrifterne; skriv `12x` i «Tillæg» på første række; hent opgørelsen.
- **Det sker:** Overskrifterne er «Fra dato | Til dato | Ydelse | Tillæg | …», uden informationsikon. Boksen skriver «Ydelsen
  Sygedagpenge 01-04-2026 - 26-04-2026: Ydelse (2) – ugyldig værdi», og bilaget har kolonnerne «Fra-dato Til-dato Ydelse
  Ydelse (2) I alt». Teksten «Opdelingen af ydelser er rent visuel - værdierne lægges sammen i beregningen» findes i koden
  (`offentligeYdelserTableColumns.ts:21`), men bruges kun af en test.
- **Det er uhensigtsmæssigt fordi:** Brugeren leder efter en kolonne «Ydelse (2)», der ikke står på skærmen, og «Tillæg» lover
  en betydning, kolonnen ikke har. Udvikleren afgjorde ved BB-116 for «Løn»/«Løn (2)», at de to kolonner skal hedde det samme
  med et informationsikon på den anden – fanen her følger ikke afgørelsen.
- **Bedre ville være:** Skærmen kalder kolonnen «Ydelse (2)» med informationsikonet og forklaringen (med en-dash: «… rent
  visuel – værdierne …»), som «Løn (2)». Bemærk: sygedagpenge-hjælperen lægger ATP/OP i kolonnen, så navnet «Tillæg» har
  en historie; afgørelsen er udviklerens.
- **Andre steder det kan gælde:** Datokolonnerne hedder «Fra dato» på skærmen og «Fra-dato» i bilaget (for småt til eget fund).

**Tilbagemelding**
For offentlige ydelser vil jeg gerne have, at der konsekvent benyttes betegnelserne Ydelse og Tillæg, og at der på tillæg-overskriften indsættes et info-ikon tilsvarende det på lønindkomst, og med samme tooltip meddelelse, altså "Opdelingen af løn er rent visuel –
værdierne lægges sammen i beregningen".

Alene for din forståelses skyld, skal Ydelse og Tillæg behandles på samme måde som Løn(1) og Løn(2) i lønindkomst, altså i den forstand at det er en rent visuelt adskillelse, og de lægges blot sammen. Årsagen til, at de har forskellige navne, beror alene på, at en lønseddel næste altid vil indeholde mange lønposter, hvorimod sociale ydelser typisk kun indeholder én ydelse og dertil nogle specifikke associerede tillæg, så navneforskellen skal opretholdes, selvom de beregningsteknisk behandles ens.

**Gennemført 2026-10-29:** kolonnen hedder «Tillæg» på skærmen, i «Fejl og advarsler» («Ydelsen Sygedagpenge … : Tillæg –
ugyldig værdi») og i bilaget («Fra-dato Til-dato Ydelse Tillæg I alt»). «Tillæg» har informationsikonet. Navnenes
begrundelse står i koden og i `form-contract.md`.

### BB-362 – Alle ydelsesrækker er låst til sygedagpengesatsernes dækning, 03-01-2005 – 03-01-2027

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-24--feltets-grænse-er-sat-af-feltets-art-ikke-af-det-tal-det-trækkes-fra`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Førtidspension `01-01-2027` – `31-01-2027` `10.000`; en anden `01-12-2004` – `31-12-2004`.
- **Det sker:** Til-datoen `31-01-2027` er rød med «Dato skal være mellem 03-01-2005 og 03-01-2027», den anden række har to
  røde datoer, og opgørelsen spærres. Grænsen er sygedagpengesatsernes dækning (`dateRanges.ts:436-451`) og gælder alle 15
  ydelsestyper. TAF-perioden går til dags dato, «Vedrører perioden» fra `01-01-2005` til årets udgang næste år.
- **Det er uhensigtsmæssigt fordi:** Fra `04-01-2027` kan en sag, hvis TAF-periode når ind i 2027, ikke få en eneste ydelse
  registreret for de dage, før satstabellen er udvidet i koden – og opgørelsen kan ikke hentes med rækken. Kontanthjælp og
  førtidspension har intet med sygedagpengesatser at gøre, og beskeden siger ikke, hvorfor 03-01-2027 er grænsen.
- **Bedre ville være:** Ydelsesrækkerne følger sagens egen ramme (som TAF-perioderne); kun sygedagpenge-hjælperens to
  datofelter bindes til satsdækningen.
- **Andre steder det kan gælde:** Ingen kendte; mekanismen er én fælles grænsekonfiguration for tabellen og hjælperen.

**Tilbagemelding**
Enig.

**Gennemført 2026-10-29:** ydelsesrækkernes datoer følger sagens ydre ramme (`01-01-2005` – årets udgang næste år) som
lønrækkerne; `01-01-2027` – `31-01-2027` tages imod. Kun sygedagpenge-hjælperens to datofelter er bundet til
satsdækningen. Tidligere gemte filer kan kun få færre røde felter.

### BB-363 – Kommentaren trykkes kun nederst i bilaget – uden bilag eller uden rækker forsvinder den tavst

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-12--et-valg-hvis-virkning-hverken-kan-ses-nu-eller-findes-senere`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:**
  1. Kommentar «ATP er trukket fra.», bilagsvalget «Offentlige ydelser» fravalgt.
  2. Ingen ydelsesrækker, kommentar «Ingen ydelser modtaget.»
- **Det sker:** I begge tilfælde findes kommentaren intetsteds i papiret. Skærmen siger ikke, hvor kommentaren trykkes.
- **Det er uhensigtsmæssigt fordi:** Tilfælde 2 er den mest naturlige brug af feltet – at forklare, hvorfor tabellen er tom –
  og netop dér udelades kommentaren. Brugeren opdager det kun ved at læse papiret igennem.
- **Bedre ville være:** Kommentaren trykkes altid: i bilaget, når det trykkes, og ellers under «Indtægter i
  erstatningsperioden». Overskriften «Kommentarer» får et informationsikon, der siger hvor.
- **Andre steder det kan gælde:** Øvrige kommentarfelter, der trykkes i et bilag (uverificeret).

**Tilbagemelding**
Enig

**Gennemført 2026-10-29:** kommentaren trykkes altid præcis ét sted: nederst i bilaget «Offentlige ydelser», når det
trykkes, og ellers i opgørelsen under «Indtægter i erstatningsperioden» med overskriften «Kommentarer til offentlige
ydelser» – også når tabellen er tom. Overskriften «Kommentarer» på fanen har et informationsikon, der siger hvor. Ved TAF
«Nej» trykkes den ikke (BB-360).

### BB-364 – En ydelsestype gemt med sit visningsnavn står som tom, regnes med og fanges ikke af dublet-kontrollen eller EET-togglen

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-14--en-anden-fortolkningsvej-ved-siden-af-tastningen`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29, også følgen for tidligere gemte `.eo`-filer. **GENNEMFØRT**
  2026-10-29.
- **Sådan fremprovokeres det:** Programmet forstår begge former, fordi tidligere gemte sager kan bære visningsnavnet
  (`resolveYdelsestype` i `ydelsestyper.ts`, brugerfund 2026-09-17). En sag med:
  1. Kontanthjælp `01-06-2026` – `30-06-2026` `9.000` gemt som «Kontanthjælp», og samme række gemt som `kontanthjaelp`.
  2. EET-togglen slået til og en manuel række `01-06-2026` – `30-06-2026` `15.000` gemt som «Midlertidigt EET».
- **Det sker:** I 1 viser første række en tom ydelsestype («Vælg...») og tomme «Periodisering», «Antal dage» og «Ydelse per
  dag», uden ring og uden linje; dublet-advarslen udebliver. Papiret regner begge: «Kontanthjælp 18.000,00 kr.» og
  kontanthjælpsforbeholdet. I 2 står rækken med tom type; togglen har ikke slettet den, beregningen bruger den ikke
  (fradraget er uændret `58.387,00 kr.`), men bilaget «Offentlige ydelser» trykker den under «Midlertidigt EET» med
  `15.000,00`.
- **Det er uhensigtsmæssigt fordi:** Skærmen siger «ingen type valgt» om en række, papiret trækker fra – og i 2 trykker
  bilaget en ydelse, der ikke er trukket fra.
- **Bedre ville være:** Visningsnavnet forstås som ydelsestypen alle steder: cellen viser «Kontanthjælp», kolonnerne udfyldes,
  dublet-kontrollen og togglens sletning ser rækken. Filen ændres ikke. Følgen for en tidligere gemt fil, der rammes: en gul
  dublet-advarsel kan dukke op efter indlæsning.
- **Andre steder det kan gælde:** Sortering og forslag (autofill) på ydelsestype; statuslinjens gruppering (kildeaflæst).

**Tilbagemelding**
Enig

**Gennemført 2026-10-29:** en ydelsestype gemt med sin label forstås som typen alle steder: cellen viser «Kontanthjælp»,
dagkolonnerne udfyldes, og dublet-kontrollen, sorteringen, forslagene, statuslinjen og bilaget ser samme type.
Midlertidigt-EET-togglen sletter (efter bekræftelse) også en manuel række gemt som «Midlertidigt EET», og den trykkes ikke
længere i bilaget. Filen ændres ikke; først et nyt valg i cellen skriver nøglen.

### BB-365 – En feriepengerække i en weekend viser tomme dagkolonner, men regnes fuldt med

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29, ensrettet med lønindkomsten.
- **Sådan fremprovokeres det:** Feriepenge `06-06-2026` – `07-06-2026` (lørdag–søndag) `3.000`.
- **Det sker:** «Periodisering» Arbejdsdage, «Antal dage» og «Ydelse per dag» tomme, ingen linje. Papiret: «Feriepenge
  3.000,00 kr.», og bilaget trykker rækken.
- **Det er uhensigtsmæssigt fordi:** Tomme dagkolonner betyder ellers, at rækken ikke regnes (manglende type); her regnes den
  fuldt med, og perioden er næsten sikkert en tastefejl.
- **Bedre ville være:** Gul ring på datoerne: «Perioden indeholder ingen arbejdsdage – kontrollér datoerne. Beløbet
  medregnes i perioden.»
- **Andre steder det kan gælde:** Sygedagpenge (samme periodisering).

**Tilbagemelding**
Enig. Og kontroller gerne alle steder i programmet, hvor problemet kunne være aktuelt. Jeg mener, at vi har behandlet det før. Sørg for at det håndteres ensartet i det omfang, det er relevant.

**Gennemført 2026-10-29:** rækken viser nu de dage, beregningen fordeler på («Antal dage» `2`, «Ydelse per dag»
`1.500,00 kr.`), og datoerne får gul ring med «Perioden indeholder ingen arbejdsdage – kontrollér datoerne. Beløbet
medregnes i perioden.» samt en linje i «Fejl og advarsler». Gælder både feriepenge og sygedagpenge.

*Hele programmet er gennemgået.* Du huskede rigtigt: lønindkomsten fik samme fald-tilbage i BB-292, og TAF-perioderne
advarer siden BB-257. Status nu:

- **TAF-perioder:** gul ring og linje (uændret).
- **Lønindkomst** (TAF i arbejdsdage): havde kun linjen og ingen markering i tabellen. Har nu også gul ring på periodens
  celler – samme tekst som før.
- **Offentlige ydelser:** som ovenfor (ny).
- **Beregningsperioden og sygeferiegodtgørelsens referenceperiode:** en periode uden arbejdsdage er en rød fejl, fordi der
  dér ikke kan regnes en dagsats – bevidst forskelligt og uændret.

### BB-366 – Sygedagpenge-hjælperens omvendte periode markerer kun til-feltet og uden datoen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-07--parvise-grænser-begge-felter-markeres-hver-med-sin-egen-udvej`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Hjælperens «Fra-dato» `30-06-2026`, derefter «Til-dato» `01-06-2026`.
- **Det sker:** Kun til-feltet er rødt med «Til-dato skal være efter fra-dato»; fra-feltet er ikke rødt, og «Indsæt» er
  grå. Tabellens egne datoer markerer begge med datoen: «Fra-dato skal være før til-dato (01-06-2026)» og «Til-dato skal være
  efter fra-dato (30-06-2026)».
- **Det er uhensigtsmæssigt fordi:** To datopar på samme fane siger det samme forskelligt; brugeren, der har tastet fra-datoen
  forkert, får kun at vide, at til-datoen er gal.
- **Bedre ville være:** Hjælperen markerer begge felter med tabellens to tekster.
- **Andre steder det kan gælde:** Andre transiente datopar (`TransientDateInput` med `fraTilRole`), uverificeret.

**Tilbagemelding**
Enig

**Gennemført 2026-10-29:** begge hjælperfelter bliver røde med tabellens tekster – «Fra-dato skal være før til-dato
(01-06-2026)» og «Til-dato skal være efter fra-dato (30-06-2026)» – og «Indsæt» er grå. Feltets egne fejl (format,
satsdækning) har forrang.

### BB-367 – «Midlertidigt EET» og «Midlertidig EET» om samme ting, og bilaget har ingen sum

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-01--kontekstuelle-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** BB-357's sag 1.
- **Det sker:** Ydelsestypen, togglen og fradragslinjen hedder «Midlertidigt EET», bilaget og bilagsvalget «Midlertidig EET».
  Bilaget har en række pr. periode under hver afgørelse, men ingen «I alt» (kildeaflæst, `offentligeYdelserSection.ts:211-275`),
  skønt fradragslinjen er bilagets sum.
- **Det er uhensigtsmæssigt fordi:** Læseren kan ikke se, at linjen og bilaget er det samme, og med to afgørelser skal han
  selv lægge sammen for at genfinde fradraget.
- **Bedre ville være:** «Midlertidigt EET» overalt, og bilaget slutter med «I alt», når det har mere end én række.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig.

**Gennemført 2026-10-29:** bilaget og bilagsvalget hedder «Midlertidigt EET». Har bilaget mere end én række, slutter det
med «I alt» – på tværs af afgørelserne, så summen er fradragslinjen. («Midlertidig EET-afgørelse» på EO oplysninger og i
TAF-afgrænsningen bevares: dér bøjes efter «afgørelse».)

## Overvejet uden fund

- **Ufærdige rækker** giver præcise linjer med rækkens navn og link, uden rød ring (BB-274/BB-291's form): «Ydelsesrække 7:
  Dato er ikke angivet», «Ydelsen 01-06-2026 - 30-06-2026: Ydelsestype er ikke valgt», «Ydelsesrække 9: Dato er ikke angivet;
  Ydelsestype er ikke valgt». Periode og type uden beløb er gul («Beløb er ikke angivet») og spærrer ikke.
- **Omvendte datoer i tabellen** markerer begge celler med hver sin tekst (M-07 bestået).
- **Dubletter** (BB-289) virker, også for hjælperens anden indsættelse; **negative rækker** (BB-290) er ikke prøvet igen.
- **Beløb 0** tages imod, vises som `0,00 kr.` pr. dag, regnes ikke og trykkes med `0,00` i bilaget – en oplysning, ikke et
  fravær (M-13); ikke et fund.
- **Reguleringstogglen:** `Ja` giver «med statslig regulering per 1. januar», bilaget «Regulering af offentlige ydelser» og
  forventet indkomst `689.272,49 kr.`; `Nej` giver «uden …» og `688.232,49 kr.` Skjult ved TAF «Nej»; nedtonet med
  forklarende tooltip, når ingen ydelse ligger i beregningsperioden (dækket af `offentlige-ydelser-regulering-inaktiv.spec.ts`).
- **M-37's kandidat (reguleringssatserne):** en manglende sats spærrer med «Regulering af offentlige ydelser kan ikke
  beregnes, fordi der mangler reguleringssats for 2027.» – ikke en forekomst. **M-36's kandidater** er dækket af BB-258/BB-290
  (en samlet negativ ydelse spærrer, så fremskrivningens nul-klampning ikke kan nås).
- **EET-togglens dialog:** «Annuller» lader togglen stå fra og giver fokus tilbage; «Ja, slet og aktivér» sletter den manuelle
  række, og ét Ctrl+Z bringer både rækken og togglen tilbage.
- **Sygedagpenge-hjælperen** indsætter én række pr. satsår med udtrykkene `4*5085+2199` og `4*(53*2+106)+23*2+46`, rydder
  datoerne og giver fokus til «Fra-dato». Dækningsbeskeden «… Opdatér sygedagpengesatserne i koden …» kan ikke nås, fordi
  datofelterne har samme grænser (kildeaflæst).
- **Rækkenavne efter sortering:** sorteringen gemmes som rækkefølge, så «Ydelsesrække 1» er den første synlige række.
- **Kommentarfeltet** stopper ved 512 tegn uden besked – programmets regel (M-04) – og 512 tegn kan læses i feltets fire linjer.
- **Bilagets «Perioden»** trykker kun rækker, der rører en periode; rækken før «Vedrører perioden» udgår.
- **Konsollen** var tavs i alle forløb.

## Henvisninger til andre bidder

- **12l:** bilagsvalget «Midlertidig EET» er aktivt, når der intet er at trykke (BB-358); «Alle» trykker ydelsesbilaget ved TAF
  «Nej» (BB-360).
- **12m:** kontroltabellens integritetslinjer nævner rækkens interne id («Offentlig ydelse (række …)»), kildeaflæst.

## Dækningshuller

- **Browsere og tema:** kun Chrome headless, lyst tema, 1536×864. M-09 ikke målt.
- **Dokumentkanal:** kun PDF læst som tekst; Word ikke hentet.
- **Tidligere gemte filer:** BB-364 bygger på programmets egen oplysning om, at ældre filer kan bære visningsnavnet; der er
  ikke indlæst en arkiveret fil med den form.
- **Midlertidigt EET:** flere afgørelser, «Delvist endelig» og en EET-fejl (frem for advarsel) er ikke målt; bilagets manglende
  sum er kildeaflæst.
- **Sygedagpenge-hjælperen** hen over et satsårsskifte og SH-dage er ikke målt.
- **Gem/Hent-rundtur**, tastaturrækkefølge og undo/redo efter hjælperens indsættelse er ikke afprøvet.
