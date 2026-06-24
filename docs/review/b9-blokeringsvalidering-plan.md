# B9 — Træk produktions-blokerings-validering ud af debug-laget (plan til forelæggelse)

**Dato:** 2026-06-24
**Status:** UDKAST TIL GODKENDELSE — ingen produktionskode ændret endnu.
**Forudgående afklaring:** `src/__tests__/quality/eoDebugGateUniqueContribution.test.ts` (4 grønne cases) + kode-verificeret kortlægning af alle `status:'error'`-stier i debug-builderne krydset mod den autoritative validator.

> **Forelæggelse jf. AGENTS.md:** Punktet rører produktions-PDF-gaten (hvornår en download blokeres) og blokerings-tekster → beregnings-/valideringsnært + UI-tekst. Det må ikke implementeres uden brugerens godkendelse. Målet er **nul synlig forskel** for brugeren.

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
2. **Udskil `eoBlockingValidation`-modulet** med de rene dato-grænse-/cutoff-/sekundærtabel-tjek (katalog §2A+B), genbrugt fra de eksisterende helpers (`computeRowDateBounds`, `buildTafCutoffErrorMessage`, `tafPeriodConstraints` m.fl.) — flyttet ud af debug til domænet, så både debug og det nye modul kalder samme kode. Beskeder bevares byte-identisk.
3. **Flyt krævede-felt-tjek** (§2C, kun reachable) ind i modulet.
4. **Omstil gaten** i `useEoBeregningViewModel` til at læse `eoBlockingValidation` i stedet for `collectAllDebugRows.errors`. Debug-rækkerne render verdikterne.
5. **Erstat string-match-værnet** med adfærds-værnet; ryd de døde fejlgrene (§2-noten).

Golden-master-suiten (fase 1) + de 457 debug-tests holdes grønne gennem hele forløbet; enhver diff i fejl-rækker/beskeder er en rød advarsel, ikke en accept.

---

## 5. Risiko & estimat
- **Risiko: høj** på korrekthed (download-gating er trust-kritisk; mange sammenflettede tjek, flere motor-/canonical-afhængige). Mitigeret af golden-master + adfærds-værn + faseopdeling.
- **Brugervendt:** mål = nul forskel. Den eneste mulige synlige forskel er blokerings-**beskedernes** ordlyd, hvis to kilder i dag giver let forskellig tekst for samme tilstand; det afdækkes i fase 1 og forelægges hvis det opstår.
- **Estimat:** ~3-5 dage, jf. den oprindelige vurdering — nu bekræftet af kataloget.

---

## 6. Forelæggelse — afgjort (2026-06-24)
1. **Arkitektur + faseplan: GODKENDT.** Start på fase 1.
2. **Over-block (§2D): RET det** — relevans-betinget krav, lille godkendt adfærdsændring, afgrænset til `arbejdsstatus` + `helbredsstatus`.
3. Øvrige katalog-tjek relokeres 1:1 (identiske triggere + beskeder); enhver utilsigtet besked-diff fanget af golden-master forelægges hvis den opstår.
