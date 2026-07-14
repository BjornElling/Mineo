# Greenfield-design for draft, afsluttet input og commit

**Status:** Målarkitektur + implementeringsplan — **delvist implementeret** (branch `greenfield`; se §0.3 Implementeringsstatus)  
**Dato:** 2026-07-14 (design) · seneste status-opdatering 2026-07-14  
**Scope:** Alle persisterede formularfelter og tabelceller, beregninger, dokument-output, `.eo`-save, `sessionStorage` samt undo/redo

---

## 0. Reviewresultat og trufne beslutninger

Designet er reviewet mod den faktiske kode af to gennemgange (Opus og Codex, 2026-07-14). **Retningen står
fast og er godkendt.** Kerneindsigten — at *afsluttet input* er den eneste autoritative tilstand, og at en
gammel gyldig værdi bag en ugyldig maske kun må nås gennem en fail-closed projektion — rammer rodårsagen.

Reviewet var uenigt på nogle punkter. De uenigheder er nu **afgjort**, og dette afsnit er den bindende kilde.
Faktatjek står i §14.1; regressionsrisici i §14.3; kodereferencer i inline-noterne (`> **📝 Gennemgang:**`).

### 0.1 Trufne beslutninger

1. **Fire selvstændige invariantbrud — ikke én rodårsag.** Fejlen har fire uafhængige årsager, som *alle* skal
   lukkes: (a) omgåelig læsning af canonical sektion, (b) valgfri producent-binding (felter kan rendere ubundet),
   (c) ikke-atomisk finalize/history (to transaktioner + coalescing-markør), (d) dokumenthandlinger uden commit-
   barriere. En projektionsgrænse alene løser kun (a). *(Rettelse af Opus' tidligere "én rodårsag"-formulering.)*

2. **Genbrug eksisterende lag som migrationssubstrat — ikke som slutarkitektur.** `invalidDrafts`-storage +
   `formPersistenceReadModel` genbruges under migrationen (dataene og projektionshalvdelen findes allerede), men den
   nuværende *separate* `invalidDrafts`-slice og den *valgfrie* binding er ikke slutmålet. Slutmålet er **én
   autoritativ, atomisk, obligatorisk bundet aggregate** med en typed projektionsvej, som alle legitime consumers går
   igennem. Quality-værn mod rå canonical-læsning kan først håndhæves, når den vej findes.

3. **Genbrug EO's *ydre* gate-mønster — generalisér ikke EO's domænekode.** Genbrug de tværgående primitiver:
   `DocumentDownloadGateResult`-typen, princippet "samme gate-resultat i UI og service", og service-grænsens
   fail-close. Generalisér **ikke** `collectAllEoRows`/`evaluateEoDocumentDownloadGate` — de er EO-domænekode med
   EO-rækker, snapshot-invarianter, AppSettings og EO-specifik præcedens; generalisering skaber en ny tværdomæne-
   kobling. Indfør i stedet en lille generisk `InputProjection` / `InputScope` / `InputBlocker`-kontrakt *før*
   domænegaten; hvert domæne ejer selv sine dependencies. *(Rettelse af Opus' tidligere "generalisér EO-gaten".)*

4. **Faseinddelt gennemførelse med det fulde greenfield-mål som bindende slutpunkt.** Ikke én monolitisk omskrivning,
   og ikke et lokalt korrekthedsfix efterfulgt af *valgfri* oprydning. Stabil feltidentitet, obligatorisk binding og
   atomisk finalize er **korrekthedsforudsætninger**, ikke kosmetik, og må ikke skubbes til et ubestemt "senere".
   Sekvensen (uddybet i §10) er: **(I)** normativt fundament + stabil feltadresse + obligatorisk binding + atomisk
   finalize i den *eksisterende* motor → **(II)** renteberegning og Satser som komplette vertikale slices (projektion
   + gate + click-preflight) → **(III)** domænevis migration → **(IV)** fjern legacy. Den A/B-opdeling, Opus tidligere
   foreslog, er **forkastet** til fordel for denne. **Brugerens rapporterede fejl (og Satser-tvillingen) er først
   lukket, når hele trin II — inklusive outputprojektion og click-preflight — er gennemført.**

5. **`beregningsdato` ER buggy — for ikke-committbart *format* (ikke for range-fejl).** Verificeret: `beregningsdato`
   blokerer korrekt ved en *parseable men out-of-bounds* dato (range-fejl), men **ikke** ved et *uparseligt* format.
   Årsag: `useStyledFieldAdapter` rapporterer kun `visualErrorMessage` gennem `onFieldError`, og den tvinges til `''`
   præcis når en ikke-committbar draft/parse-fejl er aktiv ([useStyledFieldAdapter.ts:410-422](../../src/hooks/useStyledFieldAdapter.ts#L410-L422)).
   Så `beregningsdatoHasError` forbliver `false` ved uparseligt format → aggregat-download forbliver aktiv. *(Rettelse
   af Opus' tidligere "beregningsdato er ikke buggy".)* Den lokale boolean fjernes uanset som selvstændig sandhedskilde.

6. **Egen version til rejected-input-envelopen — ikke `PERSISTED_DATA_VERSION`-bump.** `PERSISTED_DATA_VERSION`
   versionerer de canonical sagssektioner og må ikke bruges som bekvem cachebuster for feltadresser. Den afsluttede/
   rejected-input-tilstand får **egen version** eller en eksplicit nøglemigration. Stiltiende forkastelse er kun tilladt
   for inkompatibel *recovery*-state efter en dokumenteret vurdering — aldrig for aktuelt synligt ugyldigt input i en
   aktiv, opgraderet session.

7. **Coordinatoren klargør kun editor/persistens — den ejer ikke domænegates.** `CriticalActionCoordinator` udvides
   til at finalisere åben editor + afvente persistens for dokument-handlinger, men hvert dokument leverer selv sin
   typed, revisionsbundne preflight, og servicegrænsen fail-closer på den. Det fælles hjælpe-flow må ikke blive en
   callback-baseret "god function", der skjuler domænescope.

8. **Nye invarianter hører i danske kontrakter — ikke i `CLAUDE.md`.** B7 orphan-invarianten og de øvrige nye
   invarianter skal stå i relevant dansk kontrakt og håndhæves af tests, før de bruges som migrationsværn. Slutkriterium
   for orphan-state: række + alle tilknyttede cellestates slettes i samme transaktion, og en invarianttest beviser, at
   orphan-state er *urepræsenterbar*; først derefter fjernes reconcile-effekterne.

### 0.2 Status

Alle reviewpunkter er konvergeret, og faserækkefølgen (§0.1-punkt 4, §10) er besluttet. Dokumentet er klar som
implementeringsgrundlag. Se §5.4 for den brugervendte sondring mellem *ikke udfyldt* og *ugyldig værdi*.

### 0.3 Implementeringsstatus (branch `greenfield`, opdateret 2026-07-14)

Status pr. fase (§10). ✅ = færdig, 🟡 = delvist, ⬜ = ikke påbegyndt. Commit-hashes er på `greenfield`.

| Fase | Emne | Status | Note |
|---|---|---|---|
| 1 | Normativt fundament (8 kontrakter + reason-taksonomi) | 🟡 | Kernekontrakter opdateret; terminologi og enkelte krydshenvisninger konvergeres fortsat |
| 2 | Typer, `FieldId`, obligatorisk binding | 🟡 | **Binding gennemført** (se §0.3.1); typed `FieldId` + celle-identitets-migration (kolonneindeks) **udestår** |
| 3 | Atomisk `finalizeEdit` i eksisterende motor | 🟡 | Skalarfelter og styrende `setValues`-commits med flere draft-rydninger er atomiske; tabelcellers egen finalize konsolideres i Fase 4 |
| 4 | Fælles feltmotor (nedlæg `useRowDrafts`/`useTableInputCore`-overlap) | ⬜ | Trin III-IV; ikke påbegyndt |
| 5 | Undo/redo på snapshot; fjern coalescing | 🟡 | Forward-commit-atomicitet leveret for skalar-felter; **coalescing-fjernelse blokeret på Fase 4** (celler + direkte-`setValues` bruger den stadig) |
| 6.1 | `InputProjection`/`InputScope`/`InputBlocker`-kerne | ✅ | Ready/blocked-projektion, scoped blockers og branded ready-revision bruges nu i produktion |
| 6.2-6.4 | Projektion/gate/critical-action pr. domæne | 🟡 | Fuldt implementeret i reference-slices renteberegning + Satser; øvrige dokumentdomæner migreres i Fase 8 |
| 7 | Renteberegning som vertikal reference | ✅ | UI, række-/aggregatgates, click-preflight og servicegrænse bruger samme revisionsbundne projektion |
| 8 | Domænevis migration | 🟡 | Satser er komplet migreret; binding-migration er gennemført, mens øvrige dokument-/beregningsentrypoints udestår |
| 9 | Fjern legacy | ⬜ | Trin IV; ikke påbegyndt |

**Brugerens oprindeligt rapporterede fejl og Satser-tvillingen er lukket.** Afsluttet ugyldigt input maskerer straks
den tidligere canonical værdi i visning og outputprojektion. Et dokumentklik finaliserer først en åben editor, bygger
projektionen igen fra seneste state og får en afsluttende revisionskontrol i servicen. Aktuelt verifikationsresultat
skal læses fra den seneste implementerings-handoff, ikke fastholdes som en statisk tæller her.

#### 0.3.1 Leveret siden designet (kronologisk, med afvigelser fra planen)

- **Fase 6.1 — generisk input-integritetskerne** (`183aec3b`): `InputBlocker` (reason/scope/fieldId/label),
  `InputScope` (global/section/row), `InputProjection<T>`, central besked-skabelon, `documentGateFromBlockers` +
  `blockersForScope` (scope-præcis → `DocumentDownloadGateResult`). Genbruger EO's *ydre* gate-mønster; generaliserer
  **ikke** `collectAllEoRows` (§0.1-punkt 3 overholdt).
- **Fase 8 (Satser) + Fase 7 (renteberegning)** (`183aec3b`, `25cf43c5`): reaktiv gating, outputprojektion,
  revisionsbinding, click-preflight og fail-closed servicekontrol er leveret i begge reference-slices.
  `renteInputIntegrity.ts` oversætter sektionens `invalidDrafts` → scoped blockers (beregningsdato=global,
  celler=per-række). `beregningsdato` bundet via rigtig reporter (erstatter den blanke `beregningsdatoHasError`-boolean =
  selve bug'en). `downloadGate.test` vendt fra mock → rigtig provider (§14.3-risiko #2 respekteret).
- **Fase 3 — atomisk `finalizeEdit`** (`a5ef0f17`): ny store-mutation `finalizeEdit` (sektion + `invalidDrafts` i ÉN
  `set()`, ét `committedChangeCounter`-bump; delt ren `computeInvalidDraftsUpdate` med `setInvalidDraft`). `persistData`
  fik en valgfri `clearInvalidDraft`-option → ÉN `runAtomicPersistenceMutation` over begge storage-nøgler + ét
  deterministisk `capture` (fuld case-matrix: værdiændring × draft-eksisterer, inkl. no-op-værdi-med-lingering-draft =
  standalone clear, og ren no-op). Den kanoniske skalar-committer `setFieldValue` auto-udleder `clearInvalidDraft` af
  feltnavnet → **ingen call-sites ændret**. Forward-paritet med den allerede-atomiske restore-sti (§3.4-note).
  **Afvigelse fra §4.4's fulde ambition:** kun skalar-felt-stien er atomisk nu. Tabelceller + direkte-`setValues`-felter +
  immediate-commit-widgets beholder BEVIDST den eksisterende `queueMicrotask`-coalescing, indtil grid-finalize
  konsolideres i Fase 4 — så den kritiske sti ikke kobles til en stor grid-refaktorering (jf. §9-note, §10-bemærkning).
  Derfor er coalescing-fjernelsen (§7.3, Fase 5-punkt 2) endnu ikke sket: maskineriet er stadig load-bearing for de
  ikke-migrerede stier, og fjernelse nu ville give en double-frame-regression.
- **Fase 8 — binding-migration af alle 37 ubundne felter** (`a9f057d4`, `d995d554`, `0eb4fd25`, `ac0d0651`, `0e8f65c7`):
  §4.3's krav om **obligatorisk binding** håndhævet i praksis. En AST-scanning afslørede at **37 af 68 persisterede
  draft-felter i sags-siderne var ubundne** (intet `onFieldError`) — deres ugyldige input levede kun i `useDraftField`s
  lokale `useState`, overlevede ikke F5, blokerede ikke Gem og kunne ikke undo/redo'es. Det var §0.1-punkt 1(b)
  (valgfri producent-binding) bredt udbredt, samme klasse som Satser-bug'en. Alle bundet, fordelt på 5 filer:
  `Aarsloen` (6), `EetOplysningerTab` (2), `IndtaegtFoerSkadenSection` (12), `AnsaettelsesforholdCard` (11),
  `SygeferiegodtgoerelseSection` (5). AST-verificeret bagefter: **0 committende felter uden `onFieldError`** (den
  disablede `storeBededagPct` korrekt udeladt — kan ikke producere en draft).
  - Ny **`useKeyedFieldErrorReporter`** (tynd variant af `useFormFieldErrorReporter` med `DynamicFieldName`) giver
    nested/sammensatte identiteter (`eoLoenudvikling.*`-bar-nøgle; per-AF `${af.id}:<felt>`) den fulde reporter-kontrakt
    uden call-site-casts — nested felter deltager nu i draft-kanalen på linje med top-level. Dette er den strukturelle
    ensartning, ikke endnu en variant.
  - Reconciliation: felter med en eksisterende `error`/`helperText`-domænefejl bevarer den (anden `source`; ekstern fejl
    har visuel forrang pr. `mineo-field-pattern.md`). SFGG-felterne manglede DESUDEN `fieldPath` på deres commit — tilføjet
    samtidig, så invalidDraft-nøglen matcher reporteren.

#### 0.3.2 Væsentligste udeståender

1. **Typed `FieldId` (Fase 2 kerne) + celle-identitets-migration.** Identitet er stadig untyped `string` i tre formater;
   kolonneindeks er bagt ind i den persisterede celle-`invalidDrafts`-nøgle (§4.3, §14.3-risiko #7). At fjerne den kræver
   en sessionStorage-nøglemigration (oversæt, drop ALDRIG synligt input; egen envelope-version) og kobler til Fase 4.
2. **Fase 4** (nedlæg `useRowDrafts`/`useTableInputCore`-overlap) → **derefter Fase 5's coalescing-fjernelse** (§7.3) og
   **Fase 3's fulde atomicitet for tabelceller** (§4.4). Disse tre hænger sammen og er Trin III-IV.
3. **Fase 6.2-6.4 for de øvrige domæner:** `CriticalActionCoordinator` dækker endnu ikke dokument-download (§6.2); de 14
   ikke-EO/TAF dokument-entrypoints går stadig uden om en central preflight.
4. **Arkitekturværn (§11.5):** intet værn håndhæver endnu `onFieldError`-binding på nye persiterede felter. Anbefaling:
   byg det på den AST-baserede quality-harness (`src/__tests__/quality/architecture/`) med en JSX-attribut-query — en
   regex-scanner duer ikke (false positives på arrow-funktion-props). `fieldIdentityGuard.test.ts` dækker i dag `name` +
   undo-identitet, men **ikke** `onFieldError`-bindingen.

---

## 1. Beslutning

Mineo skal have tre klart adskilte tilstande:

1. **Åben draft** — det brugeren er ved at skrive, mens editoren er åben.
2. **Afsluttet input** — den aktuelle værdi efter blur, Enter eller en immediate-commit-handling. Tilstanden er enten gyldig eller ugyldig.
3. **Domæneprojektion** — schema-validerede værdier, som må bruges til beregning, save og dokument-output.

Den afsluttede inputtilstand skal være den autoritative beskrivelse af, hvad feltet aktuelt indeholder. Et afsluttet ugyldigt input må derfor aldrig behandles som den tidligere gyldige værdi.

Den anbefalede kerneinvariant er:

> Når editoren er lukket, skal vist feltværdi, aktuel inputtilstand, gate-status og undo/redo-status beskrive samme brugerhandling.

En tidligere gyldig værdi må gerne bevares internt som recovery-data, men den skal maskeres strukturelt og må ikke kunne nå beregninger, save eller dokument-output, så længe feltets afsluttede tilstand er ugyldig.

## 2. Svar på de overvejede løsninger

### 2.1 Slet ikke den tidligere gyldige værdi ved ugyldigt input

Det anbefales ikke at omsætte et ugyldigt input til `undefined` eller til et tomt felt.

Det ville sammenblande tre forskellige brugerhandlinger:

- brugeren har ryddet feltet med vilje,
- brugeren har indtastet en ugyldig værdi,
- feltet har aldrig været udfyldt.

Det kan give forkerte defaults, forkerte “mangler”-fejl og beregning på en semantik, brugeren ikke har valgt. Den rå ugyldige tekst skal desuden stadig bevares til visning, F5 og undo/redo, så sletning fjerner ikke behovet for en særskilt tilstandsrepræsentation.

### 2.2 Indfør et autoritativt lag for afsluttet input

Dette er den anbefalede løsning, men laget må ikke være en valgfri sidekanal, som hver gate selv kan vælge at læse.

Det skal være den eneste adgangsvej til aktuel brugerinputtilstand. Domænekode må ikke kunne læse en gammel canonical værdi uden samtidig at få at vide, at feltet aktuelt er ugyldigt.

> **📝 Gennemgang:** Verificeret — laget *findes allerede* (`invalidDrafts`-slice i `formPersistenceStore.ts:46-53`
> + projektion som blokerende feltfejl i `formPersistenceReadModel.ts:50-90`). Rodårsagen er præcist, at det er en
> **omgåelig** sidekanal: `RenteberegningTab` bygger download-data direkte fra `committedRentekravById` →
> `computeRentekravRow` ([RenteberegningTab.tsx:114-135](../../src/components/pages/renteberegning/RenteberegningTab.tsx#L114-L135))
> og ser aldrig masken. Den vigtigste, billigste rettelse er derfor at gøre laget **ikke-omgåeligt** (projektions-
> grænse + quality-guard mod rå `getPersistedData`/canonical-selectors i domæne-/gate-kode), ikke at bygge et nyt lag.
> Dette er den centrale reframing — se §0.1-punkt 2.

> **Codex-svar:** Bypass-diagnosen er rigtig, men “laget findes allerede” er for stærkt. De nødvendige data findes
> delvist. Den autoritative, atomiske og obligatorisk bundne abstraktion findes ikke. Quality-værn mod rå læsninger er
> nødvendige, men de kan først være pålidelige, når alle legitime consumers har en typed projektionsvej at gå gennem.

### 2.3 Bevar no-live-preview

Åben draft forbliver lokal UI-state og påvirker ikke beregning eller afledt feedback, mens brugeren skriver. Først når redigeringen afsluttes, bliver den nye tilstand autoritativ.

Et klik på Gem eller en dokument-download er selv en afslutning af redigeringen: den åbne editor skal finaliseres først, hvorefter handlingen vurderes ud fra den nye afsluttede tilstand.

## 3. Nuværende problem

### 3.1 Den semantiske tilstand er delt

Mineo har allerede store dele af et mellemlag i `invalidDrafts`, men tilstanden er fordelt mellem:

- lokale drafts i felter og tabeller,
- schema-validerede sektioner med den seneste gyldige værdi,
- `invalidDrafts` med afsluttet, ikke-committbart input,
- runtime-only `fieldErrors`,
- lokale fejl-booleans i side- og tabelkomponenter,
- domænespecifikke download-gates.

Et ugyldigt commit-forsøg skriver den rå tekst til `invalidDrafts`, men beholder den tidligere gyldige værdi i sektionen. Det er i sig selv acceptabelt som intern lagring. Fejlen opstår, fordi mange consumers læser sektionen direkte og aldrig ser masken i `invalidDrafts`.

### 3.2 Renteberegning kodificerer fejlen

På renteberegning sker følgende:

1. En gyldig dato committes til `RentekravRow`.
2. Datoen erstattes med en ugyldig tekst, og redigeringen afsluttes.
3. Tabelinputtet skriver teksten til `invalidDrafts`, men kalder med rette ikke value-commit.
4. `RenteberegningTab` bygger fortsat `pdfContexts` fra den gamle `committedRentekravById`.
5. Den samlede download-gate modtager ingen information om det afsluttede ugyldige input.
6. Download forbliver mulig fra den gamle `pdfContext`.

Dette er ikke kun en tilfældig race. `Renteberegning.downloadGate.test.tsx` kræver aktuelt udtrykkeligt, at download er aktiv ved en ugyldig dato-draft oven på en tidligere gyldig dato. Testen og den tilhørende kontraktfortolkning låser dermed fejlen fast.

Per-rækkens downloadikon bruger samtidig en lokal fejl-boolean og kan derfor reagere anderledes end “Download samlet oversigt” og “Download alle specifikationer”. Samme brugerinput har således flere konkurrerende gates.

> **📝 Gennemgang — afgjort omfang (verificeret i koden):** Fejlen rammer **både** række-felter (`renterFra`,
> `belob`, `tillaegstid`) **og** det globale `beregningsdato` — men ad to forskellige veje:
> - **Række-felt:** de samlede gates (`evaluateDownloadAllGate` / `evaluateOversigtDownloadGate` i
>   [renteberegningDownloadGate.ts](../../src/domain/renteberegning/renteberegningDownloadGate.ts)) beregnes kun ud fra
>   committed rækker og ser *aldrig* rækkens `renterFraHasError`. En ugyldig `renterFra`-draft blokerer derfor kun
>   per-række-ikonet ([BeregnetRenteTable.tsx:123](../../src/components/tables/BeregnetRenteTable.tsx#L123)) — ikke de samlede downloads.
> - **`beregningsdato`:** blokerer korrekt ved *range*-fejl (parseable, out-of-bounds), men **ikke** ved *uparseligt*
>   format. `beregningsdatoHasError` fodres af `onFieldError`, som kun bærer `visualErrorMessage` — og den tvinges til
>   `''` netop når en ikke-committbar draft/parse-fejl er aktiv ([useStyledFieldAdapter.ts:410-422](../../src/hooks/useStyledFieldAdapter.ts#L410-L422)).
>   Ved uparseligt format forbliver booleanen `false` → begge samlede gates aktive.
>
> Fælles rod: gaten fodres af et signal (`renterFraHasError`/`beregningsdatoHasError`), der *pr. design er blankt*
> præcis når inputtet er ikke-committbart. Det er masken-er-usynlig-for-gaten-rodårsagen i konkret form. Begge lokale
> booleans fjernes som selvstændige output-sandhedskilder (§0.1-punkt 5, Fase 7.4).
>
> **Testpåstanden ovenfor er upræcis.** `downloadGate.test.tsx:113-123` handler om `renterFra`, og den sender den
> ugyldige streng via `draftRows` — men `BeregnetRenteTable` renderer cellen fra `committedById.get(row.id)`, så den
> ugyldige tekst når **aldrig** ind i `invalidDrafts`. Testen beviser altså blot "den samlede gate beregnes fra committed
> input", ikke "en reelt afsluttet ugyldig draft holder knappen aktiv". Der findes **ingen** test for uparseligt
> `beregningsdato`/`renterFra` oven på gyldig. §11.4 og Fase 7.5's plan om at "vende" testen skal skrives som en
> *integrationstest gennem `TableDateInput`/`StyledDateField` → invalidDrafts* (jf. §11.4), ellers vender man en test,
> der ikke tester det påståede.

### 3.3 Problemet er tværgående

Satser-siden har samme strukturelle risiko: et ugyldigt afsluttet årstal gemmes som `invalidDraft`, mens visning og dokument-gate udledes af det tidligere gyldige `values.year`.

Andre dokument-gates, som kun modtager håndplukkede booleans eller canonical sektioner, har samme fejlfamilie, også selv om det konkrete symptom endnu ikke er observeret.

> **📝 Gennemgang — Satser bekræftet, men *værre* end beskrevet:** Feltet hedder `values.aargang` (ikke `values.year`),
> og [Satser.tsx:218-226](../../src/components/pages/Satser.tsx#L218-L226) renderer `StyledYearField` **uden
> `onFieldError`-prop**. Dermed er invalid-draft-kanalen *ubundet*: en afsluttet ugyldig årgang lever kun i
> `useDraftField`s lokale `useState`-fallback ([useInvalidDraftSlot.ts:39-61](../../src/hooks/fieldState/useInvalidDraftSlot.ts#L39-L61))
> — den når **aldrig** `invalidDrafts`-store'en, overlever ikke F5, og er usynlig for read-model + save-gate.
> `resolveSatserPdfGate` læser kun committed `values.aargang`, så download-knappen kan stå aktiv på den gamle årgang.
> Dette er ikke bare "samme familie" — det rammer §4.3's krav (**binding er obligatorisk**) direkte: Satser er et konkret,
> allerede-eksisterende eksempel på et ubundet sagsfelt. Fix af Satser er derfor både en gate-rettelse *og* en binding-rettelse.

> **Codex-svar:** Enig. Dette korrigerer også hovedtekstens feltnavn: det er `aargang`, og den ugyldige råværdi når
> ikke den centrale store i dag. Satser er stærk evidens for, at “gør den eksisterende read-model obligatorisk” ikke er
> nok; selve producentbindingen skal være strukturelt obligatorisk og testbevogtet.

### 3.4 Undo/redo kompenserer for splittet state

Et gyldigt commit efter et ugyldigt input udføres i dag som mindst to writes:

1. skriv den gyldige sektion,
2. ryd `invalidDrafts`.

Undo-laget forsøger at samle dem til ét history-trin med en global `pendingValueCommitFieldPath` og en `queueMicrotask`-baseret markør. Det gør korrektheden afhængig af rækkefølge og timing og er årsagen til, at nye transitioner løbende kræver særrettelser.

Det er desuden kontraktdrift: form-kontrakten forbyder microtask-/timeout-hacks i commit-flowet.

> **📝 Gennemgang — bekræftet præcist:** Forward-committen er **to separate atomiske transaktioner** mod *to forskellige*
> storage-nøgler: `persistData` (sektion + `captureValueCommit`, [FormPersistenceContext.tsx:165-180](../../src/contexts/FormPersistenceContext.tsx#L165-L180))
> efterfulgt af et *separat* `writeInvalidDraft(...,null)` (clear + `captureCoalescing`, [FormPersistenceContext.tsx:234-246](../../src/contexts/FormPersistenceContext.tsx#L234-L246)),
> kaldt fra adapterens `commitValue`-wrapper. De ser kun atomiske ud for undo, fordi et modul-globalt
> `pendingValueCommitFieldPath` + `queueMicrotask`-backstop ([undoRedoStore.ts:95-139](../../src/stores/undoRedoStore.ts#L95-L139))
> kollapser dem til ét frame. Rækkefølgen (value-først-så-clear) er *proceduralt* håndhævet, ikke transaktionelt: hvis
> clear-txn'en fejler efter value-txn'en, rulles value **ikke** tilbage. Bemærk kontrasten: **restore-stien er allerede
> ét atomisk `atomicWritePersistenceSections`** ([useUndoRedo.ts:24-49](../../src/hooks/useUndoRedo.ts#L24-L49)). Målet i §4.4
> er altså at bringe *forward*-stien op på samme atomicitet som restore allerede har — hvilket eliminerer coalescing-markøren helt.

> **Codex-svar:** Enig. Dette er et selvstændigt trust-kritisk problem: hvis value-write lykkes og efterfølgende clear
> fejler, kan UI-kaldet returnere fejl, selv om canonical state allerede er ændret. Atomisk `finalizeEdit` er derfor ikke
> oprydning omkring undo; den lukker en reel mulighed for delvist commit og skal prioriteres tidligt.

### 3.5 Kontrakterne er indbyrdes ude af sync

- `document-output-contract.md` kræver aggregering af blokerende feltfejl, beregningsstatus og output-invariants.
- `formPersistenceReadModel` projicerer allerede `invalidDrafts` som en blokerende feltfejl.
- `renteberegning-contract.md` og rentegaten fortolker “committed-only” som om den afsluttede ugyldige tilstand skal ignoreres.
- `critical-action-contract.md` omfatter ikke dokument-download.

“Committed-only” skal fremover betyde **afsluttet input**, ikke kun “seneste værdi der kunne parses”.

## 4. Målmodel

### 4.1 Begreber

| Begreb | Levetid | Må være ugyldig | Undo/redo | Må bruges til beregning/output |
|---|---:|---:|---:|---:|
| Åben draft | Mens editoren er åben | Ja | Nej | Nej |
| Afsluttet input | Efter finalize | Ja | Ja | Kun gennem projektion |
| Domæneprojektion | Afledt snapshot | Nej | Afledes igen | Ja |

“Commit” bør i den nye kode reserveres til den atomiske persistens-transaktion. Feltets brugerhændelse kaldes `finalizeEdit`, fordi både et gyldigt og et ugyldigt resultat er en vellykket afslutning af redigeringen.

### 4.2 Felttilstand

Den konceptuelle model er en diskrimineret union:

```ts
type SettledFieldState<T> =
  | Readonly<{
      status: 'valid';
      value: T;
      displayValue: string;
    }>
  | Readonly<{
      status: 'invalid';
      raw: string;
      issueCode: FieldInputIssueCode;
    }>;
```

Tom tekst er **ikke** en `invalid`-status. Parseren mapper tom tekst til `valid` med værdi `undefined`. Grunden er, at
"påkrævet" næsten altid er **kontekstafhængigt** (fx "Månedsløn skal udfyldes *når* 'Angivet månedsløn' er valgt"), og
et felt-lokalt parse-kald kender ikke den kontekst. Sondringen mellem *ikke udfyldt* og *ugyldig værdi* afgøres derfor
ikke i feltet, men i den forbrugende projektion/blocker, der kender kravet (§5.4):

- **ugyldig værdi** = ikke-committbar, ikke-tom draft → `SettledFieldState.status: 'invalid'` (rå tekst bevaret);
- **ikke udfyldt** = `valid`/`undefined`, som en *påkrævende* consumer efterspørger → en `missing`-blocker fra projektionen.

En delvis/ufuldstændig indtastning (fx en halv dato `12-05-`) er ikke-tom og behandles som `invalid`, ikke som tom.

Den konkrete store kan internt repræsentere unionen effektivt som:

```ts
type InputSnapshot = Readonly<{
  canonicalSections: FormPersistenceSections;
  rejectedInputs: RejectedInputMap;
  revision: number;
}>;
```

For et givent `FieldId` gælder:

- findes et entry i `rejectedInputs`, er feltets aktuelle tilstand `invalid`, og en eventuel værdi i `canonicalSections` er kun skjult recovery-data;
- findes intet entry, udledes `valid` fra den schema-validerede canonical sektion.

`canonicalSections` og `rejectedInputs` er én privat, atomisk aggregate. Ingen af delene må eksponeres alene til beregnings- eller outputkode.

### 4.3 Stabil feltidentitet

Alle persisterede felter og celler skal have et obligatorisk, typed `FieldId`, som bruges ens til:

- finalize,
- state-opslag,
- fejl og tooltip,
- session-persistence,
- gate-årsager,
- undo/redo-origin,
- fokus-restore.

En tabelcelle identificeres strukturelt med sektion, tabel, eventuelt row-scope, row-id og feltnavn. Kolonneindeks er UI-geometri og må ikke være den persistente datanøgle.

Lokale fallbacks for persisterede sagsfelter skal fjernes. Et sagsfelt må ikke kunne rendere som “ubundet” og dermed kun holde en ugyldig tilstand lokalt.

### 4.4 Én atomisk finalize-transaktion

Alle feltfamilier og tabelceller skal bruge samme kerneoperation:

```ts
finalizeEdit({
  fieldId,
  raw,
  resolution,
  origin,
}): FinalizeResult
```

Feltadapteren parser én gang og leverer et typed resultat. Transaktionen udfører samlet:

- history-capture af før-tilstanden,
- canonical value-opdatering ved gyldigt resultat,
- skrivning eller rydning af rejected input,
- relevante afledte fejlmetadata,
- `sessionStorage`-write,
- én revisionsstigning,
- store-commit.

Ved fejl rulles store, storage og history tilbage til før-tilstanden.

Der må ikke findes separate offentlige operationer som “commit value” efterfulgt af “clear invalid draft”. Coalescing-markører og microtasks bliver dermed overflødige.

## 5. Domæneprojektion og fail-closed-adfærd

### 5.1 Ingen direkte læsning af canonical sektioner

Beregninger, dokument-gates og generator-input må kun opnås gennem en scope-baseret projektion:

```ts
type InputProjection<T> =
  | Readonly<{
      status: 'ready';
      data: T;
      revision: number;
    }>
  | Readonly<{
      status: 'blocked';
      blockers: readonly InputBlocker[];
      revision: number;
    }>;
```

Hvis et relevant felt er `invalid`, må `ready.data` ikke kunne dannes. Den tidligere canonical værdi må ikke være tilgængelig i den blokerede gren.

Det skal håndhæves med modulgrænser og typer, ikke kommentarer. Rå canonical selectors begrænses til input-/persistence-infrastruktur.

### 5.2 Afhængighedsscope

En ugyldig værdi blokerer de consumers, der afhænger af den:

- et ugyldigt felt i en renterække blokerer rækkens beregnede resultat og rækkedokument;
- “Download alle specifikationer” og samlet renteoversigt blokeres, hvis en inkluderet række er ugyldig;
- et globalt felt som beregningsdato blokerer alle renteoutputs, der afhænger af det;
- `.eo`-save blokeres globalt ved ethvert afsluttet ikke-committbart sagsinput.

Uafhængige dele af appen behøver ikke ophøre med at virke, men de må aldrig modtage en maskeret gammel værdi fra et felt, de faktisk afhænger af.

> **📝 Gennemgang — scoping er det svære (her gemmer regressionerne sig):** Den *naive* implementering ("enhver
> invalidDraft i en sektion → hele sektionens projektion er `blocked`") vil **over-blokere**: én ugyldig celle i række 3
> ville slukke per-række-download for de gyldige rækker 1-2. Projektionen skal derfor være **scope-opdelt** — per-række for
> rækkedokumenter, sektions-bred for aggregat-dokumenter.
> **Afgjort løsning (§0.1-punkt 3):** implementér scoping som en lille tværgående `InputScope`/`InputBlocker`-kontrakt,
> hvor en `InputBlocker` bærer sit `FieldId`/row-scope, og hver consumer angiver hvilket scope den afhænger af — så et
> per-række-dokument kun blokeres af *sin egen* rækkes blockers. `collectAllEoRows` genbruges **ikke** som generisk motor
> (det er EO-domænekode med EO-specifik dependency-/suppression-logik); kun *princippet* om scope-bærende blockers genbruges.
> **Skriv begge retningstests:** (a) gyldig række 1 + ugyldig række 2 → række 1's per-række-download *forbliver aktiv*;
> (b) samme tilstand → aggregat-download er *blokeret* af den ugyldige række.

### 5.3 Beregnede visninger

Når et afsluttet felt bliver ugyldigt, må en berørt beregnet værdi ikke fortsætte med at fremstå som det aktuelle resultat. Den skal skifte til den eksisterende ikke-beregnet-/fejltilstand for det pågældende domæne.

Planen ændrer ikke de eksisterende domæneregler for range/bounds-fejl, som allerede har en gyldig canonical værdi. En eventuel ændring af disse reglers beregnings- eller save-semantik kræver særskilt godkendelse.

### 5.4 Brugervendt fejlårsag: *ikke udfyldt* vs. *ugyldig værdi*

Brugervendte fejlmeddelelser (typisk i "Fejl og advarsler"-bokse) skal kunne sondre mellem, at et felt **ikke er
udfyldt**, og at det er udfyldt med en **ugyldig værdi** — fx "Feltet *Årsløn* er ikke udfyldt" vs. "Der er udfyldt en
ugyldig værdi i feltet *Årsløn*". Modellen understøtter dette, når følgende gøres eksplicit (det var under-specificeret
i den tidligere skitse).

**Årsagen skal være maskinlæsbar — ikke gættet fra en besked-streng.** Hver `InputBlocker` bærer en typed årsag og en
stabil feltidentitet:

```ts
type InputBlockerReason =
  | 'missing'   // påkrævet, men feltet er tomt (valid/undefined)
  | 'invalid';  // feltet indeholder en ikke-committbar (ugyldig) værdi

type InputBlocker = Readonly<{
  fieldId: FieldId;          // stabil identitet → opslag af feltets brugervendte navn
  scope: InputScope;         // per-række / sektion / global (§5.2)
  reason: InputBlockerReason;
  detail?: string;           // valgfri domæne-specifik uddybning (fx hvilken betingelse gør feltet påkrævet)
}>;
```

**To producent-veje, én taksonomi (matcher de to eksisterende runtime-kanaler):**

- **`invalid`** produceres, når feltets afsluttede tilstand er `SettledFieldState.status: 'invalid'` (den nuværende
  `invalidDrafts`-vej). Erstatter dagens generiske `Ugyldig værdi: "<rå tekst>"` fra `formPersistenceReadModel`.
- **`missing`** produceres af den påkrævende consumer/domæneprojektion, når et afhængigt felt er `valid`/`undefined`
  (dagens domæne-validator-vej, fx "…er ikke udfyldt" i `erstatningsopgoerelseValidator`/`eetEalCalculation`).

**Beskeden dannes af en central skabelon ud fra `reason` + feltnavn — ikke ad-hoc pr. producent.** Feltnavnet slås op
via `FieldId` (§4.3), så beskeden altid kan navngive feltet (dagens `invalid-draft`-besked kunne ikke, fordi read-modellen
manglede feltidentitet). Skabelonerne skal respektere den eksisterende `error-contract.md`-konvention (brug "ikke
udfyldt/angivet/valgt"; aldrig et bart "<felt> mangler") — den præcise ordlyd pr. kontroltype (tekstfelt vs. dropdown
vs. toggle) er et UI/UX-valg, se §6.4.

**Fejlbokse kategoriserer på `reason`, ikke kun `severity`.** Boks-modellen (i dag `EoRowStatus`/`FormFieldError` med
kun `severity`) udvides, så en `error`-række også kan vise/gruppere efter *manglende* vs. *ugyldig*. Dette er additivt og
bryder ikke `severity`-splittet (error vs. warning).

**Range/bounds-fejl er en tredje, eksisterende kategori** (parseable men uden for interval; har en gyldig canonical værdi).
Den bevarer sin nuværende semantik (§5.3) og hører hverken under `missing` eller `invalid`; den kan om nødvendigt få sin
egen `reason` senere, men det er uden for dette designs scope.

## 6. Dokument-output og andre kritiske handlinger

### 6.1 Én gate-model

Alle dokument-gates skal bygges af tre eksplicitte kilder:

```ts
type DocumentPreflight = Readonly<{
  inputIntegrity: InputProjection<unknown>;
  calculation: CalculationProjection;
  outputInvariants: readonly DocumentBlocker[];
}>;
```

UI-knappen, click-handleren og dokumentservicen skal bruge samme gate-resultat. Lokale booleans som `renterFraHasError` må ikke være selvstændige sandhedskilder for output.

Dokumentservicen må kun modtage en godkendt, revisionsbundet model. Det skal være umuligt at kalde generatoren med en gammel `pdfContext`, hvis inputrevisionen siden er ændret.

### 6.2 Udvid commit-barrieren

`CriticalActionCoordinator` skal udvides med dokument-output som kritisk handling.

> **📝 Gennemgang — omfang bekræftet og kvantificeret:** `CriticalAction` dækker i dag kun
> `'save' | 'load' | 'navigate' | 'undo' | 'redo'` ([criticalActionCoordinator.ts:3](../../src/criticalActions/criticalActionCoordinator.ts#L3))
> — dokument-download er **ikke** med. Der findes **18** `download*Dokument`-entrypoints i
> [documentService.ts](../../src/document/service/documentService.ts), og **ingen** af dem går gennem coordinatoren.
> Kun EO/TAF (4 stk.) har allerede en aggregeret fail-closed gate (`evaluateEoDocumentDownloadGate`); de øvrige 14
> bruger felt-lokale gates eller ingen. Dette er den største enkeltstående migrationsflade i planen — den retfærdiggør
> §0.1-punkt 4's faseopdeling, og at critical-action-integrationen laves som ét delt hjælpe-flow
> (finalisér åben editor → læs snapshot → byg gate) fremfor 18 individuelle tilpasninger (§0.1-punkt 7).

> **Codex-svar:** Enig i én fælles action-orchestrator og i, at migrationsfladen skal inventariseres samlet. Coordinatoren
> kan dog kun klargøre editor/persistens; den kan ikke eje 18 domæners gates. Hvert dokument skal fortsat levere en typed,
> revisionsbundet preflight, og servicegrænsen skal fail-close på den. En fælles helper må ikke blive en callback-baseret
> “god function”, der skjuler domænescope og gør alle dokumenter ens på papiret, men forskellige i praksis.

Forløbet ved klik er:

1. Finalisér en eventuelt åben form- eller grid-editor gennem dens normale finalize-vej.
2. Afvent eventuel tabelpersistens.
3. Læs et nyt `InputSnapshot` og dets revision.
4. Byg domæneprojektion og dokument-gate.
5. Ved blokering: start ingen generator eller fil-I/O.
6. Ved godkendelse: send kun den godkendte projektion til dokumentservicen.

Det lukker også vinduet, hvor en knap endnu ikke har nået at rerendere som deaktiveret efter blur.

### 6.3 Brugeradfærd ved blokering

Efter en afsluttet ugyldig indtastning:

- feltet viser fortsat den ugyldige tekst med rød markering og tooltip;
- relevante downloadknapper er deaktiverede;
- hvis handlingen selv afslutter en åben editor med ugyldigt resultat, startes ingen download, feltet fokuseres, og den eksisterende danske advarsel om ugyldige felter vises;
- der må ikke vises et dokument baseret på den tidligere gyldige værdi.

Den præcise tekst og eventuel justering af fokus-/advarselsoplevelsen skal godkendes som UI/UX, hvis den afviger synligt fra det eksisterende save-flow.

### 6.4 Ordlyd for *ikke udfyldt* / *ugyldig værdi* (UI/UX — godkendt)

Mekanikken (maskinlæsbar `reason` → central skabelon → navngivet felt) er besluttet i §5.4. Ordlyden er godkendt
(2026-07-14) som **kontroltype-tilpasset** for `missing`, og ensartet for `invalid`:

| `reason` | Kontroltype | Skabelon (feltnavn indsat) |
|---|---|---|
| `missing` | Tekst-/talfelt | `Feltet <navn> er ikke udfyldt` |
| `missing` | Dropdown/valg | `<navn> er ikke valgt` |
| `missing` | Til/fra (toggle/radio) | `<navn> er ikke angivet` |
| `invalid` | Alle | `Der er udfyldt en ugyldig værdi i feltet <navn>` |

Dette er foreneligt med den eksisterende `error-contract.md`-konvention ("ikke udfyldt/angivet/valgt"; aldrig bart
"<felt> mangler") og med dens test-guard. Kontroltypen skal derfor være kendt, hvor beskeden dannes — den udledes af
feltets `FieldId`/felt-metadata, ikke af en fri streng. Den præcise skabelon-tekst er endelig; afvigelser kræver ny
UI/UX-godkendelse.

## 7. Undo/redo

### 7.1 History-enhed

Ét `finalizeEdit` giver præcis ét history-trin, uanset transition:

| Før | Bruger afslutter | Efter | Undo |
|---|---|---|---|
| Gyldig A | Ugyldig X | Ugyldig X | Gyldig A |
| Ugyldig X | Ugyldig Y | Ugyldig Y | Ugyldig X |
| Ugyldig X | Gyldig B | Gyldig B | Ugyldig X |
| Gyldig A | Gyldig B | Gyldig B | Gyldig A |
| Ugyldig X | Ryd felt | Gyldig tom/`undefined` | Ugyldig X |

Redo genskaber i alle tilfælde den nøjagtige efter-tilstand, herunder rå ugyldig tekst, fejlstatus, gate-status og fokusmål.

### 7.2 Åben editor

Åben draft indgår fortsat ikke i global history. Escape annullerer den aktuelle redigering tilbage til den afsluttede tilstand, der fandtes ved editoråbning.

Hvis feltet allerede var afsluttet ugyldigt før editoren blev åbnet, skal Escape gendanne denne ugyldige tilstand. Escape må ikke rydde den og vise den tidligere gyldige værdi.

> **📝 Gennemgang — verificér adfærd pr. feltfamilie (ikke ensartet i dag):** Grid-kernen *bevarer* allerede den
> ugyldige draft ved cancel (`preserveInvalidDraft ?? true`, [useTableInputCore.ts:256](../../src/hooks/tableInput/useTableInputCore.ts#L256)),
> så tabelceller er tæt på målet. Form-felterne er ikke ens: kun felter med `escapeRevertsToFormatted` (fx Percent)
> reverterer draften ved Escape; Date/Year gør ikke ([useStyledFieldAdapter.ts:323-329](../../src/hooks/useStyledFieldAdapter.ts#L323-L329)).
> Kravet her (Escape → gendan *settled* tilstand fra editorens start-snapshot, inkl. afsluttet ugyldig) er derfor en
> **adfærdsændring** for nogle familier — ikke blot en testtilføjelse. Verificér hver families Escape-/cancel-sti mod
> start-snapshot-invarianten før migration; antag ikke, at nuværende adfærd allerede er korrekt.

### 7.3 Snapshot

History snapshotter den samlede `InputSnapshot` atomisk. Afledte projektioner, fejl og gates genberegnes efter restore. Kun ikke-afledelig UI-information, fx fokus-origin, gemmes særskilt i history-framet.

Dette fjerner behovet for:

- separat capture af sektion og invalid draft,
- asymmetrisk coalescing,
- microtask-markør,
- særskilte restore-kanaler for ugyldig tekst.

## 8. Persistence og save/load

### 8.1 `sessionStorage`

Den samlede afsluttede inputtilstand skal overleve F5. Gyldige og ugyldige afsluttede inputs skrives atomisk under samme revisionsmodel og valideres med Zod.

Ved korruption skal hydrering være fail-closed og give den eksisterende eksplicitte systemfeedback. En ugyldig recovery-del må ikke få canonical sagsinput til stiltiende at ændre betydning.

**Versionering (§0.1-punkt 6):** Den afsluttede/rejected-input-envelope har sin **egen** version (eller en eksplicit
nøglemigration ved feltadresse-ændringer) og deler ikke `PERSISTED_DATA_VERSION`, som versionerer de canonical
sagssektioner. Et feltadresse-skift (fx kolonneindeks → feltnavn, §4.3) må ikke fremtvinge et `PERSISTED_DATA_VERSION`-
bump. Stiltiende forkastelse af rejected-state er kun tilladt for reelt inkompatibel recovery-state efter en dokumenteret
vurdering — **aldrig** for aktuelt synligt ugyldigt input i en aktiv, opgraderet session (det ville tavst tabe det, brugeren
netop ser). En feltadresse-migration skal derfor oversætte gamle nøgler, ikke droppe dem.

### 8.2 `.eo`

`.eo` indeholder fortsat kun schema-valideret brugerinput. Save-flowet er:

1. finalisér åben editor,
2. kontrollér global input-integritet,
3. kræv en `ready` domæneprojektion for alle sektioner,
4. serialisér projektionen,
5. validér save-snapshot igen med de canonical Zod-schemas,
6. skriv filen.

Et afsluttet ugyldigt input skrives aldrig til `.eo`, og save må ikke fortsætte med en maskeret tidligere værdi.

### 8.3 Load og reset

Load erstatter hele `InputSnapshot` atomisk og starter uden rejected inputs, fordi `.eo` kun indeholder canonical input. Reset og sletning af en side skal fjerne både canonical data og alle feltstates i samme transaktion.

Sletning af en tabelrække skal atomisk fjerne rækken og dens celletilstande. Efterfølgende orphan-reconcile-effekter bør dermed ikke være nødvendige.

## 9. Tabelarkitektur

Gridceller og almindelige formularfelter skal bruge samme finalize-kerne.

For dynamiske tabeller skal ansvaret opdeles sådan:

- cellekernen ejer den åbne celledraft og `finalizeEdit` for cellen;
- rækkeinfrastrukturen ejer add, delete, reorder og eventuel atomisk rækkeoperation;
- domæneprojektionen ejer sammensætning og schema-validering af den canonical række;
- ingen row-hook må holde en konkurrerende, autoritativ kopi af samme celledraft.

Renteberegningens nuværende overlap mellem `useRowDrafts`, `useTableInputCore`, committed rows og `invalidDrafts` skal fjernes i referenceimplementeringen.

> **📝 Gennemgang — overlap bekræftet; konsolidering er bindende slutmål:** Der er to lag i dag: **Lag A** =
> committed-vs-draft *rækker* ([useRowDrafts.ts](../../src/rowDrafts/useRowDrafts.ts)), som ikke har begrebet "ugyldig";
> **Lag B** = per-celle `invalidDrafts` ([useTableInputCore.ts](../../src/hooks/tableInput/useTableInputCore.ts), opt-in
> via `adapter.useSaveError`). Ved ugyldigt blur returnerer `commitAndEmitBlur` `false` *før* den kalder cellens `onBlur`,
> så Lag A's committed forbliver urørt og Lag B's `invalidDraft` skygger for den viste værdi. **Dette er ikke et
> holdbart slutdesign:** `useSaveError` er opt-in, de to lag har forskellige livscyklusser, og korrekt undo afhænger af
> procedural write-rækkefølge — netop de tilbagevendende fejlkilder. Den samlede `finalizeEdit`-kerne (som nedlægger
> overlappet) er derfor et **bindende slutmål**, men den mest indgribende del og hører til migrationens sidste trin
> (§0.1-punkt 4, trin III-IV), *efter* at fundament + vertikale slices er landet — så den kritiske download-fix ikke
> kobles til en stor grid-refaktorering. Regressionsvagt: `useReconcileInvalidDraftsToLiveRows` og B7 orphan-invarianten
> må ikke tabe dækning, når row+celle-sletning gøres atomisk (§8.3). B7-invarianten skal flyttes til en dansk kontrakt +
> test *før* den bruges som migrationsværn (§0.1-punkt 8) — ikke `CLAUDE.md`.

## 10. Implementeringsplan

De ni faser nedenfor realiserer de fire trin i §0.1-punkt 4:
- **Trin I (fundament):** Fase 1 (kontrakter), Fase 2 (typer, `FieldId`, obligatorisk binding), Fase 3 (atomisk
  `finalizeEdit` i den eksisterende motor), Fase 5 (undo/redo på snapshot), Fase 6.1 (`InputProjection` + integritets-
  projektion).
- **Trin II (vertikale reference-slices):** Fase 7 (renteberegning) og starten af Fase 8 (Satser), inkl. Fase 6.2-6.4
  (projektion/gate/critical-action) anvendt på disse to domæner. **Brugerens rapporterede fejl + Satser-tvillingen er
  først lukket ved afslutningen af hele trin II.**
- **Trin III (domænevis migration):** resten af Fase 8 + Fase 4 (fælles feltmotor udbredt til alle familier).
- **Trin IV (fjern legacy):** Fase 9.

Bemærk: Fase 4's nedlæggelse af `useRowDrafts`/`useTableInputCore`-overlappet er den mest indgribende del og hører til
trin III-IV — ikke fordi den er valgfri (den er et bindende slutmål, §9), men fordi den ikke må blokere den kritiske
download-fix i trin II.

### Fase 1 — Normativt fundament

Opdatér først følgende kontrakter, så den nye semantik er bindende før kodeændringer:

- `form-contract.md`
- `persistence-contract.md`
- `error-contract.md`
- `undo-redo-contract.md`
- `critical-action-contract.md`
- `document-output-contract.md`
- `mineo-field-pattern.md`
- `renteberegning-contract.md`

Fjern begrebet “committed rå draft”. Erstat det med “afsluttet ugyldigt input”. Præcisér, at canonical data bag en invalid maske ikke er aktuel domænestate.

Fastlæg i `error-contract.md` den maskinlæsbare fejlårsag-taksonomi (`missing` vs. `invalid`, §5.4) og de centrale
besked-skabeloner (inkl. at feltet altid navngives), forenelig med den eksisterende "ikke udfyldt/angivet/valgt"-konvention.

### Fase 2 — Typer, schemas og identitet

1. Definér Zod-dækkede schemas og schema-afledte typer for rejected input og samlet `InputSnapshot`.
2. Definér ét typed `FieldId`-system for almindelige felter, nested data og tabelceller.
3. Etablér canonical builders for tabelidentiteter; fjern frie string-keys og kolonneindeks som persistent identitet.
4. Gør binding obligatorisk for alle persisterede sagsfelter.

### Fase 3 — Atomisk input-store

1. Indfør én store-operation for `finalizeEdit`.
2. Saml canonical update, rejected-input update, storage-write, revision og history-capture i samme rollback-beskyttede transaktion.
3. Indfør felt- og scope-selectors, som returnerer den diskriminerede afsluttede tilstand.
4. Gør rå canonical sektionslæsning intern for persistence-/inputlaget.

### Fase 4 — Fælles feltmotor

1. Migrér de almindelige Styled-felter til `finalizeEdit`.
2. Migrér `useTableInputCore` og alle tabeladaptere til samme operation.
3. Fjern lokale invalid-draft-fallbacks for sagsinput.
4. Sørg for ens semantik for blur, Enter, paste, immediate clear, dropdown og toggle.
5. Bevar den eksisterende to-trins editoradfærd og no-live-preview.

### Fase 5 — Undo/redo

1. Lad history snapshotte hele `InputSnapshot`.
2. Fjern `captureValueCommit`, `captureCoalescing`, `pendingValueCommitFieldPath` og microtask-reset.
3. Genafled feltfejl og gate-status efter restore.
4. Bevar stabilt fokusmål via `FieldId`.

### Fase 6 — Projektioner og tværgående gates

1. Indfør `InputProjection<T>` og en central input-integritetsprojektion. Blockers bærer typed `reason`
   (`missing`/`invalid`, §5.4) + `fieldId`; en central skabelon danner den navngivne brugervendte besked.
2. Gør beregnings- og dokument-entrypoints afhængige af en `ready` projektion.
3. Udvid critical-action-flowet med dokument-output.
4. Bind outputmodeller til snapshotrevisionen og genkontrollér preflight umiddelbart før generatorstart.
5. Udvid fejlboks-modellen (`EoRowStatus`/`FormFieldError`) additivt med `reason`, så bokse kan gruppere/formulere
   *ikke udfyldt* vs. *ugyldig værdi* uden at bryde det eksisterende `severity`-split.

### Fase 7 — Renteberegning som vertikal reference

1. Migrér beregningsdato og alle renterækkefelter.
2. Lad berørte rækkeberegninger returnere blocked ved afsluttet ugyldigt input.
3. Erstat per-række-, alle- og oversigtsgates med én scope-baseret gatefamilie.
4. Fjern `renterFraHasError` og `beregningsdatoHasError` som selvstændige output-sandhedskilder.
5. Vend den nuværende positive regressionstest, så gyldig dato → ugyldig dato blokerer alle relevante downloads.

### Fase 8 — Domænevis migration

Auditér og migrér samtlige dokument- og beregningsentrypoints. Satser prioriteres umiddelbart efter renteberegning, fordi samme fejlmønster allerede er identificeret dér.

For hvert domæne dokumenteres:

- relevant input-scope,
- blockers,
- beregningsprojektion,
- output-invariants,
- fokusmål for hver brugerrettelig blocker.

Der må ikke være en længerevarende blanding, hvor et migreret felt stadig læses direkte fra gammel canonical state af en ikke-migreret gate. Migrering udføres derfor som komplette vertikale slices pr. domæne.

### Fase 9 — Fjern legacy-mekanismer

Når alle consumers er migreret, fjernes:

- `invalidDrafts` som separat offentlig sidekanal,
- syntetisk error-merge som gate-mekanisme,
- lokale save-/download-fejlbooleans,
- orphan-reconcile-effekter, der kun skyldes separat celle-state,
- konkurrerende row-/cell-drafts,
- direkte domænelæsninger af rå persistence-sektioner.

## 11. Teststrategi

### 11.1 Fælles kontrakttests for alle inputfamilier

Hver persisteret inputfamilie skal bestå samme testmatrix:

- gyldig → gyldig,
- gyldig → ugyldig,
- ugyldig → ugyldig,
- ugyldig → gyldig,
- ugyldig → ryd,
- Escape fra gyldig og ugyldig før-tilstand,
- F5/hydrering,
- reset/load,
- storage-fejl med fuld rollback.

For hver transition hævdes samlet:

- vist tekst,
- settled status,
- canonical projektion eller blocker (inkl. blocker-`reason`: `missing` vs. `invalid`),
- fejlmarkering,
- brugervendt fejlbesked-familie (ikke udfyldt vs. ugyldig værdi, med feltnavn),
- save-gate,
- relevant dokument-gate,
- history-længde.

Sondringstest specifikt: (a) påkrævet felt tomt → `missing`-blocker + "ikke udfyldt"-besked; (b) samme felt med
ikke-committbar tekst → `invalid`-blocker + "ugyldig værdi"-besked; (c) et betinget-påkrævet felt, hvor betingelsen
IKKE er opfyldt → hverken blocker eller besked.

### 11.2 Undo/redo-invarianter

Der tilføjes sekvenstests, ikke kun enkeltstående snapshots:

```text
gyldig A → ugyldig X → undo → redo
ugyldig X → ugyldig Y → undo → redo
ugyldig X → gyldig B → undo → redo
gyldig A → ugyldig X → ryd → undo → undo → redo → redo
```

Hvert trin skal hævde både feltvisning, beregningsstatus og download-gate.

### 11.3 Kritiske handlinger

Integrationstests skal bruge rigtige felter, store og coordinator og dække:

- klik på Gem mens editoren indeholder ugyldig tekst,
- klik på download mens editoren indeholder ugyldig tekst,
- afsluttet ugyldigt input før klik,
- pending tabelpersistens,
- ingen generator-/fil-I/O ved blokering,
- fokus og dansk fejlfeedback,
- revisionsændring mellem UI-render og click-preflight.

### 11.4 Renteberegning

Mindst følgende dækkes for beregningsdato, beløb, renter-fra og tillægstid:

- tidligere gyldig værdi erstattes af ugyldig,
- per-rækkedownload blokeres,
- download alle blokeres,
- samlet oversigt blokeres,
- berørt beregnet output bruger ikke den gamle værdi,
- undo gendanner gammel gyldig værdi og åbner gates igen,
- redo gendanner ugyldig tekst og lukker gates igen.

Den nuværende mockbaserede test, der kun sender en ugyldig `draftRows`-streng uden den reelle finalized-state, erstattes af en integrationstest gennem `TableDateInput`, persistence-provider og input-store.

### 11.5 Arkitekturværn

Tilføj quality tests eller lint-værn for:

- dokument-entrypoints uden central preflight,
- persisterede felter uden `FieldId`-binding,
- beregnings-/dokumentkode, der importerer rå canonical selectors,
- direkte writes til canonical sektion og rejected input uden om `finalizeEdit`,
- history-coalescing via timing.

## 12. Acceptkriterier

Designet er først færdigimplementeret, når alle følgende udsagn er sande:

1. Et afsluttet ugyldigt felt viser altid den ugyldige tekst efter blur, navigation, F5, undo og redo.
2. Ingen beregning eller dokumentmodel kan modtage den tidligere gyldige værdi som aktuel værdi for dette felt.
3. Alle relevante downloads er reaktivt blokeret og har et fail-closed click-preflight.
4. `.eo`-save er blokeret ved ethvert afsluttet ikke-committbart sagsinput.
5. Gyldige og ugyldige afsluttede edits giver begge præcis ét undo-trin.
6. Undo og redo gendanner samme felttekst, fejlstatus, beregningsstatus og gates.
7. Ingen commit-korrekthed afhænger af microtasks, timeouts, render-timing eller write-rækkefølge mellem parallelle stores.
8. Alle persisterede felter og celler er obligatorisk bundet til den centrale inputtilstand.
9. Dokumentknap og dokumentservice kan ikke være uenige om, hvorvidt output må dannes.
10. De normative kontrakter, kode og tests beskriver samme semantik.
11. Brugervendte fejlbokse sondrer maskinlæsbart mellem *ikke udfyldt* og *ugyldig værdi* og navngiver feltet i begge tilfælde.

## 13. Ikke-mål

Designet ændrer ikke:

- beregningsregler,
- dato-/range-politikker,
- brugerens to-trins redigeringsmodel,
- no-live-preview-reglen,
- `.eo`-filformatet ud over eventuelle nødvendige interne versioneringsbeslutninger,
- dokumentlayout eller dokumentindhold.

Der er ikke behov for nye dependencies.

---

## 14. Gennemgang: faktatjek, anbefaling og regressionsrisici (Opus, 2026-07-14)

### 14.1 Faktatjek mod koden

Alle centrale påstande er verificeret mod den aktuelle kode. Resultat:

| Doc-påstand | Status | Kilde |
|---|---|---|
| Renteberegnings download-data bygges kun fra committed rækker | ✅ Bekræftet | `RenteberegningTab.tsx:114-135` |
| Per-række-ikon og samlede gates har forskellige sandhedskilder | ✅ Bekræftet | `BeregnetRenteTable.tsx:123` vs `renteberegningDownloadGate.ts` |
| Testen låser fejlen fast | ⚠️ Upræcist | Testen gælder `renterFra`, finalizer aldrig draften (renderer fra `committedById`) — se §3.2-note |
| `beregningsdato`-draft er også buggy | ✅ Bekræftet (for parse-fejl) | Buggy ved *uparseligt format*, korrekt ved *range-fejl*: `onFieldError` bærer kun `visualErrorMessage`, der tvinges til `''` ved invalid draft — `useStyledFieldAdapter.ts:410-422` |
| Satser har samme fejl | ✅ Bekræftet + værre | Feltet er `values.aargang`, og det er *ubundet* (`Satser.tsx:218-226`) |
| Forward-commit = 2 transaktioner + microtask-coalescing | ✅ Bekræftet | `FormPersistenceContext.tsx:165-246`, `undoRedoStore.ts:95-139` |
| Restore-stien er allerede atomisk | ✅ Bekræftet (doc nævner det ikke) | `useUndoRedo.ts:24-49` |
| Dokument-download går ikke gennem `CriticalActionCoordinator` | ✅ Bekræftet | `criticalActionCoordinator.ts:3` |
| Kolonneindeks bruges som persistent celle-nøgle | ✅ Bekræftet | `cellInvalidDraftScopes.ts:42-44`, `gridCoreUtils.ts:70` |
| `.eo` udelukker invalidDrafts; sessionStorage persisterer dem separat | ✅ Bekræftet | `fileSaveInternals.ts:22-28`, `invalidDraftsStorage.ts` |
| 18 dokument-entrypoints, ingen via coordinator | ✅ Bekræftet | `documentService.ts` |

**Konklusion:** Diagnosen holder, og fejlfladen er nu **bredere** end først antaget: `beregningsdato` er også ramt
(for uparseligt format). Det bekræfter den fælles rodårsag — gaten fodres af signaler, der er blanke præcis når inputtet
er ikke-committbart — og understreger, at *alle* lokale fejl-booleans skal afvikles som selvstændige output-sandhedskilder,
ikke kun række-gaten. Den ene reelle upræcished (den falske regressionstest) er adresseret i §3.2/§11.4.

### 14.2 Anbefaling og faserækkefølge

Disse punkter er nu afgjort og flyttet til **§0.1** (bindende beslutninger) og **§10** (fasernes rækkefælge). Kort:
de fire invariantbrud (§0.1-punkt 1) lukkes gennem fundament → vertikale slices → domænevis migration → legacy-fjernelse
(§0.1-punkt 4), med genbrug af EO's *ydre* gate-mønster men ikke EO's domænekode (§0.1-punkt 3). `SettledFieldState<T>`
og `InputProjection<T>` er de formaliseringer, der bærer invarianten. Brugerens rapporterede fejl er lukket efter trin II.

### 14.3 Regressionsrisici (rangeret)

1. **Over-blokering ved scope-forveksling (høj).** Se §5.2-note. En sektions-bred maske ville slukke gyldige rækkers
   per-række-download. Kræver scope-bærende blockers + eksplicit over-blokerings-test.

   > **Codex-svar:** Enig. Tilføj også den modsatte test: aggregat-download skal være blokeret af den ugyldige række,
   > selv om mindst én anden række er gyldig.
2. **At "vende" en test der ikke tester det påståede (høj).** `downloadGate.test.tsx:113` finalizer aldrig draften.
   Hvis man blot inverterer assert'en uden at gå gennem `TableDateInput`→`invalidDrafts`, får man en grøn test der
   stadig ikke dækker den virkelige sti. Skriv integrationstesten (doc linje 504 har allerede fanget dette).

   > **Codex-svar:** Enig. Den gamle test kan eventuelt bevares som en ren committed-only unit-test, men den må ikke
   > bære regressionens navn eller bruges som bevis for finalized-invalid-adfærd.
3. **B7 orphan-datatab-regression (middel).** Atomisk row+celle-sletning (§8.3) skal bevare dækningen fra
   `useReconcileInvalidDraftsToLiveRows`/`useTableCellErrorTracker`; ellers kan forældreløse celle-invalidDrafts igen
   blive spøgelses-Gem-mål. Behold guard + test indtil reconcile-effekterne beviseligt er overflødige.

   > **Codex-svar:** Enig i risiko og overgang. Slutkriteriet er stærkere: række og alle tilknyttede cellestates slettes
   > i samme transaktion, og en invarianttest beviser, at orphan-state er urepræsenterbar. Først derefter fjernes reconcile.
4. **No-live-preview-lækage (middel).** Når beregning/gate nu reagerer på *afsluttet* ugyldig tilstand, må den åbne
   draft stadig ikke lække ind i calc. Projektionen skal læse settled state, ikke open draft. Test eksplicit.

   > **Codex-svar:** Enig. Der skal testes både typing uden blur og klik på download, hvor klikket selv finaliserer
   > editoren; de to situationer skal bevidst have forskellig gate-timing.
5. **Escape gendanner canonical i stedet for ugyldig (middel).** §7.2's krav (Escape → tilbage til afsluttet ugyldig
   før editoråbning) skal verificeres mod nuværende Escape-adfærd; det er præcis den slags "ryd-til-gammel-gyldig",
   der allerede har givet bugs (jf. [Effektiv invalid-draft = én kilde]).

   > **Afgjort (verificeret):** Adfærden er *ikke* ensartet i dag. Grid-kernen bevarer allerede den ugyldige draft ved
   > cancel (`preserveInvalidDraft ?? true`, `useTableInputCore.ts:256`), mens form-felternes Escape kun reverterer for
   > `escapeRevertsToFormatted`-felter (Percent) — Date/Year gør ikke (`useStyledFieldAdapter.ts:323-329`). Kravet er en
   > **adfærdsrettelse** for de familier, der ikke restorer settled state fra editorens start-snapshot; verificér hver
   > familie før migration (se §7.2-note).
6. **Word/docx + standalone minProcesrente (middel).** Gaten skal sidde *over* format-valget (`documentFormat.ts`),
   så både PDF og Word blokeres ens. minProcesrente er en separat offentlig app — verificér at gate-ændringer ikke
   ændrer dens (bevidst anderledes) flow.

   > **Codex-svar:** Enig. Inputintegritet er kanalneutral. Standalone-varianten skal bruge samme finalize/preflight-kerne,
   > men dens mobil-tilladte UI og routerløse navigation må fortsat være variantlokal.
7. **sessionStorage-nøgleskift ved FieldId-migration (middel — ikke lav).** invalidDrafts-nøgler indeholder kolonneindeks
   i dag. Skift til feltnavn-baserede nøgler må **ikke** løses ved at bumpe `PERSISTED_DATA_VERSION` og lade version-gaten
   droppe gamle drafts — det ville tavst tabe aktuelt synligt ugyldigt input i en aktiv session (§0.1-punkt 6). Løsning:
   rejected-input-envelopen får egen version, og feltadresse-skiftet implementeres som en **eksplicit nøglemigration**
   (oversæt gamle nøgler → nye), ikke en forkastelse. Test hydrering af en gammel envelope *med* bevaret ugyldigt input.

### 14.4 Afgørelse af de tidligere åbne spørgsmål

De tre spørgsmål, reviewet efterlod åbne, er nu afgjort (fuld begrundelse i §0.1):

- **Faserækkefølge:** fasedelt gennemførelse med det fulde greenfield-mål som bindende slutpunkt — ikke én monolit,
  ikke et lokalt fix efterfulgt af valgfri oprydning (§0.1-punkt 4, §10). Den eneste tilbageværende beslutning til dig er,
  om denne rækkefølge passer din arbejdsgang.
- **EO-genbrug:** genbrug de tværgående document-gate-primitiver og "samme gate i UI og service"; behold EO-aggregator/
  EO-gate domænespecifikke; indfør en lille generisk inputprojektion før domænegaten (§0.1-punkt 3).
- **`beregningsdato`:** afklaret ved kodeinspektion — buggy for uparseligt format, korrekt for range-fejl; den lokale
  boolean fjernes som selvstændig sandhedskilde uanset (§0.1-punkt 5). En integrationstest fastlåser den nye adfærd.
