# Review-plan for draft/commit-arkitekturen

**Formål:** Dette dokument er arbejdsgrundlaget for et samlet, adversarielt review af implementeringen af
`docs/architecture/draft-commit-greenfield-design.md`.

Det er ikke et review i sig selv, og det er ikke stedet hvor fund skrives. Det er en **statusflade**: en kort,
levende oversigt der altid gør det tydeligt

- hvor langt reviewet er nået,
- hvad der allerede er gennemgået,
- hvor mange fund der er åbne, og hvor de står beskrevet,
- og hvad der stadig mangler at blive kontrolleret.

Selve fundene bor i særskilte fase-rapporter (se "Fund og rapportstruktur"). Denne plan må ikke vokse til et
fundkatalog.

Det væsentligste mål med reviewet er at verificere, at slutproduktet er en **ægte fra-bunden-løsning**:

- bygget op mod det bedst mulige system,
- ikke unødigt fastholdt på legacy-strukturer,
- og kun beholdt, hvor den eksisterende løsning faktisk er den bedste løsning.

Hvis reviewet finder fejl, huller eller strukturbrud, er første respons ikke at lappe lokalt, men at tage et skridt
tilbage og undersøge, om problemet bør løses gennem en mere systematisk og ensartet omlægning.

## Udgangspunkt: et helt nyt review fra bunden

Dette review begynder forfra. Det tager **ikke** afsæt i, at kodebasen har været reviewet før.

Det er en bevidst metodisk beslutning, ikke en formalitet:

- **Tidligere reviews er ikke dækning.** At et område er blevet gennemgået før — af mig, af en ekstern
  review-runde eller i en work item — er ikke evidens for, at det er korrekt i dag. Et område regnes som
  ukontrolleret, indtil dette review har kontrolleret det.
- **Tidligere fund er ikke facit.** Rapporterne i `docs/reviews/`, de afsluttede work items i `work-items/` og
  designdokumentets egne statusafsnit læses ikke som konklusioner, der kan genbruges. De må gerne læses som
  beskrivelse af, hvad koden forsøger at gøre — aldrig som bevis for, at den gør det.
- **Et lukket fund er ikke et løst fund.** Reviewet må ikke springe et kontrolpunkt over med henvisning til, at
  et tidligere review erklærede det lukket. Netop de steder, hvor noget er erklæret lukket, er der ingen aktiv
  mistanke tilbage i systemet — og derfor størst risiko for at en rest står uset.
- **Statusmarkeringer er påstande.** Hver gang et dokument, en kommentar eller en work item siger "gennemført",
  "slettet" eller "dækket", er det en påstand, der skal efterprøves mod kildegrafen, AST'et eller en test, der
  kan fejle.
- **Ingen arvede undtagelser.** Reviewet starter uden en liste over "kendte accepterede afvigelser". Er en
  afvigelse acceptabel, skal dette review selv nå frem til det og skrive begrundelsen.

Reviewets objekt er kodebasens **nuværende tilstand**, målt mod målarkitekturen i
`draft-commit-greenfield-design.md` og de bindende kontrakter i `src/contracts/` — ikke mod migrationens forløb.

## Adversarielt review — den bindende metode

Alle review-pas i denne plan gennemføres som **adversarielle reviews**. Det er ikke en tone, det er en metode:
reviewet har til opgave at få implementeringen til at fejle, ikke at bekræfte at den ser rigtig ud.

### Grundregler

1. **Falsificér, bekræft ikke.** For hvert kontrolpunkt formuleres den konkrete måde, det kunne være brudt på, og
   der ledes efter den. "Jeg kunne ikke finde noget galt" er kun et resultat, hvis der faktisk er ledt efter et
   navngivet brud.
2. **Antag at påstanden er falsk, indtil mekanismen er set.** En kontrakt, en kommentar, en work item-status, et
   afsnit i designdokumentet og et testnavn er alle påstande. Evidens er kode, AST-forespørgsler, en kørt test
   eller en observeret fejl.
3. **Et værn skal kunne fejle.** For hvert værn, reviewet støtter sig på, skal det afgøres: kan det fejle i dag?
   Hvis reglens mål er slettet, er den grøn af tomhed. Hvis en allowlist peger på en fil, der ikke findes, er
   undtagelsen aktiv fra det øjeblik, en fil igen opstår på stien. Mutationstest, hvor det er billigt: bryd
   invarianten bevidst og se, at noget bliver rødt — bliver det rødt af en ANDEN grund, er det ikke evidens.
4. **Ret mutationen mod mekanismen.** En bevidst indført fejl skal ramme netop den mekanisme, kontrolpunktet
   handler om. En test, der fejler, fordi typecheck brød, beviser intet om runtime-invarianten.
5. **Strukturelle spørgsmål kræver et AST.** Spørgsmål om arv, rækkevidde, kald og imports besvares med
   `src/__tests__/quality/architecture/`-harnessets AST-værktøjer eller en tilsvarende AST-forespørgsel — ikke
   med tekstsøgning. En regex ser ikke, at `describe.skip` nedarver skip til sine børn, og kan ikke skelne kode
   fra kommentar.
6. **Fravær skal bevises som fravær.** At noget ikke længere bruges, er ikke det samme som at det ikke findes.
   Identifier- og import-værn måler brug; fysisk fravær af filer og mapper er sin egen kontrol.
7. **Gå efter den dyreste fejl først.** Prioritér de brud, der ville producere forkerte tal, tabe brugerdata,
   gemme ugyldigt input i `.eo` eller blokere lydløst — før strukturelle uskønheder.
8. **Én skeptiker er ikke nok på trust-kritiske fund.** Ved fund, der rammer beregning, persistens eller
   dokumentgates, skal konklusionen efterprøves fra en uafhængig vinkel, før den skrives som lukket.

### Adversarielle standardangreb

Hvert fase-pas skal aktivt forsøge mindst disse angreb, hvor de er meningsfulde:

- **Den maskerede værdi:** kan en tidligere gyldig værdi overleve et ugyldigt settle nogen steder — i en cache,
  en memo, en rækkekopi, en lukket editor eller en projektion?
