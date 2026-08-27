---
name: fix-it
description: Gennemfør, review og færdiggør en Mineo-ændring fra plan til valideret, afgrænset commit. Brug til features, fejlrettelser, refaktoreringer, arkitekturarbejde og andre konkrete kodeændringer, hvor Claude skal implementere og Codex skal reviewe, rette, verificere og committe resultatet.
argument-hint: "[scope eller arbejdsnotat]"
disable-model-invocation: true
model: opus
effort: high
---

# Fix-it-arbejdsgang

Gennemfør eller genoptag scopet i **$ARGUMENTS**. Arbejd efter Mineos `AGENTS.md` og bindende
kontrakter. Scope kan være en ny ændring, en fejlrettelse, en refaktorering eller et arkitektur-
arbejde; det er ikke et greenfield-designforløb.

Målet er det bedst mulige slutprodukt: velstruktureret, deterministisk, testdækket og i tråd med
programmets røde tråd. Når et problem viser sig, gå to skridt tilbage. Undersøg først, om fejlen
er et symptom på en fælles strukturel årsag, og om samme årsag kan findes andre steder. Ret roden,
når det er relevant, også selv om det kræver væsentlige eller breaking arkitekturændringer.

## 1. Roller og beslutningsmyndighed

- **Claude Code** orkestrerer, kortlægger, planlægger og implementerer hele scopet.
- **Codex 5.6 Luna Extra High** overtager efter implementeringen som uafhængig reviewer og
  implementerende kvalitetssikrer. Codex må anfægte planen, ændre arkitekturen, rette koden,
  skrive tests og gennemføre verifikation.
- Begge agenter ejer selv alle kode-, struktur- og procesbeslutninger. Ingen tekniske valg,
  scopevalg eller arkitekturvalg forelægges udvikleren.
- Udvikleren spørges kun før en ændring, der reelt ændrer synlig UI/UX eller beregningstal/-regler.
  Forelæg i så fald den konkrete brugeroplevelse eller talmæssige forskel og stop før ændringen.
  En bugfix, der blot genskaber dokumenteret tilsigtet synlig adfærd, kræver ikke ny godkendelse;
  ændringer af beregningstal/-regler forelægges altid.

Claude og Codex må ikke nøjes med at lappe symptomer eller afvise fund, fordi de strider mod den
oprindelige plan. De skal hver især efterprøve helheden mod kode, kontrakter, tests og faktisk
runtime-adfærd.

## 2. Preflight og arbejdsnotat

1. Læs relevante dele af `AGENTS.md`, bindende kontrakter i `src/contracts/` og relevante
   arkitekturdokumenter i `docs/architecture/`. Claude-memory er kun orientering.
2. Inspicér `git status --short`, `git diff`, `git diff --cached` og untracked filer. Registrér
   præcist working-tree-baseline før ændringen: filer, staged/unstaged status og diffens omfang.
   Eksisterende ændringer tilhører udvikleren og må hverken overskrives, nulstilles eller committtes.
3. Skriv scope, invarianter, acceptance criteria, risikoklasse, forventede berørte områder og
   testplan i hovedtråden. Ved fler-sessionsarbejde bruges et midlertidigt
   `docs/arbejdsnotat-<slug>.md`; slet det før Codex committer.
4. Kortlæg eksisterende mønstre, delte helpers, parallel logik, relevante tests og mulige andre
   manifestationer af problemet, før produktionskode ændres.

Hav kun ét aktivt `fix-it`-scope ad gangen. Hvis scopet opdages at være forkert afgrænset, ændres
planen eksplicit og acceptance criteria opdateres. Stiltiende scopeudvidelse er ikke tilladt,
men en strukturel rodårsag, som er nødvendig for en korrekt løsning, hører med i scopet.

## 3. Godkendelsesgate

Hvis planen kan ændre synlig UI/UX eller beregningstal/-regler, forelæg den konkrete forskel for
udvikleren og stop før implementering. Alt andet afgøres autonomt af Claude eller Codex. En pause
genoptages ved at påkalde `/fix-it <arbejdsnotat eller scope>` igen.

## 4. Claude implementerer

Sæt status `under-implementering` og gennemfør hele den besluttede løsning:

- Genbrug kanoniske helpers, schemas, contracts, state-flow og eksisterende testmønstre.
- Konsolidér parallel logik, og opdel eller flyt filer, når det giver en sundere struktur.
- Følg Mineos regler om schema-autoritet, runtime-integritet, numerik, save/load, dokumentgates,
  desktop-gate og manglende live preview.
