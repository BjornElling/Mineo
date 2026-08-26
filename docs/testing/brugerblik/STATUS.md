# Brugerblik – status

Fremdrift for UI/UX-fornufts- og edge case-gennemgangen. Se `.claude/skills/brugerblik/SKILL.md`.

- **Næste flade:** Forsørgertab (`/forsoergertab`, nr. 10)
- **Næste fund-ID:** BB-117
- **Åbne spørgsmål:** **fire**, alle fra flade 9 – se [aarsloen.md](aarsloen.md).
- **Udestående implementeringer:** **21 fund fra flade 9 afventer brugerens afgørelse** (BB-096–BB-116).
  Ingen udeståender fra flade 1–8.
- **Senest opdateret:** 2026-08-25 (**Årslønsberegning gennemgået: 21 fund, heraf tre Høj, og to nye
  tværgående mønstre M-23/M-24 – de første, der handler om beregningens GRUNDLAG frem for om, hvad
  programmet siger.** De tunge er BB-096 (to identiske lønrækker fordobler årslønnen til
  `793.500,00 kr.`, uden rødt felt eller advarsel), BB-097 (99 feriedage i en måned med 23 hverdage
  giver `-76 hverdage` og årslønnen `0,00 kr.` med aktiv downloadknap) og BB-098 (en lønrække med
  beløbet `0,00 kr.` spærrer dokumentet med «Indtastning mangler», mens intet er rødt – fladen har to
  uenige svar på «er der noget her?»). **Beregningsformlerne selv er kontrolregnet og er i orden** i
  alle tre metoder. **M-22 er efterprøvet og bestået:** BB-080's rettelse navngiver Stamdata på en
  flade uden en eneste stamdataoplysning. Tidligere samme dag: de tre sidste åbne spørgsmål fra
  flade 1–8 afgjort – Varige méns
  datoafstand, Ctrl+S' synlighed og `Gem`s adfærd ved rettet navn. Ingen af dem krævede en
  kodeændring; alle tre fastholdt den bestående adfærd og er nu normative i henholdsvis
  `varigemen-contract.md` §2.11, `keyboard-navigation.md` og `persistence-contract.md` §5. Samtidig er
  de fem udbredte tilbagemeldinger fra flade 8a efterprøvet i koden uden fund af huller. **Hele
  gennemgangen har dermed nul udeståender frem til flade 9.** Tidligere samme dag: Renteberegning →
  **Satser afgjort**: BB-091, BB-092 og BB-093
  gennemført, BB-094 og BB-095 afvist. Beregningen er uændret – begge Høj-fund var brugervendte
  tekster, der navngav forfaldsdatoen, hvor beregningen bruger rentedatoen. Satsvalget og
  terminologien er nu bindende i `renteberegning-contract.md` §2.9–§2.10. **M-15's spor er lukket for
  hele programmet** med BB-094's anden afvisning. **Samme dag er ALLE fem rente- og satsspørgsmål
  afgjort** – lovhenvisningerne rettet, de fire øvrige fastholdt som uændret adfærd og gjort normative
  i §2.11–§2.12 og `varigemen-contract.md` §2.10. Kun tre åbne spørgsmål er tilbage i hele
  gennemgangen, og ingen af dem hører til renteberegning.)

## Flader

Rækkefølgen er fastlagt i `.claude/skills/brugerblik/references/flader.md` (små flader først).
Status: `Ikke startet` · `I gang` · `Gennemgået` · `Afventer bruger`.

| # | Flade | Status | Fund | Dokument |
|---|---|---|---|---|
| 1 | Stamdata | Gennemgået | 10 (BB-001–BB-010) | [stamdata.md](stamdata.md) |
| 2 | Om | Gennemgået | 12 (BB-011–BB-022) | [om.md](om.md) |
| 3 | Indstillinger | Gennemgået | 8 (BB-023–BB-029, BB-036) | [indstillinger.md](indstillinger.md) |
| 4 | Satser | Gennemgået | 6 (BB-030–BB-035) | [satser.md](satser.md) |
| 5 | MinProcesrente | Afgjort | 12 (BB-037–BB-048) | [minprocesrente.md](minprocesrente.md) |
| 6 | Global shell | Afgjort | 13 (BB-049–BB-061) | [globalshell.md](globalshell.md) |
| 7a | Varige mén – Ménberegning | Afgjort | 13 (BB-062–BB-074) | [varigemen.md](varigemen.md) |
| 7b | Varige mén – Satser | Afgjort | 5 (BB-075–BB-079) | [varigemen.md](varigemen.md) |
| 8a | Renteberegning – Beregning | Afgjort | 11 (BB-080–BB-090) | [renteberegning.md](renteberegning.md) |
| 8b | Renteberegning – Satser | Afgjort | 5 (BB-091–BB-095) | [renteberegning.md](renteberegning.md) |
| 9 | Årslønsberegning | Afventer bruger | 21 (BB-096–BB-116) | [aarsloen.md](aarsloen.md) |
| 10 | Forsørgertab | Ikke startet | – | – |
| 11 | Erhvervsevnetab | Ikke startet | – | – |
| 12 | Erstatningsopgørelse | Ikke startet | – | – |

## Årslønsberegning – gennemgået 2026-08-25

**21 fund: tre Høj, ni Mellem, ni Lav.** Det fulde grundlag med målte tal står i
[aarsloen.md](aarsloen.md).

| ID | Kort | Prioritet |
|---|---|---|
| BB-096 | Den samme måned to gange fordobler årslønnen (793.500 mod 396.750 kr.) uden et ord | **Høj** |
| BB-097 | 99 feriedage i en måned med 23 hverdage giver -76 arbejdsdage og årslønnen 0,00 kr. | **Høj** |
| BB-098 | En lønrække med 0,00 kr. spærrer dokumentet med «Indtastning mangler», intet er rødt | **Høj** |
| BB-099 | Tabellens «Samlet løn» regner videre på en rød sats, som om den var tom | Mellem |
| BB-100 | Tillæggenes beregningsgrundlag er usynligt, og de to kolonner følger modsatte regler | Mellem |
| BB-101 | Ved et helt kalenderår nævner hverken skærm eller dokument en «Beregnet årsløn» | Mellem |
| BB-102 | Omregnings-togglen ser aktiv ud, afviser klikket og svarer kun med et blink | Mellem |
| BB-103 | I Beløb-tilstand ignoreres satserne uden besked, men advarslen om dem bliver stående | Mellem |
| BB-104 | De to downloadknapper på siden hedder begge «Download som Word» | Mellem |
| BB-105 | Skift af lønperiode tømmer perioden og spærrer dokumentet, uden at noget peger på hvorfor | Mellem |
| BB-106 | To af Indstillingers tre standardværdier for de samme tre felter når ikke Årsløn | Mellem |
| BB-107 | Samme fejltekst på begge periodeceller, og den siger «dato» om et ugefelt | Mellem |
| BB-108 | Skærm og dokument skriver samme procent og samme formel forskelligt | Lav |
| BB-109 | En sats på 0 % står på skærmen og mangler i dokumentet | Lav |
| BB-110 | Dokumentet skriver «0» for et feriedage-felt, brugeren har ladet stå tomt | Lav |
| BB-111 | Tre kolonner hedder noget andet i dokumentet end på skærmen | Lav |
| BB-112 | Samme antal står to gange med hver sin ordlyd, og linjen kan blive «23 hverdage = 23 hverdage» | Lav |
| BB-113 | Advarslerne kalder «Feriegodtgørelse/-tillæg» for to andre ting | Lav |
| BB-114 | Et ugenummer, der ikke findes i året, får den generiske «ugyldig værdi»-tekst | Lav |
| BB-115 | Lønperioder i fremtiden accepteres uden signal (op til 31-12 i indeværende år) | Lav |
| BB-116 | «Løn» og «Løn (2)» siger ikke, hvad forskellen er | Lav |

**De tre Høj-fund er af en art, programmet ikke har set før, og det er derfor de to nye mønstre er
kommet.** De 22 hidtidige mønstre handler om, hvad programmet *siger, viser, skjuler eller blokerer*.
BB-096 og BB-097 handler om, at det **regner rigtigt på et forkert grundlag** – og i begge tilfælde er
der intet rødt felt, ingen advarsel og en aktiv downloadknap. **M-23** (aggregatet af-dublerer tiden,
men ikke pengene) og **M-24** (feltets grænse er sat af feltets art, ikke af det tal det trækkes fra)
har begge en prøve, der tager under et minut pr. flade og hører på hver flade med en periodetabel:
*indtast den samme række to gange og se, om resultatet fordobles*, henholdsvis *sæt fradraget større
end det, der trækkes fra, og læs linjen*.

**Beregningsformlerne selv er kontrolregnet og er i orden.** Alle tre metoder er efterregnet i
browseren (A: `34.500 / 22 × 253`, B: `33.750 / 21 × 231`, C: `33.750 / 1 × 12` og
`10.000 / 11 × 52,14`), normtallene 261 hverdage, 8 SH-dage, 30/25 feriedage og 52,14 uger holder, og
rækkens to tillægskolonner er efterregnet ciffer for ciffer. **Ingen af de 21 fund handler om en
forkert formel.**

**M-22 er efterprøvet på fladen og BESTÅET.** En fødselsdato på `99-99-9999` gør årslønsdokumentets
knap grå med **«Ret fejlen i Stamdata»**, selv om fladen ikke viser en eneste stamdataoplysning – det
er BB-080's rettelse i drift. SH-dage-bilaget blokerer korrekt ikke, fordi dets brevhoved er slået fra
som standard; at de to knapper så står side om side med samme navn i hver sin tilstand, er BB-104.

**Konsekvenser for de resterende flader – tre prøver at tage med:**
1. **M-23's prøve hører på hver flade med en periodetabel og en `sum / enheder`-brøk.** Indtast den
   samme række to gange. Kandidater: EO's lønindkomst (samme tabelkomponent), forsørgertab, EET.
2. **M-24's prøve hører på hver mellemregning med et fradrag i parentes.** Sæt fradraget større end
   det, der trækkes fra. Se samtidig efter grænser, der er dubleret af et cifferloft og derfor døde.
3. **BB-098's prøve er ny og meget billig: find fladens tomheds-prædikater og hold dem op mod hinanden
   på værdien 0.** Årsløn havde to, der var enige om alt andet end nullet.

**Dækningshuller:** kun Chrome, lyst tema, 1536×864; PDF-kanalen ikke læst (begge dokumenter hentet som
`.docx`); `Gem`/`Hent` ikke afprøvet (filvælgeren kan ikke betjenes headless – samme hul som BB-049);
undo/redo og kolonnesortering ikke afprøvet på fladen. Konsollen var tavs: 197 beskeder, 0 fejl,
0 advarsler.