- **Den fjerde kanal:** findes der en vej, hvor åben draft påvirker noget afsluttet — et effect, en ref, en
  `onChange`-afledt beregning, en gate, der læser DOM?
- **Den brede capability:** eksponerer noget `setState`, rå sektioner, hele settings-objektet eller en
  StoreApi, hvor et smallere interface ville gøre bruddet til en typefejl?
- **Den lydløse blokering:** kan en consumer blokere uden synlig fejl i contentboxen — eller omvendt blokere
  bredere end sine faktiske dependencies?
- **Den grønne af tomhed:** har værnet stadig et levende mål, og fejler det, hvis målet brydes?
- **Den tolerante load:** kan en gammel eller manipuleret `.eo` føre en værdi ind, som ingen consumer kan
  håndtere — eller føre til stille datatab uden preflight-rapportering?
- **Den stale token:** krydser noget en async-grænse uden at genlæse og sammenligne hele
  `EvaluationSourceToken` (input + settings)?
- **Den parallelle løsning:** løses samme problem to steder, hvor kun det ene sted er blevet rettet?
- **Den forældede beskrivelse:** beskriver en kommentar, kontrakt eller doc en mekanisme, der ikke længere
  findes — eller en tilstand, der var sand undervejs i migrationen, men ikke er det nu?

### Delegation til subagents

Brede fase-pas delegeres til subagents, når hovedtråden ellers ville fyldes med fil-dumps
(`AGENTS.md` → "Reviews og subagents"). Reglerne for delegation i dette review:

- Subagenten får et **falsificerende** opdrag: "find den konkrete måde X er brudt på", ikke "vurdér om X ser
  rigtigt ud".
- Subagenten skal returnere **evidens** (fil + linje, AST-resultat, kørt kommando + udfald) — ikke en vurdering.
- Subagenten må ikke få tidligere review-rapporter som grundlag. Den skal måle koden mod målarkitekturen og
  kontrakterne, ikke mod hvad et tidligere review konkluderede.
- Hovedtråden ejer konklusionen. Et subagent-fund skrives ikke ind som fund, før hovedtråden har efterprøvet
  evidensen. Subagenter tager fejl, og et selvsikkert formuleret fund uden verificerbar evidens er et
  ikke-fund.
- Ved trust-kritiske fund bruges to uafhængige subagents med forskellig vinkel frem for én.

## Arbejdsprincipper

1. **Slutproduktet først.** Vurder altid, om den nuværende løsning reelt er det bedste slutprodukt, eller om den
   blot viderefører en gammel form.
2. **Systematik før patches.** Når et fund kan løses ved at konsolidere struktur, hjælpefunktioner, state-flow eller
   ejerskab, skal det foretrækkes frem for et lokalt plaster.
3. **Én rød tråd.** Slutproduktet skal være velstruktureret, ensrettet og let at auditere. Parallelle løsninger for
   samme concern er et advarselsflag.
4. **Ingen skjult kompatibilitet.** Legacy-bevaring er kun acceptabel, hvis den er bevidst og dokumenteret som den
   bedste løsning for den konkrete del.
5. **Foretræk typegrænsen frem for værnet.** Kan en grænse udtrykkes som en type, så bruddet bliver en
   compilerfejl, er det stærkere end en AST-regel, der skal jage det.
6. **Koden skal beskrive sig selv som færdig.** Kommentarer, navne og docs skal beskrive systemet, som det er —
   ikke rejsen derhen. Se fase R1 og R9.
7. **Dokumentér undervejs.** Hvert review-skridt skal efterlade spor: fund i fase-rapporten, status her.
8. **Luk fund ordentligt.** Fund skal enten være rettet, parkeret som åbne beslutninger eller eksplicit vurderet som
   acceptable — aldrig blot forsvinde.

## Mandat, grænser og autoritet under reviewet

- `AGENTS.md` fastlægger mandat, godkendelsesgrænser og kvalitetsgate. Ved konflikt gælder `src/contracts/*.md`
  over denne plan.
- Designdokumentets §12 (bindende arbejdsaftale) gælder også for dette review: alle proces- og kodebeslutninger
  træffes af agenten. Brugeren forelægges **kun** ændringer med egentlig synlig UI/UX-betydning eller
  beregningsmæssig virkning, og altid som konkrete brugeroplevelser — aldrig som teknisk arkitektur- eller
  scope-spørgsmål.
- Designdokumentets §5.4 og §9's hårde stop gælder: finder reviewet en ændring, der ville flytte et tal, ændre
  dokumentindhold eller ændre ikke-godkendt synlig adfærd, stoppes der og forelægges — også når ændringen ser ud
  som en oplagt fejlrettelse.
- Reviewet ejer kontrakterne på samme vilkår som implementeringen: står en kontrakt i vejen for det bedst mulige
  slutprodukt, rettes kontrakten frem for at følge den blindt. Ved tilføjelse/fjernelse/omdøbning følges
  `docs/architecture/contract-topology-procedure.md`, og `contract-topology.json` opdateres i samme ændring.
- Reviewet må ikke udvide feature-fladen. §11's ikke-mål gælder uændret.

## Fund og rapportstruktur

Fund skrives **ikke** i denne plan. Planen ville ellers vokse til flere tusinde linjer og holde op med at fungere
som status.

### Filstruktur

| Fil | Indhold |
|---|---|
| `docs/review/draft-commit-greenfield-review-plan.md` | Denne plan: metode, faser, status, tælling af fund og henvisninger. |
| `docs/review/draft-commit-review/R<n>-<slug>.md` | Én rapport pr. fase. Alle fasens fund, evidens, angreb og konklusioner. |
| `docs/review/draft-commit-review/grill-me-konvergensreview.md` | Supplerende tværgående konvergensreview med 15 yderligere fund (GM-F01–GM-F15), som skal behandles sammen med fasefundene. |
| `docs/review/draft-commit-review/fund-oversigt.md` | Samlet, kort registerlinje pr. fund på tværs af faser, konvergensreview og brugertest. Bærer desuden den bindende rettelsesrækkefølge og reglen for tilfældighedsfund. |
| `docs/review/draft-commit-brugertestfund.md` | Brugerens brugertestfund (UT-F01–UT-F06) med reproduktion, kerneårsag og løsningsretning. |
| `work-items/WI-<nnn>-<slug>.md` | Fund der er for store til at rette i reviewets løb, efter `work-items/_TEMPLATE.md`. |

