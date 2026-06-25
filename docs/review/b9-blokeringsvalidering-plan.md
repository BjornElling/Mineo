# B9 — Træk produktions-blokerings-validering ud af debug-laget (plan til forelæggelse)

**Dato:** 2026-06-24 (oprindelig plan) · **Afsluttet:** 2026-06-25
**Status:** ✅ **GENNEMFØRT** — men IKKE via den oprindelige plan (parallel `eoBlockingValidation`). Brugeren valgte i stedet **single-source-relocation (approach B)**: række-evaluerings-motoren er flyttet UD af `domain/debug/` til den autoritative placering `src/domain/eoRowEvaluation/`, så download-gaten drives af ÉN autoritativ kilde uden parallel logik eller paritets-risiko. Se **§8 Gennemførelse (2026-06-25)** nederst — den supersederer §3-7's `eoBlockingValidation`-centrerede design.

> **Forelæggelse jf. AGENTS.md:** Punktet rørte produktions-PDF-gaten (hvornår en download blokeres) → beregnings-/valideringsnært. Brugeren godkendte (1) arkitektur + faseplan, (2) over-block-fixet, og (3) approach B (relocation) frem for parallel re-derivation. Målet var **nul synlig forskel** ud over det godkendte over-block-fix.

---

## 1. Problemet (kode-verificeret)

Download-gaten for de fire EO-PDF'er er i dag (`useEoBeregningViewModel.ts:439`):

```
canDownload = eoPdfProjection?.kind === 'ok'  &&  !hasBlockingDebugErrors
```

- **Led 1 — autoritativt:** snapshottet kører den autoritative validator (`erstatningsopgoerelseValidator`) på committed data. Fanger den noget blokerende → `data:null` → `eoSnapshotToEoDocument` returnerer `kind:'blocked'`. Helt uden om debug.
- **Led 2 — debug:** `hasBlockingDebugErrors` udledes af `collectAllDebugRows(...).errors`, dvs. de samme DEV-debug-builders som EODebug-siden. Det slår kun til, når snapshottet *lykkedes* (projektion `ok`) men en debug-builder alligevel satte `status:'error'`.

**Bevist:** Led 2 blokerer cases som led 1 IKKE fanger. Den autoritative validator tjekker for datoer kun *komplethed, rækkefølge og ménafgørelse-grænsen* — ikke min/max-grænser eller cutoff-datoer. Debug-laget re-deriverer dem og siger det rent ud i koden (`eoDebugSvieSmerteRows.ts:100-103`): felt-fejlene *"vil typisk være tom for disse felter"*, så debug regner grænserne igen *"for at undgå falske grønne hak"*.

**Konsekvens:** Fjernede man bare debug-leddet og lod gaten bygge på (snapshot ∪ felt-fejl), ville PDF'er med dato uden for grænsen — og enkelte tomme krævede felter — **slippe igennem**, især efter genindlæsning af en `.eo`-fil (hvor felt-tooltips er væk, men committed data består). Det er en reel adfærdsændring. Derfor er B9 **ikke** en ren strukturel refaktor; en del af valideringen skal have et autoritativt hjem.

---

## 2. Katalog: hvad debug-laget gater UNIKT (skal have autoritativt hjem)

Kun stier hvor validatoren **ikke** uafhængigt blokerer (= kan sameksistere med projektion `ok`). Stier hvor validatoren allerede blokerer, er redundante — debug *renderer* dem blot, og de er uproblematiske.

### A. Dato-grænser & cutoff (kernen — størst og vigtigst)
| Sti | Trigger | I validatoren? |
|---|---|---|
| `sviesmerte.periode.<id>` | fra/til uden for [skadedato … dags dato/ménafgørelse]-bounds; "ingen gyldige datoer" | **Nej** (kun rækkefølge + ménafgørelse) |
| `taf.periode.<id>` | fra/til uden for bounds | **Nej** |
| `taf.periode.<id>` | fra/til ≥ differencekrav-/endeligt-EET-/midlertidigt-EET-dato (cutoff) | **Nej** — bevidst "stille clamp" i motoren (eo-snapshot-contract.md §2.2) |
| `taf.ferie.<id>` | komplethed/rækkefølge/overlap/bounds | **Nej** (validatoren validerer slet ikke ferieperioder) |
| `taf.beregningsgrundlag.beregningsperiode` | TAF-periode overlapper ikke beregningsperioden | **Nej** |
| `taf.beregningsgrundlag.ferie.<id>` | overlap / uden for beregningsperioden | **Nej** |

