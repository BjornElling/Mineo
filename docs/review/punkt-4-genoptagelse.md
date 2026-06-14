# Genoptagelse — Punkt 4 (Domænelogik / beregningskernen)

> **Formål med denne fil:** Alt der skal til for at genoptage review+rettelse af punkt 4 i `docs/review/code-review-plan.md` på et senere tidspunkt, uden tab af kontekst. Skrevet 2026-06-14 efter at 4.0–4.8 var færdige.

---

## 1. Opgaven (uændret mandat fra brugeren)

- Kør **individuelle subagents** på hvert underpunkt af punkt 4 (domænelogik). Brugeren foretrækker subagents, så orkestratorens (hovedtrådens) kontekstvindue holdes rent.
- Følg `docs/review/code-review-plan.md` — udover review skal **alle fund, fejl og potentielle forbedringer rettes**.
- Orkestratoren træffer **alle koderelaterede beslutninger** og går efter det bedst mulige slutprodukt.
- **Brugeren involveres KUN** hvis en ændring påvirker **UI/UX på en måde brugeren vil opleve** — herunder **de tal programmet producerer** (beregningslogik). I så fald: præsentér konkrete eksempler på, hvad brugeren ser/oplever før vs. efter. Alt andet gennemføres direkte.
- Autoritativ kilde: `AGENTS.md` (roller, mandat, constraints). `src/contracts/*.md` > `AGENTS.md` ved konflikt.

---

## 2. Orkestrerings-strategi (den der er brugt — fortsæt sådan)

**Orkestratoren delegerer hvert underpunkt til én subagent** (`subagent_type: general-purpose`, fuld værktøjsadgang). Orkestratoren:
- ejer **statustabellen** i `code-review-plan.md` (subagents må IKKE røre den → undgår parallel-edit-konflikt),
- ejer **TodoWrite**-listen,
- samler **godkendelsespunkter** til én konsolideret runde til brugeren til sidst,
- verificerer kombineret tilstand (typecheck) efter parallelle waves.

**Parallel-sikkerhed (ufravigelig regel givet til hver subagent):** Rediger KUN filer i dit eget domæne. Nødvendige rettelser i delte/tværgående filer (`src/utils/`, `src/types/`, `src/schemas/`, `src/contracts/`, `src/data/`) eller et andet underpunkts domæne → RET IKKE, rapportér som krydsreference. Det gør parallelle agents kollisionsfri.

**Wave-inddeling brugt indtil nu:**
- **Wave 1:** 4.0 alene (fundament — alt delegerer til opreguleringsmotorerne).
- **Wave 2 (parallel, disjunkte domæner):** 4.1, 4.5, 4.6, 4.7.
- **Wave 3:** 4.2 + 4.3 parallelt (aarsloen vs erhvervsevnetab), derefter 4.4 sekventielt (samme EET-mappe som 4.3).
- **EO-familien 4.8–4.14: SEKVENTIELT** (tæt koblet, samme mappe `src/domain/erstatningsopgoerelse/`, organisk vokset). 4.8 færdig.