Fase-rapporterne oprettes efterhånden som faserne startes — ikke på forhånd.

### Fund-id

Hvert fund får et stabilt id: `R<fase>-F<løbenummer>`, fx `R3-F02`. Id'et bruges i fase-rapporten, i
fund-oversigten, i eventuelle work items og i commit-beskeder. Numre genbruges ikke, heller ikke når et fund
afvises.

### Hvad der står hvor

- **I fase-rapporten:** hele fundet — beskrivelse, evidens, angrebet der fandt det, vurdering, anbefaling,
  løsning, status.
- **I fund-oversigten:** én linje: id, kort titel, alvor, lokation, status, rapport-reference.
- **I denne plan:** kun tal og status pr. fase, plus henvisning til rapporten. Ingen fundbeskrivelser.

### Standardformat for et fund (i fase-rapporten)

```md
### R<n>-F<nn> — [kort titel]

**Lokation:** [fil / modul / funktion — med linje hvor det er muligt]
**Problem:** [konkret beskrivelse af hvad der er galt]
**Evidens:** [AST-resultat / kørt kommando + udfald / mutationstest / kodecitat]
**Angrebet der fandt det:** [hvilket adversarielt angreb der afslørede det]
**Konsekvens:** [forkerte tal / datatab / lydløs blokering / forældet beskrivelse / kun strukturel]
**Alvor:** [kritisk / væsentlig / mindre]
**Strukturel vurdering:** [lokalt symptom / tegn på bredere problem / ukendt]
**Overvejelse:** [hvilket mønster eller hvilken systemisk årsag der kan ligge bag]
**Anbefaling:** [foretrukken retning — lokal rettelse eller systematisk omlægning]
**Forslag til løsning:** [konkret løsning eller løsningsretning]
**Kræver godkendelse:** [nej / UI/UX / beregningslogik]
**Status:** [rettet / parkeret / kræver godkendelse / under videre analyse / hypotese / afvist med evidens]
```

Hvis et fund peger på et bredere mønster, skal det fremgå eksplicit. Reviewet skal ikke kun notere den enkelte
fejl, men også overveje, om fejlen afslører parallelle løsninger, uklar ejerskabsplacering, unødvendig kompleksitet
eller anden arkitektonisk drift.

Et fund uden efterprøvet evidens registreres som **hypotese**, ikke som fund. Hypoteser er tilladte og nyttige,
men de må ikke tælles med i en fases exitkriterier, og de må ikke lukkes som "vurderet acceptabel" uden at være
undersøgt.

## Review-status

**Overordnet status:** I gang

**Aktuel fase:** R0–R8 delvist gennemgået. Rettearbejdet er begyndt og følger den bindende
rettelsesrækkefølge i [fund-oversigt](draft-commit-review/fund-oversigt.md); R9 køres til sidst.

**Sidst opdateret:** 2026-07-28

**Baseline:** branch `greenfield`. Baseline fastlægges og efterprøves i fase R0 — den overtages ikke fra
designdokumentets statusafsnit.

### Fasestatus

| Fase | Emne | Status | Fund (åbne/i alt) | Rapport |
|---|---|---|---:|---|
| R0 | Baseline, kortlægning og værnenes troværdighed | Delvist gennemgået | 3/3 | [R0-baseline-og-vaern](draft-commit-review/R0-baseline-og-vaern.md) |
| R1 | Kontrakter, dokumentation og sluttilstandssprog | Delvist gennemgået | 7/7 | [R1-kontrakter-og-sluttilstandssprog](draft-commit-review/R1-kontrakter-og-sluttilstandssprog.md) |
| R2 | Inputkerne, felteditor og afsluttet input | Delvist gennemgået | 2/3 | [R2-inputkerne-og-felteditor](draft-commit-review/R2-inputkerne-og-felteditor.md) |
| R3 | Feltvurdering, issue-model og gates | Delvist gennemgået | 4/4 | [R3-issues-og-gates](draft-commit-review/R3-issues-og-gates.md) |
| R4 | Persistence, session, `.eo` og undo/redo | Delvist gennemgået | 2/2 | [R4-persistence-session-eo-undo-redo](draft-commit-review/R4-persistence-session-eo-undo-redo.md) |
| R5 | Domæneprojektioner og beregningsflow | Delvist gennemgået | 2/2 | [R5-domaeneprojektioner-og-beregningsflow](draft-commit-review/R5-domaeneprojektioner-og-beregningsflow.md) |
| R6 | Dokumentoutput og generatorer | Delvist gennemgået | 4/4 | [R6-dokumentoutput-og-generatorer](draft-commit-review/R6-dokumentoutput-og-generatorer.md) |
| R7 | Pages, shell, porte og UI-struktur | Delvist gennemgået | 3/3 | [R7-pages-shell-porte-og-ui-struktur](draft-commit-review/R7-pages-shell-porte-og-ui-struktur.md) |
| R8 | Testkvalitet, kvalitetsværn og acceptmatrix | Delvist gennemgået | 8/8 | [R8-testkvalitet-vaern-og-acceptmatrix](draft-commit-review/R8-testkvalitet-vaern-og-acceptmatrix.md) |
| R9 | Tværgående konvergens og slutkontrol | Ikke startet | 0/0 | — |

**Supplerende konvergensreview:** Gennemgået — 15 fund (GM-F01–GM-F15) i
[grill-me-konvergensreview](draft-commit-review/grill-me-konvergensreview.md). Rapporten supplerer
fasegennemgangene og erstatter ikke R9's afsluttende exitkriterier.

