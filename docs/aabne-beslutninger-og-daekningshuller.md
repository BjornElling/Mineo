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

**Ingen åbne punkter.** De fire, der stod her, blev alle afgjort 2026-07-31:

| Forhold | Afgørelse | Ejes nu af |
|---|---|---|
| Dokumentudfaldets rækkeudgaver | En deaktiveret download-knap giver INGEN besked ved klik — kun tooltip ved hover. Universelt for hele programmet. | `page-component-contract.md` §11.1 |
| Dokumentfejlens lokale kanal | Samme afgørelse: `gate-blocked` er tavs. De øvrige udfald (stale-afbrud, død DEV-server) vises fortsat lokalt. | `page-component-contract.md` §11.1, `document-output-contract.md` §A5 |
| Reguleringens to overenskomst-etiketter | Ensartet: navn OG overenskomstparter alle steder, via `resolveOverenskomstDisplay`. | `src/data/overenskomstRates.ts` |
| Særligt ferietillæg | Må ikke indregnes nogen steder — rent fremtidigt udviklingsprojekt. Satsdataene er slettet. | `indskudte-loentillaeg-contract.md` §6 |

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

### 2.4 Fem fjernede mekanismer har intet fraværsværn

`cellFocusPaths`, `useCellInvalidDraftChannel` og `onFieldError` findes ikke længere i koden, men de står ikke
på nogen forbudsliste. Intet maskinelt tjek forhindrer, at de genopstår under samme navn.
`src/contracts/mineo-field-pattern.md` §10 er indtil videre eneste spærring.

Det samme gælder `visibleDocumentFailureMessage` og `resolveOverenskomstNameOnlyDisplay`, slettet 2026-07-31
med brugerbeslutningerne om tavse download-gates og den ensartede overenskomst-etiket. Begge udtrykte netop
den adfærd, beslutningerne afskaffede, så en genopstået kopi ville genindføre forskellen. Positive værn
findes (`DocumentOutcomeMessage.test.tsx` pinner at `gate-blocked` → `null`; `overenskomstRates.test.ts`
pinner at etiketten bærer parterne), men intet forbyder navnene som sådan.

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
