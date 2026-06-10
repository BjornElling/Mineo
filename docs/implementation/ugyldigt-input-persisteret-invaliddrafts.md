# Plan: Ugyldigt input som persisteret state (`invalidDrafts`)

> Status: UDFØRT (2026-06-10).
>
> | Fase | Status |
> |------|--------|
> | 0 — Kontrakter | ✅ Gennemført |
> | 1 — Schema + store | ✅ Gennemført |
> | 2 — Commit-vej (`useDraftField`) | ✅ Gennemført (alle 8 `Styled*`-felter) |
> | 3 — Tabel-input | ✅ Gennemført (alle 10 feature-tabeller bundet via `CellInvalidDraftScopeProvider`) |
> | 4 — Save-gate + routing | ✅ Gennemført (celle-fieldPath-routing via `cellInvalidDraftScopes`; vent-på-mount mod `data-mineo-field-path`) |
> | 5 — Fejl-UI afledes | ✅ Gennemført (almindelige felter + tabelceller) |
> | 6 — Oprydning | ✅ Gennemført (`draftHistoryRegistry`, `useTableInputHistoryRestore`, `tableInputErrorRegistry`, `useTableInputSaveError`, `captureInvalidDraftIfNew` slettet) |
>
> **Bevidst afvigelse fra planen (Fase 3/6): den syntetiske `${af.id}:loenindkomst`-aggregat-fejl er BEVARET.**
> Planen ville fjerne aggregatet og rute direkte på cellens `fieldPath`. Men aggregatet fodrer også
> EO's PDF-download-/debug-gate (`useBlockingFieldIdsBySuffixForSection` i `EOberegningTab`/`EODebug`),
> der er output-adfærd. Per-celle `invalidDrafts` håndterer nu save-blokering + præcis scroll-til-celle
> (invalidDrafts tjekkes FØR fieldErrors, så routing bruger den fulde celle-`fieldPath`); aggregatet
> bevares uændret som signal til PDF/debug-gaten og som routing-fallback. Det er en bevidst,
> dokumenteret undtagelse for ikke at ændre observerbar output-gating.
>
> **Tabel-celle-identitet:** lagrings-`fieldPath` = `${tableId}:${rowScope}:${rowId}:${colIndex}`
> (`config/cellInvalidDraftScopes.ts`), unik pr. sektion og route-diskriminerende. Undo-fokus bruger
> fortsat `data-mineo-undo-field-path` = `gridCellKey` (uændret); kun storage + `data-mineo-field-path`
> + save-gate-routing bruger den fuldt kvalificerede `fieldPath`.
>
> Verificeret grøn: `typecheck`, `typecheck:test`, `lint`, fuld suite (4929 tests / 397 filer).
>
> **Vigtig korrektion til planen (Fase 4):** Save-gaten kan ikke læse KUN `invalidDrafts`. Der findes blokerende `source:'rule'`-feltfejl (string-beskeder → `blocksSave:true`), fx `useAslAarsloenRuleReporter`, forlig-rule-fejl i `EOOplysningerTab` og `aslAfgoerelser` i `Erhvervsevnetab`. De er IKKE parse-fejl. Gaten blokerer derfor på `invalidDrafts` (parse) **plus** resterende blokerende `fieldErrors` (rule/schema). Det er kun tabel-input-**registret** der fjernes som blokeringskilde.
>
> **Afvigelser fra planteksten (sådan blev det faktisk bygget):**
> - `invalidDrafts` er en **store-slice parallel til `fieldErrors`** i `formPersistenceStore` (med `invalidDraftRevisions`), IKKE en sektion i `persistenceRegistry`. Derfor: eget Zod-schema (`src/schemas/invalidDraftsSchema.ts`), **egen dedikeret sessionStorage-nøgle** (`getInvalidDraftsStorageKey` i `storageManifest.ts`, serialisering i `src/utils/invalidDraftsStorage.ts`) — ikke per-sektion-vejen — og **automatisk .eo-eksklusion** (ikke en sektion → indgår aldrig i save-snapshot; ingen ændring i `fileSave.ts`/`fileLoad.ts`). Schemaet tæller ikke i `computeSchemaFingerprint` → **ingen `PERSISTED_DATA_VERSION`-bump**.
> - `useDraftField`-restore for almindelige felter sker nu via **autoritativ-snapshot-epoch force-resync** (en epoch-ændring resyncer draften selv ved read-only-fokus) — dette erstatter det tidligere `draftHistoryRegistry`-push. `draftHistoryRegistry` er derfor stadig **i live-brug af tabel-celler** (`useTableInputHistoryRestore`) og kan først slettes efter Fase 3.
> - `data-mineo-field-path` er tilføjet på felt-input **ved siden af** det eksisterende `data-mineo-undo-field-path` (samme værdi for almindelige felter; de tjener hver sit subsystem).
> - Kanalen til felterne: `useFormFieldErrorReporter` bærer nu `pageKey`/`fieldName`/`commitInvalidDraft`/`clearInvalidDraft`, og felterne læser reaktivt via `useFieldInvalidDraftChannel(reporter)` (context-fri store-selector → sikker uden provider).
>
> **Udestående (Fase 3 + 6):** Tabel-celler skriver endnu til det gamle `tableInputErrorRegistry` (bevaret som **fallback** i save-gaten → ingen regression; tabeller virker som før). Migrering af grid-celler til `invalidDrafts` (fuldt kvalificeret routbar fieldPath + `data-mineo-field-path` + `prepareTabForBlockingError`-prefiks; fjern den syntetiske `${af.id}:loenindkomst`-aggregat) og sletning af `draftHistoryRegistry`/`captureInvalidDraftIfNew`/`tableInputErrorRegistry`/`useTableInputSaveError` mangler. Den faste 30-frame-`waitForAnimationFrame`-heuristik i `navigateToBlockingInputError` er **ikke** ændret endnu (afventer celle-mount-delen i Fase 3).
>
> **Afløser** [bevar-ugyldig-tabel-vaerdi-ved-navigation.md](bevar-ugyldig-tabel-vaerdi-ved-navigation.md): den plan byggede et ekstra lag oven på det runtime-parallelle system for at få tabelceller til at overleve navigation. Denne plan fjerner i stedet det parallelle system, så bevarelse (også for tabeller) sker gratis. Den gamle plan udføres ikke.

