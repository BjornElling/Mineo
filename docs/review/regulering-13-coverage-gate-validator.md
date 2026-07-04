# Regulering punkt 13 — Coverage-gate, validator og escape-hatch

**Dato:** 2026-07-04
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Tværgående — den brugervendte coverage-gate (`eoRowIndkomstRows`), pre-compute-validatoren (`erstatningsopgoerelseValidator`) og escape-hatchen `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden`. Dækker alle interval-baserede former (Overenskomst privat/offentlig, Statistik, KRL, KL-lønaftaler) + de to manuelle former.
**Primært scope:**
- `domain/eoRowEvaluation/eoRowIndkomstRows.ts` (coverage-/visibility-rows: `reguleringsvaerdi`, `startvaerdi`, `slutvaerdi`, `alleVaerdier`, `daekningAdvarsel`, `raekkerFoerReguleringsdato`)
- `validators/erstatningsopgoerelseValidator.ts` (`validateLoenudviklingsKravForAktivKilde`, `validateLoenudviklingDataCoverage`, manuel-form-grene `:846–898`)
- app-setting `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` + `allowReguleringMedUdloebMedMaaneder`
**Afhængigheder læst:**
- `AGENTS.md`; `regulering-review-plan.md` (punkt 13 + U2/U6 + S5/S8); `regulering-8-form-manuel-procentsats.md`, `regulering-6-form-overenskomst-offentlig.md`, `regulering-12-datakomplethed-staleness.md`
- `domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts` (`resolveReguleringsStrategi:373`, `assertUniform:271`, `buildPerAnsaettelseModel:1482`, dispatch `:1605`, `buildLoenudviklingFromManual:1251`)
- `domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering.ts`
- `domain/erstatningsopgoerelse/helpers/reguleringKildeCoverage.ts` (`resolveKildeReguleringsIntervalIso`), `helpers/angivetLoenHelpers.ts` (`resolveLoenudviklingKilde`), `helpers/eoSharedUtils.ts` (`resolveAnvendtReguleringsdato`), `eoRowShared.ts` (`getRangeForManualRegulering`, `calculateElapsedWholeMonths`)
- `settings/appSettingsSchema.ts` + `contracts/app-settings.md` (escape-hatch-kommentar `:110–113`); schema `sections/erstatningsopgoerelseSchemas.ts` + `baseSchemas.ts` (`tableIsoDateCellString`, `percentageDecimal`)
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run eoRowIndkomstRows erstatningsopgoerelseValidator reguleringSilentPathAlignment loenudviklingBeregning manuelProcentsatsRegulering manuelReguleringRowPredicates` → ✅ 8 filer / 177 tests (heraf 11 nye)

## Kæde fra input til færdigt produkt

Coverage-gaten er ikke selv en beregning; den er den brugervendte **fail-closed-port** mellem
input og produkt. Eksempel: `Beregningsperiode`, to ansættelsesforhold (A + B), begge KRL
"KTO (kommuner)". Af A's reguleringsdato ligger inden for dækning; af B har en `saerligFraDatoRegulering`
før KRL's ældste sats (01-04-2001).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveLoenudviklingKilde` returnerer i Beregningsperiode ALLE ansættelsesforhold; row-laget itererer pr. af | Aggregering kunne maskere ét af's hul | ✔ (ingen aggregering — per-af rows, se U2) |
| Datakilde-opslag | `resolveKildeReguleringsIntervalIso(af)` → kildens `[fraIso;tilIso]` (samme funktion som validator + note-lag) | Parallel coverage-kilde → utakt | ✔ (én autoritativ kilde) |
| Reguleringsdato-forankring | `resolveAnvendtReguleringsdato` pr. af (saerligFraDato ?? beregningsperiodeTil) | Forkert dato → forkert gate | ✔ |
| Segment/indeks/akkumulering | (compute; punkt 3–10) — gaten sammenligner reguleringsdato/TAF-grænser mod `[min;max]` | — | ✔ |
| Aggregering (af/år) | **Ingen** aggregeret status; hvert af emitterer eget `reguleringsvaerdi`/`startvaerdi`/`slutvaerdi`/`alleVaerdier` med prefix `loenindkomst.<af.id>.regulering` | Af A skjuler af B | ✔ (U2-test: af B → error, af A → ok, ikke maskeret) |
| Snapshot | motor fail-closer per-af (throw → `runtime_exception`); gaten fail-closer per-af (row `error`) | — | ✔ |
| Validator/gate | row `error` (usynlig-blokering-net) + `validateLoenudviklingsKravForAktivKilde`/`…DataCoverage` (pre-compute) | Drift row↔validator | ✔ (U6-konsolidering: fælles prædikater) |
| Skærm-præsentation | error-rækker vises i "Fejl og advarsler"; blokerende error → ingen forældet/under-reguleret PDF | Blokering uden synlig fejl | ✔ (per-af rows er synlige) |
| PDF/Word-output | punkt 14 | — | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