**Fire åbne spørgsmål** – alle fire ændrer tal og kan ikke afgøres uden brugeren: overlappende
perioder, en lønrække på 0 kr., lønperioder i fremtiden, og om Indstillingers to øvrige
standardværdier skal gælde Årsløn.

## Efterprøvning af de fem udbredte tilbagemeldinger – 2026-08-25

Fem af flade 8a's tilbagemeldinger bad udtrykkeligt om mere end fundets egen flade: *«er den
implementeret alle steder, hvor problemet kunne være aktuelt?»*, *«både her og i resten af
programmet»*, *«lav en universel rettelse»*. Sådanne krav er de letteste at afslutte for tidligt,
fordi fundets eget sted bliver rettet og resten ligner en detalje. Alle fem er derfor efterprøvet mod
produktionskoden – ikke mod rapporternes egne «Gennemført i kode»-afsnit. **Ingen huller fundet.**

| Krav | Efterprøvet | Kontrakt |
|---|---|---|
| BB-080 – stamdata er kun en dokumentafhængighed, når brevhovedet er slået til | Alle syv flader kalder `projectStamdataForDocumentIfEnabled` med deres eget brevhoved-flag; **ingen ubetinget kaldsside tilbage** i produktionskoden. Blokeringsteksten er `'Ret fejlen i Stamdata'` (`documentOutcome.ts`) | `document-output-contract.md` §Gate-deling – og håndhævet som **typegrænse**: en `project`, der læser formatvalget, kompilerer ikke |
| BB-083 – en delvist udfyldt række må ikke få rødt partnerfelt | Rettelsen er **fjernet**; de to tilbageværende `rule`-validatorer er ægte egen-værdi-regler (nul-beløb, rentedato forbi beregningsdato) og returnerer `undefined`, når partneren mangler | `input-field-behavior-contract.md` §1.0a |
| BB-084 – ugyldig indtastning gør ikke en række «tom» | Centralt i `fieldCatalog.ts` (`hasEntityInput` læser `rejectedInputs`), som alle ti tabeller arver via `useCollectionTable`. Dropdown-undtagelsen er implementeret pr. descriptor | `input-field-behavior-contract.md` §1.0a |
| BB-085 – download-ikoner deaktiveres, forsvinder ikke | Fælles `DownloadIconButton` med obligatorisk tooltip; **den flade du navngav** (regulering pr. ansættelsesforhold) renderer nu ubetinget med `disabled` | `page-component-contract.md` §11.1a – udvidet til **enhver** deaktiveret handling |
| BB-088 – højst ét decimalkomma pr. talled | Universelt på tegn-prædikatet i `numericDraftAdmission.ts`; **virker også for procent- og brøkfelter**. Ingen linjeskift-særregel tilbage | `input-field-behavior-contract.md` §1.2 + §Talled |

**Én observation værd at bære videre.** BB-088's værn ligger på `onDraftChange`, ikke på keydown, og
keydown-filteret er *afledt* af samme prædikat (`keyFilterFromAdmission`). Det er grunden til, at
rettelsen holder for paste, for tabelceller og for transiente overlay-felter uden tre separate
implementeringer – og det er samme arkitektur som tegnværnet. **Prøven ved enhver fremtidig
indtastningsregel: ligger den på prædikatet, eller på tastetrykket?** Kun den første er
modalitets-uafhængig.

**Ét sted er læst og bevidst ikke ændret:** EO's fire outputs (`eoDocumentDefinitions.ts`) læser
stamdata **ubetinget**, og det er korrekt – dér er skadestype, skadedato og fødselsdato reelt
*beregningsinput*, ikke kun brevhovedstof. BB-080's regel er, at stamdata ikke må være en
dokumentafhængighed, **når den kun bruges til brevhovedet**; den siger ikke, at stamdata aldrig må
blokere. Forskellen er værd at kende, før nogen «ensretter» EO med de øvrige syv flader.

## Renteberegning → Satser – gennemgået 2026-08-24, afgjort 2026-08-25

**Alle fem fund er afgjort** – tre gennemført, to afvist. Det fulde grundlag med målte tal og
brugerens tilbagemeldinger står i [renteberegning.md](renteberegning.md) under «Fane 2 – Satser».

| ID | Kort | Udfald |
|---|---|---|
| BB-091 | Tillægssatsens datokolonne heder «Forfaldsdato», nabotabellens identiske kolonne «Gælder fra» | **Gennemført** – begge tabeller heder «Gælder fra»; terminologien er normativ i `renteberegning-contract.md` §2.9 |
| BB-092 | Tillægssatsen vælges efter rentedatoen; fanen og beregningsforudsætningen siger forfaldsdatoen | **Gennemført** – teksten var forkert, beregningen rigtig: forudsætningen siger nu «rentedato» på skærm og i begge dokumenter |
| BB-093 | De to satstabeller ser ens ud, men den ene sats skifter under beregningen og den anden ligger fast | **Gennemført** – reglen er bindende i §2.10, og hver boks siger nu, hvordan dens egen sats virker. Beregningen er uændret |
| BB-094 | Satsfanen siger ikke, hvor langt satserne er fastsat – nyeste række dækker halvdelen af de lovlige datoer | **Afvist** – professionelle brugere kender halvårskadencen og kan læse dækningen af tabellens rækker; dokumenterne advarer fortsat. **M-15's spor er dermed lukket** |
| BB-095 | Negative satser skrives «- 0,45 %», og «-» er programmets tegn for «ingen værdi» | **Afvist** – formen er et bevidst visuelt valg for satstabellerne; tvetydigheden findes ikke, da «-» som fravær altid står alene i en celle |

**De to Høj-fund var samme sag, og ingen af dem kostede et forkert tal i beregningen.**
Beregningsforudsætningen – som trykkes i begge dokumenter og deles med standalone MinProcesrente –
sagde «ved forfaldsdato før 01-03-2013 dog + 7 %», mens motoren vælger tillægssatsen på
**rentedatoen**. Målt: forfaldsdato `20-02-2013` + 30 dages tillægstid gav `6.402,74 kr.` (8,2 %), hvor
den trykte forudsætning gav `5.621,92 kr.` (7,2 %). **Brugeren afgjorde, at rentedatoen er den
juridisk rigtige nøgle**, så teksten er rettet og tallene står. Dermed blev BB-091's kolonnenavn og
BB-092's forudsætning én og samme ensretning.

**Satsvalget er nu bindende, fordi det består af to modsatte regler.** `renteberegning-contract.md`
§2.10: referencesatsen er **periodisk** (slås op pr. halvårsstart, så et krav skifter sats undervejs),
tillægssatsen er **fastlåst pr. krav** på rækkens rentedato (rentedato før `01-03-2013` → 7 % for hele
kravet, også for perioder efter). Tre nye enhedstests hævder begge halvdele på motoren. §2.9 låser
terminologien: «Forfaldsdato» er kravets egen forfaldsdato, «Rentedato» er forfaldsdato + tillægstid,
og en sats' ikrafttræden heder «Gælder fra» – aldrig noget af de to andre.

**Læren af BB-091 er generel og bør stå ved hver fremtidig omdøbning:** en ensretning, der kun ser på
de steder, hvor det GAMLE ord stod, efterlader de steder, hvor det NYE ord allerede stod. Søg det nye
ord i hele programmet, før det tages i brug.

**Fanen er programmets mindste hidtil sammen med 7b** – to bokse, to tabeller, ingen felter, ingen
knapper, intet dokument, intet fokuserbart element. Hele edge case-blikket B0–B6a er derfor uden
genstand og er skrevet ned som sådan. **Tabellerne selv er kontrolleret og er i orden:** 44
referencesatsrækker uden huller (to pr. år 2005–2026, altid 01-01 og 01-07), nyeste først, ingen
dubletter; tillægssatsen har to rækker. Den **nedre** dækning hænger sammen – tabellens ældste række
er samme dato som fane 1's nedre datogrænse.

**Fundet var en rest efter den rettelse, der netop var gennemført.** BB-081's tilbagemelding gjorde
«Forfaldsdato» til kravets forfaldsdato, og ensretningen blev kørt i hele programmet (commit
`504031ef`) – men Tillægssats-tabellens kolonne hed allerede «Forfaldsdato» om noget helt andet (en
sats' ikrafttræden, `01-08-2002`) og blev derfor ikke rørt. Det var BB-089's fund igen, med det nye
ord.

**Ingen nye mønstre, men M-11's navngivne kandidat holdt ikke – og det er selv en lære.** Fanens to
lovhenvisninger («jf. rentelovens § 5» / «§ 5, stk. 2») kan ikke måles, fordi satserne kun vises her,
og BB-075's stramning kræver to uforenelige henførsler; spørgsmålet står fortsat som juridisk åbent
spørgsmål og er bevidst urørt af rettelsen. Men i samme boks stod en påstand om en DATO, og den kunne
fremprovokeres på ét forsøg. **Prøv datoerne før lovhenvisningerne.** M-13's fjerde form (BB-095,
fortegnets skrivemåde) er afvist, og **M-15's spor er lukket for hele programmet** med BB-094's anden
afvisning: en dataafhængig dækningsgrænse skal ikke skrives på skærmen, når målgruppen kan læse den af
datasættets egne rækker.

**Konsekvenser for de resterende flader – én prøve tilbage, én lukket:**
1. **BB-092's prøve er billig og hører på hvert forudsætningsafsnit:** tag hver sætning, der navngiver
   en dato, og lav en sag, hvor de to kandidatdatoer falder forskelligt ud. Kandidater: Varige méns og
   forsørgertabs forudsætningsafsnit, EO-bilagenes indledninger. **Prøven har nu givet sit første
   fund, og udfaldet gik til teksten – men det kunne være gået til beregningen.**
2. **BB-094's intervalprøve er lukket som fund-kilde** (find datasættets nyeste række, find feltet der
   læser datasættet, sammenlign intervallerne). Den er stadig værd at køre som *kontrol*: er feltets
   interval bredere, findes der lovlige indtastninger uden dækning – men et opslagsværk, hvis rækker
   selv viser kadencen, skal ikke skrive dækningen ud i tekst.

**Bevidst ikke foreslået:** en sammenlagt «procesrente»-kolonne. Den ville se ud som den oplagte
forbedring, men være forkert for de krav, hvis rentedato ligger før `01-03-2013` og hvis periode løber
ind i tiden efter – tillægssatsen ligger fast fra rentedatoen (BB-093). Afvisningen er nu normativ i
`renteberegning-contract.md` §2.10, så den ikke kan foreslås igen. BB-077's afgørelse er tilsvarende
respekteret: fanen markerer ikke sagens egen række.