### B. Beregnings-/dæknings-tjek (afhænger af motor-/canonical-output)
| Sti | Trigger | I validatoren? |
|---|---|---|
| `taf.beregningsgrundlag.indkomst` | ingen indkomst i beregningsperioden | **Nej** |
| `loenindkomst.<id>.regulering.*` | valgt overenskomst/KRL dækker ikke regulerings-datoen | **Delvist** (statistik/KRL-år dækket; overenskomst ikke) |
| `sfgg.dagssats.<id>` (direkte overenskomst) | sats kan ikke fastsættes for perioden | **Nej** |
| `taf.beregningsgrundlag.angivetLoenOpreguleresFraDato` | kan ikke udledes | **Nej** |

### C. Krævede felter (reachable empty-state)
| Sti | Trigger | I validatoren? | Reachable? |
|---|---|---|---|
| `erstatningsopgoerelse.arbejdsstatus` | `tafArbejdsstatus` tom | **Nej** | **Ja** (optional, ingen schema-default) — **bevist** |
| `erstatningsopgoerelse.svieSmerteHelbredsstatus` | tom | **Nej** | **Ja** (optional) |
| `loenindkomst.<id>.loenudvikling.valgt` | basis ikke valgt / overenskomst ikke valgt | **Delvist** | Ja |

> **Ikke-reachable (udgår af kataloget):** `revideretOpgoerelse`, `varigeMenAfgorelse`, `midlertidigtEETAfgorelse`, `endeligtEETAfgorelse`, `verserendeKlageEet`, `tidligereSsMax` — alle har schema-default ('Nej'), så `emptyState:'error'`-stien kan aldrig nås. De er døde fejlgrene (egnet til oprydning, ikke flytning).
>
> **Defensive try/catch-grene** (`sviesmerte.beregnetPeriode`/`antalDage` "Ugyldig dato i beregning") er beskyttet af schema-ISO-garantien og nås ikke i normal drift.

### D. Over-block-fund — **brugergodkendt rettet (2026-06-24)**
`erstatningsopgoerelse.arbejdsstatus` og `svieSmerteHelbredsstatus` blokerer i dag PDF'en **selv når den tilhørende beregning ikke kræves** (fx tom arbejdsstatus blokerer, selv om `kravPaaTabtArbejdsfortjeneste='Nej'`). Relevans-filtreringen i `eoDebugRowAggregator` rammer ikke disse rækker — utilsigtet over-blokering.
**Beslutning (bruger, 2026-06-24): RET det** — felterne må kun blokere, når den tilhørende beregning faktisk kræves. Det er en bevidst, lille adfærdsændring: i sager hvor fx TAF ikke beregnes, kan PDF'en nu hentes selv med tom arbejdsstatus. Indarbejdes i `eoBlockingValidation` (relevans-betinget krav) frem for en 1:1-relokering for netop disse to felter. Golden-master-baseline (fase 1) tages FØR ændringen, så diffen er eksplicit og afgrænset til disse to felter.

---

## 3. Foreslået arkitektur

Indfør ét autoritativt domæne-modul **`eoBlockingValidation`** (i `src/domain/erstatningsopgoerelse/validation/`), som er **eneste** kilde til "blokerer denne sag download, og med hvilken besked":

```
eoBlockingValidation(parsedValues, stamdata, fieldErrors, canonical/snapshot)
  → { blocking: BlockingIssue[] }   // id, message, navigation, severity
```

- Det subsumerer dagens to kilder: (1) validator-invarianterne **og** (2) de row-level-tjek der i dag bor i debug-builderne (katalog §2 A–C) — med **identiske triggere og beskeder**.
- **Produktions-gaten** (`useEoBeregningViewModel`) konsumerer `eoBlockingValidation` direkte i stedet for at udlede blokering af `collectAllDebugRows`.
- **Debug-laget** *renderer* `eoBlockingValidation`s verdikter i stedet for at gen-beregne dem. Debug bliver dermed ren projektion (dets erklærede rolle).
- Afhængighedspilen vendes: debug må importere blocking-modulet, aldrig omvendt.

**Hvorfor ikke bare flytte alt ind i den eksisterende snapshot-validator?** Fordi flere tjek (cutoff-efter-EET/differencekrav) bevidst er holdt UDE af validatoren — motoren clamper stille, og kun debug viser det som fejl (kontrakt §2.2). At gøre dem til snapshot-blokerende invarianter ville ændre forholdet mellem clamp og blokering = beregnings-semantik. Et dedikeret blocking-modul, som både gate og debug læser, relokerer den eksisterende blokeringslogik **uden** at omskrive clamp-vs-block-kontrakten.