### Gate-grenene og deres severity

De tre coverage-checks i row-laget (`eoRowIndkomstRows.ts`) er alle interval-baserede
(`reguleringsRange = {min, max}` fra `resolveKildeReguleringsIntervalIso` for interval-former, og
`getRangeForManualRegulering`/`{min: reguleringsdato, max: tafBoundaryDates.last}` for de manuelle):

- **`reguleringsvaerdi`** (`:435–450`): `error` hvis `!reguleringsRange.min` eller
  `anvendtReguleringsdato < min`. "Manglende reguleringsværdi på reguleringsdatoen".
- **`startvaerdi`** (`:452–460`): `error` hvis `min > tafStart`. "Manglende start-dækning".
- **`slutvaerdi`** (`:462–479`): `error` hvis `max < tafEnd` OG udløbet ligger ≥
  `allowReguleringMedUdloebMedMaaneder` (default 6) måneder efter. "Efter sidste sats".

Alle tre degraderer `error → warning` **udelukkende** når `allowIncompleteOverenskomst` er slået til
(`allowIncompleteOverenskomst ? 'warning' : 'error'`). Bekræftet: alle tre grene giver `error` i
default-tilstand (escape-hatch fra = `false`).

- Sti: [zero-delta / carry-forward maskeret som "dækket"] · Led: row-gate · Kan valid input ramme? Ja
  (reguleringsdato/TAF uden for kildens `[min;max]`) · Bevidst? **Fail-closed korrekt** — synlig
  blokerende row-`error`. Aligned med motoren ende-til-ende (S1/S2/S3/S6 i
  `reguleringSilentPathAlignment.test.ts`, bekræftet af punkt 1/3/5/6/9/10/12).

### Escape-hatch (G3) — kun severity, aldrig tal

`allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` bruges **kun** i `buildEoIndkomstRows`
(repo-bred søgning: ellers kun schema, settings-UI `Indstillinger.tsx` og tests). Den optræder
**ikke** i `erstatningsopgoerelseValidator` og **ikke** i `loenudviklingBeregning`
(beregningsmotoren modtager slet ikke app-settings). Effekten er isoleret til `.status`-feltet
(`error ↔ warning`) på de tre coverage-rows; `displayValue` (den viste, beregnede dæknings-tekst)
er identisk uanset flaget. **G3 bekræftet:** escape-hatchen sænker kun strenghed (rød → gul) og
kan strukturelt ikke ændre et eneste TAF-tal. Ny test binder kontrakten (identisk `displayValue`,
kun `status` skifter). App-settings-kommentaren `:110–113` dokumenterer korrekt undtagelsen fra
app-settings-kontraktens beregnings-forbud.

### Multi-af-maskering (U2) — kernen

`assertUniform` (`loenudviklingBeregning.ts:271`) returnerer tidligt ved `active.length <= 1` og er
derfor **inaktiv** i `Beregningsperiode`-grenen, fordi `buildPerAnsaettelseModel` (`:1488–1491`)
kalder `resolveReguleringsStrategi` pr. ansættelsesforhold med et ét-element-array. Det er
**bevidst og korrekt**: i Beregningsperiode har hvert ansættelsesforhold sin egen reguleringsstrategi,
og de beregnes uafhængigt og summeres (`:1555–1592`). Cross-af-uniformitet håndhæves kun i
angivet-løn-grenen (`:1609`, ét samlet `values`-objekt → `assertUniform` aktiv).

