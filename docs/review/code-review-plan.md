# Review- og refaktoreringsplan — Mineo

> Arbejdsværktøj for det systematiske review af hele Mineos kodebase. Hvert punkt **retter fundene** undervejs og bringer koden på linje med kontrakterne. `AGENTS.md` er den autoritative kilde til roller, mandat og constraints.

## Faste principper (gælder hvert punkt — må ikke glemmes)

- **Trust-kritisk, 100 % client-side.** Forkerte beregninger, datatab eller uforudsigelig adfærd er uacceptabelt.
- **Feature-fladen er låst.** Ingen nye beregningstyper. Favorisér **forenkling og konsolidering** frem for hypotetiske extension points.
- **Fail-closed.** Manglende reguleringssatser/år/tabeller skal fejle eksplicit — aldrig et stille gæt (jf. `manglendeAar`).
- **Én sandhedskilde.** Zod-schemas er eneste kilde til runtime-validering og afledte typer. Ingen dobbelt-sandhed for dato/rente/sats. Beregningslag og dækningsvalidering skal kalde *samme* motor.
- **Ingen live preview.** Beregn/validér/vis aldrig afledt feedback fra `onChange`-draft. Commit på `onBlur` (forms) / `onPersist` (table). Eneste immediate-commit-undtagelser: delete/backspace på ikke-redigerende celle, valg af dropdown-menupunkt, toggle/radio-aktivering.
- **Runtime data-integritet.** Committed input må ikke forsvinde/nulstilles/muteres pga. navigation, re-render, tab-skift eller sync.
- **Save/load (.eo).** Atomisk load (medmindre bruger accepterer delvis i preflight); forward/backward-tolerant; streng round-trip for brugerinput; afledte værdier genberegnes efter load.
- **Tal-identitet ved delegering.** Når lokal logik omlægges til en fælles motor, *bevis* tal-identitet med ækvivalens-test — ikke "ser rigtigt ud".
- **Sprogpolitik:** dansk uden undtagelse.
- **Godkendelse:** UI/UX- og beregningslogik-ændringer forelægges; resten gennemføres direkte. Resten af punktet kan færdiggøres mens et fund afventer.

**Dobbeltkanal dokument-output:** PDF (jsPDF) og Word (`.docx`) kører gennem *samme* format-agnostiske generatorer mod `DocumentWriter`-grænsefladen (`createDocxWriter` routes via `documentGenerationContext`). Gruppe 10 dækker begge kanaler + paritet.

**Multi-app:** Mineo (fuld) + standalone MinProcesrente deler bootstrap/storage, men er namespace-isolerede. Gruppe 12 dækker isolationen.

---

## Status og fremdrift

Arbejdet følger afhængighedsorden nedefra og op (se rationale-tabel sidst). Reviewet er endnu ikke påbegyndt — alle punkter står ⬜.

**Test-baseline:** Etablér ved reviewets start (kør fuld suite: `npx vitest run`). Hvert punkt skal efterlade suiten mindst lige så grøn som baseline.

### Statustabel

