# Genbesøg 2026-06-04 — review-punkter mod 2026-06-03-arbejdet

**Status:** Afsluttet. Alle berørte punkter genbesøgt, verificeret og testet grønt.

## Baggrund

Review-punkterne 1–14 blev først færdiggjort **2026-06-02** (commit `30330062`). Derefter landede **25 commits dateret 2026-06-03** (`30330062..HEAD`, 207 filer, ~5.800 indsatte linjer) med nyt arbejde, som det oprindelige review ikke havde set. Den **2026-06-04** blev de berørte punkter genbesøgt oven på et verificeret fundament (opreguleringsmotoren først, derefter de afhængige lag indefra og ud, og kontrakt-alignment til sidst).

**Hovedresultat:** Ingen reelle fejl indført af 2026-06-03-arbejdet. Alle delegeringer er verificeret tal-identiske, alle nye fail-closed-stier er konsistente, og det eneste oprindelige review-hul (grid row-id-laget, punkt 7.3) var allerede selvstændigt fikset. Genbesøget tilføjede 19 nye tests; fuld suite grøn (4827 tests). Brugervendte og beregnings-relevante ændringer er forelagt brugeren (se nederst).

## De nye commits (2026-06-03) — tematisk

1. **Samlet opreguleringsmotor** — `src/domain/satser/opreguleringsmotorer.ts` (`opregulerMedAslAarsloensmaksimum`, `opregulerMedAkkumuleretReguleringssats`) med fail-closed `manglendeAar`. Single-source-of-truth for opregulering i EET-EAL, forsørgertab, lønudviklings-validering, EO-debug og TAF-opregulering.
2. **Ny beregningsform "TAF opreguleret til beregningsår"** — engine `tafPerYearOpreguleretDerived.ts`, snapshot-projektion `eoSnapshotToTafPerYearOpreguleretPdfDocument.ts`, PDF `tafOpreguleretPaaAarPdf.ts`, output-target `taf_per_year_opreguleret_pdf` + invariant `buildTafPerYearOpreguleretManglendeReguleringssatsInvariant`.
3. **Tre-tilstands-valg (Ja / Nej / Skjul)** for svie/smerte, TAF og øvrige krav (`jaNejSkjulEnum`). Felter omdøbt (`beregnesSvieSmerteGodtgoerelse` → `kravPaaSvieSmerteGodtgoerelse` m.fl.) + nyt `kravPaaOevrigeErstatningskrav`. `skjul`-semantik (udelad helt vs. vis "Ingen") i præsentationsmodellen.
4. **Per-ansættelsesforhold lønudviklingsregulering** — uniform-assert på `saerligFraDatoRegulering` fjernet; hvert ansættelsesforhold kan have egen reguleringsdato.
5. **Reguleringsindstillinger genindført på Indstillinger-siden** — `eoCaseReguleringSettings.ts` slettet; to flag flyttet fra EO-schema til device-lokale `appSettings`.
6. **Sygedagpenge-tillæg: obligatorisk pension + satsdæknings-fejl + uge-led-komprimering** — `sygedagpengeInsertRows.ts`, `resolveObligatoriskPensionProcent`, `SygedagpengeCoverageError`, `sygedagpengeRates.ts`.
7. **Grid row-id-fix** — `reconcileRowIdsByPosition`/`normalizeGridRows` kunne producere duplikerede row-ids; to-fase unikhedsværn + `gridRowIdContractGuard.test.ts`.
8. **PDF-restrukturering** — `erstatningsopgoerelsePdf.ts` slanket; delte `eoBilagSections.ts` + `tafBeregningsgrundlagSection.ts`; tekst/struktur-ændringer (én samlet "I alt", "Ingen" som afslutningsvalg, kommentarfelt i bilag).
9. **`PERSISTED_DATA_VERSION` bumpet 1.9 → 3.3** (4 reelle bumps) med fingerprint-snapshots; ingen migrator (bevidst tab pr. schema-evolution §3.1a).
10. **Validator +130 l.** — systematisk reguleringssats-dæknings-validering (TAF-opreg., offentlige ydelser, lønudvikling).

## Genbesøgte punkter — udfald

Alle udfald er dokumenteret i et "Genbesøg 2026-06-04"-afsnit i den enkelte punktfil; her er sammenfatningen.

