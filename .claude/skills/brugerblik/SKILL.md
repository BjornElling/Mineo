---
name: brugerblik
description: Gennemgå én Mineo-flade (side eller fane) med brugerens øjne i stedet for kodens. Brug den, når du skal vurdere, om programmets faktiske adfærd er den bedst tænkelige brugeroplevelse — også dér hvor koden er korrekt — og når du skal afdække edge cases fra forkerte, ufuldstændige eller uforudsete indtastninger og kombinationer af indtastninger. Skillen finder og dokumenterer; den ændrer ikke produktet.
argument-hint: "[flade, fx 'stamdata' — eller 'fortsæt']"
disable-model-invocation: true
model: opus
effort: high
---

# Brugerblik

## Baggrund — hvorfor denne skill findes

Over den seneste tid er der dukket mange eksempler op på, at Mineos UI/UX **ikke** har haft en
hensigtsmæssig adfærd set fra brugerens side. Koden bag har som regel været af høj kvalitet:
typerne var rigtige, testene var grønne, kontrakterne var overholdt — og alligevel var oplevelsen
forkert. Programmet gjorde præcis det, det var bygget til, men det, det var bygget til, var ikke
det bedste for den, der sad foran skærmen.

Samtidig har der været en del edge cases, som ikke var afdækket: situationer der ikke var tænkt
igennem, fordi de forudsatte, at brugeren gjorde noget, ingen havde forestillet sig.

**Formålet med denne skill er derfor ikke at højne kodekvaliteten.** Det er at lægge et lag af
*sund fornuft* og *refleksion* oven på et program, der teknisk set allerede virker: Hvad oplever
brugeren egentlig? Giver det mening for en person, der ikke kender koden? Er dette den bedst
tænkelige oplevelse — eller bare en oplevelse, der ikke er direkte forkert?

### Den bærende præmis

**Brugeren vil indtaste et meget stort antal forkerte, ufuldstændige og uforudsete oplysninger.**

Det er ikke et fejlscenarie, der skal håndteres i en sidegren. Det er normaltilstanden, og den skal
behandles som programmets hovedsag. Brugeren taster forkert, indsætter tekst fra et andet dokument,
udfylder felterne i en anden rækkefølge end den tiltænkte, fortryder, skifter mening halvvejs, går
væk fra skærmen midt i en indtastning, og skriver værdier, der hver for sig er lovlige, men som i
kombination giver noget meningsløst. Alt dette skal programmet møde med en oplevelse, der er lige
så gennemtænkt som happy path'en.

Skillen skal derfor systematisk lede efter:

1. **Fornuftsfund** — adfærd, der virker som designet, men er uhensigtsmæssig, forvirrende,
   overraskende, tavs eller unødigt besværlig set fra brugerens stol.
2. **Edge case-fund** — situationer, hvor forkert, tomt, ekstremt, uforudset eller indbyrdes
   modstridende input giver en dårlig oplevelse: uforståelig feedback, ingen feedback, tabt
   arbejde, en blindgyde eller et resultat, brugeren ikke kan gennemskue.
3. **Systematik** — for hvert fund: er dette et enkeltstående forhold, eller er det ét udslag af et
   mønster, der sandsynligvis går igen andre steder i programmet?

### Hvad skillen IKKE er

- Den er **ikke** `jette-interaktionsaudit` (`.agents/skills/jette-interaktionsaudit/`). Jette leder
  efter, om noget *går i stykker* eller *afviger fra kontrakten*: crashes, console-fejl, datatab,
  kontraktdrift, browserforskelle. Brugerblik leder efter, om noget *er en dårlig idé*, selv når
  alting virker efter hensigten og kontrakten er overholdt. De to overlapper bevidst kun lidt: hvor
  Jette spørger «holder det?», spørger Brugerblik «er det klogt?».
- Den er **ikke** et kodereview. Kodekvalitet, struktur, navngivning og arkitektur er ikke dens
  ærinde. Ser den noget grelt, noterer den det i én linje og går videre.