**Værnet** (erstatter dagens skøre string-match, invariant C i `debugLayerIsolation.test.ts`): et **adfærds-værn** der over et korpus hævder `gate-blokerer ⇔ eoBlockingValidation ikke-tom` + at debug-render matcher blocking-modulet.

---

## 4. Faseinddeling (hver fase adfærdsbevarende, testet før næste)

1. **Lås katalogen empirisk.** ✅ **UDFØRT (2026-06-24).** `src/__tests__/quality/eoBlockingGateCatalog.test.ts` — golden-master (`toMatchInlineSnapshot`) over et korpus af projektion-`ok`-sager, der fanger id + dato-normaliseret besked for hver debug-only fejl-række. Sweep'et fandt **to gates som håndlæsningen i §2 missede:**
   - `erstatningsopgoerelse.helbredsstatus` blokerer **selv når svie/smerte ='Nej'** (samme over-block-klasse som arbejdsstatus, §2D) → omfattet af den godkendte "ret det"-beslutning.
   - `loenindkomst.<af>.satserSkadestidspunkt` — værdi-afledt satser-fejl ("Forkert værdi indtastet i Store Bededagstillæg") på et default-ansættelsesforhold; nås uden felt-fejl. Skal afklares i fase 2 (ægte gate vs. ordlyds-/reachability-detalje).
   - Bekræftede §2-katalog-stier: `sviesmerte.periode.<id>` (dato-grænse), `taf.periode.<id>` (dato-grænse **og** cutoff-efter-differencekrav), `arbejdsstatus`. *Bemærk: cutoff-beskeden er i dag dubleret ("…; …") — kosmetisk, noteret til fase 2.*
   Den fulde korpus-udvidelse (ferieperioder, beregningsperiode-overlap, indkomst-i-periode, SFGG-sats-calculability) tilføjes løbende i fase 2-takt, så hver flyttet gate har en golden-master-linje før den røres.
2. **Udskil periode-/satser-/beregningsgrundlag-blokeringen til delte, autoritative moduler.** ✅ **UDFØRT (2026-06-24).** Debug-builderne *delegerer* nu beslutningen (ÉN sandhedskilde), så DEV-display-formattering ikke længere kan flytte disse gates:
   - `svieSmertePeriodeValidation`, `tafPeriodeValidation`, `ferieperiodeValidation` (dato-grænser, overlap, rækkefølge, cutoff-efter-differencekrav/EET) — `eoDebugSvieSmerteRows`/`eoDebugTaftRows` delegerer.
   - `loenindkomstSatserGate` (satser-afvigelse, inkl. Store Bededag) + `eoPeriodeBlockingContext` relokeret til domænet; `eoDebugIndkomstModel`/`eoDebugContextBuilders` genbruger.
   - `eoBlockingValidation` + `beregningsgrundlagBlockingValidation` samler periode-, satser-, krævede-felt- og beregningsgrundlag-blokering (indkomst-i-periode + beregningsgrundlag-ferie).
   - **Ækvivalens-værn** `eoBlockingValidationEquivalence.test`: hævder at `eoBlockingValidation` blokerer præcis de samme projektion-`ok`-sager som dagens debug-gate, over et korpus der dækker de udskilte familier. Periode-/satser-familierne er ækvivalente *by construction* (debug + eoBlockingValidation kalder samme funktion).
3. **(Indgår i 2)** Krævede-felt-tjek (arbejdsstatus/helbredsstatus) reproduceret i `eoBlockingValidation` (nuværende, uændrede over-block-adfærd).

### ⚠️ Fase 4-5 — IKKE gennemført (bevidst standset af trust-hensyn, 2026-06-24)

4. **Omstil gaten** i `useEoBeregningViewModel` til `eoBlockingValidation`. **IKKE gjort.** `eoBlockingValidation` er bevist **ufuldstændig** for gaten: flere debug-`error`-familier gater PDF og er reachable når projektionen er `ok`, men er endnu IKKE reproduceret:
   - `loenindkomst.<af>.loenudvikling.valgt` ("Overenskomst/Statistik/KRL ikke valgt") — `eoDebugIndkomstRows.ts:177-200`.
   - `loenindkomst.<af>.regulering.*` (dæknings-gap når overenskomst/KRL ikke dækker regulerings-datoen) — `eoDebugIndkomstRows.ts:407-448` (status `error` når ikke `allowIncompleteOverenskomst`).
   - `offentligeYdelser.*` (ugyldig/manglende rækkedata) — `eoDebugIndkomstModel.ts`.
   - SFGG direkte-overenskomst-sats ("kunne ikke fastsættes"), EET-dato-logik (`aes.*`), samt **felt-fejl-drevet** blokering (eoBlockingValidation er pt. ren værdi-afledt — tager ikke `fieldErrors`).
   Disse er motor-/canonical-afhængige og kræver valide overenskomst-/statistik-/SFGG-fixtures at reproducere+verificere. At omstille gaten før de er dækket+verificeret ville **under-blokere** (en fejlbehæftet opgørelses-PDF kunne hentes) = trust-kritisk regression. Derfor standset; gaten læser fortsat `collectAllDebugRows` (uændret adfærd).
