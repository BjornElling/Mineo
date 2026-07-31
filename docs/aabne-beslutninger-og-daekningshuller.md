# Åbne beslutninger og dækningshuller

**Type:** Levende register. Ikke normativt — de bindende regler bor i `src/contracts/`.

Denne fil samler de forhold, der bevidst står åbne i programmet: beslutninger, der kræver brugerens input,
og flader, hvor der ikke findes en test, som kan fejle. De står her, fordi de ellers ville forsvinde — de er
hverken fejl at rette eller opgaver, en agent selv må lukke.

**Sådan bruges filen.** Et punkt fjernes, når det er afgjort eller dækket, ikke når det bliver gammelt. Et nyt
punkt hører kun til her, hvis det opfylder ét af to kriterier: (a) det kræver en brugerbeslutning om synlig
UI/UX eller om de tal, programmet producerer, eller (b) det er et navngivet hul i den maskinelle dækning.
Alt andet hører i en kontrakt, i koden eller i en test.

---

## 1. Afventer brugerens beslutning

Fælles for disse: de ændrer noget, brugeren ser eller får ud af programmet, og må derfor ikke afgøres af en
agent (jf. `AGENTS.md` § Mandat og godkendelsesgrænser).

### 1.1 Dokumentudfaldets rækkeudgaver er ikke ensrettet

Beskeden efter en afbrudt eller blokeret download vises i dag i fem forskellige rækkeudgaver på tværs af
siderne. Forsørgertabs fejlrække er fx fortsat inline frem for `DocumentOutcomeMessage`.

En ensretning ville give samme udseende og placering overalt, men den ændrer, hvor på siden brugeren møder
beskeden. Det er en synlig UI-ændring.

### 1.2 Reguleringens to overenskomst-etiketter er bevidst forskellige

De to etiketter i reguleringsvisningen bruger forskellig ordlyd. Forskellen er dokumentINDHOLD — en ensretning
ændrer altså teksten i et produceret dokument og kræver derfor en beslutning om, hvilken ordlyd der er den
rigtige.

### 1.3 Dokumentfejlens lokale kanal kan fjernes

Systemfejl-fladen er efterprøvet led for led og er bekræftet synlig, så `document-output-contract.md` §A5's
skel mellem uventede systemfejl og forventelige preflight-fejl holder i praksis. Dermed er den lokale
fejlkanal teknisk overflødig.

At fjerne den flytter imidlertid det sted, brugeren ser fejlen. Det er en UI-beslutning, ikke en oprydning.

### 1.4 Særligt ferietillæg er data uden beregningskobling

Satstrappen findes i `src/data/indskudteLoentillaeg.ts`, men ingen beregningssti læser den. At koble den ind
ændrer de tal, programmet producerer. Se `src/contracts/indskudte-loentillaeg-contract.md` §6, som ejer
punktet med begrundelse og re-evalueringstrigger.

---

## 2. Dækningshuller — flader uden en test, der kan fejle

Disse er ikke kendte fejl. De er steder, hvor korrektheden i dag hviler på en gennemgang frem for på et værn,
og hvor en regression derfor ikke ville blive fanget.

### 2.1 Visuel fremtoning af de færdige dokumenter

Pixel-layout, fontrendering og den visuelle inspektion af de færdige PDF- og Word-filer er ikke verificeret
maskinelt. Testfladen beviser, at det rigtige indhold og de rigtige tal når filen — ikke hvordan den ser ud.

### 2.2 Browserbaseret adfærd

To ting kræver et kørende miljø og er ikke dækket af JSDOM-testene:

- visuel sammenligning af felt-fokus på tværs af felt-typer (jf. `keyboard-navigation.md` § Residual
  manuel/visuel kontrol),
- runtime-fuzzing af tab-mount og settle.

### 2.3 Fane-aktivering bruger den aktuelle route

Ved fokus-restore kalder loopets fane-aktivering `applyDestination` med `window.location.pathname` frem for
den route-parameter, kaldet fik. Det er **tilsigtet** — routen kan have ændret sig undervejs — men adfærden er
ikke pinnet af en test. En fremtidig refaktorering kan derfor "rette" den i god tro.

### 2.4 Tre fjernede mekanismer har intet fraværsværn

`cellFocusPaths`, `useCellInvalidDraftChannel` og `onFieldError` findes ikke længere i koden, men de står ikke
på nogen forbudsliste. Intet maskinelt tjek forhindrer, at de genopstår under samme navn.
`src/contracts/mineo-field-pattern.md` §10 er indtil videre eneste spærring.

### 2.5 Registry må ikke eager-importeres — uden værn

`calculation-data-contract.md` §2.8 forbyder eager-import af beregningsdata-registret i app-entrypoints.
Reglen holder de facto (kun katalogfilen selv importerer `beregningsdataCatalog`), men ingen test hævder den.

---

## 3. Områder der aldrig er gennemgået

Programmets to store reviews dækkede input-, projektions-, dokument- og testfladen. Tre områder blev aldrig
gennemgået af nogen af dem og er derfor ukontrollerede — ikke fejlbehæftede, blot uundersøgte:

- **Data og satser** — reguleringsdata, kapitalisering og retskilder.
- **Settings, auth, config og themes.**
- **App-shell, build, multi-app og MinProcesrente-isolationen.**