- Tilføj eller opdatér meningsfulde invarianttests for ændret kritisk adfærd. Indfør ingen nye
  dependencies, serverkommunikation, telemetri eller ekstern logging.
- Kør de relevante checks efter sammenhængende delændringer og den fulde krævede gate før handoff.

Claude må ikke committe. Handoffen skal indeholde scopet, acceptance criteria, arbejdsnotatet,
baselinebeskrivelsen, ændrede filer, udførte checks og kendte risici. Claude skal ikke præsentere
sin egen plan som facit for Codex.

## 5. Codex overtager review, rettelser og verifikation

Kør Codex med skriveadgang, Luna og Extra High (`xhigh`):

```powershell
codex exec -C . -s workspace-write -m gpt-5.6-luna -c 'model_reasoning_effort="xhigh"' "Review, ret, verificér og commit den aktuelle fix-it-løsning. Læs AGENTS.md, relevante kontrakter og arbejdsnotatet. Efterprøv planen uafhængigt mod hele den berørte struktur. For hvert fund: afgør om det er lokalt eller et symptom på en strukturel rodårsag, undersøg om roden manifesterer sig andre steder, og ret alle relevante fund i stedet for kun symptomet. Du ejer selv arkitektur-, kode- og procesbeslutninger. Spørg kun udvikleren hvis en foreslået rettelse reelt ændrer synlig UI/UX eller beregningstal/-regler; stop da uden commit og returnér spørgsmålet. Kør relevante typechecks, lint og tests. Brug Playwright når ændringen berører browseradfærd, routing, auth, keyboard/focus, runtime, fil-I/O eller synligt UI; ret alle fund og gentag verifikationen indtil løsningen virker efter hensigten. Commit til sidst kun ændringer fra dette fix-it-scope, aldrig pre-eksisterende working-tree-ændringer."
```

Codex skal:

1. Reviewe både implementeringen og de beslutninger, den bygger på. Kontrollér korrekthed,
   kontrakter, invariants, datatab, parallel logik, fejlhåndtering, testhuller og uønskede
   adfærdsændringer.
2. Samle fund efter fælles rodårsag. Navngiv både strukturelle og lokale fund, og ret alle
   handlingskrævende fund, som hører til scopet. En anbefaling må ikke blot rapporteres; den skal
   implementeres eller afvises med konkret evidens.
3. Gå bredere end den oprindelige fil, når det er nødvendigt for en konsistent løsning. Lad kun
   helt urelateret arbejde stå som særskilt scope.
4. Køre en fokuseret re-review efter rettelser og gentage loopet, indtil der ikke er flere
   handlingskrævende fund i scopet.

### Playwright-gate

Ved browserrelevante ændringer skal Codex følge Mineos browserregler i `AGENTS.md`: kontrollér
Playwright-installationen, start Mineo uden `--open`, log ind gennem den synlige formular med det
dedikerede testpassword, afprøv den ændrede brugerrejse og kontrollér synlig tekst/tilstand,
`console.error` og ukontrollerede page-fejl. Brug fast E2E-test, når den dækker forløbet, og
Playwright CLI til nødvendig eksplorativ kontrol. Inspicér screenshot ved synlige UI-ændringer.
Stop alle ad hoc-servere og browserprocesser efter kontrollen.

## 6. Afgrænset commit

Codex har den udtrykkelige commit-autorisation, som `/fix-it`-arbejdsgangen giver, men må kun
committe den aktuelle løsning:

- Sammenhold før- og efter-baseline før staging. Brug ikke ukritisk `git add -A`, hvis træet havde
  eksisterende ændringer.
- Stage kun filer eller hunks, som Claude/Codex ændrede for dette scope. Hvis en fil blander
  baseline og scope, isolér hunks manuelt og bevar baseline-ændringen urørt.
- Brug aldrig `git reset --hard`, `git checkout`, `git restore`, `git clean` eller andre
  destruktive kommandoer for at få et rent diff. En midlertidig, dokumenteret unstage/stash er kun
  tilladt, hvis baseline kan gendannes uden datatab.
- Kontrollér staged diff med `git diff --cached`, `git diff --cached --check` og filoversigten,
  før commit. Fjern det midlertidige arbejdsnotat inden staging.
- Commit med én beskrivende dansk subject-linje. Push aldrig.
- Kontrollér efter commit, at committen kun indeholder scopeændringer, og at working tree stadig
  indeholder baselineændringerne uændret. Rapportér commit-id, filer, checks og eventuelle rester.

Afslut først, når acceptance criteria er opfyldt, relevante checks er grønne, Playwright-gaten er
grøn når den er relevant, alle fund har disposition, og Codex har committtet den afgrænsede løsning.