- Den er **ikke** en implementeringsopgave. Den retter ikke produktkode. Se §7.

---

## 1. Aktivering og omfang

Skillen aktiveres kun, når brugeren beder om det (`/brugerblik <flade>` eller `/brugerblik fortsæt`).

**Én invokation = én flade.** En flade er én side eller én fane — ikke mere. Gennemgangen skal være
tæt nok til, at hvert enkelt felt, hver knap, hver tilstand og hver overgang faktisk er tænkt
igennem. Bliver en flade for stor, deles den i afgrænsede afsnit, og STATUS.md fører de enkelte
afsnit hver for sig.

**Kør autonomt indtil fladen er færdig.** Undervejs stilles ingen spørgsmål til brugeren; alle
tvivlsspørgsmål registreres som fund eller som åbne spørgsmål i rapporten. Først når fladen er
gennemgået og skrevet ned, kommer den samlede tilbagemelding.

**Rækkefølgen går fra små til store flader.** Se [references/flader.md](references/flader.md).
Tanken er, at de generelle, gennemgående problemer bliver fundet og afklaret på de simple sider,
hvor de er lette at se og lette at bedømme — så de store sider senere kan gennemgås med et
færdigafklaret sæt principper i hånden i stedet for at genopdage det samme.
Argumentet `fortsæt` betyder: tag den næste ikke-gennemgåede flade i den rækkefølge.

## 2. Arbejdsmappe og filer

Alt materiale ligger under `docs/testing/brugerblik/`:

| Fil | Indhold |
|---|---|
| `STATUS.md` | Fremdrift pr. flade, næste flade, næste fund-ID. Eneste sted, status føres. |
| `<flade>.md` | Fund og overvejelser for én flade. Ét dokument pr. flade. |
| `TVAERGAAENDE.md` | De systematiske mønstre, som går igen på tværs af flader. |

Skabeloner ligger i `assets/`. Findes mappen eller `STATUS.md` ikke, oprettes de fra skabelonerne
ved første kørsel. Eksisterende dokumenter overskrives aldrig — de udbygges.

Fund-ID'er er løbende på tværs af hele programmet: `BB-001`, `BB-002`, … Næste ledige ID står i
`STATUS.md` og opdateres i samme skrivning som fundene.

## 3. Arbejdsgang for én flade

### Trin 1 — Grundlag

1. Læs `STATUS.md` og `TVAERGAAENDE.md`. Kendte mønstre skal genkendes, ikke genopdages.
2. Læs `AGENTS.md` og de kontrakter, fladen er omfattet af (`src/contracts/contract-topology.json`).
   Kontrakterne er her **ikke** facit, men referencepunkt: en dokumenteret adfærd kan udmærket være
   en uhensigtsmæssig adfærd, og så er selve kontrakten fundet.
3. Læs `docs/brugerfund-der-skal-rettes.md`. Fund, brugeren allerede har meldt, må ikke registreres
   som nye — men de er et godt spor: et rettet fund har ofte en ikke-rettet slægtning.

### Trin 2 — Inventar

Kortlæg fladen fra koden **og** fra den kørende app, og afstem de to lister mod hinanden:

- hvert felt: label, type, tomværdi, format, aktive grænser, hvad der gør det gyldigt/ugyldigt —
  og om feltet overhovedet **har** en erklæret grænse, og om den passer til feltet (prøvekatalogets
  B0);
- programmets eget svar på, hvornår en række eller en flade er **tom** — og hvad det svar styrer
  (prøvekatalogets B6a);
- hver knap, hvert valg, hver toggle, hvert link, hver tabel, hver række-handling;
- hver tilstand fladen kan stå i: tom, delvist udfyldt, gyldig, ugyldig, blokeret, afhængig af en
  anden side, låst, skjult;
