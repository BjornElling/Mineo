# Regulering punkt 2 — Form: Ingen

**Dato:** 2026-07-02
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Ingen (`loenudviklingBeregningsgrundlag === 'Ingen'`, strategi `'ingen'`)
**Primært scope:**
- `engines/loenudviklingBeregning.ts`: `resolveReguleringsStrategi` alle-Ingen-gren (`:379–385`) + active-filter/uvalgt-throw (`:383–386`); `buildFromStrategiAndBase` `'ingen'`-gren (`:1377–1380`); `buildPerAnsaettelseModel` (`:1478–1598`, multi-af); `resolveLoenudviklingRows`/`resolveLoenudviklingKilde` (`:72`).
- `helpers/angivetLoenHelpers.ts`: `resolveLoenudviklingKilde` (`:37–113`) — kildemodellen for angivet-løn vs. Beregningsperiode.
- Row-visibility for `Ingen`: `domain/eoRowEvaluation/eoRowIndkomstRows.ts` (`:277–281`, `:413`).

**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md` (punkt 2 + kontrolspørgsmål + silent-path-katalog); `regulering-0-baseline.md` (trigger-kæde, multi-af-asymmetri U2, `assertUniform`); `regulering-1-faelles-fundament.md`; `manuelProcentsatsRegulering.ts` (til multi-af-test); `eoTypes.ts` (`LoenudviklingModel`, `IndkomstSkadestidspunktModel`); `indtaegtPerioder.ts` (`IncomePeriodResult`).

**Tests kørt:**
- `npx vitest run src/__tests__/domain/erstatningsopgoerelse/loenudviklingBeregning.test.ts` → ✅ 1 fil / **26 tests** pass (heraf 3 nye for punkt 2).
- `npm run typecheck` → ✅ exit 0.
- `npm run typecheck:test` → ✅ exit 0.

## Kæde fra input til færdigt produkt

To scenarier fulgt: **(A)** ren alle-Ingen; **(C)** blandet Ingen + aktiv form i multi-af.

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi`: `alleIngen` (alle aktive = 'Ingen') → `strategi 'ingen'` (`:381`). Blandet: `active`-filter fjerner Ingen-forhold, resten reguleres. Uvalgt (`active.length === 0`) → `throw 'Loenudviklingsstrategi er ikke valgt'` (`:385`) | Uvalgt kunne stille falde til nul | ✔ throw (fail-closed) |
| Datakilde-opslag | `'ingen'` konsulterer INGEN satstabel (`konsolideret: null`, `:381`); ingen carry-forward-risiko (S6 uanvendelig) | — | ✔ (ingen kilde) |
| Reguleringsdato-forankring | `'ingen'`-grenen returnerer FØR `resolveAnvendtReguleringsdato` (early return `:381`); reguleringsdato irrelevant for Ingen | — | ✔ (ikke relevant) |
| Segment/indeks/akkumulering | `buildFromStrategiAndBase` `'ingen'`: `tafRanges.map(r => ({...r, deltaPct: 0}))` (`:1379`). Fuld basisløn × antal, deltaPct 0 | deltaPct kunne fejlagtigt give nul BELØB | ✔ deltaPct 0, fuld basis |
| Afrunding | `roundByMethod(0, 2, 'halfAwayFromZero') = 0`; `segmentAmountOre(base, qty, 0) = base×qty` | — | ✔ |
| Aggregering (af/år) | Multi-af (Beregningsperiode): hver af reguleres uafhængigt via `strategiDataByIndex` (per-af `resolveReguleringsStrategi` med ét-element-array), summeres (`:1580`). Ingen-af bidrager sin fulde basis, deltaPct 0 | Ingen-af maskerer/fortrænger aktiv af | ✔ ingen maskering |
| Snapshot | Motor-throw (uvalgt) → `computeEoSnapshot` → `fail_closed` / `runtime_exception` | — | ✔ |
| Validator/gate | Row-lag (`eoRowIndkomstRows.ts`): `Ingen` → row `status 'ok'`, displayValue 'Ingen' (`:278`); uvalgt (`!loenudviklingBasis`) → `status 'error'` (`:281`) → blokerer download | Uvalgt maskeret i row-lag | ✔ error (dobbelt fail-closed: motor + row) |
| Skærm-præsentation | For `Ingen`: regulerings-detaljerrækker BEVIDST undertrykt (`:413` `loenudviklingBasis === 'Ingen'` → return); deltaPct 0 vises via segment-beløb (fuld basis) | Undertrykkelse = tabt værdi? | ✔ bevidst (intet at regulere) |
| PDF/Word-output | deltaPct 0 / fuld basis bæres i `beregnedeSegmenter` → output-generatorer (punkt 14) | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