**Brugertestfund:** 6 fund (UT-F01–UT-F06) i
[draft-commit-brugertestfund](draft-commit-brugertestfund.md) — 1 afvist med evidens, 2 rettet, 3 åbne.

**Fund i alt:** 59 — 52 åbne, 5 rettet (UT-F04, UT-F05, R2-F01, INC-F01, INC-F02) + 1 delvist (GM-F14),
1 afvist (UT-F01). Etape 1 og 2 af rettelsesrækkefølgen er lukket. Tælling og rettelsesrækkefølge
vedligeholdes i [fund-oversigt](draft-commit-review/fund-oversigt.md).

**Tilfældighedsfund:** Fund konstateret undervejs i rettearbejdet skal enten rettes straks eller skrives ind
som nyt fund — aldrig blot nævnes i chatten. Reglen er bindende og står i
[fund-oversigt](draft-commit-review/fund-oversigt.md).

**Åbne godkendelsespunkter:** 0 — anbefalingerne i
[grill-me-konvergensreview](draft-commit-review/grill-me-konvergensreview.md) samt R5-F01, R6-F02 og R7-F03
er godkendt til implementering; se `docs/review/draft-commit-review/fund-oversigt.md`

**Åbne hypoteser:** 5 — se fase-rapporterne

## Sådan bruges dokumentet

- Før hvert review-pas læses den relevante fase, dens kontrolpunkter og de normative kilder, den peger på.
- Fasens rapport oprettes ved fasens start i `docs/review/draft-commit-review/`.
- Fund skrives i fase-rapporten med det samme og får en linje i fund-oversigten. De må ikke kun blive i chatten.
- Denne plan opdateres efter hvert pas: fasestatus, fundtælling, aktuel fase, dato.
- Når en fase er afsluttet, sættes dens status med den evidens, der bærer markeringen — evidensen står i
  rapporten, ikke her.
- Hvis der opstår større strukturelle fund, registreres de i rapporten for den fase, hvor de blev opdaget, også
  hvis de vedrører et andet område. Den berørte fase noteres i fundet.
- Hvis et problem viser sig at være symptom på et dybere arkitekturproblem, skal reviewet flyttes fra symptom til
  årsag, før der konkluderes.
- Bliver et fund for stort til at rette i reviewets løb, oprettes en work item i `work-items/` efter
  `work-items/_TEMPLATE.md`, og fundet krydsrefereres begge veje. Reviewet afgiver ikke ejerskab ved at oprette
  WI'en.

## Review-faser

Faserne herunder er reviewets arbejdsdeling. De følger målarkitekturens opbygning, ikke migrationens forløb.
Rækkefølgen er anbefalet, ikke bindende — men fase R0 skal ligge først, og fase R9 sidst.

Hver fase afsluttes med en fase-note i sin egen rapport efter skabelonen nederst i dokumentet.

### Fase R0 — Baseline, kortlægning og værnenes troværdighed

Formål: etablere et efterprøvet udgangspunkt og afgøre, hvilke af de eksisterende værn reviewet overhovedet kan
støtte sig på.

Denne fase er placeret først, fordi resten af reviewet ellers ville arve implementeringens egen målestok. Hvis et
værn er grønt af tomhed, er alt, det "beskytter", ukontrolleret.

Kontroller:

- arbejdstræets aktuelle tilstand, og en selvmålt baseline for gates (typecheck, lint, testantal, ledger, build)
  — målt, ikke overtaget fra et dokument,
- hvilke filer der faktisk udgør den aktuelle arkitektur (`src/inputCore/`, `src/persistence/`, `src/document/`,
  domæneprojektionerne, porte og shell),
- hvilke dele der er historiske rester, migreringsspor eller bevidst bevaret struktur,
- at `src/__tests__/quality/architecture/`-harnessets regler hver har et **levende mål** — ikke kun en fixture
  de kan flage,
- at alle allowlists i kvalitetsværnene peger på filer, der findes i kildegrafen,
- at `deletionLedger`-kontrollen faktisk dækker fysisk fravær, ikke kun manglende brug,
- at `acceptanceMatrix.test.ts` binder hvert af sine punkter til en aktiv testdeklaration, og at
  `knownLimitation`-felterne peger på WI-filer, der findes,
- hvilke invarianter der reelt er testdækket, og hvilke der kun ser dækkede ud.

Adversarielt fokus: vælg et repræsentativt udsnit af værn og **bryd deres mål bevidst**. Bliver de røde? Bliver de
røde af den rigtige grund?

Exitkriterier:

- der findes en selvmålt, efterprøvet baseline,
- scope er afgrænset,
- og rapporten indeholder en eksplicit liste over hvilke værn reviewet stoler på, hvilke det ikke stoler på, og
  hvorfor.

### Fase R1 — Kontrakter, dokumentation og sluttilstandssprog

Formål: sikre at al normativ og forklarende tekst — kontrakter, arkitekturdocs, kodekommentarer, navne og
testbeskrivelser — beskriver systemet, som det er nu, i sin færdige form.

Dette er ikke kosmetik. En kommentar, der beskriver en mellemtilstand som nutid, er en aktiv fejlkilde: den næste
læser træffer beslutninger på et forkert grundlag, og et review kan ikke skelne "bevidst bevaret" fra "glemt
rest". Det er samme fejlklasse som kontraktdrift, blot i kommentarlaget.

#### R1a — Kontrakt- og dokumentdrift

Kontroller:

- at de bindende kontrakter i `src/contracts/` beskriver den nuværende arkitektur, ikke en mellemform,
- at `contract-topology.json` er konsistent med de faktiske kontraktfiler og deres klassifikation,
- at `error-contract.md` §1.1's konsekvensmatrix stemmer med designets §1.6-tabel og med koden,
- at arkitekturdocs i `docs/architecture/` ikke fastholder gamle mellemformer som norm,
- at der ikke ligger parallelle forklaringer af samme concern i forskellige dokumenter,
- at `docs/domain/`, `docs/implementation/` og rod-`README.md` beskriver den nuværende tilstand,
- at designdokumentets egne statusafsnit ikke beskriver noget som gennemført, der ikke er det.

