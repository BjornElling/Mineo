# Greenfield-review — Mineo

Dette er en prioriteret kandidatliste til et *greenfield re-design* af Mineo. Hvor
`code-review-plan.md` er en systematisk gennemgang, der retter og konsoliderer det
eksisterende punkt for punkt, stiller denne plan ét andet spørgsmål for hver del af
programmet:

> Hvis jeg skulle kode denne del helt forfra i dag — med alt hvad jeg nu ved om,
> hvordan programmet faktisk hænger sammen — hvordan ville jeg så have indrettet
> arkitekturen, og hvor stor en forbedring ville det give?

Kandidaterne er de steder, hvor arkitekturen er vokset organisk, og hvor et
gennemtænkt re-design ville give en markant forbedring. Hver anbefaling er
kalibreret mod programmets eksisterende "røde tråd", så et re-design trækker
strukturen mod større ensartethed — ikke mod endnu en parallel løsning.

`AGENTS.md` fastlægger mandat og godkendelsesgrænser. Ved konflikt gælder
`src/contracts/*.md` over denne plan. Alt der berører UI/UX med synlig betydning
eller beregningslogik forelægges, før det ændres.

## Central instruktion til mig selv (læs først)

Dette er ikke en passiv observationsliste. **Jeg har det fulde ansvar for at
implementere ændringerne** og for at føre hver kandidat helt i mål — ikke blot at
beskrive den. Mit ansvar er at sikre, at kandidaterne faktisk opnår **det bedst
mulige slutprodukt**, og at foretage **alle** de rettelser af programmet, der kræves
for at nå dertil.

- **Omfang er ingen hindring.** Jeg gennemfører de nødvendige ændringer, også store,
  arkitektoniske og **breaking** ændringer. Bagudkompatibilitet er ikke et hensyn
  (jf. `AGENTS.md`); jeg river ned og bygger om, når det giver et bedre slutprodukt,
  frem for at lappe på en svag struktur. Jeg vælger den rigtige løsning, ikke den
  mindst indgribende.
- **Jeg ejer den bedste udgave, ikke bare planens bogstav.** Viser en kandidat sig
  ved implementering at være forkert skåret, for snæver eller kun en delmængde af det
  reelle problem, retter og udvider jeg planen og løser det underliggende problem —
  jeg implementerer ikke en ringere løsning, blot fordi den stod skrevet her.
- **Opportunistiske forbedringer undervejs er en pligt, ikke en mulighed.** Falder
  jeg over fejl, datatab-risici, kontraktdrift, død kode, parallelle helpers eller
  oplagte kandidater uden for det aktuelle scope, tager jeg ansvar for at rette dem
  (eller registrere dem eksplicit, hvis de hører til et senere spor) — også fejl jeg
  ikke selv har introduceret. Jeg efterlader hver berørt del bedre, end jeg fandt
  den, inkl. manglende testdækning.
- **Kvalitet, tillid og korrekthed går forud for at blive hurtigt færdig.** Hver
  keystone laves som et testtungt spor med relevant golden-value-/transition-net
  **før** første ændring; refaktoreringer af beregning beviser tal-identitet; og
  intet efterlades i en halvfærdig, inkonsistent mellemtilstand.
- **Hold planen løbende opdateret.** Når en kandidat gennemføres — eller viser sig
  at skulle skæres om undervejs — markerer jeg den straks her: `✅`-status i fase-
  tabellen + en kort **Status**-linje i detalje-afsnittet. Planen skal altid
  afspejle den faktiske tilstand.

**Godkendelsesgrænsen står ved magt:** UI/UX med synlig betydning og al
beregningslogik forelægges som konkrete brugeroplevelser, før den ændres — men det
begrænser kun *hvornår jeg spørger*, ikke *hvor gennemgribende jeg må omlægge* alt
det øvrige.

## Metode

Kandidaterne er fundet ved en parallel, fan-out-baseret gennemgang af fem
delsystemer (EO-domænetriaden, UI-sider/viewmodels, dokument-output,
input-infrastruktur/utils, samt persistence/schemas/config/data). Hovedtråden har
ejet den endelige vurdering, kalibreret scoringen på tværs af områder og samlet
fundene til én rangorden. Scoringen afspejler hovedtrådens samlede vurdering, ikke
et enkelt delsystems isolerede syn.

En efterfølgende greenfield-audit af hele programmet (2026-07-10) har suppleret
listen med kandidater #37–#52. Den gennemgang blev delt i tre uafhængige spor
(domæne/dokumenter, UI/input samt persistence/shell/tooling) og derefter
overlap-valideret i hovedtråden mod #1–#36 og de normative kontrakter. Lokale
oprydninger, hypotetiske udvidelsespunkter og fund der allerede var dækket, er
frasorteret.

## Vurderingskriterier

Hver kandidat er stadig vurderet på tre **ligestillede** kriterier (1–5 ★). De
bruges nu som *planlægnings-signal* inden for hver fase — hvor meget test-net og
godkendelse en opgave kræver — ikke som sorterings-nøgle:

| Kriterie | 1 ★ | 5 ★★★★★ |
|---|---|---|
| **Forbedring** — hvor stor en forbedring opnås | marginal / kosmetisk | fjerner en central arkitektur-svaghed |
| **Lethed** — hvor let er ændringen at lave | pervasiv, rører alt | lokal, mekanisk |
| **Sikkerhed** — hvor ufarligt er det | rører trust-kritisk beregning/save uden net | isoleret, ingen adfærdsrisiko |

## Byggerækkefølge (indefra-og-ud)

Den tidligere udgave rangordnede efter summen af de tre stjerner. Det er en dårlig
*rækkefølge*: ligestillet vægtning belønner trivielle-men-sikre opgaver og begraver
de centrale byggekloder midt i tabellen. For en trust-kritisk kodebase er den
rigtige rækkefølge **indefra-og-ud** — byg kernen først, og lad de ydre lag falde ud
af den:

1. **Kanoniske primitiver & fundament** — delte byggekloder, runtime-opstart og
   verifikationsnet som keystones og konsumenter sidder på. De er afgrænsede, men
   trust-kritiske primitiver/opstartsændringer laves som egne testspor.
2. **Spine-keystones** — de store centrale omlægninger, hver placeret oven på fase
   1-primitiverne. Rører beregning, output, UI eller save/load → **relevant
   golden-/transition-net og nødvendig godkendelse FØR** første ændring.
3. **Projektioner & konsolideringer** — den kode der *kollapser*, når spinen findes
   (præsentation bliver tynde projektorer).
4. **UI-dekomponering** — det yderste lag; konsumerer alt det indre.
5. **Uafhængige oprydninger** — gated af intet. Interleaves som fyld, når en keystone
   afventer brugerens godkendelse.

I tabellerne er **ID** det stabile kandidat-id (matcher detalje-afsnittene nedenfor),
og **Sekv** er den anbefalede udførelses-rækkefølge. Krydsreferencer som "#23" i
teksten peger på de stabile id'er, ikke på sekvensen.