**Ingen exit-sti i Form: Ingen er en tavs under-regulering.** De relevante stier:

- **Sti: zero-delta (`'ingen'`-grenen, `:1379`).**
  - Led i kæden: beregningsmotoren.
  - Kan valid input ramme den? Ja — når brugeren bevidst vælger 'Ingen' på alle aktive forhold.
  - Bevidst korrekt eller fejl? **Bevidst korrekt.** 'Ingen' betyder eksplicit *ingen lønudviklings-regulering* — deltaPct 0 er den korrekte semantik. Det er IKKE en tavs under-regulering, fordi (1) brugeren har aktivt valgt 'Ingen', og (2) det er ægte nul-*regulering*, ikke nul-*beløb*: den fulde basisløn bæres videre (`maanedsloenOre`/`dagsloenOre` = basis, amount = basis × antal).
  - Udfald: **uændret (bekræftet korrekt).**

- **Sti: throw ved uvalgt (`active.length === 0`, `:385`; `!basis`, `:393`).**
  - Led i kæden: beregningsmotoren (+ row-lag `error` som selvstændigt værn).
  - Kan valid input ramme den? Ja — et forhold uden valgt beregningsgrundlag (`undefined`).
  - Bevidst korrekt eller fejl? **Bevidst korrekt (fail-closed).** 'Ingen' og "ikke valgt" er distinkte: `alleIngen` kræver `=== 'Ingen'` på ALLE forhold; en `undefined` bryder både `alleIngen` (falsk) OG bliver filtreret ud af `active` (fordi `af.loenudviklingBeregningsgrundlag &&` er falsy) → `active.length === 0` → throw. Uvalgt kan aldrig degradere til stille zero-delta.
  - Udfald: **uændret (fail-closed bekræftet).**

### Multi-ansættelse — kan et 'Ingen'-forhold maskere et andets regulering? (nej)

Verificeret **bredt** i begge indgange (jf. baseline U2):