5. **Erstat string-match-værnet** (invariant C) med adfærds-værnet + **anvend over-block-fix** (arbejdsstatus/helbredsstatus kun når relevant). **IKKE gjort** — afhænger af, at gaten først er omstillet (ellers er invariant C stadig en korrekt beskrivelse af den fortsatte kobling, og over-block-fixet skal ledsages af opdateret golden master + ækvivalens-delta). Hører sammen med fase 4.

Golden-master-suiten (fase 1) + de 457 debug-tests er holdt grønne gennem hele forløbet; ingen adfærdsændring er indført.

**Næste skridt for at fuldføre (kræver omhu + forelæggelses-bekræftelse pga. trust-kritikalitet):** udvid `eoBlockingValidation` (+ `fieldErrors`) til at dække loenudvikling/regulering/offentlige-ydelser/SFGG/EET-familierne, udvid ækvivalens-korpusset til at bevise BÅDE boolean OG første-besked-paritet (inkl. felt-fejl-scenarier), og omstil så gaten + anvend over-block-fix + erstat værnet.

---

## 5. Risiko & estimat
- **Risiko: høj** på korrekthed (download-gating er trust-kritisk; mange sammenflettede tjek, flere motor-/canonical-afhængige). Mitigeret af golden-master + adfærds-værn + faseopdeling.
- **Brugervendt:** mål = nul forskel. Den eneste mulige synlige forskel er blokerings-**beskedernes** ordlyd, hvis to kilder i dag giver let forskellig tekst for samme tilstand; det afdækkes i fase 1 og forelægges hvis det opstår.
- **Estimat:** ~3-5 dage, jf. den oprindelige vurdering — nu bekræftet af kataloget.

---

## 6. Forelæggelse — afgjort (2026-06-24)
1. **Arkitektur + faseplan: GODKENDT.** Start på fase 1.
2. **Over-block (§2D): RET det** — relevans-betinget krav, lille godkendt adfærdsændring, afgrænset til `arbejdsstatus` + `helbredsstatus`. *(Indgår i den endnu ikke gennemførte fase 5.)*
3. Øvrige katalog-tjek relokeres 1:1 (identiske triggere + beskeder); enhver utilsigtet besked-diff fanget af golden-master forelægges hvis den opstår.

## 7. Status ved autonom kørsel (2026-06-24)

**Gennemført (adfærdsbevarende, committet, alle tests grønne):** fase 1 + fase 2 — den dato-/periode-/satser-/beregningsgrundlag-blokering, der reelt var sammenfiltret med DEV-display-formattering, er nu udskilt til delte, autoritative domæne-moduler, som debug-builderne delegerer til (ÉN sandhedskilde). `eoBlockingValidation` er bygget som den autoritative blokerings-funktion for disse familier, med et ækvivalens-værn.

**Bevidst standset før fase 4-5 (gate-omstilling + over-block-fix + værn-erstatning):** `eoBlockingValidation` er endnu ikke komplet nok til sikkert at drive den trust-kritiske PDF-gate (mangler loenudvikling/regulering/offentlige-ydelser/SFGG/EET + felt-fejl-familierne; se fase 4-noten). Gaten er uændret. At fuldføre kræver at dække de resterende familier + bevise fuld paritet (boolean + besked + felt-fejl) — og bør bekræftes pga. trust-kritikaliteten.

**Note (midlertidig "ubrugt" produktionskode):** `eoBlockingValidation` med familie-moduler kaldes pt. kun fra ækvivalens-værnet (ikke fra produktions-gaten endnu). Det er bevidst infrastruktur for fase 4 — ikke død kode — men bør enten wires (fase 4) eller genovervejes, hvis fase 4 ikke fuldføres.

---

## 8. Gennemførelse (2026-06-25) — via single-source relocation (approach B)