#### R1b — Migrationssprog ud af kode og docs

Systemet skal ikke længere omtale sig selv som en igangværende omlægning. Konkret skal reviewet finde og fjerne
eller omskrive:

- **`greenfield` som beskrivelse af den nuværende løsning.** Ordet betegner en migrationsstrategi, ikke en
  arkitektur. En kommentar som "Greenfield-migreret side" eller "kører nu på greenfield-inputCore" fortæller
  læseren, hvad der skete, ikke hvad der gælder. Den skal beskrive mekanismen: hvilken write-grænse siden bruger,
  og hvilken kontrakt der styrer den. Gælder kommentarer, JSDoc, `describe`/`it`-navne, variabel- og typenavne,
  filnavne og mappenavne.
- **Fase-, trin- og WI-referencer i kode.** "Fase 3", "§2.4 trin 7", "WI-002 trin 3", "trin 13", "Pass 2" og
  lignende peger på et forløb, der er slut. Henvisninger til normative §-numre i kontrakter og designdokumentet
  bevares — de peger på en gældende regel. Henvisninger til *migrationens* faseinddeling fjernes.
- **Midlertidighedsmarkører.** "midlertidig", "indtil videre", "for nu", "endnu ikke migreret", "TODO",
  udkommenteret kode og forbrugere beskrevet som "midlertidigt ubrugte". Hver enkelt skal enten være blevet
  permanent (og beskrives sådan) eller være en reel rest, der skal fjernes. Ingen af delene må stå uafklaret.
- **`legacy` brugt om noget, der ikke længere findes.** Omtale af slettede mekanismer i nutid. En absence-liste
  eller et værn SKAL nævne slettede navne — det er dens formål; sondringen skal respekteres.
- **Sammenlignende formuleringer.** "erstatter den gamle …", "i modsætning til tidligere", "den nye runtime" —
  når der ikke længere findes en gammel eller en anden runtime at sammenligne med.
- **Migrationsinventarer, der har overlevet deres formål.** `src/inputCore/ledger/` blev oprettet som en
  midlertidig migrationscheckliste (designets §6). Reviewet skal afgøre, om det stadig har et levende ansvar som
  coverage-backstop — og i så fald beskrive det som dét — eller om det skal fjernes.

Fremgangsmåde: kortlæg først omfanget maskinelt (AST for identifiers og `describe`-navne; tekstsøgning er kun
tilstrækkelig for kommentarindhold), klassificér hver forekomst som *slet*, *omskriv* eller *bevar bevidst*, og
gennemfør omskrivningen som en systematisk sweep — ikke fil for fil, efterhånden som de tilfældigvis læses.

Bevidste undtagelser er tilladt, men skal navngives i rapporten med begrundelse. Kandidater: designdokumentets
og denne plans egne filnavne (de dokumenterer en historisk beslutningsproces), branchnavnet, og absence-værn,
hvis formål er at nævne det slettede.

Overvej at afslutte fasen med et værn, der forhindrer, at migrationssproget genopstår — men kun hvis det kan
formuleres, så det ikke rammer de bevidste undtagelser eller de normative §-henvisninger.

Adversarielt fokus: tag et udvalg af normative sætninger og find den kode, der modsiger dem. Kontraktdrift går
begge veje — koden kan være foran dokumentet lige så vel som bagud. Og tag et udvalg af kommentarer og spørg: er
det her stadig sandt, eller var det sandt den dag det blev skrevet?

Exitkriterier:

- kontrakter, designdokument, docs og kode peger samme vej,
- ingen kommentar, navn, type eller testbeskrivelse omtaler systemet som en igangværende omlægning,
- hver bevaret forekomst af migrationssprog er navngivet og begrundet i rapporten,
- og der er ikke uklarhed om, hvad der er norm, og hvad der er historik.

### Fase R2 — Inputkerne, felteditor og afsluttet input

Normativt grundlag: §1.1–1.5, §1.8, §1.11, §3.1–3.6, §3.8, §7.1–7.2, §7.4.

Formål: validere at inputmodellen faktisk er bygget op omkring det besluttede princip.

Kontroller:

- at åben draft, afsluttet input og afledt projektion er reelt adskilt (§1.2),
- at der ikke findes skjulte live-preview-veje,
- at XOR-invarianten holder: intet aktuelt felt kan samtidig have ikke-tom canonical værdi og rejected raw (§1.5),
- at et ugyldigt settle faktisk fjerner den tidligere værdi fra current state — ikke blot maskerer den,
- at settle/cancel/navigation opfører sig ens på formular og tabel (§1.3),
- at Escape ikke udsteder en command, og at et efterfølgende blur ikke settler,
- at der findes én felteditor og ét codec pr. inputfamilie på tværs af form og grid (§3.3, §3.5),
- at et lukket felt ikke har værdibærende lokal kopi, pending guard, fingerprint eller resync-effect (§3.5),
- at alle autoritative ændringer går gennem `dispatchInput(command, origin)` og dens 8-trins-procedure (§3.6),
- at det styrende valgs før/efter-procedure kun rydder felter med overgangen `relevant → irrelevant`, der havde
  en aktiv rød feltfejl (§3.6, §1.9),
- at placeholder-promotion og første settle er én command, og at rækkeinfrastrukturen ikke holder en
  konkurrerende værdikopi (§3.8, §1.11),
- at samme concern ikke håndteres forskelligt i forskellige inputflader uden saglig grund.

Adversarielt fokus: forsøg at konstruere en sekvens, hvor en afløst værdi overlever, hvor en draft påvirker en
gate, eller hvor to settles giver to history-trin. §7.2's obligatoriske statekæder er minimum, ikke maksimum —
led efter kæden, der ikke står der.

Hvis der findes flere måder at løse samme inputproblem på, skal reviewet undersøge, om de kan samles til én
kanonisk model.

Exitkriterier:

- inputadfærd er ensartet på tværs af form og grid,
- kanonisk tilstand er tydelig og XOR-invarianten er efterprøvet,
- og der er ingen parallelle inputveje, som blot eksisterer af historiske grunde.

### Fase R3 — Feltvurdering, issue-model og gates

Normativt grundlag: §1.6–1.10, §3.4, §7.3.

Formål: sikre at fejl-, blokerings- og save-semantikken er strukturel og deterministisk — ikke konfigurerbar per
issue.

Kontroller:

- at `ValidationReader` og den offentlige `InputReader` har de to snævre grænser i den faste rækkefølge, uden
  cirkularitet (§3.4),
- at den offentlige reader ikke eksponerer en værdi fra et felt med aktiv feltfejl,
- at der ikke findes lagrede `blocksSave`/`blocksProjection`-booleans, og at save-gaten udledes strukturelt af
  `rejectedInputs` — ikke af issuefarve eller reason (§1.6),
- at §1.6-matrixens fem rækker holder i kode: format, range/bounds, feltplaceret domæneregel, tomt/`missing`,
  warning,
- at tomhed aldrig giver rød markering og aldrig blokerer `.eo` (§1.7),
- at et felt viser højst én aktiv rød fejl, valgt af en central deterministisk prioritet (§1.8),
- at range-/datotooltips viser faktiske grænser, og at `min > max` forklares med de inputs, der skabte grænserne,
- at fejl og warnings afledes fra afsluttet input, og at mounted komponenter ikke rapporterer dem til en store
  (§1.8, §10-kriterium 22),
- at blokering er afhængighedsspecifik: række 2's fejl blokerer ikke række 1 og 3, men blokerer totalen (§1.10),
- at et blokeret område ikke lader et tidligere resultat stå som gyldigt (§1.10),
- at dependency-gates er udledt af hvad motorerne **faktisk** læser — inklusive klipningsgrænser på tværs af
  sektionsgrænser.

Adversarielt fokus: led efter både **overblokering** og **underblokering**. En overblokering er ikke "sikker" —
den er lige så meget en fejl som et falsk tal. Prøv særligt at finde en consumer, der blokerer uden synlig fejl i
contentboxen.

Exitkriterier:

- konsekvenserne af en fejl følger struktur og dependencies, ikke flag,
- ingen lydløs blokering og ingen overblokering,
- og save-sondringen mellem rejected og canonical er efterprøvet i kode.

### Fase R4 — Persistence, session, `.eo` og undo/redo

Normativt grundlag: §1.4, §1.12, §3.1, §3.7, §3.9, §3.10, §7.4–7.5.

Formål: sikre at state-håndtering er trust-kritisk korrekt og strukturelt enkel.

Kontroller:

- at `.eo`-save er atomisk og fail-closed og følger §3.9's seks trin i rækkefølge,
- at `.eo` kun indeholder schema-gyldigt canonical input og aldrig rejected raw (§1.12),
- at save blokeres før fil-I/O ved aktivt relevant rejected input, og at tomhed og warnings ikke blokerer,
- at load er tolerant på den rigtige måde og ikke genskaber skjult legacy-adfærd,
- at preflight rapporterer strippet/droppet data med reconcilierende tal ved load,
- at en gammel `.eo` med en nu-ugyldig bounds-værdi kan indlæses, vises og gemmes igen, mens den fortsat blokerer
  afhængige consumers (§1.12),
- at sessionen har én current-only envelope uden `fieldAddressVersion`-bro, sentinel-adresser eller
  legacy-migrator (§3.7),
- at sagsinput ligger i ÉN envelope, og at skrivegrænsen er compiler-håndhævet (`ManifestStorageKey`),
- at current-session-korruption håndteres fail-closed hele vejen, og at kun eksplicit `Slet alt` kan fjerne den
  korrupte kilde (§1.12),
- at bootstrap aldrig stiltiende starter tomt og senere overskriver kilden,
- at history kun snapshotter afsluttet input og fokus-origin, og at restore skriver sessionen først (§3.7),
- at undo/redo giver nye monotone revisioner og navigerer til origin-lokationens route+fane,
- at load/reset/`Slet alt` gennemføres uden settle og kun kasserer draften ved succes (§1.4),
- at porten aldrig læser produktions-singletonen direkte, men altid gennem `captureStableSource()`, og at ingen
  binding eksponerer en `StoreApi` (§3.10),
- at hver port har ét ansvar og ikke både eksponerer reads, raw writes, UI-notices og persistence.

Adversarielt fokus: angrib den stabile dobbeltlæsning og retry-grænsen. Angrib rollback-stien — hvad sker der ved
serialization-, storage- og store-fejl midt i en command? Led efter en vej, hvor en gennemført handling efterlader
storage og runtime uenige.

Hvis fund her viser, at persistence er bygget oven på en forkert inputmodel, skal reviewet tilbage til fase R2 og
rette årsagen før symptomet.

Exitkriterier:

- data kan bevares og genskabes uden skjulte sidekanaler og uden stille datatab,
- fail-closed holder på alle de kritiske stier,
- og persistence-laget er enkelt nok til at kunne auditeres.

### Fase R5 — Domæneprojektioner og beregningsflow

Normativt grundlag: §3.4, §3.9, §5.4, §7.3.

Formål: sikre at beregningerne er rene, konsoliderede og kun fodres fra gyldige projektioner.

Kontroller:

- at domæneprojektioner er almindelige rene funktioner, som læser konkrete refs og returnerer `ready | blocked`,
- at de aldrig modtager rå sektioner, og at ingen beregnings-, save- eller dokumentkode kan importere raw
  canonical sections (§10-kriterium 28),
- at beregningsmotorer aldrig kaldes fra en `blocked` projektion (§7.3),
- at der ikke findes en generisk projektions-DSL eller en parallel blocker-model,
- at dependency følger de refs, funktionen faktisk læser — ikke et manuelt `global | section | row`-scope,
- at rækkeprojektioner isolerer andre rækker, og at aggregater inkluderer alle valgte rækker,
- at samme beregningsproblem ikke er implementeret på flere måder,
- at snapshot-omfanget er som besluttet (snapshot-first kun for EO/EET/forsørgertab),
- at `EvaluationSourceToken` genlæses og sammenlignes ved hver async-grænse.