- hvad fladen *afhænger af* (felter andre steder i programmet), og hvad der *afhænger af den*
  (beregninger, dokumenter, andre siders synlighed og grænser);
- hvad der er **usynligt** for brugeren, men styrer, hvad han ser.

Sidste punkt er det vigtigste. De fleste fornuftsfund bor i afstanden mellem, hvad programmet ved,
og hvad det fortæller.

### Trin 3 — De to blikke

Kør [references/proevekatalog.md](references/proevekatalog.md) igennem for fladen:

- **Fornuftsblikket** — spørgsmålsbatteriet om oplevelsen. Stilles til hvert felt, hver handling og
  til fladen som helhed.
- **Edge case-blikket** — inputpartitioner, grænser, rækkefølger og kombinationer. Her er præmissen
  fra baggrunden bindende: antag en bruger, der gør det forkerte, og find ud af hvad han møder.

Begge blikke stilles med den **konkrete** flade for øje. Et generisk «kunne feedbacken være
tydeligere?» er ikke et fund. Et fund er: *denne handling, i denne tilstand, giver dette, og det er
uhensigtsmæssigt fordi …*

### Trin 4 — Efterprøv i browseren

Et fornuftsfund kan ikke afgøres fra kildekoden alene. Hvad brugeren oplever, skal ses.

Følg `AGENTS.md` §Browser-testadgang og den projektlokale `playwright-cli`-skill
(`.agents/skills/playwright-cli/`): headless, uden `--open`, log ind gennem den synlige formular
med det dedikerede testpassword. Kør de scenarier igennem, som blikkene har peget på, og registrér
det, der faktisk sker — ikke det, koden lover.

De faste greb (feltadresse-locator, `dblclick` før `fill`, `beforeunload` før navigation, quoting
ved `run-code`) står i Jettes SKILL.md §«Browsermekanik: de faste greb». Læs dem før første
browserkald; de sparer flere timers gentagne fejlgreb.

Kan et scenarie ikke afprøves headless, registreres det som dækningshul i rapporten frem for at
blive gættet.

### Trin 5 — Systematik-tjek

For **hvert** fund: spørg, om det er en enkeltstående uheldig detalje eller ét udslag af et mønster.

Formuler mønsteret som en sætning uden reference til den konkrete flade («en afhængig værdi ryddes
uden besked, når forudsætningen ændres»), og søg derefter i koden efter andre steder, hvor samme
sætning kunne være sand. Brug `rg` på mekanismen, ikke på ordlyden. Skriv de konkrete kandidatsteder
ned — også dem, der ikke er verificeret; en uverificeret kandidat er et spor for en senere flade,
ikke et fund.

Rammer mønsteret bredt, får det en post i `TVAERGAAENDE.md`, og de enkelte fund henviser dertil.

### Trin 6 — Skriv ned

Skriv fladens dokument efter [assets/FUND.template.md](assets/FUND.template.md), opdatér
`TVAERGAAENDE.md` og `STATUS.md` i samme omgang.

Rapporten skal indeholde både fundene **og overvejelserne**: hvad blev afprøvet uden at give
anledning til noget, og hvorfor det er i orden. En flade, hvor alt er tænkt igennem og intet er
galt, er et fuldgyldigt resultat — men det skal fremgå, hvad der så blev tænkt igennem, ellers kan
en senere kørsel ikke skelne «afprøvet og fundet i orden» fra «ikke afprøvet».

Skriv kompakt. Bestået adfærd fylder én linje. Pladsen bruges på fund og på de overvejelser, en
læser ikke selv ville komme på.

## 4. Hvad tæller som et fund

Et fund er en **konkret oplevelse**, der kan gøres bedre. Det skal kunne fremprovokeres, og det skal
kunne beskrives uden at nævne en eneste kodelinje.

Registrér:

- adfærd, der er teknisk korrekt, men overraskende, tavs, uforståelig eller unødigt besværlig;
- feedback, der siger *at* noget er galt uden at sige *hvad* eller *hvad der forventes*;
- tilstande, hvor brugeren tror, han er færdig, men ikke er det — eller omvendt;
- forudsætninger, programmet kender, men ikke fortæller (hvorfor er knappen inaktiv? hvorfor
  forsvandt feltet? hvorfor er tallet ikke ændret?);
- uforudsete input eller kombinationer, der fører til en blindgyde, et misvisende resultat eller
  ingen reaktion;
- lovlige, men usandsynlige værdier, hvor en advarsel ville have reddet brugeren;
- felter uden grænse, eller med en grænse så vid eller så vilkårlig, at den intet afværger;
- steder hvor programmets begreb om «tom» og «udfyldt» ikke svarer til det, brugeren kan se;
- inkonsistens: samme koncept navngivet, placeret eller behandlet forskelligt to steder — herunder
  to forskellige fejlbeskeder for én og samme brudte regel.

Registrér **ikke**:

- kodesmag, navngivning, struktur og andre rent interne forhold;
- mikro-æstetik uden konsekvens for forståelse eller flow;
- afvigelser fra en kontrakt, som ikke gør oplevelsen dårligere — det er Jettes og `/fix-it`'s bord;
- ønsker om nye features. Featurefladen er låst (`AGENTS.md`). En bedre oplevelse af det
  eksisterende er i scope; en ny beregningstype er ikke.

Hvert fund klassificeres:

| Felt | Værdier |
|---|---|
| Type | `Fornuft` · `Edge case` · `Fejl` (egentlig defekt fundet undervejs) |
| Rækkevidde | `Lokal` · `Mønster` (henviser til `TVAERGAAENDE.md`) |
| Prioritet | `Kritisk` · `Høj` · `Mellem` · `Lav` |
| Beslutning | `Afventer bruger` (UI/UX eller beregning) · `Agent afgør` (rent teknisk) |

Hvert fund skal have et **forslag**: den adfærd, der ville være den bedst tænkelige. Uden forslag er
fundet ikke færdigt — brugeren skal kunne sige ja eller nej, ikke selv designe løsningen.

## 5. Prioritering — hvad vejer tungt

Vægten følger konsekvensen for brugerens tillid til programmet, ikke hvor let fundet er at rette:

1. Noget, brugeren har skrevet, forsvinder eller ændrer sig uden hans handling.
2. Et forkert eller misvisende tal, som brugeren ikke har nogen anledning til at betvivle.
3. En blindgyde: brugeren kan ikke komme videre og får ikke at vide hvorfor.
4. Tavshed, hvor brugeren venter et svar.
5. Feedback, der er der, men ikke kan handles på.
6. Unødige klik, spring og gentagelser.
7. Inkonsistens mellem to flader, der løser samme opgave.

## 6. Bevidst uden for scope

- **Ingen ændring af produktkode.** Skillen dokumenterer. Rettelser sker gennem `/fix-it` eller
  brugerens beslutning bagefter.
- **Ingen gate-kørsel.** Ingen `npm run test`, `lint` eller `build` — der ændres ingen kode.
- **Ingen commit.**
- **Ingen vurdering af, om juridiske eller beregningstekniske regler er rigtige.** Ser noget
  underligt ud, registreres observationen og forelægges; reglen afgøres ikke.

## 7. Afslutning på en flade

Når fladen er skrevet ned, gives én samlet tilbagemelding til brugeren med:

1. hvor mange fund, fordelt på type og prioritet;
2. de fund, der kræver brugerens beslutning — hver formuleret som en konkret brugeroplevelse med et
   konkret forslag, uden interne begreber (`AGENTS.md` §Mandat: UI/UX og beregning er brugerens);
3. de systematiske mønstre, fladen afdækkede, og hvor de forventes at gå igen;
4. hvilken flade der står som den næste.

Herefter stopper skillen. Den fortsætter ikke af sig selv til næste flade — den næste kørsel startes
med `/brugerblik fortsæt`.