> **Hvorfor ikke bare "de store byggekloder allerførst"?** Spine-keystonene
> (#23, #24, #25, #36, #40, #41, #42, #51) er de største byggekloder, men også de mest
> risikable. De rører beregning, output, UI eller save/load og kræver derfor et
> målrettet karakteriseringsnet og — hvor mandatgrænsen rammes — forudgående
> godkendelse. Fase 1 bygger primitiverne og sikkerhedsnettet først.

### Fase 1 — Kanoniske primitiver & fundament

Delte byggekloder og verifikationsfundament. Bygges først, så fase 2 har noget at
stå på. #37/#49 kræver godkendelse og tal-golden-net; #38 kræver kanal- og
samtidighedsnet; #39 kræver state-/hydration-karakterisering.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 1 | 47 | ✅ Ét verificeret release-artefakt | ★★★★★ | ★★★★☆ | ★★★★★ | fundament for alle senere spor |
| 2 | 48 | ✅ AST-baseret arkitekturgrænse-harness | ★★★★☆ | ★★★☆☆ | ★★★★★ | styrker alle kontraktændringer |
| 3 | 49 | ✅ Neutral måneds-/intervalalgebra | ★★★★☆ | ★★★★☆ | ★★★☆☆ | før #36 |
| 4 | 37 | ✅ Branded `MoneyOre` + lukket pengealgebra | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætning for #36 |
| 5 | 39 | ✅ Persistence initialiseres før React-render | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | før #19, #28, #33 |
| 6 | 17 | ✅ Kanonisk dag-set-modul | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | muliggør #23, #36 |
| 7 | 15 | ✅ `TableSpec` (udred `documentTableRenderer`) | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | muliggør #24 |
| 8 | 11 | ✅ `defineDocument`-generator-factory | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør #24 |
| 9 | 38 | ✅ Eksplicit dokument-genereringssession | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | muliggør #24; beslægtet #11 |
| 10 | 12 | ✅ Felt-fejl-seam + `numericFieldConfig` + `mergeSx` | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør #25, #7 |
| 11 | 19 | ✅ Generisk keyed-slice store-factory | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | muliggør #28 |
| 12 | 33 | Atomisk mutations-primitiv | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | muliggør #28, #41 |
| 13 | 13 | `meta.schemaFingerprint` → `persistedDataVersion` | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør #42 |
| 14 | 9 | `DocumentDownloadButton`-konsolidering | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør fase 4 |
| 15 | 8 | `PageTabs` + `SideTab`-komponenter | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør fase 4 |

### Fase 2 — Spine-keystones (karakteriseringsnet + godkendelse FØRST)

De store centrale byggekloder. Hver laves som et separat, testtungt spor. Brug
golden-values til tal/output og en eksplicit transitionsmatrix til persistence- og
workflow-spor. Forelæg før første ændring, når UI/UX eller beregningslogik berøres.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 16 | 23 | Regulering → kanonisk forløb | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #17 |
| 17 | 24 | Deklarativt dokument-IR (blok-model) | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #15, #11, #38 |
| 18 | 25 | Samlet felt-state-kerne | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #12 |
| 19 | 42 | Versionsbåret schema-evolution for `.eo` | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | forudsætter #13 |
| 20 | 40 | Eksplicit critical-action-/commit-barriere | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #25 |
| 21 | 41 | Save/load som typed use-case + tilstandsmaskine | ★★★★★ | ★★☆☆☆ | ★☆☆☆☆ | forudsætter #33, #40, #42 |
| 22 | 51 | Typed beregningsdatakatalog + provenance | ★★★★☆ | ★★☆☆☆ | ★☆☆☆☆ | selvstændig data-keystone |
| 23 | 36 | EET på kanonisk `MoneyOre`/canonical-spine | ★★★★☆ | ★☆☆☆☆ | ★☆☆☆☆ | forudsætter #17, #37, #49; spejler #23 |

### Fase 3 — Projektioner & konsolideringer

Den kode der kollapser til tynde lag, når spinen findes.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 24 | 16 | Split `reguleringsPresentation` + `sygeferiegodtgoerelse` | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | reg-del forudsætter #23; SFGG-del uafhængig |
| 25 | 31 | PDF/Word-paritet som struktur | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #24 |
| 26 | 32 | EO-sektion-funktioner → `Block[]` | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #24 |
| 27 | 50 | TAF-graf → ren scene-model + Canvas-renderer | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | beslægtet #24 |
| 28 | 27 | Samlet række-persistering-kerne | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | beslægtet #25 |
| 29 | 45 | Deklarativt editable `GridSpec` | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #25, #27 |
| 30 | 28 | Kollaps persistence læse-sti-lagstak | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | forudsætter #19, #33, #39 |
| 31 | 30 | Konsolider validerings-ejerskab | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | beslægtet #20 |
| 32 | 20 | eoInspektion regex-row-id → struktureret metadata | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | uafhængig |

### Fase 4 — UI-dekomponering

Det yderste lag. #43 etablerer app-shellens stabile grænse; #5 etablerer
side-mønstret; #26 (højeste lokale keyboard-risiko) laves sidst.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 33 | 43 | Kanonisk page-manifest + persistent app-shell | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #40; før øvrig UI-dekomponering |
| 34 | 5 | Ensartet viewmodel-mønster (meta + guard) | ★★★★★ | ★★★☆☆ | ★★★☆☆ | paraply for resten |
| 35 | 44 | Feature-slicede EO-viewmodels | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | forudsætter #5; før #1, #22 |
| 36 | 1 | `AnsaettelsesforholdCard` → sektioner | ★★★★☆ | ★★★★☆ | ★★★★☆ | forudsætter #44 |
| 37 | 6 | `Aarsloen.tsx` → VM + sektioner | ★★★★★ | ★★★☆☆ | ★★★☆☆ | forudsætter #5, #9 |
| 38 | 18 | `EetDifferencekravTab` + delt forlig-editor | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | forudsætter #5 |
| 39 | 10 | `Forsoergertab.tsx` → sektioner + VM | ★★★☆☆ | ★★★★☆ | ★★★★☆ | forudsætter #5 |
| 40 | 21 | `Indstillinger.tsx` → deklarativt register | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | del af #5-familien |
| 41 | 22 | `IndtaegtFoerSkadenSection` → under-sektioner | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | forudsætter #44 |
| 42 | 7 | Headless `StyledDropdown` | ★★★★☆ | ★★★★☆ | ★★★☆☆ | forudsætter `mergeSx` (#12) |
| 43 | 26 | `Container.tsx` → headless keyboard-nav-hook | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | højeste UI-risiko; sidst |

### Fase 5 — Uafhængige oprydninger

Gated af intet. Kør når som helst — især som fyld, mens en keystone afventer
godkendelse. Ordnet efter værdi.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 44 | 2 | `documentService` → deklarativt download-register | ★★★★☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 45 | 3 | `fileHandleStorage` → IndexedDB-kv-primitiv | ★★★★☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 46 | 46 | Variant-ejede styles og build-assets | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | uafhængig; synlig QA/godkendelse |
| 47 | 29 | `dateRanges.ts` split + read-time `TODAY` | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | uafhængig |
| 48 | 4 | `utils/` residual parallel-helper-oprydning | ★★☆☆☆ | ★★★★★ | ★★★★★ | uafhængig |
| 49 | 14 | Fjern dupleret `sanitizeFilenamePart` i reports | ★☆☆☆☆ | ★★★★★ | ★★★★★ | uafhængig |
| 50 | 35 | Carry-forward series-opslag | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | uafhængig |
| 51 | 52 | Normative kontrakter: invariant-kerne vs. implementeringskort | ★★★★☆ | ★★★☆☆ | ★★★★☆ | uafhængig |

---

## Kandidatdetaljer

Afsnittene er ordnet efter stabilt kandidat-**ID** (ikke sekvens — se
byggerækkefølgen ovenfor). Hver kandidat angiver scope, den organiske vækst-fejl,
greenfield-visionen, hvordan den følger den røde tråd, samt afhængigheder.

### 1 — AnsaettelsesforholdCard → `sections/`-dekomponering · 12

- **Scope:** `src/components/pages/erstatningsopgoerelse/loenindkomst/AnsaettelsesforholdCard.tsx` (1119 — største fil i `components/`).
- **Problem:** Forbruger korrekt `useLoenindkomstVm()`, men destrukturerer 40+ VM-felter og renderer ét monolitisk kort (identitet, overenskomst, satser, løntabel, lønudvikling, SFGG). VM-laget findes; view'et blev aldrig splittet som `eoOplysninger/sections/`.
- **Greenfield:** Spejl `eoOplysninger/sections/`-dekomponeringen i `loenindkomst/sections/` (`OverenskomstSection`, `SatserSection`, `LoentabelSection`, `LoenudviklingSection`; `SygeferiegodtgoerelseSection` findes). Kortet bliver ~80 linjers komposition.
- **Rød tråd:** Er den etablerede VM + `sections/` + `useXxxVm()`-model — afslutter et arbejde der allerede er halvvejs.
- **Afhængigheder:** Ingen; VM/kontekst er på plads.

### 2 — `documentService` → deklarativt download-register · 12

- **Scope:** `src/document/service/documentService.ts` (935), `documentLoader.ts` (77).
- **Problem:** ~17 næsten-identiske `downloadXxxDokument`-funktioner (25-35 linjer hver, kun modulnavn/fejltekst/params varierer). Fejltekst forfattes PDF-først og string-erstattes (`/PDF/g`). Dev-server-detektion (~180 linjer dev-only) ligger i produktions-download-stien. `documentLoader` har 18 håndskrevne wrappers + en parallel 18-entry-map.
- **Greenfield:** Ét register `Record<DocumentKind, { load, buildParams, gate?, errorLabel }>` + én generisk `downloadDocument(kind, input)`. Format-neutrale fejl-labels (ingen string-kirurgi). Flyt dev-server-guard til separat preflight-hook. `documentLoader` kollapser til map alene.
- **Rød tråd:** Konsolidering over udvidelsespunkter; format-neutralitet renere.
- **Afhængigheder:** Uafhængig; god pilot der ikke rører layout.

### 3 — `fileHandleStorage` → generisk IndexedDB-kv-primitiv · 12

- **Scope:** `src/utils/fileHandleStorage.ts` (732).
- **Problem:** 10 eksporterede funktioner åbner hver DB'en, starter transaction og hånd-wrapper en enkelt `get/put/delete` i `new Promise` med dupleret `onsuccess/onerror/oncomplete/close` + `typeof indexedDB`-guard. Fire urelaterede concerns (fil-handle, default-dir, dir-metadata, pending PWA-open) deler ét store med ad hoc-nøgler.
- **Greenfield:** ~30-linjers typet `idbGet<T>/idbPut/idbDelete`-primitiv → de 10 funktioner bliver one-liners (~150-200 LOC total). Split i `fileHandleKvStore.ts` + `fileHandleVerification.ts`. Fire concerns som typede nøgler ét sted.
- **Rød tråd:** Én kanonisk storage-primitiv frem for 10 parallelle wrappers.
- **Afhængigheder:** Ingen; device-lokal cache, degraderer allerede til `null`/`false`.

### 4 — `utils/` residual parallel-helper-oprydning · 12

- **Scope:** `utils/amountInputUtils.ts` (paste-normalisering) vs `utils/inputPasteNormalization.ts`; ad hoc element-lokatorer i `utils/scrollToEoRow.ts:35-65`; mikro-moduler (`dateOrderValidation.ts`, `numberComparison.ts`, `percentInputUtils.ts`).
- **Problem:** To amount-paste-normalisatorer i hver sit hjem; DOM-lokatorer genopfundet i scroll-helperen; enkelt-symbol-moduler øger navigations-omkostning. **NB:** `utils/` er ellers allerede stærkt konsolideret (scroll-lag, kanonisk dag-iteration, rounding, dansk tal-parsing) — dette er oprydning, ikke re-design.
- **Greenfield:** Fold amount-paste ind i `inputPasteNormalization`; udtræk delt `findElementByFieldPath`/`findElementByRowId` brugt af både scroll og undo/redo-restore; merge enkelt-symbol-moduler ind i domæne-naboer.
- **Rød tråd:** Ét hjem per concern.
- **Afhængigheder:** Ingen; rene relokationer af testede funktioner.

### 5 — Ensartet viewmodel-mønster på alle sider (meta) · 11

- **Scope:** Hele `pages/`-træet. Har VM: EO Oplysninger/Beregning, Loenindkomst. Mangler: `Aarsloen`, `Forsoergertab`, `Indstillinger`, `EetDifferencekravTab`, `MenberegningTab`, `OffentligeYdelserTab`, `Satser`, `Renteberegning`.
- **Problem:** Tre uforenelige svar på "hvor bor afledt state + handlers": VM+kontekst, snapshot-funktion, eller alt inline. En vedligeholder kan ikke forudsige hvor logik bor.
- **Greenfield:** Én kanonisk form per persisteret fagside: `useXxxViewModel(form)` + `XxxVmProvider`/`useXxxVm()` + side reduceret til sektions-komposition. `compute*`-snapshot bevares som beregningskerne. Guard: enhver `pages/*.tsx` over ~250 LOC skal delegere til en VM.
- **Rød tråd:** Håndhæver `page-component-contract`s tiltænkte mål overalt.
- **Afhængigheder:** Paraply over #6, #10, #18, #21; #1/#22 er samme families view-split.

### 6 — `Aarsloen.tsx` → VM + sektioner · 11

- **Scope:** `src/components/pages/Aarsloen.tsx` (798).
- **Problem:** Største non-VM-side. Ejer 3 hooks, `setField`-factory, memoized `fieldHandlers`, inline `renderPdfDownloadIcon` med egne shake-keyframes, og en ~470-linjers render hvis "Beregning"-sektion er en dybt nested `metode A/B/C × loenperiode`-stige med dupleret JSX. A/B/C-labels bygges inline med template-literals.
- **Greenfield:** `useAarsloenViewModel` ejer hooks/handlers/gates og eksponerer `beregningsLinjer: BeregningLinje[]`; render bliver `.map` over prækomputerede linjer + sektions-komponenter. Erstat download-ikon med delt `DocumentDownloadButton` (#9).
- **Rød tråd:** Del af #5; præsentations-labels ud af JSX ned i VM.
- **Afhængigheder:** #5 (mønster), #9 (download-knap).

### 7 — Headless `StyledDropdown` + delt `mergeSx` · 11

- **Scope:** `src/components/inputs/StyledDropdown.tsx` (857), `inputs/table/TableDropdown.tsx`, `dropdownInteractionCore.ts` (59).
- **Problem:** ~115 linjer mekanisk `sx`-merge-boilerplate (hånd-skrevet 5 gange; ren version findes allerede i `StandardGridTable.tsx:51-57`). ~75-linjers inline `onKeyDown` med typeahead/Escape dobbelt-implementeret. Genopfinder combobox-fokus/close/typeahead uden at dele felt-familiens kontrakt (via `role="combobox"`-undtagelse frem for delt kontrakt).
- **Greenfield:** (a) headless `useDropdown` på `dropdownInteractionCore`, (b) lille præsentations-shell, (c) delt `mergeSx`-helper overalt. `StyledDropdown` + `TableDropdown` bliver to shells over én kerne, i keyboard-navigation-kontrakten frem for en undtagelse.
- **Rød tråd:** Én kerne, to shells (som resten af felt-familien).
- **Afhængigheder:** Ingen; isoleret til dropdown-familien.

### 8 — Delt fane-scaffolding + `SideTab`-komponent · 11

- **Scope:** Identisk `<Tabs>`-scaffold i `Erstatningsopgoerelse.tsx`, `Erhvervsevnetab.tsx`, `VarigeMen.tsx`, `Renteberegning.tsx`; roteret 90° `side-tab`-blok dupleret i `Erstatningsopgoerelse.tsx` (×2) og `Stamdata.tsx`.
- **Problem:** Hver fane-side re-implementerer samme absolut-positionerede `<Tabs>`-header med samme `sx` + `handleTabChange`/`isAllowedTab`-guard. Kontrakt §10.2 kræver eksplicit fælles abstraktionspunkt hvis stylingen skal være identisk — den er identisk ved copy-paste.
- **Greenfield:** Delt `<PageTabs items={[{key,label}]} activeTab onChange/>` (indkapsler positionering + sx + guard) og `<SideTab label active onClick/>`. Centraliserer også `usePersistedActiveTab`-wiringen.
- **Rød tråd:** Opfylder kontrakt §10.2's krav om fælles abstraktion.
- **Afhængigheder:** Ingen; præsentationel.

### 9 — `DocumentDownloadButton`-konsolidering · 11

- **Scope:** Kanonisk `inputs/DocumentDownloadButton.tsx` (51); inline hånd-rullet 32×32-download-`Box` med egne shake-keyframes dupleret i 10 filer (`Aarsloen`, `Satser`, `MenberegningTab`, `EOberegningTab`, `EOKontrolTabel`, `IndtaegtFoerSkadenSection`, `RenteberegningTab`, `AnsaettelsesforholdCard`, `BeregnetRenteTable`, m.fl.).
- **Problem:** To parallelle implementeringer af samme affordance. De inline-versioner mangler den format-bevidste tooltip/aria-label ("Download som PDF/Word") som kontrakt §11.1 kræver → også en a11y/kontrakt-mangel, ikke kun duplikering.
- **Greenfield:** Slet alle inline download-`Box` + `renderPdfDownloadIcon`; rut alt via `DocumentDownloadButton` (udvid med `variant` hvis en inline-form reelt behøves). Eksplicit mandat i kontrakt §11.2.
- **Rød tråd:** Ét download-affordance-mønster; lukker a11y-hul.
- **Afhængigheder:** Bør ske sammen med/ før #6.

### 10 — `Forsoergertab.tsx` → sektioner + VM · 11

- **Scope:** `src/components/pages/Forsoergertab.tsx` (632); beregning allerede i `computeForsoergertabSnapshot`.
- **Problem:** Beregning er ren (godt), men præsentationen er ~500 uafbrudte linjer `row--label-right-hover`-blokke + en inline `StandardLooseTable` med hånd-skrevet `colgroup`/`TableHead`/`TableBody` + 6 inline `useFormFieldErrorReporter`.
- **Greenfield:** `useForsoergertabViewModel` (reportere, download, snapshot-memo) + sektions-komponenter (`ForsoergertabBeregningSection`, `EalKravSection`, `AslYdelserSection`; løs tabel → lille `AslLoebendeYdelserTable`).
- **Rød tråd:** Del af #5; snapshot bevares som kerne.
- **Afhængigheder:** #5.

### 11 — `defineDocument`-generator-skelet-factory · 11

- **Status: ✅ Gennemført (2026-07-11).** `defineDocument<Input>` ejer nu den faste,
  kanal-neutrale generator-lifecycle (writer/metadata → valgfrit vandmærke og brevhoved →
  valgfri titel → body → footer → filnavn → save), og samtlige 18 generator-entrypoints er
  migreret — også EO/TAF-særtilfældene og deres tidlige returgrene. Det kommende blok-IR
  (#24) foregribes ikke: `body` skriver fortsat mod det gældende `DocumentWriter`-API.
  De statiske one-line-filnavnsbuildere er fjernet; `resolveDocumentArtifactFileName`
  resolver nu `.pdf`/`.docx` direkte fra den aktive genereringssession, og Word-writerens
  skjulte `.pdf`→`.docx`-omskrivning er fjernet. Den endelige eksplicitte sessions-/artefakt-
  grænse hører fortsat til #38. Lifecycle-, formatfilnavns-, PDF-/Word-indholds- og
  generator-golden-tests bevarer outputadfærden.

- **Scope:** `varigeMenDocument.ts`, `kapitaliseringDocument.ts`, `eetEfterEalDocument.ts`, `satserDocument.ts`, `renteDocument.ts`, `shDageDocument.ts`, `forsoergertabDocument.ts` m.fl.; delt `documentGeneratorSetup.ts` (106).
- **Problem:** Fælles preamble er fanget, men hver generator gentager samme ydre skelet verbatim (`initStandardDocumentWriter → brevhoved → title → sektioner → footer → save`). Filnavn-buildere er one-liner-duplikater; `resolveDocumentArtifactFileName` hardkoder `'pdf'` før formatet kendes, hvorefter Word-writeren omskriver extension i `save` — filnavn/format-ejerskab splittet over tre filer.
- **Greenfield:** `defineDocument({ title, filenameBase, brevhoved, body: (model) => Block[] })`-factory ejer skelettet. Filnavne resolves ét sted af download-laget med det reelle format.
- **Rød tråd:** Konsolidering; forbereder #24 (label-value-generatorer er allerede næsten deklarative).
- **Afhængigheder:** Kan wrappe eksisterende generatorer før #24; delvis pilot for IR'et.

### 12 — Delt visual/range-fejl-seam for `Styled*Field` · 11

- **Status: ✅ Gennemført (2026-07-11).** `useStyledFieldAdapter` ejer nu den kanoniske
  `getVisualError(value)`-seam og rapporterer committed range/bounds-fejl som
  `blocksSave:false`, også efter load/remount og bounds-ændringer. Dato og heltal er reduceret til
  rene committed-projektorer uden parallel range-state/rapportering; procent følger samme kontrakt,
  så schema-gyldige værdier uden for UI-interval committes og markeres uden at blokere Gem.
  `numericFieldConfig` samler finite/order/fortegns-valideringen for de fem form-/tabelfelter, og
  `mergeSx` bevarer MUI's object/callback/array-kontrakt i hele `Styled*Field`-familien samt
  `StyledDropdown` og de berørte numeriske tabelfelter. Målrettet net: 8 filer/67 tests; fuld suite,
  source/test-typecheck og lint grønne.
- **Scope:** `StyledIntegerField.tsx:205-292`, `StyledDateField.tsx:140-341`, `StyledPercentField.tsx:214-246`, `StyledAmountField.tsx`; kontrast: `tableInputAdapter.ts:76-87` (`getCommittedVisualError`).
- **Problem:** "Commit tilladt, men uden for UI-range → ikke-blokerende `blocksSave:false`-fejl" er re-implementeret per form-felt (state + `useEffect` + `onFieldError`), inkonsistent: Percent folder range ind i `parse` → hard block, en anden UX end Integer/Date. Config-validering (`"Ugyldig konfiguration: minValue er større end maxValue"`) er verbatim-dupleret i 5 filer.
- **Greenfield:** Tilføj `getVisualError(value)`-seam til `useStyledFieldAdapter` (spejler tabel-adapterens seam). Udtræk numerisk config-validering til delt `numericFieldConfig.ts`. Ensret Percent med Integer/Date.
- **Rød tråd:** Bringer form-felterne til tabel-cellens allerede-løste seam.
- **Afhængigheder:** Beslægtet med #25 (samme felt-familie).

### 13 — `meta.schemaFingerprint` → `persistedDataVersion` rename · 11

- **Scope:** `formPersistenceStore.ts` (felt 27, assert 179-199, ~10 write-sites), `config/persistenceVersion.ts`, `utils/schemaFingerprint.ts`.
- **Problem:** Feltet `meta.schemaFingerprint` holder ikke et fingerprint — det holder `PERSISTED_DATA_VERSION`-strengen, beskyttet af to lange advarsels-kommentarer ("dette er IKKE et beregnet fingerprint"). Den faktiske `computeSchemaFingerprint` er test-only. ~10 mutationer re-stempler feltet.
- **Greenfield:** Omdøb feltet til `persistedDataVersion`, så guarden bliver en åbenlys versions-guard og kommentarerne forsvinder. Bevar `PERSISTED_DATA_VERSION` (runtime-guard) vs. computed fingerprint (CI-drift-gate)-opdelingen. Centralisér stempling i `resolveMeta`.
- **Rød tråd:** Fjerner navne-ar; ét versions-koncept.
- **Afhængigheder:** Ingen; TS håndhæver rename-fuldstændighed.

### 14 — Fjern dupleret `sanitizeFilenamePart` i reports · 11

- **Scope:** `src/components/reports/ContentBoxReportDialog.tsx:32-37`.
- **Problem:** Bug-rapport-dialogen re-implementerer `sanitizeFilenamePart` lokalt — en kopi af den kanoniske i `documentFileName.ts` (re-eksporteret via `documentFormatUtils.ts:16`). To sandheder for filnavn-sanitering.
- **Greenfield:** Importér den kanoniske; slet den lokale kopi. Hele ændringen.
- **Rød tråd:** Ét sted for filnavn-sanitering.
- **Afhængigheder:** Ingen. Ren quick win (lav forbedring, men triviel og sikker).

### 15 — `TableSpec` — udred `documentTableRenderer` · 10

- **Status: ✅ Gennemført (2026-07-10).** Fundamentet + alle konsumenter er migreret og bevist **byte-identisk** af golden-value-net på begge kanaler: `src/__tests__/document/tableChannelParity.golden.test.ts` (+ `tableGoldenCapture.ts`) for de 9 standalone-generatorer, og det nye `src/__tests__/document/eoSectionTableParity.golden.test.ts` for EO-dokumentets ctx-baserede bilag-sektioner (fuldt EO-dokument renderet i begge kanaler). Byggekloderne: (a) ren, unit-testet `resolveColumnWidths.ts` (tekstmåling injiceret; `documentTableRenderer` delegerer), (b) `tableSpec.ts` med `TableSpec`-værditypen + `compileTableSpecToLegacyParams` + `renderTableSpec` (absorberer `resolveDocumentSectionEndY` i sin `{endY}`-retur) + `buildSummedTotalRowSpec`/`buildFormattedTotalRowSpec`. **Alle 9 standalone-generatorer** (klLoenaftaler, KRL, forsørgertab, regulering, renteoversigt, løbende ydelser, årsløn, SH-dage, rente) **OG alle ctx-baserede EO-sektioner** (`loenindkomstSection`, `offentligeYdelserSection` + `renderMidlertidigtEetSection`, `shDageSection`, `eoBilagSections`' inline SFGG-periode- + regulering-af-offentlige-ydelser-tabeller, `reguleringSection`) migreret. Compiler-kapabiliteter valideret: flex/fixed/min/auto/grow-bredder, summeret/formateret total, underline, universel total-række-rydning, muted rows, valign, fast **og dynamisk** `rightInset` (sidstnævnte gren først kørt ved reguleringSection-migreringen: Beregnet regulering med Indeksberegning som grow-kolonne + dynamisk skaleret højre-inset). Afvigelser ensartet efter forelæggelse: rentes talkolonne-justering (PDF/Word) + total-rækkens parités-afhængige stribe-baggrund (standalone); og — godkendt 2026-07-10 — EO-bilagenes total-rækker (`SH-dage i alt`, SFGG `I alt`) bringes under den samme universelle total-række-rydning (aldrig stribe-baggrund, ingen cellekant), så de ser identiske ud med standalone-dokumenternes. Per-sektion-tests opdateret (justering flyttet fra `columnStyles.halign` til celler); døde celle-builder-exports (`cellLeft`/`cellRight`/`cellCenter`) fjernet; `docs/architecture/document-output-architecture.md` §7 opdateret til TableSpec-laget. `renderDocumentTable` er nu primært compilerens/Word-broens interne renderer.
- **Scope:** `src/document/layout/documentTableRenderer.ts` (1006), `documentTableBridge.ts` (56); `getDoc()` + `renderDocumentTable` + `resolveDocumentSectionEndY`-dansen i ~15 generatorer.
- **Problem:** Nominelt i det format-neutrale lag, men importerer `jspdf-autotable`; ~900 linjer er ren PDF (adaptiv kolonne-redistribution, symbol-keyed layout, underline via `didDrawCell`). Word er én early-return-branch der rekonstruerer alignment fra et **separat** beregnet map → canonical-vs-presentation-drift. `finalY`-returværdien er meningsløs på Word, men hver generator udfører `resolveDocumentSectionEndY`-ritualet.
- **Greenfield:** En `TableSpec`-værditype (rows, per-kolonne-intent fixed/flex/grow + align, total-descriptors) uden render-viden. Kolonne-bredde bliver en ren, unit-testet funktion. Hver renderer forbruger `TableSpec` nativt → alignment defineres én gang, begge kanaler læser samme felt.
- **Rød tråd:** Format-neutralt lag bliver faktisk format-neutralt; bygbar bag eksisterende `renderDocumentTable`-signatur, tabel-for-tabel.
- **Afhængigheder:** Delmængde af #24; mest tilgængelige høj-forbedrings-dokument-kandidat. Rører tal → kræver bredde/afrundings-tests.

### 16 — Split `reguleringsPresentation` + `sygeferiegodtgoerelse` · 10

- **Scope:** `engines/reguleringsPresentation.ts` (1726; to funktioner på 537 og 670 LOC), `engines/sygeferiegodtgoerelse.ts` (1395; `computeSygeferiegodtgoerelse` alene 364 LOC).
- **Problem:** To organisk-voksede monolitter der hver ejer ren beregning, penge-afrunding, display-streng-samling og orkestrering. `sygeferiegodtgoerelse.ts` importeres af validator, snapshot og row-builders uden internt seam mellem "ren SFGG-matematik" og "SFGG-præsentation".
- **Greenfield:** Split langs eksisterende funktions-grænser: `sfggReferencesats.ts` / `sfggPeriodisering.ts` / `sfggEngine.ts` (tynd orkestrator) / `sfggWarnings.ts` (validator-vendt). Præsentationstekst bliver i `helpers/sygeferiegodtgoerelseTexts.ts`. `reguleringsPresentation.ts` foldes ind i #23.
- **Rød tråd:** SFGG har allerede `Calculable`/`MoneyOre`-disciplin; split udnytter det.
- **Afhængigheder:** Regulerings-delen forudsætter/overlapper #23.

### 17 — Kanonisk dag-set-algebra · 10

- **Status: ✅ Gennemført (2026-07-09).** Duplikeret `buildSHDageSet` i kontrol-laget slettet; den range-baserede ferie-builder flyttet til motoren som `buildFerieDageSetForPeriode`, nu en tynd komposition over `buildFerieDageSet` + `placeLoseFeriedage` (parallel kopi elimineret). `eoInspektion` forbruger read-only. Byte-identitet bevist i `tafDaySets.equivalence.test.ts`. Rest: den fulde dag-set-algebra bor stadig i `engines/tafDaySets.ts` (ikke flyttet til `domain/dates/`) — bevidst, filnavnet kan omdøbes senere hvis ønsket.
- **Scope:** `engines/tafDaySets.ts` (`buildFerieDageSet`, `buildShDageSet`), `eoInspektion/eoInspektionRegulationCore.ts:545-624` (**anden** `buildFerieDageSet`/`buildSHDageSet`), `dates/shDageBeregning.ts` (den faktiske primitiv).
- **Problem:** To `buildFerieDageSet` med divergerende signaturer og næsten-identisk logik, plus tre SH-dag-set-indgange om én primitiv. Kontrol-laget (`eoInspektion`) **ejer og eksporterer** dag-set-buildere som sammentælling forbruger — dvs. beregningslogik er lækket ind i det nominelt nedstrøms inspektions-lag, i strid med "kontrol importerer engine, aldrig omvendt".
- **Greenfield:** Ét kanonisk kalenderdag-modul i `engines/` (eller `domain/dates/`) der ejer alle SH/ferie/arbejdsdag/TAF-dag-sæt med én signatur-familie → `ReadonlySet<ISODateString>`. `eoInspektion` forbruger read-only. Gør tre-lag-splittet ærligt.
- **Rød tråd:** Genopretter lag-grænsen; bygger på `iterateDatesInclusive`/`shDageBeregning`.
- **Afhængigheder:** Ingen hård; forbedrer #20/#23's lag-klarhed.

### 18 — `EetDifferencekravTab` + delt forlig-editor · 10

- **Scope:** `src/components/pages/erhvervsevnetab/EetDifferencekravTab.tsx` (891).
- **Problem:** EET bruger snapshot-mønstret, men tab'en bærer to store modul-niveau-subkomponenter inline + 8 commit-handlers + dupleret bilag-toggle-logik + fuld "forlig om ansvarsgrad"-wiring der er en nær-verbatim kopi af logik i `EOOplysningerTab` (samme `useForligAnsvarsgradValidation`) — samme problem løst to steder.
- **Greenfield:** `useEetDifferencekravViewModel` ejer bilag-handlers/download-gate/forlig-wiring; udtræk delt `ForligAnsvarsgradSection` brugt af både EO Oplysninger og denne tab (allerede dokumenteret delt domæne, `domain-boundary-contract §10`). Box-subkomponenter → `erhvervsevnetab/sections/`.
- **Rød tråd:** Del af #5 + fjerner reel EO/EET-duplikering.
- **Afhængigheder:** Forlig skriver til `erstatningsopgoerelse`-sektionen fra EET; bevar den delte kilde-semantik nøjagtigt.

### 19 — Generisk keyed-slice store-factory · 10

- **Status: ✅ Gennemført (2026-07-11).** De tre strukturelt identiske slices
  (`sections`/`fieldErrors`/`invalidDrafts`) deler nu én `createKeyedSectionSlice<TCache>()`-factory,
  instantieret pr. concern. De seks tom-cache-/initial-revisions-konstruktorer er kollapset til én
  `buildSectionKeyedMap`-builder, og de seks increment-varianter til ét delt par
  (`incrementSectionKeyedRevision`/`incrementAllSectionKeyedRevisions`) — de bevarede navne holder
  store-body'ens call-sites uændrede, så adfærden er byte-identisk (bevist af det eksisterende
  revision-/epoch-/atomicitets-net i `formPersistenceStore.api.test.ts`). De tre revision-map-typer er
  aliaser af én kanonisk `SectionKeyedRevisions`. Den fjerde parallelle tom-cache-kopi i
  `invalidDraftsStorage.ts` deler nu den eksporterede `createEmptyInvalidDraftsCache`. Nyt
  `formPersistenceStore.keyedSlices.test.ts` pinner key-coverage, nul-start, per-key-objekt-isolation og
  at store/storage-konstruktørerne er samme kilde. Cross-slice atomiske actions (#33) og læse-sti-kollaps
  (#28) er bevidst ikke rørt her.

- **Scope:** `src/stores/formPersistenceStore.ts:118-249, 300-565`.
- **Problem:** Tre-fire strukturelt identiske slices (`sections`, `fieldErrors`, `invalidDrafts` + revisions) med hver sin kopi af fem helpers (create-empty, initial-revisions, increment-one/all, coverage-assert). En fjerde empty-cache-konstruktor dupleret i `invalidDraftsStorage.ts`. Kommentar erkender "fire næsten-identiske kopier".
- **Greenfield:** Generisk `createKeyedSectionSlice<TValue>()` → `{ empty, revisions, incrementOne, incrementAll, assertCoverage, restore }`, instantieret 3 gange. Store komponerer disse + få cross-slice atomiske actions. ~250 LOC kollapser; drift bliver strukturelt umulig.
- **Rød tråd:** Én factory frem for parallelle slices.
- **Afhængigheder:** Del af den samlede store-oprydning med #28 + #33. Trust-kritisk state → adfærd byte-identisk (revision/epoch-orden).

### 20 — eoInspektion regex-row-id → struktureret metadata · 10

- **Scope:** `eoInspektion/eoInspektionPageViewModel.ts` (302), `eoRowNavigationMap.ts`, `buildEo*Rows.ts`.
- **Problem:** Page-viewmodel rekonstruerer domænestruktur ved regex-parsing af row-ids (`getSfggEmploymentId`, `getRegulationEmploymentId`) og `parseSfggTable` splitter tabeller ud af `displayValue`-strenge på `|`/`\n`. Skjult streng-kontrakt: at omdøbe et id-mønster bryder gruppering uden type-fejl.
- **Greenfield:** Tilføj eksplicit struktureret metadata til `EoRowModel` (`employmentId?`, `section`, strukturerede table-payloads). Viewmodel grupperer på typede felter; `parseSfggTable` forsvinder (arch-doc §16.B foreslår allerede dette).
- **Rød tråd:** Struktureret data frem for streng-round-trip; display-only.
- **Afhængigheder:** Additiv metadata; regex-parsere slettes sidst. Rører ikke gate/beregning.

### 21 — `Indstillinger.tsx` → deklarativt settings-register · 10

- **Scope:** `src/components/pages/Indstillinger.tsx` (628).
- **Problem:** ~20 nær-identiske `row--label-right-hover`-blokke, hver hånd-wirer en kontrol til `updateSettings({...})` med inline type-guard og bespoke closure. Directory-picker-side-effekt blandet ind. En statisk form beskrevet imperativt 20 gange.
- **Greenfield:** Deklarativt settings-register: `SettingsRow` drevet af descriptor (`{ label, control, key, options, guard }`) grupperet i sektioner. Directory-picker → `useDefaultDirectorySetting()`. 628 linjer → data-tabel + lille renderer; ny indstilling = én descriptor.
- **Rød tråd:** Deklarativt frem for imperativt gentaget; device-lokale settings (ikke `.eo`).
- **Afhængigheder:** Del af #5-familien; kræver lille typet control-descriptor-abstraktion.

### 22 — `IndtaegtFoerSkadenSection` → under-sektioner · 10

- **Scope:** `eoOplysninger/sections/IndtaegtFoerSkadenSection.tsx` (791 — største fil i den ellers eksemplariske `sections/`-mappe).
- **Problem:** Selve reference-dekomponeringens største sektion er selv en god-komponent (større end de fleste hele sider): samler indkomst-før-skade-input, løntrin-finder-trigger og lønudviklings-håndtering.
- **Greenfield:** Split i `sections/indtaegtFoerSkaden/`-undersektioner med samme `useEoOplysningerVm()`-mønster mappen allerede bruger. Afslutter det arbejde mappen startede.
- **Rød tråd:** Samme etablerede kontekst-mønster; ren JSX-split.
- **Afhængigheder:** Ingen.

### 23 — Keystone: Regulering → kanonisk forløb · 9

- **Scope:** `engines/reguleringsPresentation.ts` (1726), `eoInspektion/eoInspektionRegulationCore.ts` (966), R1-strategi-registret `engines/regulering/` + `forms/*`.
- **Problem:** R1 konvergerede *beregnings*-stien (registret `FORM_REGISTRY`), men de to *præsentations*-stier adopterede det aldrig: både `reguleringsPresentation` og `eoInspektionRegulationCore` re-deriverer per-form-serier direkte (`buildStatistikIndexEntries`, `buildKrlIndexEntries`, `buildKlLoenaftalerIndexEntries`) med `forloeb`-fallback. Per-form-regulerings-viden findes i **tre** parallelle steder. Arch-doc flagger det selv som uafklaret gæld (§8, §16.A).
- **Greenfield:** Udvid R1 til endestationen: hver `ReguleringForm` udsender ét kanonisk, præsentations-klart `forloeb` (segmenter + display-rows + formel-komponenter + coverage) som **eneste** output. De to præsentationsfiler kollapser til tynde projektorer. Slet `buildXIndexEntries`-fallbacken.
- **Rød tråd:** "Kanonisk beregnet én gang, projiceret mange gange" — snapshot-first-princippet, som EO-kernen ellers følger.
- **Afhængigheder:** Opløser regulerings-delen af #16; forudsætning for at #15/#24 kan rendere regulering rent. Trust-kritisk kerne → golden-value-net (`reguleringSilentPathAlignment.test.ts` m.fl.) før arbejde.

### 24 — Keystone: Deklarativt dokument-IR · 9

- **Scope:** `document/writer/documentWriter.ts` (kontrakt), `pdf/infrastructure/pdfWriter.ts` (953), `docx/infrastructure/docxWriter.ts` (760), alle ~18 generatorer.
- **Problem:** `DocumentWriter` er en imperativ PDF-cursor (`getY/setY/ensureSpace/advanceY`) — i Word er hver af disse no-ops. `getDoc()` er en "ærlig union" der indrømmer at kanalen lækker; `getPageWidth()` returnerer mm på PDF, twips på Word; `getTextWidth` divergerer. Paritet holdes af hånd-synkede kodestier + kommentarer, ikke af struktur.
- **Greenfield:** Vend retningen om: generatorer udsender en **deklarativ blok/flow-model** (Title, Section, LabelValueRow, Table, Signature, PageBreak…) uden Y-koordinater. To rene renderere (`PdfRenderer`, `DocxRenderer`) forbruger modellen; paginering bliver internt PDF-anliggende. Paritet bliver strukturel (begge går samme træ).
- **Rød tråd:** Bevarer ét `DocumentRenderer`-interface, men routet via den eksplicitte session fra #38; blok-modellen *er* snapshot→dokument-kontrakten, så canonical ikke kan drifte fra presentation.
- **Afhængigheder:** Keystone — forudsætter #15, #11 og #38; opløser #31 og #32. Højeste risiko/laveste lethed i dokument-laget; pilot på label-value-generatorerne (#11) først.

### 25 — Keystone: Samlet felt-state-kerne · 9

- **Scope:** `hooks/useDraftField.ts` (320) + `useStyledFieldAdapter.ts` (416) vs `hooks/tableInput/useTableInputCore.ts` (663); parallelle kanaler `useFieldInvalidDraftChannel` vs `useCellInvalidDraftChannel`; parallelle adapter-kontrakter `DraftParse` vs `TableInputAdapter`.
- **Problem:** To hooks implementerer den *samme* trust-kritiske draft-state-maskine to gange, med kommentarer der åbent kryds-refererer hinanden ("spejler useDraftField"): optimistisk-commit-guard, authoritative-epoch-resync, physical-focus-guard, undo-restore-suppression, fejl-re-derivation, invalid-draft-branching. Hver fremtidig draft/undo-rettelse skal spejles i to filer.
- **Greenfield:** Én felt-state-kerne parameteriseret af én adapter-kontrakt, med en tynd "surface"-seam (`<input>` vs grid-celle-editor-handle). De delte parse-kerner (`integerDraftCore` m.fl.) bliver kernens parse-lag; én invalid-drafts-kanal-abstraktion; én epoch-resync; én `pendingCommit`-guard. `useStyledFieldAdapter` og grid-editor-handlen bliver to adaptere over kernen.
- **Rød tråd:** Realiserer den "delte commit/edit-lim" som `useStyledFieldAdapter`s header allerede stræber mod — tabel-stien tilsluttede sig aldrig.
- **Afhængigheder:** Relateret til #27 (række-persistering) og #12 (fejl-seam). Højeste blast-radius i appen (hvert input + undo/redo + save-gating) → tung test før ændring.

### 26 — `Container.tsx` → headless keyboard-nav-hook · 9

- **Scope:** `src/components/layout/Container.tsx` (623).
- **Problem:** Én `React.memo` blander normativ kontrakt-docblock, rene DOM-utils (radio-group-tab-stops, visibility-probing), en focusable-cache med `MutationObserver`, og én ~320-linjers `handleKeyDown` med nested `focusOnly`/`moveFocus`/`moveByArrow` + række-geometri-matematik.
- **Greenfield:** Udtræk headless `useContainerKeyboardNavigation(containerRef)` + testede moduler: `focusableCache.ts`, `focusGeometry.ts` (søster til `gridCore/`-geometri), `widgetSemantics.ts`, `radioGroups.ts`. `Container` bliver en tynd `<Box>`. Adfærdsgrænsen er dokumenteret i `keyboard-navigation.md`.
- **Rød tråd:** Headless-hook + rene testbare moduler, som grid-laget allerede er delt op.
- **Afhængigheder:** App-wide fokus-infrastruktur; hold keyboard-nav-tests grønne hele vejen. Højeste risiko blandt UI-kandidaterne.

### 27 — Samlet række-persistering-kerne · 9

- **Scope:** `rowDrafts/useRowDrafts.ts` (333) + `useSliceRowDrafts.ts` (108) vs `tables/gridCore/useGridRowPersistenceCore.ts` (176).
- **Problem:** Celle-input-laget er allerede konvergeret (alle celler er `Table*Input` over `useTableInputCore` — nul `Styled*Field` i tabeller), men **to** række-draft-managere overlevede migreringen: `useRowDrafts` (fuld per-række-draft-buffer + deep `committedValuesEqual`) og `useGridRowPersistenceCore` (egen committed-liste + fingerprint-flush + id-reconcile). Samme problem, to arkitekturer, valgt per tabel af historik. `useRowDrafts`' draft-buffer er stort set vestigial (løse tabeller læser committed, ikke draft).
- **Greenfield:** Én række-persistering-kerne over den delte celle-stak: hver `Table*Input` ejer sin celle-draft; én hook ejer committed-liste + empty-row-stripping + fingerprint-flush + `reconcileGridRowIdentityForRestore` + undo-origin. `useSliceRowDrafts`' slice-binding foldes på. Løs vs grid = ren styling-prop.
- **Rød tråd:** Én kerne bag den allerede-konvergerede celle-stak.
- **Afhængigheder:** Beslægtet med #25; rører save/load + undo/redo-fokus → per-tabel-verifikation.

### 28 — Kollaps persistence læse-sti-lagstak · 9

- **Scope:** `stores/formPersistenceStore.ts` (SoT), `formPersistenceReadModel.ts`, `hooks/useFormPersistenceSelectors.ts`, `contexts/FormPersistenceContext.tsx` (674).
- **Problem:** Context'ens læse-halvdel er ren indirektion over `formPersistenceReadModel` (`getPersistedData`, `getFieldErrors`, `getInvalidDraft` … alle trivielle wrappers). Samme snapshot-funktioner er nåbare tre veje (direkte, re-eksporteret via selectors-hook, re-wrappet via context). Context'en bundter ~20 i én `useMemo` med 22-entry dep-array. Kun `lastNotice` er reelt context-bundet.
- **Greenfield:** Kollaps læse-stien til to kanoniske niveauer: selector/snapshot (forbruges direkte af UI) + facade (kun operationer der kræver orkestrering + notice-state). Drop de ~12 læse-pass-throughs fra context-fladen (kontrakten siger allerede nye callsites skal bruge store-selectors).
- **Rød tråd:** Kanoniske persistence-hook-niveauer; context = tynd facade over Zustand.
- **Afhængigheder:** Del af samlet store-oprydning (#19 + #33). Bred callsite-flade → hver fjernet metode er en migrering.

### 29 — `dateRanges.ts` split + read-time `TODAY` · 9

- **Scope:** `src/config/dateRanges.ts` (623).
- **Problem:** Tre concerns smeltet sammen: (1) **afledt runtime-state ved import** — `TODAY = getTodayLocalISO()`, `CURRENT_YEAR`, `DATE_*_YEAR_END` bager `Date.now()` ind i modul-load-konstanter → en range's `max: TODAY` fryses ved første import og bliver stale ved dag-skift i en langlivet fane; (2) logik (`subtractYearsISO`, `computeSkadedatoMinRule`); (3) ~30 nær-identiske range-records hvor `notes`-prosa gentager den maskinlæsbare `type`/`min`/`max`-semantik og skal hånd-synkes.
- **Greenfield:** Split i `dateRangeTypes.ts` / `dateRangeRules.ts` / kompakt `dateRanges.ts`-datatabel. Erstat frosne `TODAY`-konstanter med read-time-factories (`maxToday()`, `endOfYear(offset)`). Range-buildere (`dynamicMinFromSkadedato({ max })`) eliminerer copy-paste og udleder `notes` fra formen.
- **Rød tråd:** Zod forbliver runtime-sandhed; read-time-bounds fjerner stale-smell.
- **Afhængigheder:** Mange forbrugere importerer de konkrete range-objekter; buildere skal producere identiske former. `TODAY` frozen→read-time er en subtil adfærdsændring der skal verificeres mod validatorer.

### 30 — Konsolider validerings-ejerskab · 8

- **Scope:** `validators/erstatningsopgoerelseValidator.ts` (998), `engines/../validation/` (15 filer, ufuldstændig barrel), `eoRowEvaluation/`-builders + `eoRowIssueCatalog.ts`, `snapshot/eoSnapshotInvariants.ts`, Zod-schemas.
- **Problem:** Samme felt kan valideres i op til fem steder: Zod (form/required), 998-LOC-validatoren (cross-field), `validation/`-mappen (importeret af både validator og row-builders), row-evaluation-builders (driver den faktiske PDF-gate), og snapshot-invarianter. Ejerskab af "hvad blokerer PDF'en" er reelt splittet mellem `collectAllEoRows` og validator-invarianter. `validation/index.ts`-barrelen dækker kun 7 af 15.
- **Greenfield:** Gør row-evaluation-laget til *eneste* cross-field-autoritet (ejer allerede gaten + `dependsOn`/suppression-graf + issue-katalog). Reducér centralvalidatoren til en tynd adapter der projicerer row-resultater ind i den legacy `ValidationResult`-form snapshot-invariant-stien behøver. Zod = form-sandhed, row-evaluation = forretningsregel-sandhed, invarianter = system/engine-sandhed. Komplet barrel.
- **Rød tråd:** Ét sted per validerings-concern; matcher B9-fundet om at row-laget er trust-kritisk gate.
- **Afhængigheder:** Validatoren er load-bearing for snapshot-invariant-kontrakten → re-homing af regler risikerer at ændre hvilke fejl der blokerer. Højt testsurface, høj konsekvens.

### 31 — PDF/Word-paritet som struktur · 8

- **Scope:** `pdf/infrastructure/pdfWriter.ts` (953) vs `docx/infrastructure/docxWriter.ts` (760); `docxStyles.ts`, `docxWatermark.ts`, `pdfBrevhovedRenderer.ts`, `documentFooterImage.ts`.
- **Problem:** Hver primitiv findes to gange og holdes lige af kommentarer, ikke kode: `writeLeftRightText` (~150 målte linjer i PDF vs fast-DXA-kolonne-estimat i Word), signatur-blok, brevhoved, footer-image, UDKAST-vandmærke. Sum-linjen over totaler tegnes som linje i PDF, som celle-top-border i Word (og ignorerer bredden). Ingen test hævder at de to kanaler producerer ækvivalent struktur.
- **Greenfield:** Falder ud af #24: med et deklarativt IR bliver "left-right-line", "signatur", "brevhoved", "sum-line" node-typer defineret én gang; hver renderer implementerer node-typen én gang → paritet garanteret. Golden-model-test snapshotter IR'et.
- **Rød tråd:** Struktur frem for hånd-synk; navngivne docx-styles bevares.
- **Afhængigheder:** Koblet til #24; svær standalone uden bare at flytte duplikeringen. Rører de præcise pixels brugeren inspicerer i signerede dokumenter.

### 32 — EO-sektion-god-funktioner + DI-container · 8

- **Scope:** `document/generators/eo/sections/opgoerelseSection.ts` (836), `reguleringSection.ts` (680), `eoBilagSections.ts` (558); samlet i `erstatningsopgoerelseDocument.ts`.
- **Problem:** `renderOpgorelseSection` tager en `OpgorelseSectionContext` med ~40 felter der re-bundter writer-metoder + et dusin penge/dato-formattere + invariant-assertere — en bespoke DI-container hånd-wiret som objekt-literal. Penge-formatter-sættet defineres lokalt *og* trådes gennem context'en, mens implementeringerne allerede bor i `documentFormatUtils.ts`. `writer` sendes både som løftede metoder *og* som nested `writer`-sub-objekt.
- **Greenfield:** Sektioner bliver rene `(EoModel) => Block[]`-funktioner der returnerer IR'et fra #24 — ingen writer, ingen formatter-bundle (formattering påføres ved bygning af IR-noder, kun fra `documentFormatUtils`). Udvid `eoSnapshotToEoDocument` så sektioner modtager en fuldt projiceret model.
- **Rød tråd:** Snapshot→dokument-projektion; ét formatter-sted.
- **Afhængigheder:** Koblet til #24; context-objektet er dybt viklet ind i cursoren. Flagskibs-dokumentet → høj konsekvens.

### 33 — Atomisk mutations-primitiv i `FormPersistenceContext` · 8

- **Scope:** `contexts/FormPersistenceContext.tsx`: `persistData`, `writeInvalidDraft`, `replaceAllPersistedData`, `clearPageData`, `clearAllData`, `reconcileInvalidDrafts`; `utils/persistenceStoreRollback.ts`, `persistenceSnapshotStorage.ts`.
- **Problem:** Hver muterende metode re-implementerer samme transaktion i hånden (læs forrige sessionStorage → capture rollback + undo-snapshot → skriv → capture undo-frame → commit store → på `catch` bespoke rollback-sekvens). 5-6 strukturelt identiske try/catch. `atomicWritePersistenceSections` findes allerede som primitiv (brugt af undo-stien), men context-metoderne bruger den ikke. Undo-coalescing-markør-logik er inline-koblet til mutations-koden.
- **Greenfield:** Én `runAtomicPersistenceMutation({ affectedStorageKeys, mutate, captureUndo })`-primitiv der ejer backup/commit/rollback (udvid `atomicWritePersistenceSections`). De fem metoder bliver tynde beskrivelser af "hvad ændres". Flyt coalescing-beslutningen til undo-laget (det er undo-semantik).
- **Rød tråd:** Én atomisk-write-primitiv; context mod tynd facade (kobler til #28).
- **Afhængigheder:** Trust-kritisk save-sti; coalescing/undo-samspillet er subtilt ("præcis én undo-frame per commit"). Kræver tungt test-net før berøring.

### 34 — EO schema-variant-dedup — udgået · 7

- **Status: ❌ Udgået som kandidat (2026-07-10).** Den efterfølgende verifikation viste, at filen allerede udleder varianterne gennem `createLoenudviklingOgSatserSchema(...)`; den påståede parallelle schema-form findes ikke længere. Filen er 363 linjer, og en ren filopdeling uden et konkret grænseproblem ville være ændring for ændringens skyld. Kandidaten er derfor fjernet fra byggerækkefølgen, men ID'et bevares som historik.

### 35 — Carry-forward series-opslag · 7

- **Scope:** `data/offentligLoenLookup.ts` (binær søgning), `data/krlRates.ts`, `data/overenskomstRates.ts`, `data/klLoenaftaler.ts`, `data/statistiskeRates.ts`; allerede-delt: `data/rateSeriesIntegrity.ts`.
- **Problem:** Integritets-primitiverne (sortering, no-interior-gap) er allerede konsolideret (R5, godt). Men *lookup*-halvdelen er stadig per-fil: hver kilde har sin egen "find nyeste entry med `effectiveDate ≤ target`" (én binær søgning, resten lineær scan) + sit eget `getReguleringsDatoIntervalFor*`. Samme carry-forward-semantik implementeret 4-5 gange — hver et sted en subtil off-by-one kunne give stille mis-regulering.
- **Greenfield:** Delt generisk `carryForwardSeries<T>(sortedDescendingByDate)` → `{ at(date), interval(), datoer() }`, parallelt til de eksisterende integritets-primitiver. Hver kilde bygger sin typede serie én gang.
- **Rød tråd:** Delt primitiv som integritets-laget; generede satstabeller urørt.
- **Afhængigheder:** Lav-forbedring (den risikable integritets-del er allerede delt). Fodrer faktiske erstatningstal → høj bar; signaturer varierer.

### 36 — EET på kanonisk `MoneyOre`/canonical-spine · 6

- **Scope:** `domain/erhvervsevnetab/` (~4700 LOC): `eetDifferencekravCalculation.ts` (941), `eetLoebendeYdelserCalculation.ts` (861), `eetKapitaliseringCalculation.ts` (581), `eetSnapshot.ts` (235) m.fl.
- **Problem:** EO-kernen byggede en disciplineret kanonisk penge-model (heltals-øre, `Calculable<MoneyOre>`, Zod-valideret `eoCanonicalOutput`). EET bruger **intet** af det (nul `MoneyOre`/`Calculable`-matches i hele træet) — regner i rå kroner-floats med en spredt afrundings-zoo (`round0/2/3/4/roundNearest1000/ceilNearest12`). EET kører desuden en **parallel snapshot** med egen `EetIssue`/`EetFieldErrors`. `eetDifferencekrav` selv-orkestrerer søster-calcs (bryder parametrerings-mønstret). EO↔EET bygget bro via en transient injection-hack.
- **Greenfield:** Re-basér EET på samme primitiver: penge som `MoneyOre`, delresultater som `Calculable<MoneyOre>`, Zod-valideret `eetCanonicalOutput` der spejler `eoCanonicalOutput`, unified issue/invariant-type. Erstat selv-orkestrering med eksplicit komposition. Formalisér EET→EO-koblingen som førsteklasses snapshot-input.
- **Rød tråd:** Bringer det næststørste beregningsdomæne på den betroede penge/canonical-disciplin.
- **Afhængigheder:** Højeste risiko/laveste lethed: hver EET-calc-signatur + hvert afrundings-site ændres; float→øre er subtilt omkring lovbestemte afrundingsregler (`roundNearest1000`, `ceilNearest12`). **Kræver udtømmende golden-value-tests før første ændring** — kan flytte juridisk følsomme beløb.

### 37 — Branded `MoneyOre` + lukket pengealgebra · 9

- **Status: ✅ Gennemført (2026-07-11).** `MoneyOre` ejes nu af det domæne-neutrale
  `domain/money/money.ts` og afledes direkte af et branded Zod-schema. EO-engines,
  snapshot, årsfordeling, graf- og dokumentprojektioner bruger den lukkede algebra for
  konstruktion, nul, addition, subtraktion, summering, skalering og krone↔øre-konvertering;
  den EO-lokale `eoMoney`-facade, `MoneyKroner`-aliaset og alle produktions-/test-casts er
  fjernet. Et AST-værn forbyder fremtidige `MoneyOre`-assertions uden om modulet, og
  compile-time-tests beviser at rå aritmetik mister brandet. Eksisterende golden-værdier
  er bevaret, suppleret af algebra-/overflow-/roundtrip-tests.

- **Scope:** `domain/erstatningsopgoerelse/shared/eoTypes.ts`, `eoMoney.ts`, EO-engines/snapshot/projektioner og deres dokumentformattere.
- **Problem:** `MoneyOre` og `MoneyKroner` er blot aliaser for `number`. Mindst 17 direkte `as MoneyOre`-casts — især i `tafPerYearDerived.ts` — går uden om `ensureMoneyOre`, og rå `+`/`-`-aritmetik taber enhedsbeviset. #36 ville dermed flytte EET over på en nominelt kanonisk, men ikke reelt lukket pengeprimitiv.
- **Greenfield:** Neutralt `domain/money/`-modul med opaque/branded `MoneyOre`, Zod-konstruktor og navngivne `zero/add/subtract/sum/scale/fromKroner/toKroner`. Ingen cast eller konstruktion uden for modulet; alle operationer returnerer valideret `MoneyOre`.
- **Rød tråd:** Deterministisk numerik og én autoritativ pengealgebra i stedet for type-etiketter oven på rå floats.
- **Afhængigheder:** Forudsætning for #36. Berører beregningskode bredt → forelægges og bevises tal-identisk med EO-golden-net før migration.

### 38 — Eksplicit dokument-genereringssession · 9

- **Status: ✅ Gennemført (2026-07-11).** Den modul-globale `activeContext`, fallback-
  fabrikken, pending-promise-listen og writer-routeren er fjernet. Hvert downloadforløb
  får nu en immutable `DocumentGenerationSession` med format og writer-fabrik; alle
  generatorer modtager sessionen eksplicit og returnerer et `DocumentArtifact` med blob
  og formatkorrekt filnavn. Begge writere afslutter via `build(): Promise<Blob>`, og kun
  service-laget udløser browser-downloaden. Et nyt samtidighedsnet afslutter PDF og Word
  i omvendt rækkefølge og beviser, at format, filnavn og blob ikke krydser sessioner;
  det eksisterende PDF-/Word-/generator-golden-net er bevaret grønt.

- **Scope:** `document/documentGenerationContext.ts`, `writer/documentWriterRouter.ts`, `docxWriter.ts`, `documentService.ts` og alle generator-entrypoints.
- **Problem:** `activeContext` er modul-global state, der lever hen over `await`. Samtidige downloads kan overtage hinandens format/writer og gendanne kontekster i forkert rækkefølge; Word-writerens `save()` registrerer desuden en global pending-promise i stedet for at returnere sit artefakt. #24 bevarede oprindeligt netop denne kontekst og dækkede derfor ikke problemet.
- **Greenfield:** Én eksplicit `DocumentGenerationSession` gives til generator/renderer. Rendereren returnerer `Promise<DocumentArtifact>`; service-laget ejer den eneste download-side-effect. Fjern `activeContext`, fallback-factory, `registerPendingDocumentDownload` og writerens skjulte `save()`-kanal.
- **Rød tråd:** Eksplicit dataflow og én artefaktgrænse for PDF/Word; ingen skjult async-global state.
- **Afhængigheder:** #11 letter callsite-migreringen; #24 er den naturlige slutform. Kræver parallel-download-tests og eksisterende kanal-golden-net.

### 39 — Persistence initialiseres før React-render · 9

- **Status: ✅ Gennemført (2026-07-11).** `initializePersistenceRuntime()` bygger nu hydration-planen, hydrater det autoritative Zustand-store atomisk og rydder read-model-cache før `root.render`. Begge app-entries kalder initialiseringen i `renderApp` efter variantens namespace/device-gate og før app-træet oprettes; unsupported-device hard-stop initialiserer fortsat ingen sagsstate. Den færdige runtime føres eksplicit gennem app-roden til en render-ren `FormPersistenceProvider`, som kun ejer startup-notice og efterfølgende cleanup af afviste storage-nøgler. Provider-remount kan derfor ikke længere genlæse `sessionStorage` eller overskrive committed state. Det nye runtime-karakteriseringsnet beviser første-render-hydrering, uændrede section revisions/committed counter, ét autoritativt epoch-bump, rydning af runtime-fejl, invalid-draft-revision og remount-bevarelse; eksisterende persistence-konsumenttests er migreret til eksplicit runtime.

- **Scope:** `contexts/FormPersistenceContext.tsx:120-136`, `persistenceSessionHydration.ts`, `formPersistenceStore.ts`, `bootstrapClientApp.tsx` og begge app-entries.
- **Problem:** `FormPersistenceProvider` læser `sessionStorage`, bygger hydration-plan, muterer det globale store med `hydrate()` og rydder read-model-cache inde i en `useState`-initializer. Begge roots renderer under `React.StrictMode`; render er dermed uren, provider-remount kan rehydrere, og startup-rækkefølgen er bundet til en global singleton.
- **Greenfield:** `initializePersistenceRuntime(...)` kører én gang før `root.render`, efter variantens namespace er fastlagt, og returnerer hydreret store + startup-notice/cleanup-plan. Provider modtager den færdige runtime og er en ren facade uden autoritativ init-side-effect.
- **Rød tråd:** Store er source of truth; hydration er én eksplicit autoritativ replacement før nogen children kan læse state.
- **Afhængigheder:** Laves før #19/#28/#33. Revisions-, epoch-, `invalidDrafts`- og notice-semantik skal karakteriseres state-identisk.

### 40 — Eksplicit critical-action-/commit-barriere · 9

- **Scope:** `utils/commitFlush.ts`, `gridCoreRegistry`, `MainLayout`, `useFileSaveLoad`, `useUndoRedoShortcuts` og felt-/grid-surface fra #25.
- **Problem:** Save/load/navigation finder aktive grid-editorer via DOM-query + global registry, blur'er `document.activeElement` og venter en Promise-tick plus to animation frames på, at commits "falder til ro". Tre kritiske handlinger bruger to forskellige guard-funktioner, og korrekthed afhænger af render-timing frem for et eksplicit lifecycle-signal.
- **Greenfield:** Én registreret `CriticalActionCoordinator` med typede commit-deltagere. `prepare(action)` returnerer deterministisk `committed | blocked(target)` og afventer kun eksplicitte commit-promises/events — aldrig DOM-scanning eller faste frames. Save, load, navigation og undo bruger samme barriere med navngiven policy.
- **Rød tråd:** Imperative, auditerbare commits og én grænse for alle handlinger der kan unmount'e eller erstatte committed state.
- **Afhængigheder:** Bygger naturligt på #25 (én feltkerne) og føder #41/#43. Fokus-/commit-adfærd skal være bruger-identisk; høj datatabsrisiko kræver transitionsmatrix.

### 41 — Save/load som codec + I/O-porte + tilstandsmaskine · 8

- **Scope:** `utils/fileSave.ts` (429), `fileLoad.ts` (370), `fileSaveInternals.ts` (284), `hooks/useFileSaveLoad.ts` (423), `types/fileOperations.ts` og `MainLayout`-dialogerne.
- **Problem:** Én trust-kritisk use-case er spredt over ~1.500 linjer. File System Access/fallback og manuel/PWA-load har parallelle kontrolstier; fallback-download sker før in-memory-verifikation; `SaveFileResult`/`LoadFileResult` er booleans med næsten alle andre felter optional; to nullable pending-states kan repræsentere ugyldige UI-kombinationer.
- **Greenfield:** Ren `EoFileCodec.encode/decode`; typede `SaveTarget`/`LoadSource`-porte; byg og verificér ét artefakt før enhver sink; read-back-verifikation hvor sinken understøtter det; diskriminerede resultater (`cancelled | saved | preflight | failed`). Ét reducer-/state-machine-flow ejer preflight → overwrite → apply → metadata og bruges af både picker og PWA.
- **Rød tråd:** Parse én gang, valider én gang, anvend atomisk; filformat, I/O og UI-workflow har hver én klar grænse.
- **Afhængigheder:** Bygger på #33, #40 og #42 (samt #3 for storage-primitiven). Højeste save/load-risiko → fuldt round-trip-, transitions-, fejlindsprøjtnings- og rollback-net før første ændring.

### 42 — Versionsbåret schema-evolution i `.eo` · 9

- **Scope:** `config/persistenceVersion.ts`, `schemas/eoFileSchema.ts`, `fileSave.ts`, `fileLoad.ts`, `inboundPersistedSection.ts` og `persistenceMigrations.ts`.
- **Problem:** `.eo` gemmer containerens `FILE_FORMAT_VERSION` og buildets `appVersion`, men ikke sagsinputtets `PERSISTED_DATA_VERSION`. Migratoren modtager kun `(pageKey, value)` og kan derfor ikke kende kildens data-version; versionsstyret migration må gætte på shape. #13 omdøber kun runtime-store-feltet.
- **Greenfield:** Save skriver særskilt `persistedDataVersion`; load sender den til et per-sektion migrator-register (`fromVersion → current`). Manglende version behandles som eksplicit legacy-baseline og må aldrig i sig selv blokere tolerant load eller udløse advarsel, hvis alle tilstedeværende værdier kan indlæses.
- **Rød tråd:** `FILE_FORMAT_VERSION` ejer containeren; `PERSISTED_DATA_VERSION` ejer indholdet — også i den eneste brugerrettede langtidsbevaring.
- **Afhængigheder:** #13 først; #41 konsumerer den færdige codec/migrationsgrænse. Trust-kritisk containerændring kræver gamle/nyere fil-fixtures og preflight-tests.

### 43 — Kanonisk page-manifest + persistent app-shell · 9

- **Scope:** `App.tsx`, `SideMenu.tsx`, `MainLayout.tsx`, `config/pageNavigation.ts` og direkte `navigate(...)`-calls i side/viewmodel-laget.
- **Problem:** Samme faste sidekatalog håndholdes som loader-map, 11 lazy-konstanter, routes-array, menu-/utility-lister og endnu et route/default-tab-map. `createPageWrapper` monterer en ny `MainLayout` pr. route, så PWA-kø, undo-shortcuts, devtools, overlays og listeners remountes ved hvert sideskift. Kun sidemenu-navigation går gennem commit-guarden; andre bruger rå `navigate`.
- **Greenfield:** Ét feature-låst `APP_PAGE_MANIFEST` med `PageId`, path, lazy loader, menu-metadata og optional persistence/default-tab. Routes/preload/menu/reverse lookup udledes. Appen har én layout-route (`MainLayout` + `Outlet`) og én `useCommitSafeNavigate()` over #40; undo/load har eksplicit dokumenterede særveje.
- **Rød tråd:** Ét register for den låste featureflade og én sikker navigationsgrænse — ingen plugin-/fremtidsabstraktion.
- **Afhængigheder:** Efter #40. Ændret mount-livscyklus kan afsløre skjult remount-state; karakterisér navigation, load/PWA, undo-fokus og shell-state.

### 44 — Feature-slicede EO-viewmodels · 10

- **Scope:** `useEoBeregningViewModel.ts` (891), `useLoenindkomstViewModel.ts` (874), `useEoOplysningerViewModel.ts` (605), deres contexts og sektionskonsumenter.
- **Problem:** De "gode" reference-VM'er er selv blevet tre flade god-objekter (~2.370 LOC; op til 95 returnerede medlemmer). Contexts eksponerer rå `values/setValues/setFieldValue`; beregnings-VM'en blander issue-graf, side-effects, navigation, bilag, gates og fire downloads; løn-VM'en blander tabeller, dialoger, satser, SFGG og løntrin-finder. #5 standardiserer at en VM findes, men ikke dens indre grænser.
- **Greenfield:** Root-VM komponeres af feature-lokale hooks/rene projektorer (`issues`, `navigation`, `bilag`, `downloads`, `sfgg`, `loenudvikling`, `tables`). Hver sektion modtager en navngiven smal model/command-flade; ingen sektion åbner hele form-API'et. `EOberegningTab` bliver ren sektionskomposition.
- **Rød tråd:** Fører #5's VM + sections-princip helt igennem i stedet for at flytte monolitten én fil ned.
- **Afhængigheder:** Efter #5 og før #1/#22. Beregnings-/gate-sandhed ændres ikke; snapshot-, download- og navigationstests skal bevise identisk adfærd.

### 45 — Deklarativt editable `GridSpec` · 8

- **Scope:** `StandardLoenTable` (806), `OffentligeYdelserTable` (544), `LoenudviklingManuelTable` (476), `LoenudviklingManuelProcentsatsTable` (376), `EetAslAfgoerelserTable` (402), `StandardGridTable` og `gridCore`.
- **Problem:** Fem editable grids hånd-wirer samme kolonneidentitet særskilt som header/sort-id, fysisk `colIndex`, `gridCell`, undo-path, error-key, fokusmål, width/alignment og editor (39 `gridCell`-sites). En kolonneombytning kan kompilere, men sende undo/error/navigation til forkert celle; den nuværende grid-shell kan ikke typekontrollere isometrien.
- **Greenfield:** `EditableGridSpec<Row, ColumnKey>` med én descriptor pr. kolonne (`key`, stabil index, header, width, align, sort projection, editor/derived renderer, error mapping). En compiler renderer colgroup/header/body og udleder gridCell, undo/error-key og fokusmål fra samme descriptor. Dynamiske løn-/beløbsgrene er spec-factories.
- **Rød tråd:** UI-sidens pendant til dokument-`TableSpec` (#15): én kanonisk struktur, flere sikre projektioner.
- **Afhængigheder:** Efter #25/#27; migrér tabel-for-tabel med keyboard-, DOM-, undo-, error- og save-order-karakterisering.

### 46 — Variant-ejede styles og build-assets · 10

- **Scope:** `bootstrapClientApp.tsx`, `MinProcesrenteApp.tsx`, `index.css`, `minprocesrente.css`, Vite-varianterne, `public/`, `ensure-build-index.mjs` og `cleanup-minprocesrente-public.mjs`.
- **Problem:** Shared bootstrap importerer altid Mineos desktop-`index.css`; standalone overtager dermed `overflow:hidden` og kompenserer med en stor effect, der muterer `html/body/#root`. Standalone-buildet kopierer først Mineos PWA-assets og sletter/omskriver dem bagefter; begge builds kopierer efterfølgende HTML til `index.html`.
- **Greenfield:** Hver entry ejer root-stylebundle, `publicDir`/headers og HTML-input. Shared bootstrap er style-neutral (eller modtager eksplicit style-loader). Vite bygger korrekt variant-output direkte; post-build delete/copy-scripts og standalone DOM-style-workaround forsvinder.
- **Rød tråd:** Multi-app-isolation bliver strukturel i source/build i stedet for oprydning efter fælles pipeline.
- **Afhængigheder:** Uafhængig, men synligt mobil-/desktop-layout og cacheheaders kræver forelæggelse, render-QA og build-output-tests.

### 47 — Byg én gang, verificér og deployér samme artefakt · 14

- **Status: ✅ Gennemført (2026-07-10).** Én autoritativ `verify:release`-gate i `package.json` samler nu alle eksisterende værktøjer i én kæde: `typecheck` (kilde) → `typecheck:test` → `lint` → `check:mojibake` → `check:filename-case` → `test:coverage` (nyt script, aktiverer den hidtil sovende v8-coverage + tærskler) → `build:all`. `check` delegerer nu til `verify:release`, så lokal gate og CI er byte-for-byte samme kommando (fjerner drift). CI's `verify`-job er reduceret til ét `npm run verify:release`-trin og **uploader** de to verificerede `dist/`-artefakter (`actions/upload-artifact@v4`, `if-no-files-found: error`); `deploy`-jobbet **downloader** præcis dem (`actions/download-artifact@v4`) og kører kun `wrangler deploy` — **ingen rebuild**. Dermed er de deployede bytes bevisligt identiske med de verificerede (den tidligere dobbelt-build gav divergerende `builtAt`). Den ubrugte `@playwright/test`-devDependency er fjernet (+ `playwright`/`playwright-core` pruned fra lock; intet nyt testframework indført). Coverage-tærsklerne blev **ikke** sænket: fuld suite grøn med Lines 88,98 % / Branches 77,3 % mod tærskler 80/70. Hele `verify:release` verificeret grøn lokalt (exit 0, begge `dist/`-artefakter produceret).
- **Scope:** `package.json`, `vite.config.ts` og `.github/workflows/ci.yml`.
- **Problem:** `check` mangler lint/build/coverage; CI mangler lint, `typecheck:test` og coverage. Coverage-provider + thresholds er konfigureret, men aktiveres aldrig. Verify-jobbet bygger begge apps, hvorefter deploy-jobbet checker ud og bygger igen; `builtAt` gør de deployede bytes beviseligt forskellige fra de verificerede.
- **Greenfield:** Én autoritativ `verify:release` over eksisterende værktøjer (source/test-typecheck, lint, Vitest+coverage, `build:all`, build-output guards). CI uploader de to verificerede `dist`-artefakter, og deploy-jobbet deployer præcis dem uden rebuild. Den ubrugte Playwright-dependency fjernes; intet nyt testframework/paradigme indføres.
- **Rød tråd:** Én gate, ét build og én sandhed om hvad der faktisk blev godkendt til produktion.
- **Afhængigheder:** Før øvrige kandidater som fundament. Dormant coverage kan afdække reel gæld; tærskler må ikke sænkes mekanisk.

### 48 — Deklarativt AST-baseret arkitekturgrænse-harness · 12

- **Status: ✅ Gennemført (2026-07-11).** Batch 3–4 migreret og de gamle scannere reduceret/slettet, så manifestet nu bærer **17 regler**. **Batch 3 (fem grænser):** `domain/page-section-access-boundary` (page-lagets persisterede sektionsadgang: per-rod autoriserede sektioner + coverage-completeness i én regel — `PAGE_BOUNDARY_RULES` bor nu i manifestet og eksporteres til `domainBoundaryIsolation`s positive dæknings-assertion); `pdf/download-committed-state` (download-triggende filer må ikke læse committed EO-state, EO-PDF-downloads heller ikke committed stamdata — `pdfDownloadCommittedStateGuard` **slettet**); `layer/minprocesrente-standalone-import-boundary` (import-forbuds-halvdelen af standalone-isolationen; hoisting-rækkefølge + positive brugerdata-forbud beholdt i den reducerede fil); `persistence/committed-section-mirror` (den allerede-AST committed-mirror-dataflow absorberet som custom-`find`-regel — `persistenceCommittedMirrorIsolation` **slettet**); og `form/no-queue-microtask-in-commit-sensitive` + `form/no-promise-tick-in-commit-sensitive` (substring-forbuddene fra `formContractIsolation` — Promise-tick fanges nu strukturelt via `await`/`.then`-parent så en `let q = Promise.resolve()`-initializer IKKE fejlflages; effect-write-grænsen med note-i-samme-vindue-semantik beholdt i den reducerede fil). **Batch 4:** `domain/eo-field-visibility-single-source` (governed EO-felters inline render-gates fanges nu strukturelt via en JSX/logisk-udtryks-forespørgsel — `getChecked(values.X) && …` / `values.X === '…' && …`, inkl. negation/parenteser/multi-line, mens kontrol-bindinger og ikke-governed felter er tilladt; `eoFieldVisibilitySingleSource` reduceret til sin positive prædikat-brugs-assertion). Bevidst afvigelse fra den oprindelige batch-4-liste: `gridRowIdContractGuard`, `fieldIdentityGuard` og `fieldUnchangedGuardInvalidDraft` **forbliver dedikerede guards** og migreres IKKE ind i forbuds-manifestet — de er positive wiring-/runtime-invarianter (createEmptyRowId-determinisme + normalize/reconcile-unikhed, felt-identitets-attributter fra `core.*`, `committedInvalidDraft`/`clearInvalidDraft`-commit-semantik), ikke import-/adgangs-grænser; deres concern er ortogonal til motorens formål, og en tvungen manifest-indpakning ville være et ringere design (deres håndrullede brace/tag-parsing kan hærdes med `astQueries` senere som ren robusthed). Alle grafen overtræder fortsat **nul**, og de nye regler er bevisligt ≥ strengere end de gamle (AST fanger aliasing/negation/multi-line/parent-kontekst). Grønt: fuld quality-suite (29 filer/189 tests), `typecheck` + `typecheck:test` + `lint`. Bevidst bevaret som regex/tekst-kontrakt: `mojibake`, `pwaHeaders`, `pdfPseudoTableGuard`, `dateContractGuard`-idiomerne og tekst-forbuddene i `roundingNormGuard`.
- **Status (historik): 🟡 Motor + batch 1–2 gennemført (2026-07-10).** Ny motor i `src/__tests__/quality/architecture/`: `sourceGraph.ts` (ÉN kanonisk, modul-cachet læsning+parse af hele `src/` til AST, delt af alle regler), `astQueries.ts` (rene TS-compiler-API-forespørgsler: imports m. named bindings + type-only, kald m. positionelt første string-arg, medlemsadgang, element-adgang, relativ import-opløsning — alle med præcis fil:linje:kolonne), `ruleKit.ts` (deklarative regel-factories `forbidImports`/`forbidMemberAccess`/`forbidCalls`/`forbidElementAccess` + generisk `defineRule` med indbygget allow + **generisk anti-rot**), `architectureRules.ts` (manifest) og `architectureRules.test.ts` (kør-motor der (1) kører manifestet mod grafen → nul overtrædelser, (2) beviser hver regel ikke er inert via medbragte positive/negative fixtures — vacuous-pass-værnet generaliseret ud af de per-guard håndrullede selvtests, (3) håndhæver anti-rot ét sted). **Batch 1 (8 regler) migreret og de gamle scannere slettet:** rå `localStorage`/`sessionStorage`-adgang (→ member-access-regler), `sessionStorage.setItem` manifest-key (→ call-regel m. positionelt literal-arg), de tre persistence-import-grænser `useFormPersistence`/`FormPersistenceContext`/`formPersistenceStore` (→ import-regler), fail-open `getSatserForYear`-import (→ named-import-regel, anti-rot) og rå `aarsloenAslMax[...]`-subscript (→ element-access-regel). AST-reglerne er bevisligt **≥ strengere** end de gamle regex (fanger nu aliasing/destrukturering/bracket-notation/dynamic-import/inline-`type`-modifier som de gamle kommentarer indrømmede at misse) — og grafen overtræder stadig nul, dvs. ingen regression. Slettet: `noDirectSessionStorageAccess`, `sessionStorageBoundaryIsolation`, `persistenceAccessIsolation`, `failOpenDisplayLookupIsolation`, `aslAarsloensmaksimumSingleSource`; `noDirectLocalStorageAccess` reduceret til sin runtime-røgtest; `contractCoverageMatrix` (persistence- + page-component-kontrakt) repeget til motor-testen. **Batch 2 (2 regler mere, i alt 10):** lag-grænsen `layer/inspektion-import-boundary` (ingen domæne-fil uden for de to sanktionerede snapshot-broer må importere `src/domain/eoInspektion` — relativ + alias/absolut, anti-rot på broerne; dækker også `eoRowEvaluation`/`eoCanonicalOutput`/`eoControlMismatch`) og `domain/eet-cross-domain-persisted-lookup` (intet `getPersistedData`/`usePersistedSection`/`commitSection('erhvervsevnetab')`). `inspektionLayerIsolation` + `eetDomainIsolation` reduceret til deres fil-specifikke POSITIVE wiring-assertioner (fx at download-gate-VM'en i components-laget konsumerer den autoritative motor og er inspektionsfri — uden for domæne-scopet — og at EO-EET-felterne bindes i EO-oplysninger-sektionerne). Grønt: fuld quality-suite (31 filer/193 tests), `typecheck` + `typecheck:test` + `lint`. **Rest (kommende batches, dokumenteret her):** import-/kald-grænserne i `domainBoundaryIsolation` (sektion-adgang + coverage-completeness), `pdfDownloadCommittedStateGuard`, og import-forbuds-halvdelen af `minprocesrenteStandaloneIsolation`; absorbér `persistenceCommittedMirrorIsolation` (allerede AST) og substring-delene af `formContractIsolation`; sekundært de brace/tag-parsende guards (`gridRowIdContractGuard`, `fieldIdentityGuard`, `fieldUnchangedGuardInvalidDraft`, `eoFieldVisibilitySingleSource`) hvor en JSX/AST-node-forespørgsel erstatter håndrullet parsing. Bevidst bevaret som regex/tekst-kontrakt: `mojibake`, `pwaHeaders`, `pdfPseudoTableGuard`, `dateContractGuard`-idiomerne og tekst-forbuddene i `roundingNormGuard`.
- **Scope:** De 35 tests i `src/__tests__/quality/`, især de 30 filer der læser/scanner source, samt `quality/testUtils.ts`.
- **Problem:** Import-/adgangsgrænser håndhæves af mange lokale directory-walkers, regex/substring-søgninger og filspecifikke allowlists. Flere guards dokumenterer selv silent-pass-huller (aliasing, destructuring, bracket notation); samme kildecache og diagnostics genopfindes. `formContractIsolation` viser allerede AST-præcedens.
- **Greenfield:** Én lille Vitest-båret `architectureRules`-motor på TypeScript compiler API (allerede dependency), ét deklarativt regel-/undtagelsesmanifest, kanonisk fil-cache og præcise diagnostics. Regex beholdes kun hvor selve tekstformen er kontrakten (fx mojibake eller CSS-forbud).
- **Rød tråd:** Normative grænser beskrives én gang og håndhæves strukturelt i stedet for gennem konkurrerende tekstscannere.
- **Afhængigheder:** Uafhængig. Bevar alle nuværende regler og negative fixtures, før gamle guards slettes.

### 49 — Neutral måneds-/intervalalgebra ud af EO-motoren · 11

- **Status: ✅ Gennemført (2026-07-10).** Den rene inklusive månedsbrøk er flyttet til
  `domain/dates/maanedsbroek.ts` og bruges nu direkte af både EO- og EET-domænet. EO-motoren
  ejer fortsat sin fraværsjustering og afrunding, mens EET ikke længere importerer en
  søsterdomæne-engine. De eksisterende golden-værdier for månedsgrænser, skudår og
  floating-point-identitet er flyttet til en domæne-neutral test; EET's karakterisering er
  bevaret. Den ubrugte, test-only offentlige-ydelses-wrapper i `utils/periodeBeregning.ts` og
  dens duplikerede tests er fjernet.
- **Scope:** `erstatningsopgoerelse/engines/periodiseringsMotor.ts`, `domain/erhvervsevnetab/eetDifferencekravCalculation.ts`, `eetLoebendeYdelserCalculation.ts` og `utils/periodeBeregning.ts`.
- **Problem:** EET importerer `optaelMaanederPraecis` direkte fra EO's engine i to beregninger; en `utils/`-wrapper importerer samme EO-motor og bruges kun af tests. En domæne-neutral månedsbrøk er dermed ejet af én side, og søsterdomænet bryder laggrænsen for at genbruge den.
- **Greenfield:** Flyt rene ISO-interval-/månedsbrøk-primitiver til `domain/dates/`; EO-motoren beholder kun EO-politik. Fjern den test-only produktionswrapper og test den neutrale algebra direkte.
- **Rød tråd:** Neutrale primitiver i neutralt hjem; intet søsterdomæne importerer en anden sides engine.
- **Afhængigheder:** Før #36. Mekanisk i form, men beregningslogik → forelægges og bevises identisk for månedsgrænser/skudår.

### 50 — TAF-graf → ren scene-model + tynd Canvas-renderer · 10

- **Scope:** `document/generators/tafFordelt/tafKravGrafChart.ts` (800) og grafens helper-tests.
- **Problem:** Én fil blander sampling, aksevalg, layout, kurvegeometri, labels, legend og Canvas-tegning. Rene dele eksponeres gennem `__tafKravGrafChartTestables`, fordi den egentlige PNG-renderer ikke kan testes meningsfuldt i jsdom; domænebeslutninger og rasterisering har ingen reel seam.
- **Greenfield:** Byg en ren `TafChartScene` (akser, ticks, polygoner, markører, labels) fra den autoritative dokumentmodel. En lille Canvas-renderer rasteriserer scenen; golden-tests snapshotter scene-data, og få integrationstests verificerer PNG-artefaktet.
- **Rød tråd:** Kanonisk projektion én gang, renderer uden domænebeslutninger; svarer til dokument-IR-princippet for grafikken.
- **Afhængigheder:** Beslægtet med #24, men kan laves selvstændigt. Pixelændringer er synlig dokument-UX og forelægges; ellers kræves pixel-/scene-identitet.

### 51 — Typed beregningsdatakatalog + provenance · 7

- **Scope:** `data/lovbestemteRates.ts` (957), `overenskomstRates.ts` (1805), kapitaliseringens 33 håndkodede tabelmoduler/original-PDF'er, øvrige satskilder og `scripts/import-offentlig-loen.mjs`.
- **Problem:** Flere datakilder blander rå tal, typer, referenceprosa, coverage, integritetscheck og opslag i samme filer. Kun KL/RLTN har et reproducerbart kilde→valideret-data-flow; årlige opdateringer afhænger ellers af håndholdte formater og parallel dokumentation. #35 konsoliderer kun carry-forward-opslag.
- **Greenfield:** Fælles katalog-envelope (`id`, kilde/provenance, coverage, validator) med kilde-specifikke payloads — ingen tvungen universel sats-shape. Datafiler er data-only; lookup/bounds/reference-projektioner afledes. Generator bruges kun, hvor kilden kan importeres deterministisk; ingen automatisk PDF-ekstraktion uden sikker kildeproces.
- **Rød tråd:** Genbruger KL/RLTN's etablerede validerede importmønster uden at udviske reelle domæneforskelle.
- **Afhængigheder:** Selvstændig data-keystone, lavere prioritet end #41. Alle værdier er beregningslogik → forelæggelse og fuld golden-værdi-identitet.

### 52 — Normative kontrakter: invariant-kerne vs. implementeringskort · 11

- **Scope:** `src/contracts/` (27 kontraktfiler/~4.700 linjer), `contract-topology.json`, coverage-matrixen og informative arkitektur-/reviewdokumenter.
- **Problem:** Stabile regler, konkrete fil-/symbolnavne, audits og historiske noter står blandet i normative kontrakter. Der er allerede drift: `eo-snapshot-contract.md` navngiver ikke-eksisterende `...PdfDocument`-funktioner, og `app-settings.md` beskriver en ældre settings-kobling. Topologi-testen kan kun verificere linkage, ikke sandheden i implementeringskortene.
- **Greenfield:** Kontrakter indeholder kun stabile, testbare invariants og ejerskab. Fil-/symbolkort, auditsekvenser og historik flyttes til informative arkitektur-/reviewdokumenter eller maskin-afledte manifests. `contract-topology.json` bevares som autoritativt hierarki; manuelle duplikatlister fjernes.
- **Rød tråd:** Én autoritativ beskrivelse pr. concern og mindre drift mellem norm og kode.
- **Afhængigheder:** Uafhængig; følg topology-proceduren ved hver flytning og opdatér coverage-matrixen samlet. Ingen runtime-adfærd.

---

## Tematisk sammenfatning

Det stærkeste gennemgående tema er, at princippet **"kanonisk beregnet én gang,
projiceret mange gange"** — som EO's snapshot/canonical/`MoneyOre`-rygrad er et
godt udgangspunkt for — både er anvendt **inkonsistent** og nogle steder kun
nominelt gennemført:

- **Regulering** (#23): beregning konvergeret, præsentation ikke.
- **Dag-sæt** (#17): beregnet på begge sider af lag-grænsen. ✅ løst.
- **Penge og perioder** (#37, #49): EO's kanoniske type er ikke lukket, og EET
  importerer stadig en neutral månedsprimitiv fra EO's engine.
- **EET** (#36): adopterede aldrig rygraden og må først migreres, når #37/#49 står.
- **Dokument-output** (#24, #31, #32, #38, #50): paritet og grafik holdes af
  hånd-synkede stier, mens den aktive kanal ligger i skjult async-global state.
- **Felt/tabeller** (#25, #27, #45): draft-maskinen og kolonneidentiteten har
  parallelle repræsentationer, der kan drifte uafhængigt.

Det næststærkeste tema er, at de mest kritiske **lifecycles ikke har én eksplicit
grænse**. Persistence initialiseres under React-render (#39), kritiske handlinger
venter på DOM/animation frames (#40), save/load er fire sammenvævede codec-/I/O-/UI-
stier (#41), og `.eo` mangler sagsinputtets kildeversion (#42). Samme mønster findes
ydre i appen: sidekatalog og shell-lifecycle er parallelle (#43), og app-varianter
ryddes først op efter fælles style-/asset-build (#46).

Det tredje tema er **parallel boilerplate og håndholdt governance**: store-slices
(#19), atomiske mutationer (#33), IndexedDB-wrappers (#3), download-funktioner
(#2), settings-rækker (#21), reference-data/provenance (#51), release-gates (#47),
source-scannende kontrakttests (#48) og kontrakternes implementeringskort (#52).
Greenfield-retningen er ikke mere framework, men færre og mere autoritative
registre, codecs, porte og projektioner for den allerede låste featureflade.

**Anbefalet rækkefølge (indefra-og-ud):** Byg først fase 1's kanoniske primitiver
(#37, #49, #17, #15, #11, #38, #12, #19, #33, #13) oven på det verificerede
release-/arkitektur-net (#47/#48). Lav derefter fase 2's keystones én ad gangen:
beregning/dokument (#23/#24/#36), felt-/action-state (#25/#40), save/load
(#42/#41) og data (#51). Fase 3 gør output og tabeller til tynde projektioner;
fase 4 etablerer først den persistente shell (#43) og dekomponerer derefter
viewmodels/views (#5/#44 og resten). Fase 5 kører kun som uafhængigt fyld.

Kandidaterne #37, #49, #36 og #51 kan alle berøre juridisk følsomme tal; de kræver
forudgående godkendelse og golden-værdi-identitet. #41/#42 er tilsvarende
trust-kritiske for databevaring og kræver fuldt round-trip-/rollback-net. #34 er
verificeret udgået og indgår ikke længere i byggerækkefølgen.