Da fase 4 skulle gennemføres, viste kode-niveau-kortlægningen at den oprindelige plans `eoBlockingValidation`-vej (parallel re-derivation af ALLE blokerings-familier) var (a) et fler-dages refaktor, (b) en duplikering af store dele af 5+ buildere = præcis den parallelle logik konvergens-princippet advarer imod, og (c) bærer af irreducibel under-blokerings-risiko (korpus kan ikke bevise udtømmende paritet). **Brugeren valgte i stedet approach B: single-source relocation.** Det opnår B9's mål uden parallel logik og uden paritets-risiko.

**Det egentlige problem (præciseret):** Den trust-kritiske download-gate hang på `collectAllDebugRows`, der lå i `domain/debug/` — et lag der nominelt er "DEV". Isolations-invariant A (intet domæne-modul må importere `domain/debug/`) gjorde at en autoritativ validator IKKE kunne genbruge motoren uden enten at flytte den eller duplikere den.

**Hvad blev gjort:**
1. **Over-block-fix (§2D, godkendt).** `arbejdsstatus`/`helbredsstatus` blokerer nu kun download, når den tilhørende beregning faktisk kræves — håndhævet i den delte relevans-filtrering (`isRowRelevantForEoValues`). Golden-master (`eoBlockingGateCatalog.test`) opdateret: diffen er afgrænset til netop disse to felter (helbredsforhold forsvinder fra TAF-only-sager). Eneste bruger-synlige ændring.
2. **Relocation.** Hele gate-closuren (20 filer: aggregator + builder-registry + alle `buildEODebug…Rows` + delte typer/helpers) er flyttet `domain/debug/` → **`src/domain/eoRowEvaluation/`** (autoritativ, debug-fri). De 21 tilbageværende `domain/debug/`-filer er ren DEV-visning (tabeller, CSV, parity, integritet, sammentælling) og er nu NEDSTRØMS: de importerer motoren, aldrig omvendt.
3. **Gaten** (`useEoBeregningViewModel`) importerer nu motoren fra `eoRowEvaluation` — ikke `domain/debug/`. Adfærd uændret (samme `collectAllDebugRows(...).errors`-sti).
4. **Retireret parallel kode.** `eoBlockingValidation` + `beregningsgrundlagBlockingValidation` + `eoBlockingValidationTypes` + ækvivalens-værnet er slettet — de var kun brugt af deres egen test og drev aldrig gaten. De delte per-familie-evaluatorer (`svieSmertePeriodeValidation`, `tafPeriodeValidation`, `ferieperiodeValidation`, `loenindkomstSatserGate`, `eoPeriodeBlockingContext`) består — motorens buildere delegerer fortsat til dem (ÉN sandhedskilde).
5. **Værnet** (`debugLayerIsolation.test.ts`) omskrevet: invariant A bevaret (kun de to snapshot-broer importerer `domain/debug`), NY **ENGINE**-invariant (`eoRowEvaluation` er debug-fri, så gatens kilde ikke kan forurenes af display-formattering), og invariant C inverteret — gaten konsumerer den AUTORITATIVE motor og må IKKE importere `domain/debug`.

**Verifikation:** typecheck (src + test) ✓, lint ✓, fuld testsuite ✓ (efter rettelse af 5 forældede `vi.mock`-stier som relocationen ramte).

6. **Navne-skift (gennemført i opfølgende commit).** Motor-filerne er omdøbt `eoDebug…` → `eoRow…` (fx `eoRowAggregator`, `eoRowBuilderRegistry`, `eoRowTypes`), og den engine-identitets-bærende symbolik er omdøbt til en row-evaluerings-identitet: `collectAllDebugRows`→`collectAllEoRows`, `DebugRowModel`→`EoRowModel`, `DebugStatus`→`EoRowStatus`, `executeAllEODebugBuilders`→`executeAllEoRowBuilders`, `EODebugExecutionContext`→`EoRowEvaluationContext`, `buildEODebug…Rows`→`buildEo…Rows`, `hasBlockingDebugErrors`→`hasBlockingEoRowErrors` m.fl. Symboler der navngiver et ÆGTE DEV-inspektions-underbegreb (`DebugDay`, `IntegrityInvariant`, `DebugCellValue`, `parseDanishToIsoDebug` o.l. — alle i delte type-/helper-filer) er bevidst beholdt. Adfærds-neutralt, typecheck-værnet.

**Mindre udestående (lav værdi):** test-filerne for motoren ligger stadig i `__tests__/domain/debug/` (spejler ikke `domain/eoRowEvaluation/`); en flytning er kosmetisk og kan tages ved lejlighed.