**Kan ét af's fulde dækning maskere et andets hul i den aggregerede status? → NEJ.** Der findes
**ingen** aggregeret coverage-status. Row-laget itererer `resolveLoenudviklingKilde(values)` (=
alle ansættelsesforhold i Beregningsperiode) og emitterer et **selvstændigt** sæt regulerings-rows
pr. af med prefix `loenindkomst.<af.id>.regulering`. Hvert af's `reguleringsvaerdi`/`startvaerdi`/
`slutvaerdi` beregnes af **dét** af's egen `resolveKildeReguleringsIntervalIso(af)` og egen
`resolveAnvendtReguleringsdato(af.saerligFraDatoRegulering …)`. Af B's hul giver af B's egen
`error`-row, uafhængigt af af A. Validatoren gør det samme (`validateLoenudviklingsKravForAktivKilde`
itererer per-af med index-baserede paths). Både compute og gate er altså per-af fail-closed; der er
ingen kollapsende reduktion, hvor en `ok` kunne overskrive en `error`.

- Sti: [aggregeret status maskerer per-af hul] · Led: row-gate (aggregering) · Kan valid input ramme?
  Nej — der er ingen aggregering · Bevidst? **Bekræftet korrekt (strukturelt umuligt)**. Ny U2-test
  binder det ende-til-ende (to KRL-af, A dækket → ok, B med tidlig `saerligFraDato` → error; mindst
  én blokerende error i det samlede rækkesæt).
- **Udfald: uændret.** Ingen kodeændring nødvendig; maskering kan ikke opstå. (Havde en aggregering
  eksisteret, ville en maskering have været kritisk — men den findes ikke.)

### S5/S8-kobling — uparsbar/ufuldstændig manuel pct

Bekræftet at S5 (og dens manuel-angivet-pendant S8) er **korrekt gated opstrøms** og at validator +
row-lag er **alignet** (nu bogstaveligt via fælles helper, se Fund 1):

- Committed `procent` er (via Zod `percentageDecimal`) enten finit ∈ [0;100] eller `undefined`;
  committed `dato` er (via `tableIsoDateCellString`) enten gyldig ISO eller `undefined`. Uparsbar/
  out-of-range/ikke-finit input fejler schemaet og kan aldrig nå motoren.
- Det stille compute-drop (`manuelProcentsatsRegulering.ts` / `buildLoenudviklingFromManual`) rammer
  derfor kun **tomme** celler. En helt tom række taber ingen regulering; en **aktiv men ufuldstændig**
  række (dato uden procent, eller omvendt) markeres blokerende `error` i BÅDE row-laget
  (`alleVaerdier`) OG validatoren — med **samme** prædikat (`isManuelProcentsatsRowAktiv` /
  `isManuelProcentsatsRowKomplet`). Bekræftet ende-til-ende (S5-blokken, uændret grøn efter
  konsolidering).
- **U6-konsolideringen ændrer ikke adfærd:** de nye helpers er bevist tal-/adfærds-identiske med de
  tidligere inline-udtryk på hele det committed domæne (ny equivalence-test).

## Fund og rettelser

1. **[Medium → rettet direkte (strukturel, tal-neutral)] U6: "aktiv-række + begge-felter-krævet"-prædikatet lå i tre parallelle kopier.**
   - Lokation: compute (`manuelProcentsatsRegulering.ts:16,58`), validator
     (`erstatningsopgoerelseValidator.ts:847–908`), row-lag (`eoRowIndkomstRows.ts:295–354`).
     Validator + row-lag delte bogstaveligt identisk kode; row-laget brugte `(dato ?? '').trim() !== ''`
     hvor validatoren brugte `dato !== undefined` (ækvivalent på committed-domænet, men latent drift).
   - Handling: Ny kanonisk helper `domain/erstatningsopgoerelse/helpers/manuelReguleringRowPredicates.ts`
     med `hasFinitePct`, `isManuelProcentsatsRowAktiv`, `isManuelProcentsatsRowKomplet`,
     `isManuelAngivetRowAktiv`, `isManuelAngivetRowDatoUdfyldt`, `MANUEL_ANGIVET_SUPPLEMENT_FELTER`.
     Compute, validator og row-lag kalder nu ALLE disse (compute genbruger `hasFinitePct`; row-lag +
     validator genbruger hele prædikat-familien). Ingen ny parallel variant.
   - Resultat: **Tal-/adfærds-neutralt.** Bevist af (a) uændrede eksisterende tests (166 → grønne) og
     (b) ny dedikeret equivalence-test der matcher helperne mod de tidligere inline-udtryk på hele
     dato×procent-matrixen (med vacuous-pass-værn: matrixen rammer beviseligt både aktiv/inaktiv og
     komplet/ukomplet). Drift-risikoen (gate/motor ude af sync) er elimineret.