## Kontekst

Programmet har to slags fejl-input, og kun den ene er problematisk:

| Type | Eksempel | I dag |
|------|----------|-------|
| Gyldigt format, uden for grænse | dato i forkert interval, heltal uden for range | Committes + gemmes. Rød kant. Blokerer ikke Gem. |
| Ugyldigt format (ikke-parsbart) | `"12.x.20"` i datofelt, `"abc"` i beløbsfelt | Committes **ikke**. Lever som flygtig draft + `invalidDraft` i runtime-fejlcache. Blokerer Gem. |

Denne plan omhandler udelukkende **nederste række** — det ikke-parsbare input.

**Rod:** Ugyldigt input lever uden for den normale state. Alt andet input flyder ad én vej: `indtastning → committed state → sessionStorage → undo/redo-snapshot → .eo`. Det ugyldige input er ikke i den vej, så der er bygget et parallelt transportsystem alene for at det kan overleve det, alt andet overlever gratis:

- `invalidDraft` gemt i runtime-fejlcachen ([fieldErrors.ts:25](../../src/types/fieldErrors.ts#L25), [error-debug-contract.md](../../src/contracts/error-debug-contract.md) §2).
- `draftHistoryRegistry` der skubber værdier tilbage i levende felter ved undo ([useDraftField.ts:189-198](../../src/hooks/useDraftField.ts#L189-L198)).
- `initialInvalidDraft`-rehydrering ved mount ([useDraftField.ts:117-123](../../src/hooks/useDraftField.ts#L117-L123)).
- `tableInputErrorRegistry` keyet på et ustabilt per-mount `useId`, ryddet ved unmount ([tableInputErrorRegistry.ts](../../src/utils/tableInputErrorRegistry.ts), [useTableInputSaveError.ts](../../src/hooks/useTableInputSaveError.ts)).
- Hele tre-kilde-resync-effekten i [useDraftField.ts:189-277](../../src/hooks/useDraftField.ts#L189-L277), der forsoner lokal draft, committed `value` og ugyldig draft på tværs af focus/blur/commit/undo/remount.

Symptomerne (scroller ikke, felt tømmes ved fane-skift, gul boks blinker) er konsekvenser af, at det parallelle system er svært at holde synkront med den rigtige state.

## Beslutninger (bruger, 2026-06-09)

1. **Gem blokerer fortsat** ved ugyldigt (ikke-committable) input. Brugeren routes stadig til feltet.
2. **Ingen bagudkompatibilitet.** Breaking changes er tilladt; ingen legacy-/konverteringskode bevares.
3. Ugyldigt input **overlever F5** (sessionStorage).
4. **.eo behøver ikke ændres** — se note nedenfor.

### Konsekvens af beslutning 1 (vigtig korrektion)

Tidlig rådgivning antog, at Gem ikke længere ville blokere, og at hele save-gating-laget derfor forsvandt. Da Gem **fortsat blokerer**, gælder:

- Routing-laget (`navigateToBlockingInputError` + fane-routing + scroll-til-felt) **består**, men fodres nu af en **stabil `fieldPath` fra state** i stedet for et registry keyet på mount-id og en `.Mui-error`-DOM-søgning på fejlbesked-strenge.
- **.eo-formatet behøver ikke ændres:** når Gem blokeres ved ethvert ugyldigt felt, kan en gemt fil per definition aldrig indeholde ugyldigt input. .eo forbliver ren, schema-valid committed domænedata. `invalidDrafts`-sektionen ekskluderes fra .eo-data-schemaet (den vil altid være tom på gemme-tidspunktet).
- Realistisk fjernes ~60-70 % af workaround-kompleksiteten (transportsystemet), ikke ~90 %. Selve Gem-blokeringen og felt-routingen er ønsket adfærd og bevares.

## Valgt model (Option C)

Tre eksplicitte tiers i stedet for to:

| Tier | Hvad | Hvor | Beregning bruger? |
|------|------|------|-------------------|
| Åben draft | mens der tastes | lokalt i felt (uændret) | aldrig |
| Committed værdi | schema-valid, typet | `formPersistenceStore.sections` (uændret) | ja |
| **Committed rå draft (ny)** | commit forsøgt, kunne ikke parses | **ny persisteret sektion `invalidDrafts`** | aldrig (behandles som tomt) |

**Beregningsfelterne og deres typer røres ikke.** Dagens runtime-`invalidDraft` promoveres til en egen persisteret sektion:

```
invalidDrafts[pageKey][fieldPath] = råstreng
```

der flyder ad den normale vej: store → sessionStorage → undo/redo-snapshot. Ved fejlende commit skrives råstrengen dertil (committed værdi forbliver sidst gyldige/undefined, præcis som i dag). Ved vellykket commit ryddes entryet. Save-gaten bliver en ren funktion af state: *findes en `invalidDrafts`-entry → blokér og route til dens `fieldPath`.*

**Fravalgt — Option B** (hvert felt bliver `{ value, raw }`): rører ~25 beregningsfiler, alle schemas og .eo. Stor risiko mod den trust-kritiske kerne for ingen ekstra gevinst. Afvist.

## Implementeringsfaser

### Fase 0 — Kontrakter først ✅ GENNEMFØRT

Schema/type-autoritet kræver kontrakt før kode ([AGENTS.md](../../AGENTS.md): "Design/opdatér schemas og typer **før** du ændrer implementeringslogik").

- [form-contract.md](../../src/contracts/form-contract.md): indfør den tredje tier ("committed rå draft" som persisteret recovery-kanal). Præcisér at §2.2 ("committed state må aldrig indeholde invalide værdier") fortsat holder — `invalidDrafts` er en separat, eksplicit string-typet kanal, ikke committed domænestate.
- [error-debug-contract.md](../../src/contracts/error-debug-contract.md) §2: `invalidDraft` er ikke længere en runtime-only error-attribut. Parse-fejlen (rød kant + tooltip) bliver en **afledt** visning af `invalidDrafts`. Range/rule/schema-fejl forbliver runtime-only i `fieldErrors`.
- [undo-redo-contract.md](../../src/contracts/undo-redo-contract.md) §1 + §6: ugyldig draft er nu del af committed-tier persisteret state, ikke runtime-only feltfejl.
- persistence-contract: tilføj `invalidDrafts`-sektionen; definér eksplicit .eo-eksklusion, sessionStorage-adfærd (overlever F5) og rydning ved autoritativ replace (load/reset/migration).
- Følg [contract-topology-procedure.md](../../docs/architecture/contract-topology-procedure.md) hvis en kontrakt om-klassificeres.

### Fase 1 — Schema + store-struktur ✅ GENNEMFØRT (se afvigelser i status-blokken: slice frem for sektion, egen sessionStorage-nøgle, automatisk .eo-eksklusion, ingen version-bump)

- Nyt Zod-schema for `invalidDrafts`: pr. pageKey en `Record<fieldPath, ikke-tom streng>`. Fuldt schema-dækket (kravet i AGENTS.md).
- Integrér i [formPersistenceStore.ts](../../src/stores/formPersistenceStore.ts) som persisteret sektion; følg eksisterende sektion-write/sessionStorage-vej ([persistenceSnapshotStorage.ts](../../src/utils/persistenceSnapshotStorage.ts)).
- Undo/redo-capture snapshotter allerede `fieldErrors` ([undoRedoStore.ts](../../src/stores/undoRedoStore.ts)); pek capture på den nye `invalidDrafts`-sektion i stedet.
- Ekskludér `invalidDrafts` fra `.eo`-data-schemaet ([fileSave.ts](../../src/utils/fileSave.ts), [fileLoad.ts](../../src/utils/fileLoad.ts)).

### Fase 2 — Commit-vej (`useDraftField` + `usePersistedForm`) ✅ GENNEMFØRT

- Tilføj en `onCommitInvalid`-kanal: ved fejlende commit skrives råstreng til `invalidDrafts` via [usePersistedForm.ts](../../src/hooks/usePersistedForm.ts); ved vellykket commit ryddes entryet og `onCommit(value)` kaldes som hidtil.
- Reducér [useDraftField.ts](../../src/hooks/useDraftField.ts) til **én** ekstern kilde: `committedInvalidDraft ?? format(value)`. Fjern `initialInvalidDraft`-seed, `restoreFromHistory`'s error-gren, registry-registreringen og `valueAtInvalidDraftPreserveRef`-grenen.
- Bevar no-live-preview: `invalidDrafts` skrives **kun** ved commit (blur/enter), aldrig i `onChange`.

### Fase 3 — Tabel-input ⬜ UDESTÅR

- [useTableInputCore.ts](../../src/hooks/tableInput/useTableInputCore.ts): cellers ugyldige rå draft skrives til `invalidDrafts` keyet på stabil `rowId+colKey` (rowId er nu deterministisk, jf. row-id-fixes). Detektion bliver state-afledt.
- Fjern `tableInputErrorRegistry` og `useTableInputSaveError`. Den planlagte grid-celle-workaround bortfalder.
- **Implementeringsnote:** Cellen mangler i dag en (pageKey, fuldt-kvalificeret fieldPath)-binding. Den skal trådes ned gennem grid-tabellerne (4 stk.) → `Table*Input` (7 stk.) → `useTableInputCore`, fx via en celle-kanal magen til `useFieldInvalidDraftChannel` (reaktiv læsning + `commitInvalidDraft`/`clearInvalidDraft`). `useTableInputCore`'s save-error-state-maskine (`saveErrorActive`/`setLocalError` + `useTableInputSaveError`) erstattes af kanalen, og `useTableInputHistoryRestore`'s registry-push erstattes af reaktiv `committedInvalidDraft` (samme mønster som almindelige felter). EET-tabellens dropdowns (`StyledDropdown`) bærer allerede `rowId:colIndex` som undo-identitet.

### Fase 4 — Save-gate + routing 🟡 DELVIST (almindelige felter ✅; celle-lokalisering + 30-frame-heuristik afventer Fase 3)

> **Status:** `getFirstBlockingInputErrorTarget` læser nu `invalidDrafts` **og** resterende blokerende `fieldErrors` (jf. korrektionen i status-blokken). `data-mineo-field-path`-lookup er tilføjet i `focusFirstVisibleBlockingInputError` + `focusVisibleBlockingErrorOnCurrentTab` og bruges for almindelige felter. Tabel-registry-fallback (`getFirstBlockingTableInputErrorTarget`) er **bevaret** indtil Fase 3. Den faste 30-frame-løkke i `navigateToBlockingInputError` er **ikke** ændret endnu.

- [useFileSaveLoad.ts](../../src/hooks/useFileSaveLoad.ts): `getFirstBlockingInputErrorTarget` ([saveBlockedFocus.ts:127-150](../../src/utils/saveBlockedFocus.ts#L127-L150)) læser `invalidDrafts`-sektionen (state-afledt) i stedet for fejlcache + tabel-registry. Selve blokeringen er uændret brugeradfærd.
- **Erstat tabel-registrets celle-lokalisering.** Grid-celler bruger ikke `.Mui-error` og fanges ikke af `FOCUSABLE_ERROR_SELECTOR`; i dag lokaliseres de af `getFirstBlockingTableInputErrorTarget()` ([saveBlockedFocus.ts:166-174](../../src/utils/saveBlockedFocus.ts#L166-L174)). Når registret slettes, skal cellen i stedet findes via en stabil `data-mineo-field-path`-attribut på celle-inputtet og en `[data-mineo-field-path="…"]`-DOM-lookup. Dette gælder begge steder registret bruges i dag: `getFirstBlockingInputErrorTarget` (fallback) og `focusVisibleBlockingErrorOnCurrentTab` ("synlig fejl på nuværende fane har forrang", [saveBlockedFocus.ts:192-213](../../src/utils/saveBlockedFocus.ts#L192-L213)).
- **Tilpas fane-routing.** `prepareTabForBlockingError` ([saveBlockedFocus.ts:82-125](../../src/utils/saveBlockedFocus.ts#L82-L125)) ruter på `fieldName`-mønstre (`loenindkomstAnsaettelsesforhold`, `offentligeYdelserRows`, `:loenindkomst`-suffiks, `sygedagpengeFra/Til`). Sørg for at `invalidDrafts`-`fieldPath` enten matcher disse prefikser eller at routing-mappingen opdateres til den nye konvention. Den syntetiske `${af.id}:loenindkomst`-aggregat-fejl udgår — routing sker nu direkte på den blokerende celles `fieldPath`.
- Bevar `navigateToBlockingInputError`-flowet (incl. "synlig på nuværende fane"-forrang). Erstat den faste 30-frame-`waitForAnimationFrame`-heuristik ([saveBlockedFocus.ts:238-244](../../src/utils/saveBlockedFocus.ts#L238-L244)) med en vent-på-mount mod `data-mineo-field-path` efterfulgt af [scrollTargetIntoView.ts](../../src/utils/scrollTargetIntoView.ts). Bemærk: vent-på-mount-efter-fane-skift er iboende og forsvinder ikke; kun den skrøbelige registry/`.Mui-error`-besked-søgning udgår.

### Fase 5 — Fejl-UI afledes ✅ GENNEMFØRT for almindelige felter (tabelceller i Fase 3)

- Rød kant + tooltip for **parse-fejl** afledes af `invalidDrafts` (felt har entry → vis fejl). Range/rule/schema-fejl forbliver i `fieldErrors` (uændret).
- **Implementeringsnote:** `useDraftField` gen-udleder fejlbeskeden ved at parse den rå streng (`parse(normalize(committedInvalidDraft))`), så kun råstrengen persisteres. Fejlen vises kun når draften aktuelt VISER den ugyldige streng (skjules mens brugeren taster en ny værdi) — erstatter det gamle `clearErrorOnDraftChange`.

### Fase 6 — Oprydning ⬜ UDESTÅR (kan først efter Fase 3)

- Slet død kode: `draftHistoryRegistry`, `captureInvalidDraftIfNew`, `tableInputErrorRegistry`, `useTableInputSaveError` og de tilhørende grene i `useDraftField`/`useTableInputCore`.
- Ingen dinglende referencer til de slettede moduler (fanges af typecheck + lint).
- **Note:** `useDraftField`'s registry-gren er allerede fjernet; `initialInvalidDraft`-seed, `restoreFromHistory`-error-gren og `valueAtInvalidDraftPreserveRef` er allerede væk. `draftHistoryRegistry` selv kan dog først slettes, når tabel-cellerne (Fase 3) ikke længere bruger det via `useTableInputHistoryRestore`. Samme gælder registry-fallback i `saveBlockedFocus.getFirstBlockingInputErrorTarget` + `focusFirstVisibleBlockingInputError`.

## Testdækning

> **Status:** Fase 1-2 + 4-5-tests er skrevet og grønne (bl.a. nye `src/__tests__/stores/invalidDraftsSlice.test.ts` og `src/__tests__/utils/invalidDraftsStorage.test.ts`; `useDraftField`-, `useUndoRedo`- og `saveBlockedFocus`-suiterne opdateret/grønne). Fase 3-tests (tabel) udestår. De obsolete invalid-draft-via-`fieldErrors`-undo-tests er omskrevet til den nye `invalidDrafts`-slice.

Princip (jf. [AGENTS.md](../../AGENTS.md): stående ansvar for testdækning; meningsfulde tests på beregning/validering/save-load): tests skrives **per fase i samme ændring som koden**, ikke som en slut-bøtte. Fuld suite (`npx vitest run`) skal være grøn før handoff, da ændringen rører form, persistence, undo/redo og save/load på tværs. Test invarianter, ikke implementeringsdetaljer.

**Regressions-baseline (skal forblive grøn).** Følgende eksisterende suiter er værn mod utilsigtet adfærdsændring og køres når den relevante fase rører deres område: `useDraftField`-resync, `saveBlockedFocus`, undo/redo, persistence/snapshot, `persistenceVersionDrift`, samt de eksisterende tabel-input-suiter. Manglende baseline-suiter identificeres ved implementering.

**Fase 1 — schema + store**
- `invalidDrafts`-schema accepterer `Record<fieldPath, ikke-tom streng>`; afviser tom streng / forkert form.
- Skrivning → sessionStorage; reload (F5) rehydrerer `invalidDrafts`.
- Fingerprint/version-drift: afgør om den nye sektion kræver `PERSISTED_DATA_VERSION`-bump, og opdatér `persistenceVersionDrift`-testen (kun `toJSONSchema({io:'input'})` tæller i fingerprint).
- Autoritativ replace (load/reset/migration) rydder `invalidDrafts` → ingen ghost-drafts.
- Undo/redo-capture inkluderer `invalidDrafts` i framet.

**Fase 2 — commit-vej**
- Fejlende commit skriver rå streng til `invalidDrafts`; committed værdi ændres **ikke** (forbliver sidst gyldige/undefined).
- Vellykket commit rydder entry + sætter committed værdi.
- Tastning/`onChange` skriver **aldrig** til `invalidDrafts` (no-live-preview); Escape/cancel heller ikke.
- Tom draft (`clearTouchedOnEmptyDraft`) rydder entry, blokerer ikke.
- `useDraftField`: ekstern kilde = `committedInvalidDraft ?? format(value)`; fokuseret felt overskrives ikke af ekstern store-ændring (physical-focus-beskyttelse); ingen flicker / silent-rollback.

**Fase 3 — tabel**
- Ugyldig celle-draft overlever navigate-væk-og-tilbage (gl. symptom 2).
- Afledt fejl er ikke-`undefined` fra første render på remount (gl. symptom 3 — intet blink).
- Fuldt kvalificeret `fieldPath`: to tabeller med samme `rowId` kolliderer ikke.

**Fase 4 — save-gate + routing**
- Gate blokerer når `invalidDrafts` ikke er tom; routes til korrekt `fieldPath`.
- **Kritisk skel ([form-contract.md](../../src/contracts/form-contract.md) §4.4):** range/bounds-fejl (`blocksSave:false`) blokerer **ikke** save. Eksplicit test for begge: gyldig dato i forkert interval *gemmes*; uparsbar dato *blokerer*.
- Fane-routing resolver korrekt fane fra `fieldPath` pr. tabel-familie (`loenindkomstAnsaettelsesforhold`, `offentligeYdelserRows`, angivet løn → `eo_oplysninger`, `sygedagpengeFra/Til`).
- "Synlig på nuværende fane"-forrang virker med `data-mineo-field-path`-lookup.
- Guard/completeness-test (jf. guard-selvtest-princip): alle relevante celle-/felt-inputs bærer `data-mineo-field-path`, og testen beviser at en manglende attribut faktisk fanges (vacuous-pass-værn).
- Integration: efter Gem fra en anden fane mountes cellen og scrolles ind i view.

**Fase 5 — fejl-UI**
- Parse-fejl: rød kant + tooltip afledt af `invalidDrafts`.
- Range/rule/schema-fejl uændret (fortsat via `fieldErrors`).

**Tværgående — calc-invarians + round-trip**
- Felt **uden** tidligere gyldig værdi + ugyldig rå draft → behandles som tomt (beløb→0, dato→null).
- Felt **med** tidligere gyldig værdi + efterfølgende ugyldig rå draft → calc bruger fortsat den sidst committede gyldige værdi (ikke tomt), præcis som i dag. Den inkonsistente tilstand kan ikke nå output, fordi beregningstabs og Gem er gated af den blokerende fejl. (Retter den tidligere unøjagtige "behandles som tomt"-formulering.)
- Round-trip: save uden ugyldigt input → load → identisk committed data; `.eo` indeholder aldrig `invalidDrafts`.

## Hvad slettes / hvad består

**Slettes:** `draftHistoryRegistry`, `captureInvalidDraftIfNew`, `tableInputErrorRegistry`, `useTableInputSaveError`, `initialInvalidDraft`-seed + `restoreFromHistory` error-gren + `valueAtInvalidDraftPreserveRef` i `useDraftField`, den planlagte grid-celle-workaround.

> **Status:** Allerede slettet — `initialInvalidDraft`-seed, `restoreFromHistory`-error-gren, `valueAtInvalidDraftPreserveRef` og registry-grenen i `useDraftField`. **Endnu IKKE slettet** (live-brugt af tabel-celler, venter på Fase 3): `draftHistoryRegistry`, `tableInputErrorRegistry`, `useTableInputSaveError`. `captureInvalidDraftIfNew` lever stadig i `useFormFieldErrors` (fyrer ikke længere for almindelige felter; kan bruges af tabel-dynamiske reportere indtil Fase 3).

**Består (fodret af ren state):** Gem-blokeringen, `navigateToBlockingInputError`, `resolveActiveFieldError`, `fieldErrors`-storen til schema/rule/range-fejl, rød kant + tooltip (afledt af `invalidDrafts` for parse-fejl).

## Dækning af den afløste plan

[bevar-ugyldig-tabel-vaerdi-ved-navigation.md](bevar-ugyldig-tabel-vaerdi-ved-navigation.md) løste tre symptomer for ugyldige tabelceller. Verificeret mod [saveBlockedFocus.ts](../../src/utils/saveBlockedFocus.ts):

| Gammelt mål | Opnås | Hvordan |
|-------------|-------|---------|
| Felt tømmes ved fane-skift | Automatisk | Ugyldig draft i persisteret store; remountet celle læser den. |
| Gul boks blinker væk | Automatisk | Fejl afledt af persisteret `invalidDrafts`, ryddes ikke ved unmount; vist fra render 1. |
| Scroller ikke til cellen | Fase 4 (aktivt) | Registry-lokalisering erstattes af `data-mineo-field-path`-lookup + vent-på-mount. |
| Rute til rette fane | Fase 4 (aktivt) | `prepareTabForBlockingError` tilpasses ny `fieldPath`-konvention. |
| Udrul til ALLE grid-tabeller | Automatisk | Ét sted i `useTableInputCore` (vs. gammel plans per-tabel-wiring). |
| Flere ugyldige celler / rydning | Automatisk | Per-felt `invalidDrafts`-entries; gyldig commit rydder. |
| rowId kollisioner pr. tabel | Krav | Fuldt kvalificeret `fieldPath` (sektion+tabel+rowId+colKey). |
| Undo/redo for tabelcelle | Via store-snapshot | Konsistent med almindelige felter; egen test. |

## Risici

- Kerne-risikoen er `useDraftField`-forenklingen: den må ikke genintroducere flicker eller silent-rollback til sidst committede værdi. Afbødet af eksisterende resync-tests + nye round-trip-tests.
- Beregningslaget er uberørt → risikoen holdes væk fra de trust-kritiske tal.
- Bred touch-count på tabel-wiring, men mekanisk gentaget mønster pr. tabel; load-bearing er Fase 1-2 (schema + store + commit-vej).