Adversarielt fokus: find den projektion, der returnerer `ready` på et grundlag, den ikke selv har verificeret —
eller som læser en værdi, den ikke har erklæret som dependency. Kontrollér, at tal er uændrede: enhver ændring i
et beregnet tal er et §5.4-stop, uanset om den ser ud som en forbedring.

Hvis en beregningsdel ser korrekt ud, men arkitektonisk skæv, skal reviewet prioritere struktur og rød tråd frem for
at acceptere et "godt nok" resultat.

Exitkriterier:

- beregninger er konsistente og tal er beviseligt uændrede for gyldige fixtures,
- projektionerne er rene og deres dependencies er præcise,
- og der er en tydelig sammenhæng mellem model, projektion og output.

### Fase R6 — Dokumentoutput og generatorer

Normativt grundlag: §3.9, §10-kriterium 27, `document-output-contract.md`, `document-format-contract.md`.

Formål: verificere at dokumentoutput bygger på den samme målarkitektur som resten af systemet.

Kontroller:

- at hvert af de 18 dokumentoutputs har én typed definition, der ejer projektion og output-invariants,
- at samme definition bruges af både reaktiv gate og click-preflight (§10-kriterium 27),
- at generatoren kun modtager et kilde-tokenbundet `PreparedDocument<T>`,
- at dokumententrypoints ikke omgår prepare,
- at et dokument kun blokeres af egne dependencies og egne output-invariants (§1.10),
- at en download aldrig blokeres uden synlig fejl i contentboxen,
- at der ikke sker lazy-load, generatorarbejde eller fil-I/O ved blokering (§7.5),
- at PDF- og Word-veje deler definition og gate, og at gaten er formatuafhængig,
- at projektionskonteksten ikke ser mere af `SourceSettings`, end den har brug for — en formatafhængighed skal
  være en typefejl, ikke noget en test skal jage,
- at click-preflight læser et **frisk** token efter settle, ikke et fanget fra render,
- at output ikke er delt op i konkurrerende løsninger for samme dokumenttype.

Adversarielt fokus: undersøg om en formatafhængighed kan gemme sig i en projektions ready-gren, som en
blocked-mod-blocked-sammenligning ikke ville fange. Undersøg samtidig, om andre dele af settings-objektet har
givet anledning til utilsigtede afhængigheder.

Hvis et dokumentområde er vokset organisk, skal reviewet undersøge, om det kan samles i en tyndere og mere
gennemsigtig outputstruktur.

Exitkriterier:

- dokumentoutput er ensartet og gate/preflight deler definition,
- ingen lydløs download-blokering,
- og der er ikke flere konkurrerende måder at generere samme type output på.

### Fase R7 — Pages, shell, porte og UI-struktur

Normativt grundlag: §3.10, `page-component-contract.md`, `app-shell-contract.md`.

Formål: sikre at brugerfladen er tynd, ensartet og tydeligt orkestreret omkring den autoritative kerne.

Kontroller:

- at sider ikke ejer domæne- eller persistenceansvar, de ikke burde eje,
- at view-model-laget er gennemført: `useXxxViewModel` + sektion-komponenter, uden logik/JSX flyttet tilbage inline,
- at shell og bootstrap ikke bærer unødigt arkitekturansvar,
- at hver app-variant initialiserer sin ene aktive runtime før render, og at provider-remount aldrig rehydrerer
  eller overskriver input (§3.10),
- at transiente UI-flader ikke kan skrive sagsinput, og at der ikke findes en parallel felt-komponentfamilie,
- at persisted controls kræver konkrete refs,
- at UI-mønstre er ensrettede, og at der ikke findes gamle side- eller viewmodelmønstre, som overlever af vane,
- at fokusdestination er editorlokationens metadata og ikke datafeltets identitet (§3.2).

Adversarielt fokus: led efter den side, der er blevet monolitisk, og spørg først, om det er et tegn på, at ansvaret
er placeret forkert et andet sted i systemet. Led efter en UI-vej, der omgår bindingen.

Exitkriterier:

- UI er tynd og strukturel,
- og ejerskabet er placeret det rigtige sted.

### Fase R8 — Testkvalitet, kvalitetsværn og acceptmatrix

Normativt grundlag: §7, §10.

Formål: sikre at tests og værn beskytter invarianter, ikke implementering — og at de kan fejle.

Denne fase forudsætter R0's værn-inventar og går et lag dybere: R0 spurgte "kan værnet fejle?", R8 spørger
"beskytter det den rigtige invariant, og er invarianten den, designet kræver?".

Kontroller:

- at §7.1's fælles feltkontrakt faktisk køres mod både form- og grid-adapteren for hver codecfamilie,
- at §7.2's obligatoriske statekæder er dækket, og at hvert trin hævder alle de krævede aspekter — canonical slot,
  rejected råtekst, visning, feltissue, consumerstatus, `.eo`-gate, dokumentgate, revision og history,
- at §7.3's issue-/gate-matrix er dækket,
- at §7.4's transaktionsinvarianter er dækket for hver command-type,
- at §7.5's kritiske handlinger er dækket ens for form og grid,
- at §10's 30 acceptkriterier hver har en dækningskilde, der kan fejle,
- at acceptmatrixens punkter er bundet til aktive testdeklarationer via AST, ikke tekstsøgning,
- at tests ikke er skrøbelige eller over-mocket, og at de ikke kun hævder implementeringsdetaljer,
- at quality guards matcher den faktiske arkitektur og ikke en tidligere,
- at der ikke findes implementeringsspecifikke tests, som kun beskytter afløste mekanismer,
- at testbeskrivelser (`describe`/`it`) navngiver den invariant, de hævder — ikke migrationsfasen, de opstod i
  (jf. R1b).