| Punkt | Navn | Status |
|---|---|---|
| **1 — Kontrakter & arkitektur** | | ⬜ |
| 1.1–1.7 | Topologi-maskineri, tværgående/domæne/page-kontrakter, arkitektur-docs, helhedsvurdering | ⬜ |
| **2 — Persistence** | | ⬜ |
| 2.1–2.6 | Arkitektur, undo/redo+fokus, FormPersistenceContext, load/apply/hydration, schema-evolution, fil-I/O | ⬜ |
| **3 — Schemas** | | ⬜ |
| 3.1–3.5 | Fundament, section-schemas A/B/C+eoFile, fingerprint+save-order-registry | ⬜ |
| **4 — Domænelogik** | | ⬜ |
| 4.0–4.14 | Opreguleringsmotorer, stamdata/satser, årsløn, EET, forsørgertab, varige mén, rente, EO-engines, snapshot, debug | ⬜ |
| **5 — Hjælpefunktioner** | | ⬜ |
| 5.1–5.5 | Dato-kerne/-validering, SH-dage, talbehandling, øvrige utils+typer | ⬜ |
| **6 — Data** | | ⬜ |
| 6.1–6.4 | Renter/rater, folkepension/sygedagpenge/overenskomst, offentlig løn, kapitalisering | ⬜ |
| **7 — UI-inputs & grid** | | ⬜ |
| 7.1–7.4 | StyledField-familien, table-inputs+adaptere, grid-infrastruktur, tabel-komponenter | ⬜ |
| **8 — Pages** | | ⬜ |
| 8.1 | Stamdata (+DebugTab), Årsløn, Satser, Mineo (forside), Indstillinger, LoginPage | ⬜ |
| 8.2 | Erhvervsevnetab + tab-underkomponenter (Oplysninger, EfterEal, Kapitalisering, LoebendeYdelser, Differencekrav, IssuesBox) | ⬜ |
| 8.3 | Erstatningsopgørelse-tabs (Loenindkomst, OffentligeYdelser, EOberegning, EOOplysninger) — de to største komponenter | ⬜ |
| 8.4 | EO-debug-komponenter (EODebug, Tabel, EmploymentSections, LoenSections, RegulationSections, GroupedRows, Rows) | ⬜ |
| 8.5 | Forsørgertab, Varige Mén, Renteberegning, MinProcesrente-calculator | ⬜ |
| 8.6 | Layout & UI-skal: MainLayout, StandaloneCalculatorLayout, SideMenu, Container, ContentBox(Frame), ui/, errors/, system/, reports/, common/, shared/ | ⬜ |
| **9 — Hooks** | | ⬜ |
| 9.1 | Form-/draft-hooks: usePersistedForm, useDraftField, useFormFieldErrors, useTwoStageInputActivation, selectors, rowDrafts | ⬜ |
| 9.2 | Undo/redo- og persisterings-hooks: useUndoRedo, usePersistedActiveTab, useUnsavedChangesGuard, useScrollToSectionWithRetry, useShakeFlag | ⬜ |
| 9.3 | Fil-/PWA-/devtools-hooks: useFileSaveLoad (krydsref 2.6), usePwaLaunchQueue, useDevtoolsMonitoring | ⬜ |
| 9.4 | Domæne-hooks: useAarsloenBeregning, useAslAarsloenRuleReporter, useAarsloenPdfGates, useOmregningToggle, useMidlertidigtEetInsertSource | ⬜ |
| **10 — Dokument-output (PDF + Word)** | | ⬜ |
| 10.1 | Orkestrering & format-routing: `src/document/*`, pdfService, `runSelectedDocumentFormat`, `createStandardPdfWriter`, standaloneRentePdfService | ⬜ |
| 10.2 | PDF-infrastruktur: jsPdfAdapter, pdfWriter, pdfLoader, pdfConfig, pdfBrevhovedRenderer, pdfDocumentAdapter | ⬜ |
| 10.3 | Word/docx-infrastruktur: docxWriter, docxStyles, docxWatermark, docxTableBridge — `PdfWriter`-paritet | ⬜ |
| 10.4 | Output-shared (begge kanaler): pdfTableRenderer, pdfHelpers, pdfFormatUtils, pdfTextUtils, pdfBrevhoved, pdfOptions | ⬜ |
| 10.5 | Generatorer I (EO-familien): eo (+sections), reguleringPdf, differencekrav, eet, kapitalisering, loebendeYdelser | ⬜ |
| 10.6 | Generatorer II: aarsloen, shDage, satser, varigemen, forsoergertab, renteberegning (+oversigt), tafFordelt (+opreguleret +kravGraf +chart), krl | ⬜ |
| 10.7 | Word-paritet & duplikerings-afvikling: `src/__tests__/docx/` + `wordContentHarness`; afvikl evt. legacy/dublerede PDF-stier | ⬜ |
| **11 — Config & settings** | | ⬜ |
| 11.1 | Config A: persistenceVersion, dateRanges, version, buildInfo, pageNavigation, scrollToTopConfig, cellInvalidDraftScopes | ⬜ |
| 11.2 | Config B: regulatoryRates, indskudteLoentillaeg (krydsref 6.2), appTheme, tableTheme | ⬜ |
| 11.3 | Settings & auth: appSettings (schema/parse/storage), AppSettingsContext, AuthGate, auth, authConfig | ⬜ |
| **12 — App-shell & multi-app** | | ⬜ |
| 12.1 | App-entry & bootstrap: main.tsx, App.tsx, bootstrapClientApp, serviceWorkerBootstrap, capability-gate, UnsupportedDevicePage | ⬜ |
| 12.2 | Standalone MinProcesrente: MinProcesrenteApp, minprocesrenteMain, StandaloneErrorBoundary, namespace-isolation | ⬜ |
| **13 — Testkvalitet** | | ⬜ |
| 13.1 | Domæneberegninger (årsløn, EET, forsørgertab, varige mén, renteberegning, opreguleringsmotorer) | ⬜ |
| 13.2 | EO-motor, EO-snapshot, EO-debug | ⬜ |
| 13.3 | Persistence, schema-evolution, fil-round-trip, invalidDrafts-recovery | ⬜ |
| 13.4 | Quality-/contract-guard-tests, dokument-output (PDF+Word-paritet), grid/keyboard, integration | ⬜ |
| **14 — Tværgående helhed** | | ⬜ |
| 14.1 | Kontrakt-alignment: `src/contracts/` vs. implementering + topology-coverage-matrix | ⬜ |
| 14.2 | Tværgående: duplikering, inkonsistente mønstre, dødkode, fil-placering | ⬜ |

