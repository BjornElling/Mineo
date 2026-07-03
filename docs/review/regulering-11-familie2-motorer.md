# Regulering punkt 11 — Familie 2: opregulerings-motorer

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Familie 2 — år-til-år opregulering (beløb i ét prisniveau → et andet). Konkret: (1) ASL-årslønsmaksimum-indeks, (2) akkumuleret reguleringssats ("tilpasningsprocenten plus to procent"), samt de tre forbrugere: TAF opreguleret til beregningsåret (G1), offentlige ydelsers statslige regulering, og EET-reguleringsrater (ASL § 25 / tabel-split ≤2023 vs Fra2024).
**Primært scope:**
- `domain/satser/opreguleringsmotorer.ts` (`opregulerMedAslAarsloensmaksimum`, `opregulerMedAkkumuleretReguleringssats`, ny delt `resolveReguleringssatsForAar`)
- `domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived.ts` (TAF opreguleret til beregningsår)
- `domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning.ts` (U1)
- `domain/erhvervsevnetab/eetReguleringRater.ts` (`resolveAslReguleringRateForAar` + wrappere)
- `data/lovbestemteRates.ts` (`reguleringssats`, `reguleringsprocentErhvervsevnetab*`, `aarsloenAslMax`) — kun læst, ingen dataændring
**Afhængigheder læst:**
- `AGENTS.md`; `regulering-review-plan.md` (punkt 11-scope, silent-path-katalog, U1, testhul #4)
- Skabelon/kvalitetsbar: `regulering-10-form-kl-loenaftaler.md`, `regulering-4-form-statistik-asl.md`
- Gateway-mønster: `domain/satser/aslAarsloensmaksimum.ts` (`resolveAslAarsloensmaksimumForAar`)
- Nedstrøms (verificeret via delegeret trace): `snapshot/eoSnapshot.ts` (:353–356, :386–388, :425, :437–441), `snapshot/eoSnapshotInvariants.ts` (:89–102), `snapshot/eoSnapshotToTafPerYearOpreguleretDocument.ts`, `document/generators/tafFordelt/tafOpreguleretPaaAarDocument.ts`, `document/generators/eo/sections/eoBilagSections.ts` (:458–502), `engines/tafNettoBeregning.ts` (:186–270), `domain/eoInspektion/eoInspektionPageViewModel.ts` (:275–322), `validators/erstatningsopgoerelseValidator.ts` (:370–448), samt EET-forbrugerne `eetKapitaliseringCalculation.ts`, `eetLoebendeYdelserCalculation.ts`, `eetDifferencekravCalculation.ts`
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run opreguleringsmotorer tafPerYearOpreguleretDerived offentligeYdelserUdviklingRegulering eetReguleringRater` → ✅ 4 filer / 55 tests (heraf 15 nye)
- `npx vitest run offentligeYdelser tafNetto tafPerYear eoSnapshot tafOpreguleret eetEal eetKapitalisering eetLoebende eetDifferencekrav erstatningsopgoerelseValidator lovbestemteRates` → ✅ 31 filer / 485 tests

## Kæde fra input til færdigt produkt

Ét gyldigt input-eksempel (TAF opreguleret til beregningsår): et år-2024 TAF-nettobeløb på **287.763,00 kr**, opgørelse lavet i 2026 (beregningsår 2026). Forventet: akkumuleret reguleringssats 2024→2026 = ∏(1+sats/100) for 2025,2026 = 1,039 × 1,048 → deltaPct afrundet til 4 decimaler = **8,8872 %**, opreguleret beløb = **313.337,07 kr**. (Verificeret i `tafPerYearOpreguleretDerived.test.ts:93`.)

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | TAF fordelt på kalenderår (`tafPerYearDerived`) → `buildTafPerYearOpreguleretBuildOutcome`; beregningsår = årstal af opgørelseLavetDen/dagsdato | Ugyldigt beregningsår → `kind:'error'` (`:90–92`) | ✔ |
| Datakilde-opslag | `opregulerMedAkkumuleretReguleringssats` slår `reguleringssats[år]` op via delt `resolveReguleringssatsForAar` | Manglende sats → `manglendeAar` (ikke tavs nul) | ✔ |
| Reguleringsdato-forankring | Kilde-år = årets kalenderår, mål-år = beregningsår; akkumulering over mellemår | — | ✔ |
| Segment/indeks/akkumulering | `faktor = ∏(1+sats/100)`, `deltaPct = (faktor−1)×100` (u-afrundet fra motoren) | Motor u-afrundet; afrunding sker ét sted nedstrøms | ✔ |
| Afrunding | `deltaPct = roundByMethod(...,4,'halfAwayFromZero')` (`:134`); beløb = `roundKroner(base×(1+deltaPct/100))` konsistent med vist deltaPct (`:137–139`) | Dobbelt-afrunding | ✔ (ét afrundingspunkt) |
| Aggregering (år) | Σ `yearTafOpreguleretOre` → `sumOpreguleretOre` (`:140`) | — | ✔ |
| Snapshot | `eoSnapshot.ts:425` gemmer `outcome.result` by reference på `data.engines.tafPerYearOpreguleret`; `'error'` → `buildTafPerYearOpreguleretManglendeReguleringssatsInvariant` (`:386–388`) | Fejl sluges → tavs nul | ✔ (fejl → blokerende `system`-invariant) |
| Validator/gate | Bevidst IKKE i pre-compute-validatoren for TAF-opreguleret (over-rapporterer ved 0-beløbs-år); dækningen håndteres fail-closed i compute + invariant | — | ✔ (bevidst; se Dækningsanalyse) |
| Skærm-præsentation | Invariant `blocksOutputs:['taf_per_year_opreguleret_pdf']`, `blocksAuthoritativeComputation:false` → kun opreguleret-dokumentet blokeres, download-knap disabled + tooltip med manglende år | — | ✔ (synlig blokering, ikke tavs) |
| PDF-output | `tafOpreguleretPaaAarDocument.ts` FORMATTERER kun `deltaPct` (4 dec.) og `yearTafOpreguleretOre`/`sumOpreguleretOre`; ingen genberegning | Genberegning/re-afrunding | ✔ |
| Word-output | Samme generator som PDF via `documentLoader.ts` (identisk værdibehandling) | Paritet med PDF | ✔ (delt kode; `tafOpreguleretPaaAarWordContent.test.ts`) |

Offentlige ydelsers statslige regulering følger en parallel kæde: motor-kald i `resolveOffentligeYdelserAkkumuleretReguleringPct` → segment-`deltaPct` (2 dec.) → `segmentAmountOre` → total ind i `computeTafNettoBeregning` → snapshot-totaler → EO-bilag ("Reguleringsværdier"-tabellen) i PDF/Word + inspektions-skærm. Motor-throw (manglende sats) fanges i `computeEoSnapshot`s try → `fail_closed`/`runtime_exception` (blokerer alle outputs, synlig). Tabel-render-throw er wrappet i `try/catch` på **alle** callsites (`eoBilagSections.ts:458–502`, `eoInspektionPageViewModel.ts:278–283`) → PDF/Word viser en synlig fallback-linje ("Reguleringsværdier kan ikke vises, fordi en nødvendig reguleringssats mangler."), skærm degraderer til `null` — aldrig en tavs nul-regulering.

## Dækningsanalyse (led 2 — tavs under-regulering)

### Motor-fail-closed (begge motorer)
- **Sti:** `manglendeAar` ikke-tom ⇒ `faktor:1`/`deltaPct:0` returneres, men listen signalerer at værdien IKKE er pålidelig; hver kalder fail-closer på den.
- **ASL-indeks (metode 1):** rent forhold idx[målår]/idx[kildeår] → kræver KUN de to endepunktsår (bevidst asymmetri vs. metode 2; et mellemår-hul er irrelevant for ratioen). Interiort tabel-hul lukkes separat i `assertAarsloenAslMaxKontinuitet` (punkt 4).
- **Akkumuleret reguleringssats (metode 2):** kræver dækning for HVERT år i [min(kilde,mål)..max(kilde,mål)] — også startåret (selv om det ikke multipliceres ind) og også det bagudvendte interval (hvor resultatet er faktor 1). Dette er den centrale fail-closed-invariant: manglende satsdata → synlig feltfejl, ikke tavs nul.
- **Kan valid input ramme den?** Ja — en TAF-periode/basisår uden for `reguleringssats`-dækningen (2005–2026). Alle kaldere (TAF-opreguleret → invariant; offentlige ydelser → throw → fail_closed / tabel-fallback; EET → `EetIssue` + null) fail-closer synligt.
- **Udfald: bekræftet korrekt (stærkt testet, nu udvidet).**

### 0-beløbs-undtagelsen i TAF-opreguleret (`tafPerYearOpreguleretDerived.ts:99`, `:122–132`) — VERIFICERET mod nær-nul og negative
- **Sti:** `if (yearEntry.yearTafOre === 0) continue;` undtager 0-beløbs-år fra dæknings-kravet (de vises med faktor 0, uændret beløb). Andet loop (`:124`) genudfylder disse med deltaPct 0.
- **Kan valid input ramme den forkert?** NEJ. Undtagelsen er **strikt `=== 0`** på et heltal i øre. Et nær-nul beløb (fx 1 øre) og et negativt beløb er begge `≠ 0` og kræver derfor fuld satsdækning → fail-closer ved manglende sats (var utestet, nu dækket). `:124`-grenen er kun nåelig for 0-beløbs-år (ikke-nul år med manglende sats har allerede tvunget en tidlig `error`-return i første loop, `:106`).
- **Bevidst korrekt eller fejl? → BEVIDST KORREKT.** Et 0-beløb bidrager 0 til totalen uanset faktor; at kræve satsdækning for det ville over-blokere (fx et krav der starter i et år uden aktivitet før dækningen). Alt der påvirker totalen (nær-nul, negativt) kræver dækning.
- **Udfald: uændret; nye tests binder nær-nul + negativt til fail-closed.**

### U1 — duplikeret per-år-satsopslag (`offentligeYdelserUdviklingBeregning.ts`) — KONSOLIDERET
- **Sti (før):** to per-år-opslag af `reguleringssats`: motoren (via `resolveOffentligeYdelserAkkumuleretReguleringPct`) OG et RÅT `reguleringssats[year]`-loop i `buildOffentligeYdelserReguleringTableData` (`:103–107`) med sin egen `typeof/Number.isFinite`-guard + throw.
- **Led:** beregning (motor) + visning (bilag-tabellen "Regulering"-kolonne).
- **Kan valid input ramme den?** Begge kaster ved manglende sats — adfærden var ens i dag. Men det rå loop var en **parallel rå-opslags-sti** uden for motoren, dvs. netop den drift-risiko reviewet konsoliderer mod: to steder kunne fremover divergere i finite-check eller besked.
- **Nuance (bekræftet):** det rå loop har et **legitimt andet concern** — det viser den ENKELTE års reguleringssats ("Regulering"-kolonnen), som motoren ikke eksponerer (motoren giver kun den akkumulerede faktor). Concernet er reelt forskelligt; men *selve tabel-opslaget + fail-closed-check* er identisk med motorens dæknings-check.
- **Udfald: hybrid-konsolidering (a).** Ny delt gateway `resolveReguleringssatsForAar(aar, satser=reguleringssats)` (parallel til `resolveAslAarsloensmaksimumForAar`) ejer det ene fail-closed per-år-opslag. Både motorens dæknings-loop OG det rå display-loop bruger den nu → ÉN opslags-/fail-closed-adfærd, ingen parallel rå `reguleringssats[year]`-sti uden for `opreguleringsmotorer.ts`. Det legitime display-concern (rå per-år-sats) bevares. **Tal-neutralt** (samme værdier, samme throw-kontrakt).

### EET-reguleringsrater (`resolveAslReguleringRateForAar`) — 2024-særtilfælde + tabel-split fail-closed
- **Sti:** skade før 2024-07-01: år ≤2023 → `reguleringsprocentErhvervsevnetab`; år =2024 → faktor 1 / pct 0 (referenceår); år >2024 → `...Fra2024`. Skade fra 2024-07-01: `...Fra2024` for alle år. Manglende/ikke-finit sats → `EetIssue{severity:'error'}` + `null`.
- **Kan valid input ramme tavs nul?** NEJ. Manglende rate returnerer aldrig en faktor-1-"ingen regulering"; den returnerer `null` + blokerende issue, som alle tre kaldere (`eetKapitaliseringCalculation:134`, `eetLoebendeYdelserCalculation:749→null`, `eetDifferencekravCalculation:507`) propagerer som `null` → blokerende.
- **Bemærk (bekræftet domæne-korrekt):** `reguleringsprocentErhvervsevnetabFoer2024` (65,7 % for 2024) bruges bevidst IKKE i denne resolver — 2024-opreguleringen af grundydelsen sker separat i de tre EET-beregninger, og hver af de tre applikationer er fail-closed guardet (`Number.isFinite` → issue/null). Resolveren behandler 2024 som referenceår (pct 0), hvilket er den tilsigtede split.
- **Udfald: bekræftet korrekt + fail-closed; tests udvidet (tabel-split-grænse, ukendt/NaN-år).**

### Numerik
- Motorerne returnerer u-afrundet `faktor`/`deltaPct`; afrundingsansvaret ligger hos kalderen (ét sted). TAF-opreguleret: `roundByMethod(...,4)` + `roundKroner`. Offentlige ydelser: `roundByMethod(...,2)`. Ingen `NaN`/`Infinity` (gateway'en behandler ikke-finit som manglende); ingen ad hoc-afrunding.

### Multi-ansættelse
- Ikke relevant for familie 2 (år-til-år på aggregerede beløb, ikke per-ansættelsesforhold). Aggregeret status-masking er punkt 13's territorium.

## Fund og rettelser

1. **[Medium → rettet direkte] U1: parallel rå `reguleringssats[year]`-opslagssti uden for motoren.**
   - Lokation: `offentligeYdelserUdviklingBeregning.ts:104` (rå loop) + `opreguleringsmotorer.ts:128` (motorens dæknings-check).
   - Problem/Risiko: to per-år-satsopslag med hver sin `typeof/Number.isFinite`-guard; drift-risiko mellem beregning og visning (finite-check/besked kunne fremover divergere).
   - Handling: udtrukket delt gateway `resolveReguleringssatsForAar` i `opreguleringsmotorer.ts` (parallel til `resolveAslAarsloensmaksimumForAar`); motorens dæknings-loop og det rå display-loop bruger den nu begge; fjernet den nu-redundante eksplicitte `reguleringssats`-arg i `resolveOffentligeYdelserAkkumuleretReguleringPct` (motoren defaulter til `reguleringssats`); fjernet den direkte `reguleringssats`-import i offentligeYdelser-filen.
   - Resultat: ÉN fail-closed per-år-opslags-adfærd; ingen parallel rå-opslagssti. **Tal-neutralt** (bevist: alle offentligeYdelser/tafNetto/opreguleringsmotorer-tests grønne + ny binding-test). Throw-kontrakten (synlig blokering) bevaret.

2. **[Bekræftet korrekt] 0-beløbs-undtagelsen i TAF-opreguleret er strikt `=== 0`** — nær-nul og negative beløb kræver fuld satsdækning og fail-closer ved manglende sats. Ingen ændring; nye tests dækker hullet (testhul #4).

3. **[Bekræftet korrekt] Begge motorer fail-closer via `manglendeAar`** — akkumuleret metode kræver dækning for hvert mellemår (og startår, og hele det bagudvendte interval); ASL-metode kræver kun de to endepunkter (bevidst ratio-asymmetri). Uændret; stærkt testet.

4. **[Bekræftet korrekt + fail-closed] EET-reguleringsrater** — 2024-referenceår, tabel-split ≤2023/Fra2024, og manglende rate → `EetIssue`+`null` propageret blokerende af alle tre kaldere. `reguleringsprocentErhvervsevnetabFoer2024` bevidst uden for resolverens ansvar (anvendes separat + guardet). Uændret; tests udvidet.

5. **[Bekræftet ende-til-ende] Værdi-integritet til produkt** — `deltaPct` (4 dec.) og `yearTafOpreguleretOre`/`sumOpreguleretOre` afrundes/beregnes ét sted i motoren og passeres by reference hele vejen; generatoren formatterer kun. Word = PDF (samme generator). Offentlige ydelsers total flyder uændret ind i `tabtArbejdsfortjenesteOre` + snapshot-totaler.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring — intet at forelægge.** U1-konsolideringen er en tal-neutral strukturel hærdning (samme værdier, samme throw-kontrakt, bevist ved uændrede tests). 0-beløbs-undtagelsen, motorernes fail-closed og EET-raterne er bekræftet korrekte uden ændring. Ingen ny brugervendt blokerende fejl for valide input.

## Testdækning (led 3)

**Nye/udvidede tests (15), alle grønne:**
- `opreguleringsmotorer.test.ts` (**+5**, ny describe for `resolveReguleringssatsForAar`):
  1. returnerer finit sats for dækket år; 2. `undefined` for udækket år; 3. `undefined` for ikke-heltal (NaN/decimal); 4. ikke-finit sats i injiceret map behandles som manglende, men 0 er gyldig; 5. gateway'ens `undefined` spejler motorens `manglendeAar` for et interval (single-source-binding).
- `tafPerYearOpreguleretDerived.test.ts` (**+4**, testhul #4):
  1. nær-nul (1 øre) beløbsår + manglende sats → `error` (fail-closed); 2. negativt beløbsår + manglende sats → `error`; 3. nær-nul beløbsår MED dækning → opreguleres normalt (ingen undtagelse); 4. multi-år: 0-beløbs-år undtaget, men ikke-nul år uden sats blokerer hele opgørelsen.
- `offentligeYdelserUdviklingRegulering.test.ts` (**+2**, U1-binding):
  1. tabellens "Regulering"-kolonne = `resolveReguleringssatsForAar(year)` (samme delte opslag som beregningen), og "Akkumuleret regulering"-kolonne = `resolveOffentligeYdelserAkkumuleretReguleringPct`; 2. tom rows-liste når sidste segment-år ≤ baseår.
- `eetReguleringRater.test.ts` (**+2**):
  1. tabel-split-grænse (2023 → tidligere indeks, 2025 → Fra2024) ved skade før 2024-07-01; 2. ukendt/ikke-heltalligt år fail-closer med blokerende issue + null.
- Bekræftet stærk eksisterende dækning: `opreguleringsmotorer.test.ts` (endepunkts-ratio vs. akkumuleret kæde, dedup af NaN-år, bagudvendt interval-dækning), `tafPerYearOpreguleretDerived.test.ts` (normalsti, negativ opregulering, manglende mellemår, 0-beløbs-ignore), `eetReguleringRater.test.ts` (2024-referenceår, begge skade-flag, wrapper-issue-id'er), `eoSnapshotPdfProjection`/`tafOpreguleretPaaAarPdf.wiring`/`tafOpreguleretPaaAarWordContent` (ende-til-ende PDF/Word).

## Tilfældighedsfund

- **[Lav — konvergens, punkt 14]** Offentlige ydelsers "Reguleringsværdier"-tabel bygger "Akkumuleret regulering"-kolonnen fra den RÅ u-afrundede akkumulerede pct (`offentligeYdelserUdviklingBeregning.ts:113`, `formatPercent(resolveOffentligeYdelserAkkumuleretReguleringPct(...))`), ikke fra den 2-decimal-afrundede `segment.deltaPct` der driver beløbet. Bevidst (tabellen dokumenterer det rå satsgrundlag; `formatPercent` afrunder til visning); beløbene er upåvirkede. Analog til U8 (KL-præsentation genberegner) — noteret for præsentations-paritet (punkt 14).
- **[Info — bekræftet korrekt, ingen handling]** De tre EET-anvendelser af `reguleringsprocentErhvervsevnetabFoer2024[2024]` (kapitalisering `:153`, løbende `:661`, differencekrav `:495`) er alle fail-closed guardet (`Number.isFinite` → blokerende issue/null). Differencekrav bruger `?? Number.NaN` + efterfølgende `!Number.isFinite`-check (indirekte men korrekt fail-closed). Ingen tavs nul-sti.
- Ingen død kode, fejlplacerede filer eller kontraktdrift tilbage i familie-2-motorerne efter U1-konsolideringen. `getSatserForYear` (fail-open, S7) er bekræftet ikke i familie-2-beregningsstien.

## Sammenfatning

Familie 2's to opregulerings-motorer er korrekte, ensartede og fail-closed: `manglendeAar` tvinger hver kalder til synlig blokering frem for tavs under-regulering, og de to metoders forskellige dæknings-krav (endepunkts-ratio vs. akkumuleret kæde med fuld mellemårs-dækning) er bevidste og testet. **U1 er lukket:** den parallelle rå `reguleringssats[year]`-opslagssti i offentlige ydelser er erstattet af den delte, fail-closed gateway `resolveReguleringssatsForAar` (parallel til ASL-gateway'en), som både motorens dæknings-check og det rå display-loop nu deler — det legitime display-concern (rå per-år-sats) bevares, men opslags-/fail-closed-adfærden er nu ét sted; tal-neutralt. **0-beløbs-undtagelsen** i TAF-opreguleret er verificeret strikt `=== 0`: nær-nul og negative beløb kræver fuld satsdækning og fail-closer (nye tests, testhul #4 lukket). **EET-raterne** (2024-særtilfælde, tabel-split, manglende rate → blokerende issue+null) er bekræftet fail-closed hele vejen gennem alle tre kaldere. Værdi-integriteten fra motor til produkt (skærm, PDF, Word) er bekræftet ende-til-ende: afrunding sker ét sted, generatoren formatterer kun, og Word deler PDF-generatoren. Ingen beregningsændring, intet at forelægge. Gate grøn: typecheck, typecheck:test, lint, 55 målrettede + 485 bredere tests (heraf 15 nye/udvidede).