**Gennemført i kode 2026-08-25:** `components/pages/renteberegning/RentesatserTab.tsx` (kolonnenavn +
én sætning pr. boks om, hvordan satsen virker), `components/tables/InterestRatesTable.tsx`
(`dateColumnHeader` obligatorisk uden default «Rentedato»; den ubrugte `rateColumnHeader`-prop fjernet;
fortegnsformen gjort eksplicit), `domain/renteberegning/renteCalculationPrinciples.ts`
(«forfaldsdato» → «rentedato» i den forudsætning, der trykkes i begge dokumenter og deles med
standalone MinProcesrente). `src/contracts/renteberegning-contract.md` har fået **§2.9** (terminologi)
og **§2.10** (satsvalg) samt et syvende punkt i minimumstestfladen; tre nye tests i
`procesrenteCalculator.test.ts` hævder §2.10; `docs/domain/renteberegning/renter.md` er ført ajour.

**Dækningshuller:** kun Chrome og lyst tema; dokumentets «Rentesats»-kolonne er ikke hentet for
BB-092's og BB-093's to sager (tallene er målt på skærmen); satsernes rigtighed mod Nationalbankens
offentliggjorte satser kan ikke kontrolleres i programmet. Konsollen var tavs: 74 beskeder, 0 fejl,
0 advarsler.

**Det ene åbne spørgsmål er lukket samme dag:** lovhenvisningerne var forkerte, og brugeren afgjorde
dem – Referencesats-boksen henviser nu til § 5, stk. 1, 2. pkt. og Tillægssats-boksen til § 5, stk. 1
(`renteberegning-contract.md` §2.11). **Tilbage står 7 %-rækkens fremtrædenhed.**

**Halvårsinddelingen er samtidig fastlåst som uforanderlig** (brugerafgørelse 2026-08-25):
perioderne 1/1–30/6 og 1/7–31/12 følger af rentelovens § 5, stk. 1, 2. pkt. og kan ikke ændre sig, så
domænet skal ikke indrettes til en anden kadence. Kontraktens §2.8 siger det nu, og
`src/data/interestRates.ts` fail-closer ved modul-load på både en referencesats med anden
ikrafttræden end `01-01`/`01-07` og et manglende halvår i kæden – det sidste var udækket og ville have
været tavst forkert, fordi satsopslaget da viderefører forrige halvårs sats.

## Renteberegning → Beregning – gennemgået og afgjort 2026-08-21–2026-08-22

**Elleve fund, alle rettet.** Det fulde historiske grundlag med målte tal og de læste dokumenter står i
[renteberegning.md](renteberegning.md).

| ID | Kort | Prioritet |
|---|---|---|
| BB-080 | En rød dato i Stamdata slukker alle downloads; intet på fanen peger derhen | **Høj** |
| BB-081 | Oversigtsdokumentets «Rente fra» viser rentedatoen – tillægstiden er usynlig i dokumentet | **Høj** |
| BB-082 | Skærmen summerer ikke rentebeløbene; kun dokumentet gør | Mellem |
| BB-083 | Én ufuldstændig rentelinje spærrer hele oversigten, og intet peger på linjen | Mellem |
| BB-084 | En række med kun en afvist værdi regnes for tom: ingen slet-knap, ingen ny række | Mellem |
| BB-085 | Rækkens downloadikon forsvinder i stedet for at blive inaktivt med en årsag | Mellem |
| BB-086 | «Slet alt»-dialogens overskrift er ordret navnet på sidens egen, fortrydelige slet-knap | Mellem |
| BB-087 | Fanens to dokumenter skriver samme dato i to formater | Lav |
| BB-088 | En indsat regnearkskolonne af beløb smelter sammen til én afvist værdi | Lav |
| BB-089 | «Rentedato» betyder to forskellige ting på sidens to faner | Lav |
| BB-090 | De to «beregning + satser»-sider navngiver deres faner spejlvendt | Lav |

**Fanen deles med MinProcesrente (flade 5, afgjort 2026-08-19), så gennemgangen er lagt på det, Mineo
gør anderledes** – oversigtsdokumentet, `.eo`-forbeholdet, valgbart dokumentformat, brevhoved fra
Indstillinger og først og fremmest **koblingen til Stamdata, som standalone slet ikke har**. Dertil
de to prøver, flade 5 efterlod som dækningshuller: dokumenternes faktiske indhold (nu hentet og læst
linje for linje) og mange rækker (~50 bygget uden træghed).

**Det tungeste fund er ikke fanens eget.** Renteberegning er den ENESTE beregningsflade i Mineo, der
ikke viser en eneste stamdataoplysning – og netop derfor har den ingen plads at vise en stamdatafejl
i. En fødselsdato på `99-99-9999` slukker begge downloadknapper med «Fejl i indtastning», med nul
røde felter på fanen, mens rækken fortsat viser `27.111,89 kr.` Blokeringen består med brevhovedet
slået FRA. **Målt på tre flader:** Satser er den skarpeste (opslagsværk, brevhoved slået fra som
standard, ingen sagsdata), Varige mén er den, der gør det rigtigt – dens spejlede rækker skriver
«Fødselsdato: Fejl i indtastning», fordi BB-064's rettelse gav den et sted at skrive det.

**To fund handler om, at dokumentet ved mere end skærmen** – og det er hentede dokumenter, ikke
kodelæsning: oversigtens kolonne «Rente fra» viser `30. januar 2019`, hvor skærmens «Renter fra»
viser `31-12-2018` (BB-081), og oversigten slutter med «Samlet rentebeløb 228.010,09 kr.», en sum
skærmen aldrig viser (BB-082). EET's «Løbende ydelser» har i forvejen en «I alt»-række på skærmen, så
BB-082 er en konvergens, ikke et nyt design.

**Ét nyt mønster og tre nye forekomster.** **M-22** (usynlig dokumentafhængighed på en anden flade) er
det bredeste siden M-21 og det første, der går på tværs af FLADER. M-13 har fået sit tredje prøvetrin
(dokument mod dokument fra samme flade), M-14 sin sidste uafprøvede kandidat målt (tabelcelle med
indsat regneark), og M-16 sin rene mangel-form.

**Beregningen er kontrolregnet og er i orden.** Halvårsperioder, 365/366 rentedage, satsskift,
tillægstidens tre enheder (månedstillæg klamper: 31-01-2024 + 1 måned → 29-02-2024) og
sammentællingen i dokumentet. Ingen af de elleve fund handler om et forkert tal – BB-081 handler om
en dato under en forkert overskrift.

**Konsekvenser for de resterende flader – tre prøver at tage med:**
1. **M-22's prøve er billig og hører på hver flade med et dokument:** giv Fødselsdato eller Skadedato
   en udfyldt-men-ugyldig værdi og læs downloadknappen. Kandidater: Årsløn, EET, Forsørgertab og EO's
   reguleringsbilag.
2. **M-13's prøve har fået et tredje trin:** har fladen mere end ét dokument, skal de to dokumenter
   sammenlignes indbyrdes, ikke kun mod skærmen.
3. **M-16 skal efterprøves i BEGGE halvdele:** en række, der er umulig som helhed, OG en række, der
   blot er halvt udfyldt. Renteberegning havde fået den første rettet og den anden ikke.

**Dækningshuller:** `Gem`/`Hent` af tabellen (filvælgeren kan ikke betjenes headless – samme hul som
BB-049), PDF-kanalens indhold (begge dokumenter er læst som `.docx`), dokumentgeneringens fejlbesked,
og mørkt tema samt de tre øvrige browsere. Konsollen var tavs gennem hele kørslen: 0 fejl, 0 advarsler.

## Varige mén → Satser – gennemgået og afgjort 2026-08-21

**Alle fem fund er afgjort** – to accepteret og gennemført (som én rettelse), tre afvist. Det fulde
grundlag med målte tal står i [varigemen.md](varigemen.md).

| ID | Kort | Udfald |
|---|---|---|
| BB-078 | Tre steder viser samme sats med hver sin talformatering (latent) | **Gennemført** – alle beløb i varige mén går nu gennem `formatKr` med nul decimaler; reglen er normativ i kontraktens nye §2.9 |
| BB-079 | Samme sats står med og uden ører tre linjer fra hinanden på fane 1 | **Gennemført** – samme rettelse; «á 11.035,00 kr.» er nu «á 11.035 kr.» på skærm og i dokument |
| BB-075 | Fanen henfører satsen til to love; resten af programmet henfører den til én | **Afvist** – satsen ER fælles for de to love, og målgruppen ved, hvilke ydelser der beregnes ens efter dem |
| BB-076 | «Beregningsår» siger ikke, hvilken af sagens datoer det er året for | **Afvist** – velkendt og entydig ydelse; lukket spor 3 fra Satser dækker også dette |
| BB-077 | Tabellen viser 22 år og markerer ikke det ene, sagen bruger | **Afvist** – en satsfane er et rent opslagsværk uden kobling til sagen, også inde på en beregningsside |

**Fanen er programmets mindste hidtil** – én tabel med to kolonner og 22 rækker, ingen felter, ingen
knapper, intet dokument. Hele edge case-blikket (B0–B6a) er derfor uden genstand, og det er skrevet
ned som sådan, så en senere kørsel ikke leder efter det igen. **Tabellen selv er kontrolleret og er
i orden:** 22 år uden huller, nyeste først, strengt faldende beløb, og satsen for begge ender af
intervallet er målt mod den sats, ménberegningen faktisk bruger (2005 → 6.450 kr., 2026 →
11.035 kr.). Årsdækningen og beregningsdatoens ydre grænser er udledt af samme datasæt, så der
findes hverken en række, brugeren ikke kan ramme, eller en lovlig dato uden en række.

**Alle fem fund bor i de to sætninger omkring tabellen, ikke i tabellen.** Det tungeste var BB-075:
fanen skriver, at satsen følger **erstatningsansvarslovens § 4** og arbejdsskadesikringslovens § 18,
mens Satser-siden viser samme tal – læst fra samme ene datasæt – alene under
«Arbejdsskadesikringsloven». **Præmissen var rigtig, konsekvensen ikke:** satsen ER fælles for de to
love, og målgruppen ved, hvilke ydelser der beregnes ens efter dem, så placeringen under ét lovsted
er ikke en mangel. Fundet er afvist.

**Rettelsen, der blev gennemført, er BB-078/BB-079 som én sag:** alle beløb i varige mén vises nu i
hele kroner uden decimaler – satstabellen, satsrækken, grundbeløbet, aldersreduktionen og
slutbeløbet, på skærmen og i begge dokumentformater – gennem den kanoniske `formatKr`, så de inline
`" kr."`-strenge er væk med. Reglen er normativ i **`varigemen-contract.md` §2.9** og er efter
brugerens afgrænsning **unik for denne ydelse**; `amount-contract.md` §5's to-decimal-standard
gælder fortsat alle andre domæner. Beregningen er bevidst uændret: kun slutgodtgørelsen afrundes,
og de tre viste linjer går stadig op, fordi reduktionen er defineret som differencen mod den
oprundede godtgørelse.

