# Regulering punkt 8 — Form: Manuel procentsats

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Manuel procentsats (daterede procenttrin → multiplikativt akkumuleret indeks fra basisindeks 100).
**Primært scope:**
- `engines/manuelProcentsatsRegulering.ts` (hele filen: `buildManuelProcentsatsEntries`, `findManuelProcentsatsEntryForDate`, `resolveManuelProcentsatsRowsFoerBasis`)
- `engines/loenudviklingBeregning.ts:804–843` (`buildLoenudviklingFromManualProcentsats`)
- `engines/reguleringsPresentation.ts:237–244, 774–791` (præsentation manuel-procentsats-gren)
**Afhængigheder læst:**
- `AGENTS.md`; `regulering-review-plan.md` (punkt 8-scope + silent-path-katalog S5)
- `regulering-5/6/7`-review (skabelon; punkt 7 er nærmeste parallel — manuel-form-familien)
- Zod-schema: `schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts:118–124` (`loenudviklingManuelProcentsatsRowSchema`), `schemas/formSchemas/baseSchemas.ts:22–35, 93–96, 124–136` (`coerceToNumberOrUndefined`, `percentageDecimal`, `tableIsoDateCellString`)
- Row-gate: `domain/eoRowEvaluation/eoRowIndkomstRows.ts:276–406`
- Validator: `validators/erstatningsopgoerelseValidator.ts:892–910`
- Invariant-noten `loenudviklingBeregning.ts:63–70` (alle throw → `fail_closed`/`runtime_exception`)
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run loenudviklingBeregning reguleringSilentPathAlignment manuelProcentsatsRegulering eoRowIndkomstRows erstatningsopgoerelseValidator` → ✅ 7 filer / 155 tests (heraf 5 nye)

## Kæde fra input til færdigt produkt

Eksempel: `Manuel procentsats`, reguleringsdato 2024-01-01, basisrække (index 0), datotrin
2025-01-01 = 10 % og 2026-01-01 = 10 %. TAF 2024-07-01→2026-12-31.
Forventet: base = indeks 100 pr. reguleringsdato; 2025-01-01 → indeks 110 (`akkumuleretPct 10`);
2026-01-01 → indeks 121 (`akkumuleretPct 21`, multiplikativt). deltaPct-segmenter: 0 → 10 → 21.
Verificeret via eksisterende test (`loenudviklingBeregning.test.ts:288–324`) + unit-test
(`manuelProcentsatsRegulering.test.ts:18–24`).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `manualProcentsats`; `assertUniform` på `normalizeManualProcentsatsRows` (multi-af) | Uvalgt/blandet → `throw` | ✔ |
| Datakilde-opslag | `konsolideret.manualProcentsatsRows = active[0].loenudviklingManuelProcentsatsTableData` (brugerens tabel) | — (brugerinput, ikke satstabel) | ✔ |
| Reguleringsdato-forankring | kanonisk `resolveAnvendtReguleringsdato`; `baseIso = reguleringsdato`; base-entry = indeks 100 pr. `baseIso` (IKKE base-rækkens dato/procent) | Ingen dato → `throw` (`:810`); undefined `baseIso` → tom entries → `throw` (`:818`) | ✔ |
| Segment/indeks/akkumulering | `buildManuelProcentsatsEntries`: `slice(1)` → filtrér (gyldig dato + finit procent) → filtrér (`dato ≥ baseIso`) → sortér (dato, derefter originalIndex) → `runningIndex *= 1 + procent/100`; per segment `findManuelProcentsatsEntryForDate` (seneste entry ≤ dato) | Uparsbar/tom pct → **stille drop** (S5); interiort hul → carry-forward via seneste entry ≤ dato; før basis → base-entry (delta 0) | ✔ **S5 gated opstrøms; carry-forward ⇒ intet interiort hul; før-basis delta 0** |
| Afrunding | `roundByMethod(entry.akkumuleretPct, 2, 'halfAwayFromZero')` (`:835`) | Ad hoc/dobbelt-afrunding | ✔ (delt kanonisk helper) |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres | Én af maskerer andens fejl (compute) | ✔ (compute; multi-af testet `:1140–1206`); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges → zero-delta | ✔ (defensive invarianter, `:63–70`) |
| Validator/gate | row-gate `alleVaerdier` (`eoRowIndkomstRows.ts:295–308`) + validator (`:892–909`): aktiv række (dato ELLER procent) UDEN begge felter → `error`; før-basis-warning (`:384–406`) | Se Dækningsanalyse (S5) | ✔ (S5-gate + før-basis-warning ende-til-ende-testet) |
| Skærm-præsentation | `reguleringsPresentation.ts:774–791` genbruger **samme** `buildManuelProcentsatsEntries`; kolonner Dato/Procent/Indeks/Akkumuleret | Parallel/duplikeret math | ✔ (ingen parallel math — samme kanoniske entries) |
| PDF/Word-output | fælles regulerings-sektion (nedstrøms, punkt 14) | Punkt 14 | (punkt 14; deler segment→beløb-infrastruktur med øvrige former) |

## Dækningsanalyse (led 2 — tavs under-regulering)

### S5 — uparsbar/ufuldstændig pct-række droppes stille (`manuelProcentsatsRegulering.ts:56–59`) — BEKRÆFTET GATED OPSTRØMS (ikke en reel silent-path)

- **Sti:** `buildManuelProcentsatsEntries` filtrerer `slice(1)`-rækker fra, hvor `dato` ikke er en
  gyldig ISO-dato ELLER `procent` ikke er finit (`isISODateString(dato) && isFinitePct(procent)`).
  Drop uden hård fejl i motoren.
- **Led:** beregningsmotoren (drop) / validator + row-lag (blokerende `error`).
- **Kan valid *committed* input ramme den? — Kun som TOM celle, og den er gated.**
  Beviset ligger i Zod-schemaet (form-kerneregel: beregning bruger kun committed, schema-valideret
  input):
  - `procent: percentageDecimal = z.preprocess(coerceToNumberOrUndefined, z.number().min(0).max(100).optional())`.
    `coerceToNumberOrUndefined` returnerer ved uparsbar streng den **rå streng** videre til
    `z.number()`, som **afviser** den (og afviser NaN/Infinity, jf. Zod 4). En out-of-range/uparsbar/
    ikke-finit pct **fejler dermed valideringen** og kan **ikke** eksistere i committed state. Den
    eneste "ikke-finit" committed værdi er `undefined` (tom celle).
  - `dato: tableIsoDateCellString` bevarer bevidst ugyldigt ikke-tomt input, så schemaet **fejler
    fail-closed** (`baseSchemas.ts:132`); tom celle → `undefined`.
  - Det stille drop rammer altså **kun** rækker med tom dato og/eller tom procent.
- **Bevidst korrekt eller fejl? → BEKRÆFTET KORREKT (gated opstrøms).** Droppet har to udfald:
  1. **Helt tom række** (hverken dato eller procent): ikke "aktiv" i hverken validator eller row-gate;
     korrekt ignoreret — **taber ingen regulering** (der er intet reguleringstrin at tabe).
  2. **Ufuldstændig men betydningsbærende række** (dato uden procent, ELLER procent uden dato): ville
     ellers være en tavs under-regulering (springet akkumuleringstrin). Men den er "aktiv" (mindst ét
     felt udfyldt) og markeres **blokerende `error`** i BÅDE validatoren
     (`erstatningsopgoerelseValidator.ts:897–908`, severity `error`) OG row-laget
     (`eoRowIndkomstRows.ts:300–307`, `alleVaerdier`-row status `error` med beskeden
     "Værdier mangler at blive udfyldt for manuel regulering"). Begge sider bruger den **identiske**
     "aktiv = dato ELLER finit procent; ok = BEGGE felter"-logik. `showReguleringDetails` kræver
     `alleVaerdier === ok`, så regulerings-detaljerne skjules desuden ved fejl.
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring, ingen ny blokerende fejl indført
  (gaten fandtes allerede). Denne struktur er **direkte parallel til punkt 7** (manuel angivet:
  `datoOk`/`grundloenOk` gater den tilsvarende stille drop-sti). Nu bundet ende-til-ende af 4 nye
  tests (se Testdækning).

### Før-basis-drop (`manuelProcentsatsRegulering.ts:63`) — BEKRÆFTET KORREKT (bevidst, ikke tavs under-regulering)

- **Sti:** rækker i `slice(1)` dateret FØR reguleringsdatoen filtreres fra akkumuleringen
  (`entry.row.dato >= baseIso`), rapporteres via `resolveManuelProcentsatsRowsFoerBasis`.
- **Led:** beregningsmotoren (drop) / row-lag (ikke-blokerende **warning**).
- **Kan valid input ramme den?** Ja — en bruger indtaster et procenttrin med dato før reguleringsdatoen.
- **Bevidst korrekt eller fejl? → BEKRÆFTET KORREKT.** Basisindeks 100 forankres på reguleringsdatoen;
  et procenttrin dateret *før* den hører til et niveau før basen og deltager pr. definition ikke i den
  fremadrettede regulering (nøjagtig samme domæneregel som privat/offentlig/statistik/manuel-angivet).
  Kommentaren `:60–62` dokumenterer desuden en **anden** grund til at ekskludere før-basis-rækker: de
  ville ellers forvride den akkumulerede procent OG bryde entries-listens sorterings-invariant, som
  `findManuelProcentsatsEntryForDate` forudsætter (base-entryen ligger forrest med reguleringsdatoen).
  Droppet vises synligt som en ikke-blokerende `warning`-row (`raekkerFoerReguleringsdato`,
  `eoRowIndkomstRows.ts:398`) — **samme kode-sti og adfærd som manuel angivet (punkt 7)**. Konsistens
  med de øvrige formers før-basis-håndtering er dermed bekræftet.
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring.

### Grænser

- **Reguleringsdato før første procenttrin:** irrelevant — base er altid indeks 100 pr.
  reguleringsdatoen (ikke en tabel-clamp). Segmenter før tidligste entry → base-entry (delta 0), korrekt.
- **Række præcis på reguleringsdatoen:** tilladt og gælder fra dag ét — base-entryen ligger forrest,
  men en brugerrække med samme dato indsættes EFTER den (sorterings- + `<=`-opslags-invariant), så den
  vinder opslaget fra og med reguleringsdatoen (`findManuelProcentsatsEntryForDate:88–96` + kommentar
  `:84–87`). Testet (`manuelProcentsatsRegulering.test.ts:46–54`).
- **Efter sidste procenttrin:** carry-forward af seneste entry (`findManuelProcentsatsEntryForDate`
  returnerer seneste entry ≤ dato). Ejes af punkt 12/13's endepunkts-gate; her bekræftet at
  reguleringen videreføres (ikke nulstilles). Til forskel fra satstabel-formerne er der ingen
  ekstern staleness (procenttrinnene ER brugerens eksplicit indtastede regulering).
- **Hul mellem procenttrin:** umuligt at give tavs under-regulering — carry-forward via seneste entry ≤
  dato (samme invariant som punkt 5/6/7).
- **Manglende reguleringsdato:** `buildLoenudviklingFromManualProcentsats` kaster (`:810–812`);
  `buildManuelProcentsatsEntries` returnerer tom liste → `throw` (`:818`). Row-gate:
  `reguleringsvaerdi`-error (før-basis-warning springes over via `anvendtReguleringsdato &&`-guard).

### Numerik

- Multiplikativ akkumulering `runningIndex *= 1 + row.procent / 100` er deterministisk; `procent` er
  garanteret finit i [0;100] (Zod) på det tidspunkt, så ingen NaN/Infinity/div-0. `akkumuleretPct =
  runningIndex − 100`. Afrunding kun ét sted: `roundByMethod(..., 2, 'halfAwayFromZero')` (`:835`),
  delt kanonisk helper — ingen ad hoc/dobbelt-afrunding.

### Multi-ansættelse

- Compute summerer per-af uden maskering (testet `:1140–1206`: Ingen-forhold + aktivt manuel-procentsats-
  forhold; det aktive beholder sin +10 %). Aggregeret row-status-maskering er punkt 13's (row-lag) territorium.

## Fund og rettelser

1. **[Info / bekræftet korrekt] S5 er gated opstrøms, ikke en reel silent-path.**
   - Lokation: `manuelProcentsatsRegulering.ts:56–59` (drop) ↔ `erstatningsopgoerelseValidator.ts:892–909`
     + `eoRowIndkomstRows.ts:295–308` (gate).
   - Problem/Risiko: Stille drop af pct-rækker kunne i teorien springe et reguleringstrin over.
   - Handling: Bevist via Zod-schema at kun **tomme** celler kan ramme droppet, og at enhver
     *betydningsbærende* ufuldstændig række gates blokerende (`error`) i både validator og row-lag —
     med identisk aktiv-række-logik. Ingen kodeændring; ingen beregningsændring. Bundet ende-til-ende
     af 4 nye tests.
   - Resultat: S5 lukket som **bekræftet korrekt (gated opstrøms)**.

2. **[Bekræftet korrekt] Før-basis-drop er bevidst, tal-neutralt OG synligt (warning-row)** — se
   Dækningsanalyse. Samme kode-sti og adfærd som manuel angivet (punkt 7). Ingen beregningsændring;
   ny test binder warning-surfacing for manuel-procentsats-varianten.

3. **[Info] Præsentationen genbruger den kanoniske `buildManuelProcentsatsEntries`** — ingen parallel/
   duplikeret akkumuleringsmatematik i visningen. Både compute og præsentation udleder `akkumuleretPct`
   fra samme entries; compute afrunder via `roundByMethod`, præsentationen formatterer via
   `formatAsAmount(·, 2)`. Begge til 2 decimaler fra samme kilde. Eventuel edge-case-afrundingsparitet
   (round-half-away vs. Intl-formattering) hører til punkt 14's præsentations-paritet — noteret dér.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring — intet at forelægge.** S5 er afgjort **bekræftet korrekt (gated opstrøms)**:
kun tomme celler kan ramme det stille drop, og enhver betydningsbærende ufuldstændig række gates
blokerende (`error`) i både validator og row-lag. Før-basis-drop er tal-neutralt og synligt
(warning-row). Interiort hul er strukturelt umuligt (carry-forward). Ingen ny blokerende fejl er
indført (gaten fandtes i forvejen), så der er ingen UI-ændring.

## Testdækning (led 3)

**Anvendt (grønne), alle i `reguleringSilentPathAlignment.test.ts` (+5):**
- **S5-blok (4 tests):**
  1. **motor stille drop** — `buildLoenudviklingModel` med en dato-uden-procent-række: segmenterne er
     `[{reg.dato, 0}, {2026-01-01, 10}]` — intet brudpunkt på 2025-01-01 (droppet). Dokumenterer den
     nuværende compute-adfærd (baseline for en evt. fremtidig godkendt rettelse).
  2. **row-gate error (dato uden procent)** — `alleVaerdier`-row status `error`.
  3. **row-gate error (procent uden dato)** — omvendt ufuldstændighed → `error`.
  4. **helt tom række → ok** — en række uden både dato og procent er ikke "aktiv"; gaten forbliver `ok`
     (ingen falsk-positiv, ingen tabt regulering).
- **Før-basis-blok (1 test):**
  5. **synlig warning** — row-modellen emitterer en ikke-blokerende `raekkerFoerReguleringsdato`-row
     (status `warning`) for en før-basis-procentsatsrække (parallel til punkt 7's manuel-angivet-test).
- Bekræftet stærk eksisterende dækning:
  - `manuelProcentsatsRegulering.test.ts`: multiplikativ akkumulering, før-basis-udeladelse +
    sorterings-invariant, række-præcis-på-reguleringsdato, drop af ugyldig dato/procent
    (`:56–62`, dokumenterer "dækkes af validatorens blokerende krav").
  - `loenudviklingBeregning.test.ts:288–324`: multiplikativ akkumulering ende-til-ende (0 → 10 → 21);
    `:1140–1206`: multi-af non-masking.
  - `erstatningsopgoerelseValidator.test.ts` + `eoRowIndkomstRows*.test.ts`: gate-dækning (grøn).

## Tilfældighedsfund

- **[Lav–Medium — konvergens, punkt 13/15]** "Aktiv-række + begge-felter-krævet"-prædikatet for manuel
  procentsats findes i **tre** parallelle kopier: compute-filteret
  (`manuelProcentsatsRegulering.ts:56–59`, semantisk komplement), validatoren
  (`erstatningsopgoerelseValidator.ts:894–908`) og row-laget (`eoRowIndkomstRows.ts:297–302`).
  Validatoren og row-laget deler *bogstaveligt* identisk kode
  (`row.dato !== undefined || (typeof row.procent === 'number' && Number.isFinite(row.procent))`).
  Manuel angivet har den samme tredobbelte struktur (punkt 7). Kandidat til konsolidering i én delt
  helper (fx `isManuelProcentsatsRowAktiv` / `manuelProcentsatsRowMangler`) — ejes af punkt 13
  (coverage-gate/validator) / punkt 15 (konvergens). Harmløst i dag (alle tre er alignet), men
  drift-risiko: ændres den ene "aktiv"-definition, kan gaten og motoren komme ud af sync.
- **[Lav — punkt 13]** Asymmetri i `alleVaerdier`-row mellem de to manuelle former: manuel **angivet**
  giver `error` ved NUL aktive rækker (`eoRowIndkomstRows.ts:326–332`, base-grundløn kræves), mens
  manuel **procentsats** giver `ok` (`Ja`) ved nul aktive rækker (`.slice(1)` + `.every` på tom liste
  → `true`). Afspejler en reel domæneforskel (procentsats-base er altid indeks 100 uden krævet input;
  angivet-base kræver en grundløn for at kunne danne basispakken), men bør bekræftes bevidst i punkt 13.
- **[Lav — punkt 13]** En før-basis-række uden procent trigger BÅDE `alleVaerdier`-error (aktiv, mangler
  procent) OG `raekkerFoerReguleringsdato`-warning, selv om rækken alligevel ikke deltager i
  reguleringen. Fail-closed (sikker retning) og ikke en under-regulering, men dobbelt-signalering er en
  mindre UX-skævhed — noteret til punkt 13's row-gate-gennemgang.
- Ingen død kode, fejlplacerede filer eller kontraktdrift i manuel-procentsats-compute-stien.
  `manuelProcentsatsRegulering.ts` er velafgrænset, ren og kommenteret (inkl. begrundelse for
  sorterings-/opslags-invarianterne).

## Sammenfatning

Manuel procentsats er korrekt, ensartet og deterministisk. Den deler det fælles fundament: kanonisk
`resolveAnvendtReguleringsdato`, `buildSegmentsFromStartDates` og `roundByMethod`/`halfAwayFromZero`,
og præsentationen genbruger den **samme** `buildManuelProcentsatsEntries` (ingen parallel math).
Den multiplikative akkumulering (`runningIndex *= 1 + procent/100` fra basisindeks 100) er
deterministisk og afrundes ét sted. **S5 er afgjort BEKRÆFTET GATED OPSTRØMS (ikke en reel
silent-path):** Zod-schemaet (`percentageDecimal`) garanterer, at committed `procent` kun kan være et
finit tal i [0;100] eller `undefined` — en uparsbar/ikke-finit pct fejler valideringen og kan ikke nå
motoren. Det stille drop rammer derfor kun tomme celler; en betydningsbærende ufuldstændig række
(dato uden procent eller omvendt) gates blokerende (`error`) i BÅDE validator og row-lag med identisk
aktiv-række-logik — direkte parallel til punkt 7's `datoOk`/`grundloenOk`-gating. Før-basis-drop er
bevidst korrekt, tal-neutralt og synligt som ikke-blokerende warning-row (samme kode-sti som manuel
angivet). Interiort hul er strukturelt umuligt (carry-forward via seneste entry ≤ dato). Ingen
beregningsændring og ingen ny blokerende fejl indført. Fund til opfølgning: tredobbelt duplikering af
aktiv-række-prædikatet (punkt 13/15) og en mindre `alleVaerdier`-asymmetri/dobbelt-signalering
(punkt 13). Gate grøn: typecheck, typecheck:test, lint, 155 målrettede tests (heraf 5 nye).