| Punkt | Udfald | Kerne |
|---|---|---|
| **4.0** (ny) | Verificeret | Opreguleringsmotoren er korrekt + fail-closed; testdækning udvidet (13 tests). Nyt fundament-punkt. |
| **2.5** | Holder | 4 reelle version-bumps, fingerprint korrekt; forward/backward-load-tolerance bekræftet. |
| **3.1** | Holder | Nye enums additive/ikke-breaking. |
| **3.4** | Opdateret | 4 bevidste breaking changes i EO-schemaet, alle korrekt håndteret pr. §3.1a. |
| **4.3** | Holder | EAL-delegering tal-identisk; eneste divergens ikke nåbar i produktion. |
| **4.5** | Holder | Årlig grundydelse delegeret; de-regulering før skadeår bevidst ikke delegeret (korrekt). |
| **4.9** | Holder | Ny TAF-opregulerings-engine korrekt; nul-år-skip kan ikke maskere dæknings-hul. |
| **4.10** | Holder | Per-ansættelsesforhold-regulering sikker; ASL-gren nu fail-closed; perf-løft adfærds-neutralt. |
| **4.12** | Holder | Ny dæknings-validering kalder samme motorer som beregningslaget (ingen dobbelt-sandhed). |
| **4.13** | Holder | Nyt 5. output-target + invariant korrekt indvævet; skjul-model behavior-equivalent på compute-siden. |
| **4.14** | Holder | Tre-tilstands-filtrering konsistent; appSettings-skift bryder ikke debug-parity. |
| **6.2** | Verificeret | Komprimering matematisk ækvivalent; satsdæknings-fejl fail-closed. **OP = ny beregningsadfærd → forelagt.** |
| **7.2** | Holder | Input-adapter-laget urørt. |
| **7.3** | Opdateret | Row-id-laget var ikke reelt verificeret oprindeligt; to reelle bugs allerede fikset, fix verificeret + ægte guard. |
| **10.1** | Holder | 16. generator + loader følger fail-closed-mønster; jsPDF-isolation intakt. |
| **10.3** | Opdateret | 3-tilstands skjul-guard korrekt; "Ingen"-afsluttesMed korrekt. **Brugervendte PDF-ændringer forelagt.** |
| **10.4** | Holder | Ny TAF-PDF følger standard-mønster. **Ny brugervendt PDF forelagt.** |
| **10.5** | Holder | Delte PDF-sektioner = legitim DRY (to forbrugere, identisk output), korrekt placeret. |
| **11.3** | Opdateret | Regulerings-flag genindført som device-lokale appSettings; flytning konsistent; strip-fjernelse sikker. |
| **14.1** | Opdateret | `eo-snapshot-contract.md` bragt i sync (ny projektion + 5 output-targets); øvrige kontrakter aligned. |

## Tests

- Fuld suite før genbesøg: 384 filer / 4808 tests grønne.
- Fuld suite efter genbesøg: **384 filer / 4827 tests grønne** (+19 nye: motor-edge-cases, EAL/forsørgertab fail-closed, sygedagpenge-komprimering+OP, snapshot-equivalence, settings-round-trip, PDF-skjul/generator, load-tolerance).
- `typecheck`, `typecheck:test`, `lint` (`--max-warnings 0`): grønne.

## Forelagt brugeren (allerede committet kode — bekræftelse ønskes)

Disse ændringer rører beregningslogik eller brugervendt output. Koden er allerede committet af brugeren, så de er behandlet som tilsigtede, men forelagt jf. AGENTS.md:

1. **Obligatorisk pension (OP) i sygedagpenge-tillæg (6.2)** — NY beregningsadfærd der ændrer producerede tal for indsatte sygedagpenge-rækker fra 2020-01-06. Formlen er verificeret korrekt indvævet; satstallene + ikrafttrædelsesdatoer i `sygedagpengeRates.ts` kan kun brugeren bekræfte mod den juridiske kilde.
2. **Ny PDF "TAF opreguleret til beregningsår" (10.4)** — nyt download-dokument; bekræft indhold/metode/afrunding.
3. **EO-PDF tre-tilstand og afslutningsvalg (10.3)** — "Skjul" fjerner emnet helt (også fra samlet krav); "Nej" beholder overskrift + "Ingen" + 0 kr.; "Ingen" som afslutningsvalg udelader "Godkendelse"-afsnittet; "én samlet I alt" i forventet indkomst; kommentarfelt vises nu i offentlige-ydelser-bilaget.
4. **Indstillinger-siden (11.3)** — ny "Beregningsteknisk"-boks med toggle + dropdown for de to regulerings-flag.