Adversarielt fokus: vælg de invarianter, hvor et brud ville være dyrest, og **bryd dem i arbejdstræet**. Fejler
suiten? Fejler den af den rigtige grund? En invariant uden en test, der kan fejle på den, er ikke beskyttet, uanset
hvor mange tests der nævner den.

Exitkriterier:

- de vigtigste invarianter er testet med tests, der beviseligt kan fejle,
- §10's kriterier har hver en levende dækningskilde,
- og testene understøtter den ønskede målarkitektur frem for den afløste.

### Fase R9 — Tværgående konvergens og slutkontrol

Formål: lukke reviewet ved at samle alle fund, sikre helhedsfornemmelse og rydde op i restdrift.

Kontroller:

- filplacering og navngivning,
- død kode, ubrugte exports og parallelle helpers,
- fysisk fravær af alt på §4.3's slettelister — inklusive tomme mapper, som git ikke sporer,
- at R1b's sluttilstandssprog holder efter alle fasers rettelser: ingen ny forekomst af migrationssprog er
  indført undervejs i reviewet,
- kontrakt-, ledger- og dokumentdrift,
- at §10's 30 acceptkriterier hver er efterprøvet i dette review,
- åbne fund, hypoteser og godkendelsespunkter i fund-oversigten,
- om den samlede kodebase fremstår som én sammenhængende arkitektur.

Afsluttende gates køres i denne rækkefølge:

```text
npm run typecheck
npm run typecheck:test
npm run lint
npm run test
npm run verify:ledgers
npm run build:all
```

Suppleret med `check:mojibake` og `check:filename-case`. Bemærk `project_stale_build_info_shifts_date_gates`:
generér build-info før en fuld vitest-kørsel, ellers giver dato-gates falske røde.

Fokus:

- helhed,
- konsistens,
- overflødige rester,
- systematiske opstramninger.

Exitkriterier:

- reviewet efterlader et samlet, velstruktureret slutprodukt,
- alle gates er grønne med dokumenteret udfald,
- og alle åbne forhold er enten lukket eller tydeligt parkeret med ejer.

## Statusstyring

Denne plan er en statusflade og skal opdateres løbende — men kort.

Ved hvert review-pas opdateres:

- fasestatus-tabellen (status + fundtælling + rapport-reference),
- aktuel fase og overordnet status,
- dato,
- tællingen af åbne godkendelsespunkter og hypoteser.

Alt indhold ud over dette hører hjemme i fase-rapporten.

### Statusværdier

- `Ikke startet`
- `I gang`
- `Afventer godkendelse`
- `Delvist gennemgået`
- `Gennemgået`

`Gennemgået` må kun sættes, når fasens exitkriterier er efterprøvet med evidens. En fase med åbne hypoteser er
`Delvist gennemgået`.

### Opdateringsregel

Hvis en fase afslører et underliggende systemproblem, registreres det i samme øjeblik i fasens rapport og
behandles som et systemisk fund, ikke som en isoleret detalje.

Hvis et fund kan løses ved at tage et skridt tilbage og konsolidere struktur, bør det undersøges før en lokal rettelse
accepteres som slutløsning.

Hvis et fund viser, at et af de værn, R0 erklærede troværdige, alligevel ikke er det, genåbnes R0's inventar for
det pågældende værn — og de faser, der lænede sig på det, revurderes.

## Skabelon for fase-noter

Hver fase-rapport indledes med en note efter denne form. Statuslinjen spejles i fasestatus-tabellen ovenfor.

```md
# R<n> — [fasens navn]

**Status:** I gang | Delvist gennemgået | Afventer godkendelse | Gennemgået
**Dato:** ÅÅÅÅ-MM-DD
**Dækket:** [kort liste over filer/områder]
**Angreb udført:** [hvilke adversarielle angreb der faktisk blev forsøgt]
**Evidens:** [kørte kommandoer, AST-forespørgsler, mutationstests + udfald]
**Fund:** [antal + id-liste, fx 3 (R3-F01, R3-F02, R3-F03)]
**Hypoteser:** [antal + id-liste eller "Ingen"]
**Handling:** [rettet / parkeret / forelagt / under systemisk omlægning]
**Næste skridt:** [hvad der mangler]
```

## Godkendelsespunkter

Godkendelsespunkter registreres i fund-oversigten og beskrives i fasens rapport — ikke her. Denne plan bærer kun
tællingen.

Krav til et godkendelsespunkt:

- en kort, brugerorienteret beskrivelse af konsekvensen: konkret hvad brugeren ser i dag, og hvad brugeren vil se
  bagefter,
- en anbefalet retning,
- en kort forklaring af, hvorfor ændringen er synlig eller talpåvirkende.

Beskrivelsen skal kunne læses af en, der ikke kan kode. Aldrig som teknisk arkitektur- eller scope-spørgsmål
(designdokumentets §12, punkt 3).

Mens et godkendelsespunkt afventer svar, fortsætter reviewet med de dele af fasen, der ikke afhænger af
beslutningen.

## Hypoteser

Mistanker uden efterprøvet evidens hører til i fasens rapport under "Hypoteser" — ikke blandt fundene. Hver
hypotese skal have en note om, hvordan den kan af- eller bekræftes, så den ikke bliver liggende som en permanent
uafklarethed.

## Afslutningskrav

Reviewet kan først regnes som afsluttet, når:

- alle faser er gennemgået med efterprøvet evidens,
- fasestatus-tabellen er opdateret med en klar slutstatus,
- alle fund i fund-oversigten er håndteret,
- alle hypoteser er af- eller bekræftet, eller eksplicit parkeret med en plan,
- godkendelsespunkter er enten besluttet eller eksplicit parkeret,
- alle gates i R9 er grønne med dokumenteret udfald,
- beregningstal og dokumentindhold er beviseligt uændrede for gyldige fixtures,
- hvert af §10's 30 acceptkriterier er efterprøvet af dette review,
- kode, kommentarer, navne, tests, kontrakter og docs beskriver den færdige sluttilstand — ikke vejen dertil,
- og det samlede slutprodukt fremstår som én sammenhængende arkitektur med en klar rød tråd.