**Subagent-promptskabelon (genbrug):** Hver prompt indeholder: (1) læs `AGENTS.md` + relevante plan-afsnit + relevante `src/contracts/*.md` + relevante memory-filer under `C:\Users\bjell\.claude\projects\c--Users-bjell-Mineo\memory\`; (2) ALDRIG ændre beregningslogik/UI uden godkendelse — dokumentér før/efter i stedet; (3) domænegrænse-reglen ovenfor; (4) præcist scope; (5) de 4–5 reviewdimensioner; (6) ret output-neutrale fund direkte, skriv/opdatér tests, kør målrettede `npx vitest run <sti>` + `npm run typecheck`(+`:test`); (7) skriv `docs/review/<punkt>-<navn>.md` efter planens format; (8) RØR IKKE statustabellen; (9) returnér kompakt struktureret opsummering (Fixed / Afventer godkendelse m. før/efter / krydsref / tests / konvergens). De fulde prompts kan rekonstrueres fra de allerede skrevne — se de eksisterende `docs/review/4.*.md` for hvert punkts faktiske scope.

---

## 3. Status pr. 2026-06-14

| Punkt | Navn | Status | Review-doc |
|---|---|---|---|
| 4.0 | Opreguleringsmotorer (fundament) | ✅ | `docs/review/4.0-opreguleringsmotorer-fundament.md` |
| 4.1 | Stamdata, satser, policies | ✅ | `docs/review/4.1-stamdata-satser-policies.md` |
| 4.2 | Årsløn | ✅ | `docs/review/4.2-aarsloen.md` |
| 4.3 | EET kerne (EAL/ASL/differencekrav/typer) | ✅ | `docs/review/4.3-eet-kerne-asl-eal-differencekrav.md` |
| 4.4 | EET kapitalisering/løbende/mer-erstatning/regulering/snapshot | ✅ | `docs/review/4.4-eet-kapitalisering-loebende-mer-regulering.md` |
| 4.5 | Forsørgertab | ✅ | `docs/review/4.5-forsoergertab.md` |
| 4.6 | Varige Mén | ✅ | `docs/review/4.6-varige-men.md` |
| 4.7 | Renteberegning | ✅ | `docs/review/4.7-renteberegning.md` |
| 4.8 | EO-engines I: periodisering | ✅ | `docs/review/4.8-eo-engines-i-periodisering.md` |
| 4.9 | EO-engines II: TAF/forligsgrad/svie-smerte/sygeferiegodtgørelse | ✅ | `docs/review/4.9-eo-engines-ii-taf-forligsgrad-svie-smerte.md` |
| 4.10 | EO-engines III: loenudvikling/regulering | ✅ | `docs/review/4.10-eo-engines-iii-loenudvikling-regulering.md` |
| 4.11 | EO helpers/initial-values/row-derived/tabel-modeller/indtaegtPerioder/sygedagpengeInsertRows/midlertidigtEet | ✅ | `docs/review/4.11-eo-helpers-initial-values-tabeller.md` |
| 4.12 | EO validation-lag + erstatningsopgoerelseValidator | ✅ | `docs/review/4.12-eo-validation-lag.md` |
| 4.13 | EO snapshot/presentation-model/canonical/invarianter/projektioner | ✅ | `docs/review/4.13-eo-snapshot-presentation-canonical.md` |
| 4.14 | EO-debug view-models/parity/severity/integrity/navigation/csv/builder-registry | ✅ | `docs/review/4.14-eo-debug-viewmodels-parity-severity-navigation.md` |

**Status:** ✅ **Hele punkt 4 (4.0–4.14) er færdig** (2026-06-14). Næste i planen er **gruppe 5 (Hjælpefunktioner)**, punkt 5.1. Den konsoliderede godkendelsesrunde (afsnit 4) er forelagt brugeren.

**Vigtigt for 4.9+:** 4.8 rørte kun `periodiseringsMotor.ts` (comment-only) + 2 testfiler — ingen signatur-/adfærdsændringer. Periodiserings-motoren er konsolideret og et sikkert fundament.

---

## 4. ⏸ ÅBNE GODKENDELSESPUNKTER — skal forelægges brugeren (konsolideret runde til sidst)

Disse er IKKE rettet. De ændrer tal/UX og kræver brugerens beslutning. Præsentér med konkrete før/efter-eksempler.

1. **(4.7 — beregningslogik, reel effekt) To konkurrerende "+ måned"-semantikker for tillægstid.**
   - `rentekravValidation.ts` `calculateInterestDate` (`enhed: 'maaneder'`) bruger rå `setUTCMonth`-rollover; kanonisk `dateUtils.ts` `addMonths` clamper til månedsslut.
   - Før: rente fra **31-01-2025** + 1 md → rentedato **03-03-2025**; efter ensretning mod clamp → **28-02-2025**.
   - Før: **31-01-2024** (skudår) + 1 md → **02-03-2024**; efter → **29-02-2024**.
   - Effekt: ændrer rentebeløbet med typisk 1–3 dages rente på det pågældende krav. **Brugeren skal vælge hvilken semantik der er korrekt.**
2. **(4.3 — validerings-/UX-spørgsmål) `computeEetEalCalculation` validerer ikke `beregningsdato >= skadedato`.** Ved beregningsdato før skadedato gives faktor 1 (ingen regulering) uden advarsel. Crasher ikke; korrekt for gyldige input. Spørgsmål: skal en advarsel/validering tilføjes?
3. **(4.5 — lav, defensiv) Silent fallthrough ved manglende `foersoergertabEalMin`** i `forsoergertabEalKrav.ts`. Uopnåelig i praksis (`getSatserCompleteYearBounds()` inkluderer min-satsen), så ingen aktuel regression. Kan evt. hærdes output-neutralt til eksplicit fail-closed. Lav prioritet.

4. **(4.9 — brugervendt output) `forligLabel` for decimal-procent bruger ikke dansk talformat.** `forligAnsvarsgradProcent` tillader decimaler. Labelen bygges som `${procentValue}%` (JS-talstreng).
   - Før: forlig på `12,5` → svie/smerte-PDF-suffix `" (forlig på 12.5%)"`; heltal `50` → `" (forlig på 50%)"`.
   - Efter (ensretning mod kanonisk `formatPercent`): `12,5` → `" (forlig på 12,5 %)"`; `50` → `" (forlig på 50 %)"`. Mindre indgribende alt.: kun punktum→komma, bevar kompakt `12,5%`.
   - **Brugeren skal vælge format** (og evt. om feltet overhovedet skal tillade decimaler — krydsref 8.3).
5. **(4.12 — latent dobbelt-sandhed i TAF-opreguleret satsdæknings-gate)** `validateTafOpreguleretReguleringssatser` kræver satsdækning for *hvert* kalenderår i hver TAF-rækkes interval, mens beregningslaget springer år med `yearTafOre === 0` over. Samme motor, forskelligt år-sæt.
   - Manifesterer **ikke** i dag (reguleringssats sammenhængende 2005–2026), men kan i teorien give en falsk-positiv blokerende feltfejl ("mangler reguleringssats for ÅÅÅÅ") på et 0-beløbs-år.
   - Fix ville ensrette år-sættet (compute-side springer 0-år; gate bør gøre det samme). Ændrer hvilke fejl brugeren *kan* udløse → forelægges.
6. **(4.13 — SFGG-valideringsfejl er fuldt ikke-blokerende uden kontraktdækning)** En SFGG-inputfejl (severity 'error') giver status 'error' *med data* og blokerer **ingen download** (`blocksAuthoritativeComputation: false`, `blocksOutputs: []`).
   - Før: bruger med manglende SFGG-dato kan downloade EO-/TAF-PDF med SFGG-beregning på ufuldstændigt input.
   - Spørgsmål: skal SFGG-fejl blokere download som andre obligatoriske felter, eller er de bevidst kun rådgivende? Påvirker hvornår download-knappen er aktiv.

Ingen øvrige godkendelsespunkter fra 4.0/4.1/4.2/4.4/4.6/4.8/4.10/4.11/4.14 (de var alle output-neutrale).

---

## 5. Parkerede krydsreferencer / tilfældighedsfund (rettes i senere grupper)

- **14.2 / navngivning:** `stamdataCalculations.ts` + `satserCalculations.ts` indeholder ingen beregninger (kun policy/gate/label) — `*Calculations`-navnet er misvisende. Rename rører konsumenter + kontrakterne `satser-contract.md` og `aarsloen-contract.md`.
- **5.4:** `formatPercentTrimmedFromRounded4` bor i `eetLoebendeYdelserCalculation.ts` og re-eksporteres via `eetEalCalculation.ts:392`; kanonisk hjem er `src/utils/formatUtils.ts`.
- **4.11 / 14.2:** `src/domain/erstatningsopgoerelse/helpers/aarsloenRowInterval.ts` er reelt en årsløn-tabel-primitiv (parser `StandardLoenTableRow`) men ligger i EO-domænet → flyt til `src/domain/aarsloen/`.
- **8.2 / 14.2:** inline `'2015-03-01'` i `EetOplysningerTab.tsx` (3×) og `forsoergertabConstants.PRE_2015_CUTOFF` bør konvergere mod den nu centrale `SKAERING_2015_03_01` (i `eetSkaeringsdatoer.ts`).
- **4.3 / 14.2 (lav):** `eetEalCalculation.ts:278-279` bruger stadig rå års-udtræk (ikke `isoYear()`).
- **6.4:** `resolveKapitaliseringsbekendtgoerelseId` antager ét kalenderår pr. skadesinterval (holder med nuværende data).
- **8.5:** `MenberegningTab` `menSats`-visningsrækken re-resolver satsen uden for engine (parallel opslagssti, kun visning) — overvej at læse `beregningsResultat.satsPerMengrad`.
- **4.10 / 14.2 (medium):** `periodiserBeloebForMaaneder` + `periodiserBeloebForArbejdsdage` (i periodiseringsmotoren) er **ubrugte i produktion** — løn-periodisering bruger `base × quantity`. Mulig parallel logik vs. periodisering-kontrakt §1A/§7; afgøres i 4.10.
- **5.3:** `erSHDag = erHverdagUtc` i `shDageBeregning.ts` er misvisende navngivet.
- **Renteberegning (4.7, parkeret, output-neutralt):** død indre år-løkke i `calculatePeriodInterest` (procesrenteCalculator.ts; kalderen halvårsopdeler altid); `beregningsdato`-carry-forward mod øvre satsdækning er korrekt men udokumenteret.

---

## 6. Memory-vedligehold (gør ved næste lejlighed)

- `MEMORY.md` / schemas-noten "Åbent til 4.2: `aarsloenSchema` required felter uden default" → **er allerede lukket i gruppe 3** (schemaet har faste defaults, kontrakt §2a, forward/backward-tolerant load regressionstestet). Markér som løst.

---

## 7. Test-/tree-tilstand

- **Baseline ved punkt-4-start:** 5020 tests / 421 filer grøn.
- **Efter 4.4:** fuld suite kørt grøn = **5095 tests / 425 filer** (agents har tilføjet tests). 4.8 tilføjede +12 i scope-suiten (alle grønne).
- `npm run typecheck` + `npm run typecheck:test` grønne efter hver wave (senest verificeret efter 4.4 fuld suite og 4.8).
- **Pre-eksisterende fejl (IKKE fra dette arbejde, hører til 9.3/12):** `MainLayout.pwaConcurrency`-test fejler på ren main. `act(...)`-warning i `TableDropdown.gridCore.test.tsx` (ikke en fejl).
- **Working tree:** Ucommittede ændringer fra alle ovenstående agents ligger i working tree. **Brugeren committer selv** (AGENTS.md: commit kun på eksplicit besked, push aldrig). Ved genoptagelse: `git status`/`git diff` for at se ophobede ændringer.

---

## 8. Reviewdimensioner og format (resumé — fuld version i planen)

Hvert punkt tjekker: (1) korrekthed/determinisme (locale/tidszone/floating-point/fail-closed), (2) crashrisici/inputrobusthed (tomme/undefined/null/NaN/0/negative/datoer A>B/division med 0/tomme arrays), (3) arkitektur/grænser (kontrakter, ingen UI↔beregning-kobling, ingen dobbelt-sandhed, kanoniske helpers), (4) type-sikkerhed (Zod↔TS, ingen `any`/usikre `as`/`!`), (5) konvergens med fundamentet. Særinstruktion: ved delegering til en motor, **bevis tal-identitet**; ved "neutral" refaktor af period-/dag-logik, **tilføj ækvivalens-test**; fail-closed-stier skal reelt fejle.

Review-doc-format pr. punkt: `# Punkt: <nr> <navn>` · Dato · Filer gennemgået · Tests kørt · `## Fund og rettelser` (severity+lokation+problem+risiko+HANDLING ✅/⏸/⏭) · `## Tilfældighedsfund` · `## Sammenfatning`. Severity: Kritisk/Høj/Medium/Lav.
