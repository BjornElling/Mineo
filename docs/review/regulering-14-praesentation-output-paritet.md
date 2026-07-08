# Regulering punkt 14 — Præsentation og output-paritet

**Dato:** 2026-07-04
**Status:** ✅ Gennemgået
**Reguleringsform(er):** tværgående — alle familie-1-former (Ingen, Statistik/ASL, Overenskomst privat+offentlig, Manuelt angivet, Manuel procentsats, KRL, KL-lønaftaler) samt familie-2 offentlige ydelsers reguleringstabel. Særligt fokus: KL-lønaftaler (U8) og offentlig overenskomst-indplacering (U3).
**Primært scope:**
- `domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts` (skærm/PDF/Word-fælles builders)
- `domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning.ts` (U9-tabel)
- `domain/erstatningsopgoerelse/engines/reguleringFormulaUtils.ts` (`computeFormulaValue`, U5)
- `document/generators/eo/sections/reguleringSection.ts`, `eo/reguleringDocument.ts`, `eo/reguleringNotes.ts`
- `document/generators/tafFordelt/tafOpreguleretPaaAarDocument.ts`, `klLoenaftaler/klLoenaftalerDocument.ts`
- `domain/eoInspektion/eoInspektionRegulationViewModel.ts` + `-Core.ts` + `eoInspektionLoenCoreModel.ts` (nedstrøms DEV-inspektionslag)
- **Ny helper:** `domain/erstatningsopgoerelse/helpers/offentligLoenSelection.ts` (U3)
**Afhængigheder læst:**
- `AGENTS.md`; hele `regulering-review-plan.md` (punkt 14 + S1 + udskudte U3/U5/U8/U9 + skabelon/severity/afslutningskrav)
- `docs/domain/taf/kl-loenaftaler-regulering.md` (KL-særvisninger, §5-invarianter)
- `regulering-12-datakomplethed-staleness.md`, `regulering-10-form-kl-loenaftaler.md`
- `src/__tests__/quality/inspektionLayerIsolation.test.ts` (B9-grænsen), `docs/architecture/eo-row-evaluation-architecture.md`
- `engines/klLoenaftalerReguleretLoen.ts`, `loenudviklingBeregning.ts` (KL deltaPct/reguleretLoenOre), `shared/eoTypes.ts`, `snapshot/eoPresentationModel.ts`
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run reguleringsPresentation reguleringSection eoInspektionRegulation eoInspektionLoenCore erstatningsopgoerelseWordContent` → ✅ 7 filer / 164 tests
- `npx vitest run offentligLoenSelection loenudviklingBeregning loenudviklingOffentligFailClosed inspektionLayerIsolation` → ✅ 4 filer / 62 tests
- `npx vitest run reguleringSilentPathAlignment klLoenaftaler tafPerYear eoSnapshotToInspektionView reguleringWordContent klLoenaftalerWordContent tafOpreguleretPaaAarWordContent offentligeYdelser` → ✅ 20 filer / 178 tests

## Formål

Sikre at det, brugeren *ser* om regulering (tabeller, indeks, noter, reguleret løn), og det, der *skrives* i PDF/Word, matcher den beregnede reguleringsværdi — at intet nedstrøms-led (skærm-præsentation, PDF, Word) taber, overskriver, dobbelt-afrunder, filtrerer eller maskerer værdien, og at en forkert visning ikke skjuler en beregningsfejl.

## Arkitektonisk grundobservation (kernen i paritet)

Skærm, PDF og Word deler **de samme domæne-builders** — der er ingen tre parallelle formaterings-implementeringer:

- `buildReguleringsvaerdierTableData` og `buildReguleringIndexRows` (`reguleringsPresentation.ts`) producerer tabel-data ÉN gang.
- **PDF + Word:** `reguleringSection.renderReguleringSection` konsumerer builderne og render via `DocumentWriter`-abstraktionen. Ved Word er `writer` en `DocxWriter` (samme `PdfWriter`-type — jf. Word-docx-memoen), så PDF og Word render *identisk* rækkedata gennem samme kodesti. Paritet PDF↔Word er derfor strukturelt garanteret for regulering-sektionen (ikke to kopier der kan drifte).
- **Skærm (DEV-inspektion):** `eoInspektionRegulationViewModel.buildRegulationInspektionSections` konsumerer de *samme* to builders. Skærm-visning er dermed også afledt af samme kilde.

Konklusion: et paritet-brud kan i praksis kun opstå (a) i en form-specifik gren inde i builderne, eller (b) i en *anden* værdikilde end den beregningen bruger (U8/U9-klassen: "vist tal ≠ tal-der-driver-beløb"). Reviewet fokuserede derfor på disse to.

## Kæde fra input til færdigt produkt (KL-lønaftaler-eksempel)

Ét gyldigt input: angivet månedsløn 30.000 kr., reguleringsdato 01-04-2024, KL-lønaftaler, TAF 01-04-2024–31-03-2026. Forventet reguleret månedsløn efter 01-10-2024 (+1,30 %) = 30.390,00; efter 01-11-2025 (+0,75 %) = 30.709,78.

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `klLoenaftaler` | — | ✔ |
| Datakilde-opslag | `klLoenaftalerRaekker` (periodesatser) | uparsbar/ikke-finit → throw (S4, punkt 10) | ✔ |
| Reguleringsdato-forankring | `resolveAnvendtReguleringsdato` (kanonisk) | — | ✔ |
| Segment/kæde/afrunding | `buildKlLoenaftalerReguleretLoenResolver`: `loen_i = afrund(loen_{i-1}×(1+sats))`; `reguleretLoenOre = toOre(loenAt)`, `deltaPct = round8(...)` | — | ✔ |
| Aggregering (af/år) | `tafPerYearDerived` bruger `reguleretLoenOre` som autoritativ KL-enhedsløn | genberegning fra deltaPct | ✔ (læser reguleretLoenOre) |
| Snapshot | `reguleretLoenOre` valgfrit i canonical-schema, propageres | felt tabes | ✔ |
| Validator/gate | download-gate = `collectAllEoRows` (`eoRowEvaluation`, autoritativ) | — | ✔ |
| Skærm-præsentation | `eoInspektionRegulationViewModel` → `buildReguleringIndexRows` | anden kilde end indkomst-linje (**U8**) | ✔ **efter fix** |
| PDF-output | `reguleringSection` (Beregnet regulering: "Reguleret månedsløn") + `opgoerelseSection`/`tafOpreguleret` (indkomst-linje, `reguleretLoenOre`) | to kilder til samme værdi (**U8**) | ✔ **efter fix** |
| Word-output | samme `reguleringSection`/`opgoerelseSection` via `DocxWriter` | — | ✔ (ende-til-ende-testet) |

## Paritets-tabel (skærm vs. PDF vs. Word)

| Element | Skærm (eoInspektion) | PDF | Word | Fælles kilde | Paritet |
|---|---|---|---|---|---|
| Reguleringsværdier-tabel (inkl. basisrække, S2) | `buildReguleringsvaerdierTableData` | s.d. | s.d. | ✔ ét sted | ✔ |
| Beregnet regulering-tabel | `buildReguleringIndexRows` | s.d. (`renderReguleringSection`) | s.d. (samme, `DocxWriter`) | ✔ ét sted | ✔ |
| KL "Reguleret løn"-kolonne | `row.reguleretLoen` | s.d. | s.d. | ✔ (nu `segment.reguleretLoenOre`) | ✔ **efter U8** |
| `tidligsteSatsGaelderFra`-note (S1) | (ikke i DEV-tabel) | `reguleringSection` note | s.d. | `resolveTidligsteSatsGaelderFra(kildeUscopedFraDato, regdato)` | ✔ |
| 4-decimal reguleringsprocent (KRL) | `formatAsAmount(v,4)` | s.d. | s.d. | ✔ ét sted | ✔ |
| Forligsfaktor (TAF opreguleret) | — | `${forlig.label} x (...)` fra model | s.d. | model | ✔ |
| Offentlige ydelser "Akkumuleret regulering" | `buildOffentligeYdelserReguleringTableData` | s.d. | s.d. | ✔ ét sted (U9, se nedenfor) | ✔ |

## Dækningsanalyse (led 2 — tabt/forvansket nedstrøms)

- **KL reguleret løn (U8).** Sti: *anden kilde nedstrøms* — Beregnet regulering-tabellen genberegnede den viste løn fra `deltaPct` i stedet for at læse segmentets autoritative `reguleretLoenOre` (som indkomst-linjerne gør). Kan valid input ramme den? Ja (enhver KL-sag). Bevidst eller fejl? Overflødig anden kilde (tal-identisk pr. KL-doc §5.2, men drift-risiko). Udfald: **rettet direkte, tal-neutralt** (læser nu `reguleretLoenOre`; defensiv deltaPct-fallback bevaret). Ingen synlig ændring.
- **Offentlige ydelsers "Akkumuleret regulering" (U9).** Sti: kolonnen bygges fra den rå u-afrundede akkumulerede pct, mens beløbet drives af `round2(...)`. Kan valid input ramme den? Ja. Bevidst eller fejl? **Bekræftet uden synlig forskel:** display-formatteren `formatPercent` afrunder selv til 2 decimaler (`round2` → `toFixed(2)`), så `formatPercent(rå)` er byte-identisk med `formatPercent(round2(rå))`. Den viste akkumulerede sats er dermed altid identisk med den, beløbet er beregnet fra. Udfald: **ingen ændring** (harmløs kilde-nuance, ikke et paritet-brud).
- **Basisrækken i Reguleringsværdier (S2).** Sti: "Beregnet regulering" dividerer med lønpakken på den anvendte reguleringsdato (formlens nævner, indeks-100-niveauet), men denne basis-sats var tidligere kun synlig inde i nævner-teksten — aldrig som en tabelrække. Kan valid input ramme den? Ja: når reguleringsdatoen ligger før reguleringsvinduets start (fx angivet løn med sen TAF-periode) OG satsen ændrede sig imellem, faldt basissatsen uden for det TAF-scopede vindue og manglede i Reguleringsværdier — læseren kunne ikke genfinde nævneren. Handling: `resolveRelevantRealDatesForTafScope` tager nu et **basisanker** (den anvendte reguleringsdato) og medtager den sats, der var i kraft på ankeret. Regler: (1) vises kun når værdierne ikke i forvejen fremgår af de øvrige rækker (identisk nabo flettes af `mergeConsecutiveValueRows`, samme satsdato dedupes); (2) dateres med sin **rå satsdato** fra reguleringsgrundlaget — aldrig med reguleringsdatoen (fortsat ingen syntetisk reguleringsdato-række); (3) mellemliggende satsændringer mellem basis og vindue, som ingen beregning bruger, medtages ikke (**vist = beregnet**). Gælder de indeks-baserede grene (offentlig/privat overenskomst, statistik, KRL). KL (egen trinvis model, ingen nævner) og manuelt angivet/manuel procentsats (har allerede eksplicit basisrække) er uændret. Bivirkning: teksten "Regulering foretages … Hertil kommer stigninger i …" sammenligner tabellens første og sidste række og fanger nu korrekt stigninger i fx fritvalg/SH, hvis fra-værdierne ligger i basisrækken. **Rettet — bevidst synlig ændring, godkendt af bruger.**
- **S1-noten (`tidligsteSatsGaelderFra`).** Sti: note vises når dækningen starter efter reguleringsdatoen. Koblet til det rigtige signal? Ja — bygges af kildens *uscopede* coverage-`fraDato` (offentlig/privat overenskomst: `overenskomstCoverageStartIso`; statistik/KRL/KL: `periodStarts[0].startIso`), ikke af en TAF-scopet delmængde eller en parallel genberegning. Den eksplicitte kommentar i `resolveTidligsteSatsGaelderFra` forbyder `relevantRealDates[0]`. Vises via `reguleringSection` når TAF-vinduet begynder sent. **Bekræftet korrekt.**
- **4-decimal-delta + forligsfaktor.** Render korrekt i alle outputs via delte builders/model (se paritets-tabel). Bekræftet.

## Fund og rettelser

1. **[Medium — rettet direkte, tal-neutralt] U8: KL Beregnet regulering læste ikke den autoritative `reguleretLoenOre`.**
   - Lokation: `reguleringsPresentation.ts` (`buildReguleringIndexRows`, KL-gren, ~l.1078).
   - Problem/Risiko: Den viste "Reguleret løn" blev genberegnet fra `deltaPct` (`basisløn × (1 + deltaPct/100)`), mens indkomst-linjerne (PDF/Word) læser segmentets autoritative `reguleretLoenOre`. To kilder til samme værdi → drift-risiko (single source of truth brudt).
   - Handling: Læser nu `segment.reguleretLoenOre / 100` direkte, når feltet er sat (det er det altid for KL-segmenter fra motoren). deltaPct-genberegningen er bevaret som **defensiv fallback** med kommentar (tal-identisk pr. KL-doc §2, hvor `deltaPct` netop holdes i fuld præcision for at reproducere den trinvist afrundede løn).
   - Resultat: **Ingen synlig ændring** (bevist tal-identisk: eksisterende KL-test uændret grøn via fallback; ny test beviser at den autoritative værdi vinder). Skærm/PDF/Word deler nu samme kilde.

2. **[Medium — rettet direkte, tal-neutralt] U3: `resolveOffentligLoenSelection` fandtes i tre parallelle kopier.**
   - Lokation: `loenudviklingBeregning.ts:234` (compute, kaster), `eoInspektionRegulationCore.ts:88` + `eoInspektionLoenCoreModel.ts:76` (inspektion, returnerer `null`).
   - Problem/Risiko: Identisk parsing-logik i tre kopier med forskellig fejl-semantik (throw vs. null) → drift-risiko mellem beregning og visning.
   - Handling: Ny delt, ren parser `parseOffentligLoenSelection` (`helpers/offentligLoenSelection.ts`) returnerer et diskrimineret resultat med feltspecifik `reason`. De tre callsites er nu tynde wrappers: compute mapper `reason` → de **uændrede** throw-beskeder (fail-closed bevaret); de to inspektions-varianter returnerer `null` ved enhver `reason`. Tjek-rækkefølgen er bevaret, så motorens feltspecifikke throw-beskeder er ordret uændrede.
   - Resultat: **Ingen adfærds-/talændring** (3 kopier → 1; throw-vs-null-semantik bevaret; dækket af ny helper-test + uændret grønne motor-/fail-closed-tests).

## Afgørelse af udskudte fund (foreslået status)

| ID | Afgørelse | Begrundelse |
|---|---|---|
| **U3** | **Lukket (rettet punkt 14)** | Ren parsing udtrukket til delt helper med tynde wrappers; throw-vs-null bevaret; tal-neutralt. |
| **U5** | **Forbliver åben → punkt 15** | `computePackageValuePct` (propagerer `NaN`/`Infinity` → callsite-throw = fail-closed) vs. `computeFormulaValue` (coercer ikke-finit → 0). Konsolidering ændrer **fail-closed-semantik** i beregningsmotoren (5 callsites i offentlig/manuel-gren) og kræver omhyggelig finite-guard-afstemning for ikke at forvandle en fail-closed til et tavst 0 (tavs under-regulering). Det er ikke et paritet-/output-problem (matematikken er identisk for valid input, og præsentationen bruger allerede `computeFormulaValue`). Hører hjemme i punkt 15's konvergens-arbejde sammen med U4/U10 — bevidst ikke forceret under et præsentations-review. Anbefalet implementering: gør `computePackageValuePct` til en tynd wrapper der først finite-guarder (throw) og dernæst kalder `computeFormulaValue`. |
| **U8** | **Lukket (rettet punkt 14)** | Læser nu autoritativ `reguleretLoenOre`; tal-identisk; single source of truth. |
| **U9** | **Lukket (bekræftet korrekt, ingen ændring)** | Ingen synlig forskel: `formatPercent` afrunder selv til 2 decimaler, så vist akkumuleret sats = den værdi beløbet drives af. Harmløs kilde-nuance. |

## B9-verifikation (gater debug-laget produktions-PDF?)

Planens scope nævner et "debug/eoDebugRegulation*"-lag. Det eksisterer **ikke** længere under det navn. Verificeret mod koden (`inspektionLayerIsolation.test.ts` + `eo-row-evaluation-architecture.md`):

- Den **trust-kritiske** download-gate er flyttet til `domain/eoRowEvaluation/` (`collectAllEoRows` → `error`-rækker driver gaten i `useEoBeregningViewModel`). Det lag er inspektionsfrit.
- `domain/eoInspektion/` er et **rent nedstrøms DEV-inspektions-/kontrollag** (tabeller, view-model). Det gater **ikke** produktions-PDF, og et kvalitets-værn pinner at kun to sanktionerede bro-filer må importere det, og at gaten aldrig konsumerer det.

Konklusion: B9-memoens tidligere bekymring ("debug-laget gater PDF") er **ikke længere gældende** — den trust-kritiske korrekthed bor i det autoritative `eoRowEvaluation`-lag. `buildReguleringIndexRows` (som eoInspektion konsumerer) er en delt *præsentations*-builder, ikke domænesandhed for gaten. Min U8-ændring i det lag er sikker.

## Testdækning (led 3)

- **Ny (led 3, ende-til-ende):** `erstatningsopgoerelseWordContent.test.ts` — KL-lønaftaler fra input → snapshot/model → **Word-produkt**; bekræfter at den kæde-opregulerede løn (30.390,00 og 30.709,78) optræder **mindst to gange** (både Forventet indkomst-linjen og Beregnet regulering-tabellen), så et tabt nedstrøms-led i én af de to stier fanges. Binder formen helt frem til produktet, ikke kun motoren.
- **Ny (U8 single-source):** `reguleringsPresentation.test.ts` — sætter `reguleretLoenOre` til en værdi der IKKE stemmer med deltaPct-genberegningen og hævder at "Reguleret løn" viser den autoritative værdi. Beviser at builderen læser `reguleretLoenOre`, ikke genberegner.
- **Ny (U3):** `offentligLoenSelection.test.ts` — normalsti (inkl. løntrin 55+) + hver feltspecifik `reason` + rækkefølge-invariant (løntrin-fejl før gruppe-fejl), der pinner motorens throw-besked-rækkefølge.
- **Bekræftet uændret grøn:** eksisterende KL-præsentationstests (via defensiv fallback), `loenudviklingOffentligFailClosed` (motorens throw-beskeder), `inspektionLayerIsolation`, `reguleringWordContent`/`klLoenaftalerWordContent`/`tafOpreguleretPaaAarWordContent`, `offentligeYdelser`.

## Tilfældighedsfund

- **[Lav — doc-drift, plan]** `regulering-review-plan.md` punkt 14 + landkort refererer til `debug/eoDebugRegulation*`. Laget er relokeret: autoritativ gate → `domain/eoRowEvaluation/`, DEV-inspektion → `domain/eoInspektion/` (B9). Planens sti-reference er forældet (kun kosmetisk; hovedtråden opdaterer plan-filen).
- **[Lav — bevidst afvigelse, ikke paritet-brud]** Det *standalone* "Regulering"-downloaddokument (`reguleringDocument.ts`) viser statistik-indeks med **1 decimal** (`formatIndexValue` → `round1`), mens EO'ens Reguleringsværdier-tabel bruger `detectDecimalPlaces`. Det er to forskellige artefakter med forskellige formål (kilde-satstabel-udskrift vs. den anvendte reguleringsopgørelse), ikke to visninger af samme view — derfor ikke et skærm/PDF/Word-paritet-brud. Noteret for komplethed.
- **[Info — bekræftet]** `reguleringNotes.ts` (`ILON12_DISCONTINUED_NOTE`) deles korrekt mellem EO-sektionen og standalone-dokumentet (ét sted for den brugervendte tekst).

## Sammenfatning

Regulering-præsentationen er **struktureltparitetssikker**: skærm (eoInspektion), PDF og Word render alle gennem de samme to domæne-builders (`buildReguleringsvaerdierTableData` / `buildReguleringIndexRows`), og PDF/Word deler oven i købet render-koden via `DocumentWriter`-abstraktionen. Reviewet fandt derfor ingen tabt/forvansket/dobbelt-afrundet reguleringsværdi i selve visnings-kæden. De to reelle fund var af "anden kilde"-klassen: **U8** (KL reguleret løn genberegnet fra deltaPct frem for den autoritative `reguleretLoenOre`) er rettet tal-neutralt til single source of truth; **U9** er bekræftet uden synlig forskel (display-formatteren afrunder selv). **U3** (tre kopier af `resolveOffentligLoenSelection`) er konsolideret til én delt ren parser med bevaret throw-vs-null-semantik. **U5** forbliver åben til punkt 15, fordi den rører beregningsmotorens fail-closed-semantik og ikke er et paritet-problem. S1-noten, 4-decimal-delta og forligsfaktor render korrekt i alle tre outputs. Debug-laget er verificeret som rent nedstrøms (B9: den trust-kritiske gate bor i `eoRowEvaluation`, ikke i inspektionslaget).

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring / ingen synlig ændring — intet at forelægge.** U8 og U3 er begge tal-/visnings-neutrale strukturelle ændringer (bevist ved uændret grønne eksisterende tests + nye tests der pinner identiteten). U9 er bekræftet uden ændring. U5 er dokumenteret og udskudt, ikke ændret.