**To skærpelser af eksisterende mønstre, ingen nye.** M-11 dækker nu også påstande om et **tals
ophav** – men prøven er efter BB-075's afvisning strammet: et fund kræver, at de to henførsler er
*uforenelige*, ikke blot forskelligt afgrænsede. M-13's prøve er udvidet i to retninger: uenigheden
om formen kan stå på ÉN skærm (BB-079 – «11.035 kr.» og «11.035,00 kr.» tre linjer fra hinanden på
fane 1, hvor PDF'en var *enig* med skærmen om begge, og BB-070's prøve derfor ikke fangede den), og
den kan ligge latent i forskellige formateringskald for samme værdi (BB-078).

**Konsekvenser for de resterende flader – to lukkede spor og én prøve:**
1. **Lukket: en satstabel skal ikke markere sagens egen række** (BB-077). Afgørelsen udvider
   Satser-fladens lukkede spor 5 fra sider til faner: også en satsfane inde på en beregningsside er
   et rent opslagsværk uden kobling til sagen. Foreslå det ikke på flade 8b.
2. **Lukket: en fagligt entydig ydelse behøver ingen forklaring** – hverken af sin lovhenvisning
   eller af, hvilken af sagens datoer der styrer satsopslaget (BB-076, udvider lukket spor 3).
3. **Åben prøve: BB-078/BB-079's er billig og bør køres på hver beregningsflade herfra** – find
   alle visninger af samme tal, også inden for én skærm, og sammenlign formen. Men bemærk, at
   **rettelsen ikke må kopieres**: nul decimaler er varige méns egen regel, ikke programmets.

**Dækningshuller:** kun Chrome og lyst tema (to viewporter målt: 1536×864 og 1244×620); BB-078's
øre-scenarie kan pr. konstruktion ikke måles i drift, før en sats får ører – det er i stedet dækket
af en påstand om, at de tre viste linjer afstemmer på de VISTE tal.

**Ingen nye åbne spørgsmål.** Fane 1's to står uændret.

**Gennemført i kode:** `components/tables/VarigeMenSatserTable.tsx`,
`components/pages/varigemen/MenberegningTab.tsx` og
`document/generators/varigemen/varigeMenDocument.ts` (alle beløb gennem `formatKr`, nul decimaler).
`src/contracts/varigemen-contract.md` har fået **§2.9** som normativ visningsregel, en rettet **§2.8**
(advarslens grænse er 1–4 %, ikke 5) og et sjette punkt i minimumstestfladen.
`docs/domain/varigemen/varige-men.md` er ført ajour med visningsreglen og de to nye testfiler. Ny
test `VarigeMen.heleKronerVisning.test.tsx` (begge faner + afstemning af de tre viste linjer) og et
nyt værn i `varigeMenWordContent.test.ts` (dokumentkanalen). **Begge værn er mutationstestet:** med
`formatKr(…, 2)` genindsat bliver alle tre påstande røde.

## Varige mén → Ménberegning – gennemgået 2026-08-20, afgjort samme dag

**Alle tretten fund er afgjort** – elleve accepteret og gennemført, to afvist. Det fulde grundlag
med målte før/efter-tal står i [varigemen.md](varigemen.md).

| ID | Kort | Udfald |
|---|---|---|
| BB-062 | Advarslen ved méngrad 5 % vises først, når tre andre felter er udfyldt | **Gennemført** (Høj) – advarslen læser feltets eget read i stedet for projektionen |
| BB-064 | En udfyldt stamdato meldes som «Mangler», mens samme skærm citerer dens værdi | **Gennemført** (Høj) – tomt og rødt skelnes med de to standardbeskeder fra `actionGate.ts` |
| BB-063 | Méngrad 1–4 regner og kan hentes uden et ord, mens 5 advarer | **Gennemført** – advarslens grænse er nu 1–4 % |
| BB-065 | Satsrækken siger «Beregningsdato mangler» om en udfyldt, rød beregningsdato | **Gennemført** – samme sondring som BB-064 |
| BB-066 | Alder-rækken viser fødselsdatoens fejl, men aldrig skadedatoens | **Gennemført** – symmetrisk fejlvisning for begge datoer |
| BB-068 | «Indsæt dags dato» vil indsætte en afvist dato fra 1. januar 2027 | **Gennemført** – knappen er inaktiv uden for satsdækningen, med årsagen i tooltippen |
| BB-069 | Et blokeret klik på en AKTIV downloadknap giver intet svar; fokus ryger til siden | **Gennemført** – frisk `InputReader`-læsning efter settle + lokal `onMouseDown`-preventDefault |
| BB-072 | «Alder på skadestidspunkt» står uændret, når datoen hedder Anmeldelsesdato | **Gennemført** – labelen er nu skadestype-afledt, både på skærm og i dokument |
| BB-070 | Skærmen og dokumentet skriver slutbeløbet forskelligt (`364.155` / `364.155,00`) | **Gennemført** – decimalfri beløb i PDF'en |
| BB-071 | Samme sats hedder tre ting på én side («per»/«pr.»/«Opgørelsesår») | **Gennemført** – «Sats pr. méngrad» og «Beregningsår» overalt, også i PDF'en |
| BB-073 | Aldersreduktionen vises som «- 0 %» og «- 0,00 kr.» for alle under 40 år | **Gennemført** – fortegnsløst nul |
| BB-067 | De nedtonede «mangler»-tekster er ikke nedtonede – farven bliver overskrevet | **Afvist** – en nedtoning kan gøre netop fejllinjerne til dem, brugeren overser |
| BB-074 | Méngradfeltets pladsholder er «0», og 0 er den ene værdi feltet afviser | **Afvist** – pladsholdere bruges bevidst bredt; feltet svarer klart ved 0 |

**To af rettelserne er samme dag udbredt til andre flader** (commit `789d11f7`): BB-068's mønster til
EET's og forsørgertabs beregningsdatofelter, og BB-064/BB-065's sondring til EO-beregningsfanens
skadedato-række. To af M-19's forudsagte kandidatsteder er dermed allerede lukket, før flade 11 og 12
er gennemgået.

**Fanen var lille, men ikke tom for fund, og næsten alle bor i ét forhold:** den låner fem
oplysninger fra Stamdata og satsdatasættet, og lånet er tavst om, hvad der er galt med dem. Fem af
de tretten fund (BB-064, BB-065, BB-066, BB-067, BB-072) er den samme sætning set fra fem sider:
*programmet ved besked og siger det ikke.*

**Beregningen selv er kontrolregnet og er i orden** – sats, aldersfradragets to trin med deres lofter,
oprundingen til hele kroner og afstemningen af de tre viste linjer. Ingen af de tretten fund handler om
et forkert tal.

**Tre nye mønstre (M-19, M-20, M-21) og to skærpelser.** M-19 (rødt læses som tomt) havde allerede sin
løsning i programmet: **Forsørgertab gør det rigtige på sin tilsvarende flade**, så rettelsen blev en
konvergens mod en truffet beslutning, ikke et nyt design. M-21 (en CSS-klasse slår komponentens farve
ihjel) er den bredeste: seks døde `color`-props og fire døde `sx`-farver i programmet, hvoraf den
alvorligste kandidat er `DocumentOutcomeMessage`s **røde fejlbesked, som efter mekanismen ikke er
rød**. M-02 er skærpet (afledte labels følger ikke skadestypen) og M-13 har fået en ny, svag
forekomst (samme tal, to former).

**Konsekvenser for de resterende flader – ét spor lukket, to åbne:**
1. **M-19's prøve hører på flade 11 og 12** (EET's og EO's spejlede forudsætningsrækker). Prøven er
   billig: giv stamdatafeltet en udfyldt-men-ugyldig værdi og læs den lånende flade. **To af
   kandidatstederne er allerede rettet** med `789d11f7`; resten står.
2. **M-21's spor er indsnævret af BB-067's afvisning:** en død farve-prop er kun et fund, hvis den
   ønskede farve gør oplysningen lettere at opdage. `DocumentOutcomeMessage` er stadig kandidaten,
   fordi den trækker den vej (en fejl, der ikke er rød). Foreslå ikke nedtoning af «mangler»-linjer
   igen.
3. **BB-072's ordlyd hører sammen med flade 10 og 11**, hvor de samme faste «skadestidspunkt»-labels
   står, plus tre dokumentgeneratorer. Afgjort her, kan de rettes i én omgang.