---

## Åbne godkendelsespunkter (allerede committet — skal forelægges og lukkes når reviewet rammer punktet)

Ændringer der allerede er committet til koden, men som indeholder UI/UX- eller beregningslogik, der skal forelægges brugeren når reviewet når det relevante punkt:

1. **PDF/Word "TAF opreguleret til beregningsår"** → **10.6.** Nyt download-dokument; bekræft indhold/metode/afrunding.
2. **EO-output tre-tilstand (Ja/Nej/Skjul) + afslutningsvalg** → **10.5.** "Skjul" fjerner emnet helt (også fra samlet krav); "Nej" beholder overskrift + "Ingen" + 0 kr.; "Ingen" som afslutningsvalg udelader "Godkendelse"-afsnit; "én samlet I alt"; kommentarfelt i offentlige-ydelser-bilaget.
3. **Indstillinger-siden "Beregningsteknisk"-boks** → **11.3.** Toggle + dropdown for to device-lokale regulerings-flag flyttet fra EO-schema til `appSettings`.
4. **Sygedagpenge OP/ATP-model** → **6.2.** Bekræft tre-leds-modellen (sats + ATP + OP).

---

## Udskudte fund — skal udbedres ved det angivne punkt

Fund der bevidst parkeres til et senere (mere passende) punkt, registreres her undervejs, så de ikke glemmes. **Læs den relevante blok ved start af hvert punkt.** Kilde = review-doc fundet stammer fra.

*(Ingen registreret endnu.)*

---

## Reviewinstruktion

Hvert punkt gennemgår den relevante del af Mineo, **retter fundene**, og kontrollerer fire dimensioner:

1. **Kodekvalitet og korrekthed** — fri for fejl der kan give forkerte beregninger, datatab eller inkonsistent tilstand?
2. **Struktur og arkitektur** — følger koden kontrakterne? Klare laggrænser? Én rød tråd, eller samme problem løst flere måder?
3. **Robusthed** — crasher/fejler ved manglende, ugyldige eller usædvanlige inputkombinationer?
4. **Konvergens** — bragt på linje med principperne fra de tidligere (mere fundamentale) punkter?

### Hvad arbejdet skal afdække og rette

- **Korrekthed/determinisme:** afhængighed af render-timing, sideeffekter, implicit cast, locale, tidszoner, floating-point. Uhåndhævede invarianter. Inkonsistente afledte værdier / partielle state-opdateringer. Afvigelser fra kanoniske helpers (afrunding/format/valuta). Fail-closed-stier der reelt fejler (ikke maskeret af nul-år-skip eller tom-liste-gren).
- **Crash/inputrobusthed:** tomme felter, `undefined`/`null`/`NaN`/0/negative/fremtidige datoer/datoer udenfor lovlige intervaller. Felter gyldige hver for sig men ugyldige sammen (dato A efter dato B). Manglende guards før beregning / ved load. Array-ops der antager ≥1 element. Division med 0.
- **Arkitektur/grænser:** brud på `src/contracts/*.md` + `AGENTS.md`. Overcoupling (UI med beregningslogik; beregning der importerer UI). Uklar ejerskab. Duplikerede sandheder.
- **Type-sikkerhed:** Zod↔TS-mismatches ("type lies"). Usikre `as`/`!`/`any`/implicit narrowing. Persisteret input fuldt Zod-dækket.
- **Tests:** manglende dækning af beregning/validering/round-trip/edge cases. Tests der tester implementeringsdetaljer frem for invarianter; flakiness; over-mocking. Mindst ét top-level `describe(...)` pr. fil.
- **Kompleksitet:** unødvendig indirektion, dødkode, ubrugte exports, for store/overlappende filer. Bemærk særligt `LoenindkomstTab.tsx` og `EOOplysningerTab.tsx` — kandidater til opdeling i gruppe 8.