2. **[Bekræftet korrekt] U2 multi-af-maskering er strukturelt umulig** — se Dækningsanalyse. Ingen
   kodeændring; ny ende-til-ende-test binder per-af-uafhængigheden.

3. **[Bekræftet korrekt] Escape-hatch G3 — kun severity, aldrig tal** — se Dækningsanalyse. Ny test
   binder `displayValue`-identitet på tværs af flaget.

4. **[Info / bekræftet bevidst] `alleVaerdier`-domæneforskel (nul aktive rækker).** Manuel
   **procentsats** giver `ok` ved nul aktive rækker (`slice(1).every(...)` på tom liste → base =
   indeks 100, intet krævet input), mens manuel **angivet** giver `error` ("Mindst én manuel
   reguleringsrække skal udfyldes"). **Bekræftet bevidst domæneforskel:** procentsats-basen ER
   indeks 100 uden input; angivet-basen kræver en grundløn for at kunne danne basispakken
   (`buildLoenudviklingFromManual:1259` kaster ved manglende base-række). Ny test pinner begge udfald.

5. **[Info / dokumenteret] Før-basis-dobbeltsignalering.** En før-basis-procentsatsrække uden procent
   trigger BÅDE `alleVaerdier`-`error` (aktiv, ikke komplet) OG `raekkerFoerReguleringsdato`-`warning`
   (dato < reguleringsdato). **Ikke en fejl i under-regulerings-forstand:** fail-closed retning (kræver
   at brugeren rydder op i en ufuldstændig række), ingen tabt regulering. Mindre UX-skævhed
   (rækken tæller alligevel ikke med). Uændret; se FORSLAG.

## FORSLAG TIL GODKENDELSE

Ét forhold kræver brugerens beslutning, fordi enhver rettelse enten indfører/fjerner en blokerende
fejl eller ændrer gate-strenghed. **Intet er ændret** — det står her til beslutning:

**Asymmetri: row-laget kræver supplement-konsistens, som hverken validatoren eller motoren gør.**
Row-laget (`eoRowIndkomstRows.ts`, `supplementsOk`) markerer `alleVaerdier`-`error`, hvis et
tillægssats-felt (feriepenge/SH-SO/fritvalg/AG-pension) er udfyldt på nogle aktive manuel-angivet-rækker,
men blankt på andre. Beregningsmotoren behøver ikke dette: et blankt tillæg tolkes som 0
(`parseManualPercentToPct → 0`), og et blankt `feriepenge` falder tilbage til base-feriepct
(`resolveManualFeriePctPct`). Validatoren har **ingen** tilsvarende konsistens-check.

- **I dag ser brugeren:** hvis man fx sætter feriepenge = 12,5 % på basisrækken og lader det stå blankt
  på en senere reguleringsrække, bliver rækken "Alle reguleringsværdier udfyldt" = **rød (Nej)**, selv
  om programmet ville kunne beregne et veldefineret resultat (blank = fald tilbage til basens 12,5 %).
- **To mulige retninger (begge er en gate-strengheds-ændring → skal besluttes af dig):**
  1. **Behold** (status quo): guarden tvinger brugeren til at udfylde tillæg eksplicit på alle rækker.
  2. **Slæk** row-laget så et blankt tillæg accepteres (matcher motorens fallback) → færre røde rækker,
     men brugeren kan da utilsigtet få base-fallback på et tillæg uden at bemærke det.
- Anbefaling til drøftelse: retning 2 fjerner en potentiel false-positiv rød markering, men retning 1
  er mere eksplicit/fail-closed. Ingen af delene rører de producerede tal — kun hvornår rækken markeres
  rød. **Ikke ændret uden din beslutning.**

(Alle øvrige rettelser i punkt 13 er tal-/adfærds-neutrale og krævede ikke forelæggelse.)

## Testdækning (led 3)

**Nye tests (11), alle grønne:**
- `manuelReguleringRowPredicates.test.ts` (**ny fil, 7 tests**): `hasFinitePct`-grænser; procentsats
  aktiv/komplet-**equivalence** mod de tidligere inline-udtryk på hele dato×procent-matrixen (+
  vacuous-pass-værn der beviser matrixen rammer alle fire udfald); aktiv-men-ikke-komplet fanges;
  tom række; manuel-angivet aktiv-equivalence mod BÅDE row-lagets trim-form OG validatorens
  undefined-form; `isManuelAngivetRowDatoUdfyldt`; supplement-felt-listen.
- `eoRowIndkomstRows.reguleringsCoverage.test.ts` (**+4 tests**):
  1. **U2 multi-af non-masking** — to KRL-af, A dækket → `reguleringsvaerdi` ok, B med tidlig
     `saerligFraDato` → `error`; mindst én blokerende error i det samlede rækkesæt.
  2. **G3 escape-hatch** — `displayValue` identisk for allow=false/true på `startvaerdi`; kun `status`
     flipper `error ↔ warning`.
  3. **U6 domæneforskel** — nul aktive rækker: procentsats → `ok`, angivet → `error`.
  4. **U6 dobbeltsignalering** — før-basis-procentsatsrække uden procent → `alleVaerdier` error +
     `raekkerFoerReguleringsdato` warning samtidigt.
- Bekræftet stærk eksisterende dækning (uændret grøn efter konsolidering): `reguleringSilentPathAlignment`
  (S1/S2/S3/S5/S6 motor↔gate-binding), `eoRowIndkomstRows.reguleringsCoverage` (allow true/false severity,
  udløbsgrænse, daekningAdvarsel), `erstatningsopgoerelseValidator` (manuel-grene), `loenudviklingBeregning`
  (multi-af non-masking i compute `:1140–1206`).

## Tilfældighedsfund

- **[Medium — se FORSLAG]** Supplement-konsistens-asymmetri (row-lag strengere end validator + motor).
  Kræver forelæggelse (gate-strenghed).
- **[Lav — konvergens, U3/U4/U5 ejes af punkt 14/15]** Ikke rørt her: `resolveOffentligLoenSelection`
  tre-variant (U3), dobbelt clamp-mekanisme (U4), `computePackageValuePct` vs `computeFormulaValue`
  (U5). Noteret uændret.
- **[Info]** `resolveKildeReguleringsIntervalIso` er korrekt eneste kilde til interval-formernes
  `[min;max]` i row-laget; de manuelle former bruger bevidst `getRangeForManualRegulering`/
  reguleringsdato-afledt range (ingen ekstern tabel). Ingen parallel coverage-kilde fundet.
- Ingen død kode eller fejlplacerede filer i gate-/validator-stien efter konsolideringen (de lokale
  `isFinitePct`/`hasManualPercentValue`-kopier er fjernet fra alle tre callsites).

## Sammenfatning

Coverage-gaten fanger hver dæknings-mangel fail-closed: "manglende reguleringsværdi på
reguleringsdatoen" (`reguleringsvaerdi`), "manglende start-dækning" (`startvaerdi`) og "efter sidste
sats" (`slutvaerdi`) giver alle synlig blokerende row-`error` i default-tilstand, og degraderer til
`warning` **kun** når escape-hatchen eksplicit er slået til. **G3 er bekræftet:** escape-hatchen
sænker udelukkende severity (rød → gul) og ændrer aldrig et tal — beregningsmotoren modtager slet
ikke app-settings, og row-lagets `displayValue` er identisk uanset flaget (nyt test-bevis).
**U2 (multi-af-maskering) er afgjort bekræftet korrekt/strukturelt umulig:** både compute og row-lag
er per-af fail-closed, og der findes ingen aggregeret status hvor ét ansættelsesforholds dækning
kunne skjule et andets hul (ny ende-til-ende-test). **S5/S8 er bekræftet gated opstrøms og alignet**
mellem validator og row-lag. **U6 er konsolideret tal-/adfærds-neutralt:** de tre parallelle kopier
af "aktiv-række + begge-felter-krævet"-prædikatet er samlet i én kanonisk helper, bevist byte-ækvivalent.
Ét forhold er parkeret til brugerbeslutning (supplement-konsistens-asymmetri — gate-strenghed).
Gate grøn: typecheck, typecheck:test, lint, 177 målrettede tests (heraf 11 nye).