- **Beregningsperiode-grenen (`buildPerAnsaettelseModel`, `:1478`):** `strategiDataByIndex` resolver strategi **pr. ansættelsesforhold** med et ét-element-array (`:1484–1487`). Et 'Ingen'-forhold → `strategi 'ingen'` KUN for det forhold; det producerer zero-delta-segmenter på sin EGEN basis og bidrager sin fulde (uregulerede) basisløn til summen. Et aktivt forhold reguleres uafhængigt på sin egen basis. Summen (`:1580`) adderer begge. Et 'Ingen'-forhold kan derfor hverken nulstille, fortrænge eller maskere et andet forholds regulering. Bekræftet af ny test (c): det aktive forholds 2024-segment beholder deltaPct = +10 %, uændret af det parallelle Ingen-forhold, og `loenudviklingTotal` = sum af begge forholds totaler.
- **Angivet-løn-grenen (`:1604`):** `resolveLoenudviklingKilde` returnerer **præcis ét** syntetisk forhold (fra `eoAngivetLoenLoenudvikling`, `angivetLoenHelpers.ts:73–112`). Der findes derfor ingen reel multi-af her; `alleIngen` = det ene forhold = 'Ingen'. Ved blandet input findes kun ét grundlag pr. angivet-løn-model, så maskering er strukturelt umulig. (Bemærk: baseline's formulering "alle aktive ansættelser" for denne gren er teknisk ét-element; `assertUniform` er vacuous her — ingen materiel forskel for Form: Ingen.)

**Konklusion:** Ingen multi-af-maskering på compute-niveau. Row-/validator-lagets aggregerede status-maskering ejes fortsat af punkt 13 (den generelle multi-af-maskeringstest for coverage-gate), men Form: Ingen bidrager ikke en ny maskeringssti.

### Kant: vacuous `alleIngen` ved tom ansættelsesliste (observation, ikke Form:Ingen-fejl)

I `buildPerAnsaettelseModel` bruges `strategiDataByIndex.every(...)` (`:1492`) og — hvis `loenindkomstAnsaettelsesforhold` er tom — er `every` på tom liste `true` (vacuous), hvilket giver label 'Ingen' + nul-segmenter uden throw. Dette adskiller sig fra `resolveReguleringsStrategi`'s `alleIngen` (som kræver `length > 0`). Det er **ikke** en løn-regulerings-tab: uden ansættelsesforhold er der ingen løn at regulere (benefits-stien håndteres separat). Enhver *udfyldt* men uvalgt af rammer den per-af throw i `strategiDataByIndex.map` FØR dette punkt. Noteret som lav observation; ejes reelt af det bredere "tom beregningsgrundlag"-emne, ikke Form: Ingen.

## Fund og rettelser

1. **[Info] Manglende invariant-tests for Form: Ingen**
   - Lokation: `src/__tests__/domain/erstatningsopgoerelse/loenudviklingBeregning.test.ts`.
   - Problem: Ingen dedikeret test bandt (a) alle-Ingen → deltaPct 0 med fuld basis, (b) uvalgt → throw, eller (c) blandet Ingen + aktiv → regulering bevaret på aktiv. Den eneste eksisterende 'Ingen'-test (`:433`) dækkede kun "ingen TAF-arbejdsdage → 0 kr".
   - Handling: **Anvendt** — nyt describe-block `buildLoenudviklingModel — Form: Ingen (review-punkt 2)` med 3 tests. Tal-neutralt (kun nye tests, ingen kildeændring).
   - Resultat: 26/26 tests grønne.

**Ingen beregningsændringer fundet eller anvendt.** Ingen kildeændringer i `loenudviklingBeregning.ts` (jf. arbejdsregel 3 — ejerskab af filen deles med punkt 3).

## Testdækning (led 3)

Ny (i eksisterende `loenudviklingBeregning.test.ts`):
- **(a)** alle-Ingen (angivet månedsløn) → `loenudviklingLabel 'Ingen'`, alle segmenter `deltaPct === 0`, `maanedsloenOre === 3_000_000` (fuld basis bæres), `loenudviklingTotal.value > 0` (ægte nul-*regulering*, ikke nul-*beløb*).
- **(b)** uvalgt strategi (`loenudviklingBeregningsgrundlag: undefined`) → `toThrow(/ikke valgt/)` (fail-closed, ikke stille nul).
- **(c)** blandet Ingen + Manuel procentsats i multi-af (Beregningsperiode): `perAnsaettelse.length === 2`, label 'Flere reguleringstyper'; Ingen-forhold alle deltaPct 0 + total > 0; aktivt forhold beholder 2024-segment deltaPct = 10 (2023 = 0); `loenudviklingTotal` = sum af begge forholds totaler (ingen maskering).

Bekræftet eksisterende dækning: `:433` (Ingen + ingen arbejdsdage → 0 kr).

## Tilfældighedsfund

- **[observation, uden for scope]** Vacuous `alleIngen` ved tom ansættelsesliste i `buildPerAnsaettelseModel:1492` (se Dækningsanalyse). Ikke en Form:Ingen-fejl; benign (ingen løn = ingen regulering).
- **[doc-drift, ikke rettet]** `regulering-0-baseline.md:53` beskriver angivet-løn-grenen som kaldt "med alle aktive ansættelser"; reelt returnerer `resolveLoenudviklingKilde` ét syntetisk forhold, så `assertUniform` er vacuous. Ingen materiel konsekvens for punkt 2; overlades til hovedtråden om baseline-formuleringen skal præciseres.

## Sammenfatning

Form: Ingen er **ægte nul-regulering** (deltaPct 0, fuld basisløn bæres videre — ikke nul-beløb) og kan ikke forveksles med "ikke valgt": `alleIngen` kræver `=== 'Ingen'` på alle aktive forhold, mens et uvalgt (`undefined`) forhold både bryder `alleIngen` og filtreres ud af `active`, hvilket fail-closer med `throw 'Loenudviklingsstrategi er ikke valgt'` (dobbelt-værnet af row-lagets `status 'error'`). I multi-af (Beregningsperiode) reguleres hvert forhold uafhængigt på sin egen basis og summeres, så et 'Ingen'-forhold hverken nulstiller, fortrænger eller maskerer et aktivt forholds regulering; angivet-løn-grenen har strukturelt kun ét forhold. Regulerings-detaljerækkerne undertrykkes bevidst for 'Ingen' (intet at regulere), uden at tabe segment-beløbet. Tre nye invariant-tests fastlåser (a) ægte nul-regulering, (b) uvalgt-throw og (c) fravær af multi-af-maskering. Gate grøn: typecheck, typecheck:test og 26 målrettede tests. Ingen beregningsændring fundet eller parkeret.