### Dokumentationsformat (én fil pr. punkt, `docs/review/[punkt]-[navn].md`)

```
# Punkt: [nummer] [navn]
**Dato:** ÅÅÅÅ-MM-DD
**Filer gennemgået:** [liste]   **Filer ikke gennemgået:** [hvis relevant]
**Tests kørt:** [kommando + resultat]

## Fund og rettelser
[Nummereret. Pr. fund: severity, lokation, problem, risiko, HANDLING:
 ✅ Rettet — beskrivelse | ⏸ Afventer godkendelse — forslag+konsekvens | ⏭ Ikke rettet — begrundelse]

## Tilfældighedsfund
[Alt udenfor punktets scope, samme handlingsmarkering. Peger fundet på et senere punkt → tilføj det også til "Udskudte fund" i denne plan.]

## Sammenfatning
[2–5 bullets: vigtigste rettelser, åbne godkendelsespunkter, konvergens.]
```

**Severity:** Kritisk (forkerte beregninger/datatab/brudte invarianter) · Høj (arkitekturfejl/type-usikkerhed/manglende validering med reel risiko) · Medium (kompleksitet/duplikering/manglende tests) · Lav (inkonsistens/oprydning).

---

## Proces

1. Vælg næste **ikke-startede** punkt (følg rækkefølgen).
2. **Læs blokken for punktet i "Udskudte fund" ovenfor.**
3. Gennemgå punktets filer + direkte afhængigheder; markér hvad der er/ikke er gennemgået. Uddelegér gerne brede gennemgange til subagents.
4. Ret fundene (kode direkte; UI/UX + beregningslogik forelægges). Nye fund der hører til et senere punkt → tilføj til "Udskudte fund".
5. Kør tests efter kvalitetsgaten i `AGENTS.md` (smalleste tjek der fanger fejl; udvid efter risikoflade). Rapportér ærligt.
6. Dokumentér i `docs/review/[punkt]-[navn].md`; opdatér statustabel til ✅ og fjern de afsluttede poster fra "Udskudte fund".

Et punkt behøver ikke dække hver fil i en mappe — scope = en sammenhængende arbejdsenhed. Filer der hører til et andet punkt krydsrefereres.

**Statusværdier:** ⬜ Ikke startet · 🟡 I gang (åbne fund/godkendelser) · ✅ Gennemgået (rettet/parkeret, tests grønne, dokumenteret).

### Rækkefølgerationale (nedefra og op)

| Gruppe | Begrundelse |
|---|---|
| 1 Kontrakter | Normative; styrer alt øvrigt. |
| 2 Persistence | Alt afhænger af korrekt gem/load. |
| 3 Schemas | Grænseflade til persistence + beregning. |
| 4 Domænelogik | Systemets hjerte; opreguleringsmotor (4.0) er fundament. |
| 5 Hjælpefunktioner | Utilities brugt af al domænelogik. |
| 6 Data | Statiske data forudsætning for korrekte beregninger. |
| 7 UI-inputs & grid | Grænseflade mod beregningslagene. |
| 8 Pages | Sammensætning af input + præsentation. |
| 9 Hooks | Lim mellem UI og domæne. |
| 10 Dokument-output | Outputkanal (PDF+Word) over domænedata. |
| 11 Config & settings | Rammeværk og opsætning. |
| 12 App-shell & multi-app | Sammenbinding + multi-app-isolation. |
| 13 Testkvalitet | Verificerer de foregående punkter. |
| 14 Tværgående helhed | Endelig kontrakt-alignment + duplikering. |