**Dækningshuller:** BB-068 kræver en systemdato i 2027 og er målt i to dele frem for i drift;
`DocumentOutcomeMessage`s farve er ikke set i drift; Word-udgaven af dokumentet er ikke hentet
(PDF'en er, og dens indhold er aflæst linje for linje). Kun Chrome, 1536×864, lyst tema.

**To åbne spørgsmål** – det ene er MinProcesrentes uafklarede spørgsmål om forudfyldt beregningsdato,
som gælder ordret her og bør besvares én gang for begge flader.

## Global shell – afgjort 2026-08-19

**Alle tretten fund er afgjort** – seks accepteret og gennemført, seks afvist og ét delvist gennemført
efter modpres. Det fulde grundlag med begrundelser står i [globalshell.md](globalshell.md).

| ID | Kort | Udfald |
|---|---|---|
| BB-049 | `Gem` kan skrive den ene sag ind i den anden sags fil, når Mineo er åben i to faner | **Gennemført** (Kritisk) – håndtaget genbruges kun, når dets `name` er fanens eget. Mit eget løsningsforslag forkastet som for kompliceret |
| BB-050 | Ctrl+Z ændrer sagen bag en åben bekræftelsesdialog; Ctrl+S starter et gem bag den | **Gennemført** – begge genveje spørger overlay-stakken; dækker alle fem overlays |
| BB-051 | Sidemenuen kan ikke nås med tastaturet, når fokus én gang har været i indholdet | **Afvist** – Tab-ringen findes for hurtig indtastning på ÉN side; mus til sidenavigation er et accepteret kompromis |
| BB-052 | Programmet ved, om sagen er gemt, og siger det aldrig; sagen har intet filnavn på skærmen | **Afvist** – brugeren gemmer selv; browserens advarsel ved lukning er den primære beskyttelse |
| BB-053 | Den anden besked arver den førstes resttid og kan være helt usynlig | **Gennemført** – identiteten kommer fra kilden som React-`key`; et fade-ud kan ikke længere lukke en nyere besked |
| BB-054 | Ctrl+Z gør ingenting, mens et felt er åbent – heller ikke browserens egen fortrydelse | **Delvist gennemført efter modpres** – den dobbelte adfærd afvist (brugeren har ret), men spærringen af tasten fjernet |
| BB-055 | Korrekt adgangskode med et usynligt mellemrum afvises som «Forkert adgangskode» | **Gennemført** – `trim()` ét sted, hvor case-neutraliseringen allerede bor; garantien for afledte virkninger er udfoldet |
| BB-056 | Kan ikke logge ind, når browseren ikke må gemme login-status – én besked for to årsager | **Gennemført** – forgrening på fejlKLASSEN, ikke på tekst |
| BB-057 | 404-siden er en hvid blindgyde uden menu og uden vej tilbage | **Gennemført** – siden ligger inde i shellen; brugerens to betingelser er efterprøvet strukturelt og målt |
| BB-058 | `Slet alt` advarer og kvitterer, også når der intet er at slette | **Afvist** – `Slet alt` skal garantere, at alt er væk; en «der var intet»-besked har ingen værdi |
| BB-059 | Genindlæsning (F5) advarer om et tab, der ikke sker | **Mitigering afvist** – brugerens regel tiltrådt som princip, men browseren har ét fælles `beforeunload` for lukning og F5. Ingen kodeændring |
| BB-060 | `Slet alt` og `Erstat` kan ikke fortrydes, og dialogerne siger det ikke | **Afvist** – brugeren forventer, at `Slet alt` er irreversibel |
| BB-061 | Der findes ingen vej ud af login igen | **Afvist** – professionelle brugere logger kun ind på egen eller en kollegas maskine |

**Én afvisning, hvor jeg pressede tilbage og fik delvist ret (BB-054).** Brugerens hovedindvending var
rigtig: min anbefaling ville have givet Ctrl+Z to betydninger, og «én tast, én funktion» er den stærkere
regel. Men fundet indeholdt et andet forhold, begrundelsen ikke dækkede – genvejen kaldte
`preventDefault()`, FØR den så, at editoren var åben, og slog dermed browserens egen tekstfortrydelse
ihjel uden selv at gøre noget. Nul funktioner plus en spærring er ikke «én funktion». Spærringen er
fjernet; den dobbelte adfærd er det ikke.

**Fem afvisninger accepteret uden indvending** (BB-051, BB-052, BB-058, BB-060, BB-061 – hvoraf to
korrigerede en fejlslutning i mit eget grundlag): BB-058's sammenligning med `Gem` holdt ikke, fordi
`Gem` faktisk ÆNDRER sin handling efter svaret, og `Slet alt` ikke gør. BB-052's begrundelse hvilede
delvis på, at et ekstra `Gem` kunne ramme forkert fil – det er bortfaldet med BB-049's rettelse.

**Sporet, STATUS lagde ud til denne flade, er lukket:** `Gem` med et satsår uden for det dækkede
interval (1999) blokerer ikke, og det er korrekt efter `form-contract` §1.6 – en bounds-fejl på en
ellers repræsenterbar værdi må gemmes. Ingen fund.

**Det væsentligste dækningshul består efter rettelserne:** filvælgeren kan ikke betjenes headless, så
BB-049's mekanisme er mutationstestet frem for målt i drift. Efterprøv manuelt med to faner og to
rigtige filer. Tilsvarende kan den browser-adfærd, BB-054 frigiver (Ctrl+Z fortryder tegn i et åbent
felt), pr. konstruktion ikke måles i jsdom.

**Konsekvenser for de resterende flader – tre lukkede spor.** Foreslå dem ikke igen:
1. **Tastaturnavigation er til indtastning, ikke til navigation.** Sidemenuen, `PageTabs` og `SideTab`
   skal ikke ind i Tab-ringen. En kontrol uden for ringen er kun et fund, hvis den er nødvendig for at
   færdiggøre indtastningen på den side, brugeren står på.
2. **Programmet skal ikke vise gemt/ugemt-tilstand eller filnavn.** Brugeren gemmer selv; det er
   åbenbart for professionelle brugere.
3. **En «Log ud» skal ikke foreslås**, og gatens formålssætning om «delt enhed» er ikke et løfte om at
   kunne fjerne adgangen igen.

**Gennemført i kode:** `utils/fileSaveTarget.ts`, `inputCore/react/useUndoRedoShortcuts.ts`,
`components/layout/MainLayout.tsx`, `auth/auth.ts`, `auth/LoginPage.tsx`, `App.tsx` og den nye
`components/system/PageNotFound.tsx`. Fire kontrakter har fået normative afsnit:
`persistence-contract.md` §5 (filhåndtagets identitet), `keyboard-navigation.md` (globale genveje og
overlay-stakken + beskedernes nedtælling), `auth-gate-contract.md` §2.3/§2.7 og
`app-shell-contract.md` §2.2. Nye/udvidede tests: `fileSaveTarget.test.ts`,
`useUndoRedoShortcuts.test.tsx`, `MainLayout.shortcutsAndMessages.test.tsx` (ny),
`PageNotFound.test.tsx` (ny), `auth.test.ts`, `LoginPage.test.tsx` og en rettet påstand i
`MainLayout.undoRedoEditorGuard.test.tsx`. **Alle nye værn er mutationstestet.** Fuld vitest grøn.

## MinProcesrente – afgjort 2026-08-19

**Alle tolv fund er afgjort** – ni accepteret og gennemført, tre afvist. Det fulde grundlag med målte
før/efter-tal står i [minprocesrente.md](minprocesrente.md).

| ID | Kort | Udfald |
|---|---|---|
| BB-037 | Tillægstid kan skubbe rentedatoen forbi beregningsdatoen; rækken holder tavst op med at regne | **Gennemført** – brugerens løsning: `rule`-validator på Tillægstid med «Beregnet rentedato kan senest være …» |
| BB-038 | 0 kr. accepteres af feltet, afvises af beregningen | **Gennemført** – «Beløbet skal være større end 0 kr.» |
| BB-039 | Blokeringen siger «Indtastning mangler», selv om intet mangler | **Bortfaldet** – min præmis var for bred; gatens præmis er nu SAND, fordi BB-037/038 giver røde felter |
| BB-040 | Renten regnes fem år ud over de fastsatte satser; kun PDF'en advarer | **Afvist** – accepteret brist; jeg pressede med en enklere løsning, afvisningen fastholdt |
| BB-041 | Sortering kan ikke slås fra og kan ikke fortrydes | **Afvist** – tilsigtet designvalg i alle tabeller |
| BB-042 | Samme indsatte dato giver to forskellige resultater | **Gennemført** – brugerens valg: tolerancen bevaret, tilstandsafhængigheden fjernet ét sted for alle tre paste-flader |
| BB-043 | Fejlen navngiver «dags dato» i stedet for Beregningsdato | **Gennemført** – «Datoen er efter beregningsdatoen (…)» med brugerens ordlyd |
| BB-044 | Bekræftelsen taler om `.eo`-filer, som ikke findes i standalone | **Gennemført** – egen ordlyd pr. variant via `hasEoFiles` |
| BB-045 | Telefonlayout i et smalt musevindue, men 1200 px indholdsboks | **Gennemført** – brugerens løsning: opstillingen låses til ENHEDEN, aldrig til vinduet |
| BB-046 | Tillægstiden regner videre, men er usynlig i telefonlayoutet | **Gennemført** – løst af BB-045's device-lås; overgangen findes ikke længere |
| BB-047 | «Slet alle indtastninger» kan ikke nås med tastaturet | **Gennemført** – `data-mineo-focusable-button` |
| BB-048 | Arbejdet kan lukkes væk uden varsel | **Gennemført** – Mineos guard genbrugt; baselinen flyttes af et gennemført hent |

**To brugerafklaringer traf jeg ikke selv, fordi de var reelle valg:**

1. **BB-042 var en modsigelse mellem to af brugerens egne afgørelser.** BB-003 (16-08): indsættelse må
   gerne være mere tolerant end tastning. Denne tilbagemelding (19-08): paste skal altid opføre sig som
   tastning. Forelagt med begge udfald; brugeren valgte at bevare tolerancen og kun rette
   tilstandsforskellen. `input-field-behavior-contract.md` §1.2a punkt 7 er rettet tilsvarende – den
   påstod det absolutte forbud, som modsagde BB-003 fem dage før.
2. **BB-045 krævede en definition af «mobil».** Browseren kan ikke sige «telefon» – kun «berøring» og
   «skærmstørrelse». Brugeren valgte, at skærmens fysiske størrelse afgør, så en berøringsfølsom
   bærbar er en desktop.

**Én afvigelse fra en tilbagemelding, forelagt og bekræftet:** ved BB-037 viser downloadknappen den
konkrete sætning i stedet for «Fejl i indtastning», fordi der kun er ÉT rødt felt – brugerens egen
lempelse af 13-08-2026. Bekræftet beholdt 19-08.

**To åbne spørgsmål står fortsat uafklarede:** skal Beregningsdato være forudfyldt med dags dato ved
første besøg, og skal tillægstid kunne bruges på telefon. Det sidste er efter BB-046 ikke længere et
fund, men et valg om telefonudgavens omfang.

## Satser – afgjort 2026-08-18

**Alle seks fund og begge åbne spørgsmål er afgjort** – to accepteret og gennemført, fire afvist. Det
fulde grundlag, inklusive de målte før/efter-tal, står i [satser.md](satser.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-030 | Satsspecifikationen udelod den sats på 0 %, skærmen viste (år 2024) | **Accepteret – gennemført**; dokumentets prøve er nu «findes værdien?» |
| BB-031 | Samme indsatte tekst gav to forskellige årstal, alt efter om feltet var tomt | **Accepteret – gennemført**; begge paste-only fortolkere slettet. Mit eget løsningsforslag forkastet |
| BB-032 | Det dækkede årsinterval 2005–2026 vises kun, når man har gættet forkert | Afvist – brugere rammer i praksis aldrig den nedre grænse |
| BB-033 | Fire steder hedder «Satser», og de viser satser på forskellige måder | Afvist – formen følger et fagligt behov pr. satstype |
| BB-034 | «Reguleringsprocent … (fra 2024)» står alene og forklarer ikke sig selv | Afvist – 2024-lovændringen er almindeligt fagkendskab |
| BB-035 | Specifikationen på papir mangler grundlaget for fri proces-beløbene | Afvist – tooltippen er akademisk baggrund, ikke en forudsætning |

**Begge åbne spørgsmål er lukket.** Satser-siden er et **opslagsværk**, ikke en del af sagsbehandlingen:
den skal ikke oplyse, at satsåret ikke påvirker beregninger, og et satsår langt fra sagens skadedato skal
ikke give en advarsel.

**Konsekvenser for de resterende flader – fem lukkede spor.** Foreslå dem ikke igen:
1. Et tilladt interval behøver ikke annonceres, hvis brugere i praksis aldrig rammer grænsen.
2. Fælles navn på forskellige visningsformer er ikke en inkonsistens, når formen følger et fagligt behov.
3. En fagligt velkendt lovhenvisning behøver ingen forklaring i brugerfladen.
4. Et informationsikons indhold er ikke automatisk noget, dokumentet mangler.
5. **Mineo er en samling selvstændige værktøjer, og brugeren forventes at vide det.** Et fund af formen
   «brugeren kan tro, at de to sider hænger sammen» kræver, at der faktisk ER en kobling, som virker
   anderledes end den ser ud.

**Gennemført i kode:** `inputPasteNormalization.ts` (begge fortolkere erstattet af det delte
tegn-for-tegn-filter; tre dødе hjælpere fjernet), `numericDraftAdmission.ts` (års- og ugeprædikaterne
flyttet hertil som ét sandt sted, plus `normalizeWeekSeparators`), `draftAdmission.ts` og
`weekDraftCore.ts` (læser nu de delte prædikater frem for egne kopier),
`satserDocument.ts` (`hasRateValue`, 18 kaldssteder, plus fri proces pr. linje). Kontrakten
`input-field-behavior-contract.md` har fået **§1.2a punkt 7** og en ny **§2.9 om års- og ugefelter**.
Tests: `inputPasteNormalization.test.ts` skrevet om (de gamle prøver pinnede den forkerte adfærd) med et
nyt værn for tomt-vs-udfyldt-ligheden; to nye værn i `satserWordContent.test.ts`, hvoraf det ene er
mutations-efterprøvet. Fuld vitest grøn: 605 filer / 7977 tests.

**En sideeffekt fundet undervejs og rettet med:** ugefeltets separatorsæt var erklæret to gange med
forskelligt indhold – `23,2025` kunne tastes, men blev afvist ved settle. Nu én erklæring, begge læser.
Efter brugerens beslutning er **mellemrum ikke længere ugeseparator**, så `uge 23/2025` kan indsættes;
prisen er, at `23 2025` ikke kan.

**Indstillinger er færdigbehandlet 2026-08-18. Alle otte fund er afgjort** – tre accepteret og
gennemført, fem afvist. Det fulde grundlag står i [indstillinger.md](indstillinger.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-024 | Farvetemaet kunne ikke stilles tilbage til at følge computeren | **Accepteret – gennemført**; `themeMode` er tre-værdig, `'system'` er default, systemskift følges live |
| BB-028 | Måneds-grænsen virker uafhængigt af den toggle, den står under | **Accepteret – gennemført**; rækkerne byttet om, tolerancen omformuleret selvstændigt |
| BB-036 | «Nulstil» fik browserens sorte fokusramme (brugerens eget fund) | **Accepteret – gennemført**; ny `.text-action-button` genbruger programmets egen fokusmarkering |
| BB-023 | «Standardværdier» slår ikke igennem på den åbne sag | Afvist – begge tidspunkter for virkning er de forventede; ingen forklarende linje |
| BB-025 | Indstillinger forsvinder tavst, hvis browserens lagring ryddes | Afvist – bæres bevidst; forbuddet mod `.eo` er nu normativt |
| BB-026 | Alle ni brevhoveder kan slås fra uden oplysning om konsekvensen | Afvist – brevhovedet er et tilbud, ikke en integritetsegenskab |
| BB-027 | Ctrl+Z virker overalt i programmet undtagen på indstillinger | Afvist – fraværet er et **værn**; nu normativt |
| BB-029 | «0 måneder» – ordlyden skulle pege det modsatte vej | Afvist – «forældet efter 0 måneder» læses naturligt som «straks» |

**Begge åbne spørgsmål er lukket.** Standardværdier anvendes aldrig på en åben sag (heller ikke på
brugerens anmodning), og de fire bokse skal ikke forklare, hvornår deres indhold virker.
**Konsekvens for de resterende flader: «fladen bør sige hvornår en indstilling virker» er et lukket
spor** – foreslå det ikke igen.

**Gennemført i kode:** `appSettingsSchema.ts` (`themeModeEnum` + `resolveThemeMode` +
`ResolvedThemeMode`), `appSettingsParse.ts`, `AppSettingsContext.tsx` (+`.shared.ts`),
`themeBootstrap.ts`, `appTheme.ts`, `App.tsx`, `Indstillinger.tsx`, `DefaultDirectoryRow.tsx`,
`layout.css`. Ny test `themeBootstrapParity.test.ts`. Kontrakten `src/contracts/app-settings.md` har
fået tre nye normative afsnit (tema-tredelingen, `.eo`-forbuddet, undo/redo). Fuld vitest grøn:
605 filer / 7971 tests.

**Tidligere flader.** Om-fladens tolv fund blev besvaret i to runder og er alle afgjort; fire af dem
efter modpres fra agenten. Det fulde grundlag står i [om.md](om.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-011 | Teksten siger «når browseren lukkes» – sagen forsvinder med **fanen**, og «Gem» nævnes ikke | **Accepteret efter modpres – gennemført**; adfærden bevares |
| BB-012 | «Ingen data … eller anden information» lover bredere end det, sætningen skal bære | **Delvist accepteret efter modpres – gennemført**; nøgleordene bevares, tre unøjagtigheder rettes |
| BB-013 | Søskendesiderne åbner i samme fane og erstatter programmet | **Accepteret efter modpres – gennemført** som generel linkregel |
| BB-014 | Rul-til-toppen-knappen dækker 19 px af det sidste søskendelink | Accepteret risiko – få står præcis på 1536×864, og zoom-løsningen ændrer præmissen |
| BB-015 | Fast indholdsbredde; 1366 px-skærm kræver vandret rul | Afgjort – 1536×864 er designmålet; shell-kontrakten dækker 1244×620 CSS-px ved 100 % browserzoom |
| BB-016 | Sidens fem links kan ikke nås med tastaturet | Afgjort – bevidst designvalg, nu håndhævet af `ExternalLink` |
| BB-017 | Hjælpeprogrammets tilstand vises først, når man klikker | Afgjort – acceptabelt kompromis |
| BB-018 | Tre ord for samme handling: download, hente, installere | **Accepteret – gennemført.** Brugeren leverede brødteksten |
| BB-019 | To browserikoner uden tekst | Afvist – ikonerne er en genkendelsesnøgle, ikke en oplysning |
| BB-020 | Startside-valget står under «Teknisk» | Afvist – bevidst undtagelse; Om vises af juridiske grunde |
| BB-021 | «Mineo» og «minEO.dk» på samme skærm | Afvist – ét navn i to sammenhænge |
| BB-022 | Forsiden peger ikke ind i programmet | Afvist – der findes ikke ét rigtigt startsted |

**Gennemført fra Om:** to tekstrettelser i `Mineo.tsx`, lavet i én omgang –
«Persondata»-boksens sætning 2 og 3 (BB-011 + BB-012) og «Teknisk»-boksens ord for handlingen
inklusive knaplabelen «Installér hjælpeprogram» (BB-018). Ordlyden står ordret i [om.md](om.md).

**Gennemført undervejs:** BB-013's generelle linkregel – `ExternalLink`/`InternalLink`, AST-reglen
`a11y/web-link-policy-single-source` og `e2e/web-link-policy.spec.ts`. Brugerens eget arbejde.

Stamdatas ti fund er afgjort 2026-08-16; afgørelserne står i [stamdata.md](stamdata.md).
Tre rettelser derfra står klar til gennemførelse: BB-002 + BB-010's ordlyd (samme kodeændring),
BB-004's nye længdekategori (6 tegn til initialfelterne) og BB-007's normalisering af indsat tekst.

## Åbne spørgsmål

**INGEN TILBAGE. Alle otte spørgsmål i hele gennemgangen er afgjort 2026-08-25**, og ingen af de otte
afgørelser krævede en kodeændring – de fastholdt alle den nuværende adfærd, som nu er normativ, så den
ikke senere «forbedres» tilbage. Det er i sig selv en observation værd at holde fast i: **hver gang et
spørgsmål blev forelagt frem for afgjort af mig selv, var det bestående valg det rigtige.** Prisen ved
at forelægge var alene tid; prisen ved at gætte ville have været en ændret adfærd, ingen havde bedt om.

De tre sidst afgjorte (2026-08-25, denne runde):

| Spørgsmål | Flade | Afgørelse | Forankret i |
|---|---|---|---|
| Skal fanen advare, når beregningsdatoen ligger tyve år fra skadedatoen? | 7a Varige mén | **Nej** – afstanden er lovlig, forekommer, og målgruppen kender satsopslagets dato. Afgørelsen afgrænser M-05 | `varigemen-contract.md` §2.11 |
| Skal Ctrl+S kunne ses nogen steder i brugerfladen? | 6 Global shell | **Nej** – genvejen forbliver skjult; asymmetrien over for `Hent`/`Slet alt` er accepteret | `keyboard-navigation.md` §«`Ctrl+S` annonceres ikke» |
| Hvad skal `Gem` gøre, når skadelidtes navn rettes efter et gem? | 6 Global shell | **To filer er det rigtige udfald** – filnavnet følger sagens oplysninger; hverken dialog eller tavs videreskrivning | `persistence-contract.md` §5 |

De fem rente- og satsspørgsmål, afgjort tidligere samme dag:

| Spørgsmål | Flade | Afgørelse 2026-08-25 |
|---|---|---|
| Er «§ 5» / «§ 5, stk. 2» de rigtige henvisninger? | 8b Satser | **Nej** – tillægget står i § 5, stk. 1, referencesatsen i § 5, stk. 1, 2. pkt. Begge sætninger rettet; ordlyden i kontraktens §2.11 |
| Skal 7 %-rækken stå som en ligeværdig sats? | 8b Satser | **Ja, og blive ved med det** – rækken må ikke rykkes ned eller sættes under en «overgangsregel»-overskrift (§2.12) |
| Skal Beregningsdato være forudfyldt med dags dato? | 8a, MinProcesrente, Varige mén | **Nej** – på alle tre flader. En urørt sag må ikke bære en værdi, brugeren ikke selv har skrevet (§2.12 / varigemen §2.10) |
| Skal en rentelinje bære sit eget kommentarfelt? | 8a | **Nej** – ét kommentarfelt pr. flade, som anvendes generelt på specifikationerne (§2.12) |
| Skal tillægstid kunne bruges på telefon? | MinProcesrente | **Nej** – der er ikke plads, heller ikke vandret. Telefonen har bevidst ét datofelt, og forfaldsdatoen lægges direkte til grund (§2.12) |

**Varige mén → Ménberegning er lukket.** Fanens andet åbne spørgsmål (advarsel ved tyve år mellem
skadedato og beregningsdato) er besvaret ovenfor; det første var ikke et nyt spørgsmål – forudfyldt
beregningsdato – og blev lukket med tværfladeafgørelsen. Grundlaget står i [varigemen.md](varigemen.md).

**Global shell er lukket.** Begge spørgsmål – Ctrl+S' synlighed og `Gem`s adfærd ved rettet navn – er
besvaret ovenfor og står udfoldet i [globalshell.md](globalshell.md). **Bemærk hvordan de to
afgørelser i `resolveSaveTarget` skal læses sammen:** BB-049's navneprøve værner mod at skrive i en
ANDEN fanes fil, mens navneafgørelsen siger, at et ændret filnavn i EGEN fane bevidst giver en ny fil.
De bor i samme beslutning og kan forveksles – derfor står de ved siden af hinanden i
`persistence-contract.md` §5.

**Ingen tilbage fra MinProcesrente** – begge (forudfyldt beregningsdato, tillægstid på telefon) er
lukket 2026-08-25; afgørelserne står ved hvert spørgsmål i [minprocesrente.md](minprocesrente.md).

Fra de tidligere flader er der ingen. BB-017's alternative overskrift til fejldialogen blev udeladt
som aftalt; BB-018's tekstrettelse ændrede derfor ikke denne overskrift.

**Efterfølgende implementering.** Det tidligere planlagte skaleringsarbejde er gennemført og ligger
nu som bindende regel i [app-shell-kontrakten](../../../src/contracts/app-shell-contract.md): Mineo
dækker mindst 1244×620 CSS-px ved 100 % browserzoom. Fysisk 1366×768 alene er ikke en garanti, fordi
systemskalering ændrer den faktiske CSS-viewport.

## Tværgående mønstre

Toogtyve mønstre i [TVAERGAAENDE.md](TVAERGAAENDE.md).

- **Ingen nye mønstre 2026-08-24 fra Renteberegning → Satser, men tre nye forekomster – og M-11's
  navngivne kandidat holdt ikke. Alle tre er afgjort 2026-08-25.** Fanen er et rent opslagsværk, så
  M-16, M-19 og M-22 er uden genstand. **M-11:** lovhenvisningerne kunne ikke måles (satserne vises
  kun her, og BB-075's stramning kræver to *uforenelige* henførsler), men en påstand om en DATO i
  samme boks kunne – og var forkert (BB-092, **gennemført**: teksten navngiver nu rentedatoen). Prøv
  datoerne før lovhenvisningerne. **Efterskrift 2026-08-25: lovhenvisningen var OGSÅ forkert** –
  brugeren afgjorde det åbne spørgsmål, og begge § -henvisninger er rettet. Læren om prøven står
  uændret (en § kan ikke måles i programmet), men konklusionen «ikke målbart» er ikke det samme som
  «rigtigt»: en umålelig påstand hører som spørgsmål til brugeren, ikke som en lukket sag. **M-15: sporet er LUKKET for hele programmet** – BB-094 er afvist
  som BB-040, og fladen var netop det opslagsværk, betingelsen krævede. Læren, der bliver stående: en
  dataafhængig dækningsgrænse skal ikke skrives i tekst, når målgruppen kan læse den af datasættets
  egne rækker. **M-13:** fjerde form – fortegnets skrivemåde (`- 0,45 %` med mellemrum, BB-095) –
  **afvist**: `-` som fravær står altid alene i en celle, så de to læsninger kan ikke støde sammen.
- **M-22 er tilføjet 2026-08-21 fra Renteberegning → Beregning og afventer bruger.** «En usynlig
  dokumentafhængighed på en anden flade slukker knappen»: hver dokumentdefinition kræver en `ready`
  stamdataprojektion, uanset om dokumentet trykker et brevhoved – så en rød dato i Stamdata slukker
  downloadknappen på flader, der ikke viser en eneste stamdataoplysning. Målt på tre flader
  (Renteberegning, Satser, Varige mén). Det er det bredeste mønster siden M-21 og det første, der går
  på tværs af FLADER; læs det sammen med M-19, hvis rettelse forklarer, hvorfor netop de spejlende
  flader kan vise årsagen.
- **Samme dag har M-13, M-14 og M-16 fået hver sin nye forekomst**, alle fra samme flade: M-13 sit
  tredje prøvetrin (dokument mod dokument fra samme flade – BB-087), M-14 sin sidste uafprøvede
  kandidat målt (tabelcelle med indsat regneark – BB-088), og M-16 sin rene mangel-form (BB-083).
- **Ingen nye mønstre 2026-08-21 fra Varige mén → Satser** – fanen er for lille til at bære et
  (én tabel, ingen felter). Til gengæld to skærpelser: **M-11** dækker nu også påstande om et
  **tals ophav** (en lovhenvisning ved siden af et tal måles ved at finde samme tal et andet sted i
  programmet og sammenligne, hvad det dér henføres til – BB-075), og **M-13's prøve er udvidet i to
  retninger**: uenigheden om formen kan stå på ÉN skærm, hvor skærm og dokument er enige (BB-079),
  og den kan ligge latent i forskellige formateringskald for samme værdi (BB-078).
- **M-19, M-20** og **M-21** er tilføjet 2026-08-20 fra Varige mén → Ménberegning og er **alle tre
  afgjort samme dag** (M-19 og M-20 gennemført; M-21's udløsende fund afvist, se sporet ovenfor):
  - **M-19 – rødt læses som tomt af den flade, der låner værdien.** En spejlet værdi læses gennem
    den vej, der skjuler en rød fejl, så «tomt» og «forkert» bliver samme tekst: «Mangler». Prøven er
    at give feltet en **udfyldt-men-ugyldig** værdi og læse den lånende flade – og derefter læse hele
    skærmen, for en bounds-fejl læser den rå værdi og citerer den gerne tre linjer længere ned.
    **Mønsteret har allerede sin løsning i programmet** (Forsørgertabs `{error ?? «Mangler …»}`), så et
    fund her er en konvergensrettelse. Ekstra skarp ved parvise grænser (M-07): den RIGTIGE af to
    datoer bliver også rød og meldes derfor som manglende.
  - **M-20 – en feltnær oplysning hentet fra hele sidens beregning.** En gul feltadvarsel, der læser
    sin værdi af projektionen, arver projektionens alt-eller-intet og er tavs, indtil urelaterede
    felter er udfyldt. Prøven: **udfyld KUN det felt, oplysningen hører til.**
  - **M-21 – en CSS-klasse slår komponentens egen farve ihjel.** `.MuiTypography-root.row--text` har
    to klasser; MUI's `color`-prop og `sx={{ color }}` får én. Enkeltklassen taber altid, uden en
    advarsel fra noget værktøj. Målt syntetisk med en enkeltklasse-regel indsat EFTER app-stylesheetet
    – den taber alligevel. Programmet har en virksom vej: klasserne `text-muted` /
    `body-text-secondary`.
- **M-02 er skærpet** (BB-072): navneregelen er gennemført for datofeltet og fejlbeskederne, men ikke
  for de **afledte** labels – «Alder på skadestidspunkt» står to linjer under den række, programmet
  netop omdøbte til «Anmeldelsesdato». Prøven er at sætte skadestypen til Erhvervssygdom og læse hele
  fladen.
- **M-13 har fået en ny, svag forekomst** (BB-070): de to udgaver er enige om rækken og tallet, men
  ikke om formen – `formatAsAmount(x)` uden præcisionsargument i generatoren giver to decimaler, hvor
  skærmen giver nul.

- **M-17** og **M-18** er tilføjet 2026-08-19 fra Global shell og **begge afgjort og gennemført samme
  dag**; begge er nu normative i kontrakterne:
  - **M-17 – én oplysning delt over to lagerscoper.** `sessionStorage` hører til ÉN fane;
    `localStorage` og IndexedDB hører til hele browseren. En sagsnær oplysning, der er delt over to
    af dem, er kun konsistent, så længe der er én fane åben. Prøven er konkret: åbn programmet i to
    faner, lad hver sætte sin egen værdi, og se om den første stadig læser sin egen (BB-049).
    **Mønsterets skarpeste lære kom af rettelsen, ikke af fundet:** den bedste identitet er den, der
    ikke skal vedligeholdes. Spørg altid, om den manglende identitet allerede findes PÅ objektet
    (`handle.name`), før der lægges en parallel kopi ved siden af, som selv kan drifte.
  - **M-18 – globale genveje kender ikke overlay-stakken.** En `keydown`-lytter på `window` rammer
    uanset hvad der ligger ovenpå, så handlingen sker bag den åbne dialog, hvor brugeren hverken
    kan se den ske eller se dens resultat (BB-050). **Halvdelen om `preventDefault()` er tilføjet af
    BB-054:** en genvej må heller ikke SPÆRRE en tast, den ikke bruger – så mister brugeren også
    browserens egen adfærd, og tasten bliver et sort hul.
- **M-06 og M-08 har fået hver sin skærpelse samme dag – med modsat udfald.** M-06 rammer også, når to
  led i SAMME beslutning normaliserer teksten forskelligt (login trimmede i «har du skrevet noget», men
  ikke i «er koden rigtig»); **dens fund er gennemført**, og normaliseringen har nu ét sted.
  M-08 er større end links – hele sidemenuen ligger uden for `Container`s ring, så prøven er ikke «er
  elementet med i selectoren?», men «findes der en vej TILBAGE?» – men **dens fund er AFVIST**, og
  sporet er lukket: Tab-ringen findes for hurtig indtastning på én side, ikke for navigation.

- **M-15** og **M-16** er tilføjet 2026-08-19 fra MinProcesrente og **afgjort samme dag**:
  - **M-15 – skærmen tier, hvor dokumentet taler.** Spejlbilledet af M-13: generatoren skriver et
    forbehold til tallet, og skærmen har ingen pendant. **Afvist for MinProcesrentes vedkommende**
    (BB-040): brugerne bruger PDF'erne, og bristen er accepteret. Mønsteret står som en åben
    kandidat for EO's dokumenter og reguleringsbilaget, hvor tallet oftere læses på skærmen.
  - **M-16 – en komplet række, programmet ikke vil regne på.** Motoren har flere afvisningsgrunde
    end feltmodellen har fejl; afvisningen kommer derfor ud som et fravær (`-`, forsvundet ikon, grå
    knap) og spærrer hele fladens dokumenter. **Gennemført for rentetabellen** (BB-037, BB-038): de
    to afvisningsgrunde er flyttet ind i feltmodellen som `rule`-validatorer. **Mønsterets anden
    halvdel viste sig unødvendig:** jeg troede, blokeringsklassen også skulle udledes pr. tilstand
    (BB-039), men når årsagen er et rødt felt, udleder den eksisterende gate klassen korrekt af sig
    selv. Rettelsen hører altså i feltmodellen, ikke i gaten – det er mønsterets skarpere form.
- **M-14's sidste åbne kandidat er efterprøvet 2026-08-19, havde fejlen og er rettet** (BB-042).
  Datofelternes segmentbaserede paste kaldtes kun i et tomt felt. Prøve 2 var derimod bestået: en dato
  uden for grænsen bevares uafkortet. Segmentfortolkningen er BEVARET efter brugerens valg (den er en
  truffet beslutning, BB-003); det er tilstandsafhængigheden, der er væk. Afgørelsen tvang samtidig en
  rettelse af `input-field-behavior-contract.md` §1.2a punkt 7, som påstod et absolut forbud mod
  paste-only fortolkning og dermed modsagde BB-003 fem dage før.
- **M-02 og M-09 har fået hver sin skærpelse samme dag.** M-02 rammer også beskeder, der genkender
  en grænse på dens *værdi* i stedet for dens *ophav* («Datoen er efter dags dato», når maksimum i
  virkeligheden er et andet felt). M-09: når layoutskiftet og breddefrigørelsen hviler på hvert sit
  kriterium (viewport kontra input-modalitet), findes der altid en tilstand mellem dem.

- **M-13** og **M-14** er tilføjet 2026-08-18 fra Satser og **begge afgjort og gennemført samme dag**.
  Begge handler om, at **to steder træffer samme afgørelse hver for sig og bliver uenige**, uden at
  brugeren kan se det:
  - **M-13** – *nul er en oplysning, ikke et fravær.* Skærmen skjuler en række, når værdien
    mangler; dokumentet skjulte den, når værdien ikke var større end nul. **Bekræftet bindende af
    brugeren:** rækker, hvor værdien findes men er 0, vises begge steder. En `> 0`-prøve på synlighed
    er altid mistænkelig. Åben kandidat: reguleringsbilagets **kolonnevalg** i `reguleringDocument.ts`
    (otte tillægssatser + grundlønnen) – hører til Erstatningsopgørelse.
  - **M-14** er **omskrevet** – læs den nye form. Den hed *«indsat tekst samles af cifre uden hensyn
    til formens positioner»*, og **den præmis blev afvist**: brugeren fastholder, at paste altid skal
    give samme resultat som tastning, også når `01-02-2026` derved bliver `102` i et årsfelt. Mønsteret
    hedder nu *«en anden fortolkningsvej ved siden af tastningen»* og handler om paste-only fortolkere,
    der udleder en værdi af hele teksten – og som kun kaldes i et tomt felt. Åben kandidat:
    datofelternes `normalizeDatePaste`, den ene tilbageværende fortolker.

- **M-12 er KRAFTIGT INDSNÆVRET samme dag efter brugerens afgørelser – læs den nye form, ikke den
  oprindelige.** Mønsteret samlede oprindelig tre fravær (ingen kvittering, forskudt virkning, ingen
  vej tilbage), og **alle tre udløsende fund blev afvist**: forskudt virkning er den forventede
  adfærd, og fraværet af fortrydelse er et værn frem for en mangel. Tilbage står den skarpere prøve,
  BB-024 bestod:
  > *Er et valg blevet til en tilstand, brugeren ikke kan komme **ud** af igen?*

  Det handler altså nu om **en manglende valgmulighed**, ikke om manglende forklaring – typisk hvor
  en startværdi udledes af omgivelserne (systemtema, dato, en anden sides værdi) og fryses af
  brugerens første valg. **Et fund, hvis rettelse er «tilføj en forklarende linje», hører ikke
  længere hjemme her.**

- **M-01 til M-07** stammer fra Stamdata og handler om indtastning. Fire er omskrevet 2026-08-16
  efter brugerens afgørelser – læs dem i deres nye form, ikke i fundenes oprindelige.
- **M-08 til M-11** er tilføjet fra Om-fladen 2026-08-16 og handler om siden som helhed:
  M-08 links uden for tastaturrækkefølgen, M-09 fast indholdsbredde, M-10 flydende knapper der
  dækker indhold, M-11 programmets egne påstande om sig selv. Alle fire er skrevet om samme dag
  efter brugerens afgørelser og skal læses i den nye form:
  - **M-08** er afgjort for eksterne links i hele programmet: `ExternalLink` sætter `tabIndex={-1}`
    fast, og en AST-regel håndhæver det. Tilbage står kun **interne** links, der bærer noget,
    brugeren skal kunne handle på.
  - **M-09** har fået en grænse: 1536×864 er designmålet, og under den er afskæring accepteret.
    Mønsteret er dermed kun relevant **på eller over** den bredde.
  - **M-10** er skærpet: det afgørende er ikke, at en knap kan dække noget, men at indholdssøjlen
    ved designmålet går helt ud til vinduets kant, så en fast placeret knap altid lander oven i den.
  - **M-11** står uændret; begge fund bag det er nu afgjort som tekstrettelser. Mønsterets fælde er
    skrevet ind: et tekstfund om programmets egne påstande bliver let besvaret som et adfærdsfund.

## Noter til rækkefølgen

- Ingen justeringer. Om var nr. 2 som planlagt og viste sig at være en mindre flade at betjene, men
  en større at bedømme end antaget: den er programmets standard-startside og det eneste sted,
  programmet udtaler sig om, hvad der sker med brugerens oplysninger.
- Indstillinger var nr. 3 som planlagt. Fladen har tyve rækker og er dermed større end de to
  foregående, men hver enkelt kontrol er enkel; det tunge lå i at spore, **hvor** hver indstilling
  får virkning. Rækkefølgens præmis holdt: fundene her er generelle og vil kunne genkendes senere
  frem for at skulle genopdages.
- **To fund bør efterprøves igen på Erstatningsopgørelse-fladen** (nr. 12): BB-028 og BB-029 om de
  beregningstekniske valg er bedømt fra reglerne, men den konkrete oplevelse på EO-kontrolfanen er
  ikke set. Det samme gælder brevhovedernes virkning i et færdigt dokument (BB-026).
- Satser var nr. 4 som planlagt og var den mindste flade indtil nu at betjene: ét felt, én knap,
  fire rene visningssektioner. Til gengæld var den den mest udbytterige at **måle**, netop fordi
  den er lille nok til at kunne sammenlignes række for række med sit eget dokument for hvert af de
  22 dækkede år. Rækkefølgens præmis holdt igen: begge nye mønstre (M-13, M-14) er generelle og
  bærer konkrete kandidatsteder ind i de store flader.
- MinProcesrente var nr. 5 som planlagt, men var ikke en lille flade: den er en hel app med egen
  indgang, eget layoutspor (den eneste, der må vises på telefon) og en beregningstabel, den deler
  med Renteberegning. Rækkefølgens præmis holdt alligevel – otte af de tolv fund er generelle og
  gælder også Mineo-udgaven. **Konsekvens for flade nr. 8 (Renteberegning):** BB-037, BB-038,
  BB-039, BB-041, BB-043 og BB-047 stammer fra den delte fane, er afgjort her og skal ikke genopdages
  dér – rettelserne til dem virker allerede i Mineo-udgaven, fordi fanen er den samme komponent. Tilbage
  til nr. 8 står det Mineo-specifikke: brevhoved, stamdata-afhængighed, Word-formatet, fanens plads
  i sagen og samspillet med Gem/Hent.
- Varige mén var nr. 7 som planlagt, og fladen er delt i sine to faner (7a Ménberegning, 7b Satser),
  som `flader.md` foreskriver. **Ménberegning er en lille flade at betjene – to felter – men den er
  den første, der LÅNER en anden sides værdier**, og det var lånet, der bar tolv af de tretten fund.
  Rækkefølgens præmis holdt igen: tre af fundene er generelle nok til at blive mønstre, og M-21 er det
  bredeste hidtil (den rammer også `DocumentOutcomeMessage`, som alle flader bruger). **Justering af
  rækkefølgen: ingen.** Fanen Satser er meget lille (én tabel med to kolonner og 22 rækker) og bør
  kunne tages i næste kørsel uden yderligere deling.
- **Fane 7b (Satser) var som forudset den mindste flade hidtil**, og forudsigelsen holdt: den kunne
  tages i én kørsel uden deling. Rækkefølgens præmis holdt derimod kun halvt. Fanen bar ingen nye
  mønstre – der er ikke nok flade til, at en vane kan vise sig – men den bar til gengæld det
  hidtil tungeste **enkeltfund** (BB-075), netop fordi den er lille nok til, at hver af dens to
  sætninger kunne holdes op mod resten af programmet. **Læren til de store flader: en flade uden
  interaktion skal ikke bedømmes på sine kontroller, men på sine påstande** – hver sætning, der
  siger noget om, hvor et tal kommer fra, er et fund i vente.
- **Flade 8 (Renteberegning) har tre spor lagt ud til sig:** de seks fund fra MinProcesrente, der
  ikke skal genopdages (se ovenfor); BB-075's prøve på de to rentelovshenvisninger; og BB-077's
  spørgsmål om at markere sagens egen række i en satstabel. **Og ét lukket spor:** BB-074's
  afvisning gælder generelt – en pladsholder `0` er ikke et fund, heller ikke hvor feltets interval
  udelukker nul, fordi programmet svarer klart, når brugeren rent faktisk taster det.
- **Fane 8b (Satser) var som forudset lille** – to tabeller, ingen felter – og kunne tages i én
  kørsel uden deling. **Rækkefølgens præmis holdt, men på en ny måde:** fanen bar ingen nye mønstre,
  og alle fem fund er ord og sætninger omkring tabellerne, ikke tabellerne selv. Det er 7b's lære igen
  – *en flade uden interaktion bedømmes på sine påstande, ikke sine kontroller* – men denne gang gav
  den to fund med prioritet **Høj**, fordi to af påstandene navngiver en anden dato end den,
  beregningen bruger. **Læren til de store flader: læs forudsætnings- og forklaringstekster med sagens
  datoer i hånden.** En sætning som «ved forfaldsdato før 01-03-2013» kan afprøves på ét forsøg, mens
  en lovhenvisning ved siden af den slet ikke kan måles. **Justering af rækkefølgen: ingen.**
- **Fund fra 8b, der hører videre til flade 9 og frem:** BB-092's datoprøve på forudsætningsafsnit og
  BB-094's intervalprøve (datasættets nyeste række mod feltets øvre grænse). Begge er billige og kan
  køres på hver beregningsflade.
- **Tre spor er lagt ud til senere flader:** M-13's kolonnevalg i reguleringsbilaget hører til
  Erstatningsopgørelse (nr. 12); M-14's to tabelcelle-årsfelter hører til Årsløn (nr. 9) og
  Erstatningsopgørelse; og Gem/Hent med et ugyldigt satsår hører til Global shell (nr. 6), fordi
  filgemmedialogen ikke kan afprøves headless.
