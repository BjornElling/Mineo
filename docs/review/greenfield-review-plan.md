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
  keystone laves som et testtungt spor med golden-value-net **før** første ændring;
  refaktoreringer af beregning beviser tal-identitet; og intet efterlades i en
  halvfærdig, inkonsistent mellemtilstand.
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

1. **Kanoniske primitiver** — de mindste delte byggekloder som keystones og
   konsumenter sidder på. Billige, isolerede, og hver muliggør en keystone.
2. **Spine-keystones** — de store centrale omlægninger, hver placeret oven på fase
   1-primitiverne. Rører beregning/output/UI → **golden-value-net og godkendelse
   FØR** første ændring.
3. **Projektioner & konsolideringer** — den kode der *kollapser*, når spinen findes
   (præsentation bliver tynde projektorer).
4. **UI-dekomponering** — det yderste lag; konsumerer alt det indre.
5. **Uafhængige oprydninger** — gated af intet. Interleaves som fyld, når en keystone
   afventer brugerens godkendelse.

I tabellerne er **ID** det stabile kandidat-id (matcher detalje-afsnittene nedenfor),
og **Sekv** er den anbefalede udførelses-rækkefølge. Krydsreferencer som "#23" i
teksten peger på de stabile id'er, ikke på sekvensen.

> **Hvorfor ikke bare "de store byggekloder allerførst"?** De fire spine-keystones
> (#23, #24, #25, #36) er de største byggekloder, men også de mest risikable, og de
> rører alle beregning/output/UI og kræver derfor forudgående godkendelse. Fase 1
> bygger derfor de billige primitiver *og* de test-net, der gør keystonene sikre at
> lave — så fase 2 er "stor byggeklods med sikkerhedssele på", ikke "stor byggeklods
> på må og få".

### Fase 1 — Kanoniske primitiver & fundament

De mindste delte byggekloder. Billige og isolerede; hver muliggør en senere
keystone eller UI-fasen. Bygges først, så fase 2 har noget at stå på.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 1 | 17 | ✅ Kanonisk dag-set-modul | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | muliggør #23, #36 |
| 2 | 15 | 🔄 `TableSpec` (udred `documentTableRenderer`) | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | muliggør #24 |
| 3 | 11 | `defineDocument`-generator-factory | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør #24 |
| 4 | 12 | Felt-fejl-seam + `numericFieldConfig` + `mergeSx` | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør #25, #7 |
| 5 | 19 | Generisk keyed-slice store-factory | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | muliggør #28 |
| 6 | 33 | Atomisk mutations-primitiv | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | muliggør #28 |
| 7 | 9 | `DocumentDownloadButton`-konsolidering | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør fase 4 |
| 8 | 8 | `PageTabs` + `SideTab`-komponenter | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør fase 4 |

### Fase 2 — Spine-keystones (godkendelse + golden-value-net FØRST)

De store centrale byggekloder. Hver laves som et separat, testtungt spor. Alle
rører beregning/output/UI → forelægges og får et golden-value-net før første ændring.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 9 | 23 | Regulering → kanonisk forløb | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #17 |
| 10 | 24 | Deklarativt dokument-IR (blok-model) | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #15, #11 |
| 11 | 25 | Samlet felt-state-kerne | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #12 |
| 12 | 36 | EET på kanonisk `MoneyOre`/canonical-spine | ★★★★☆ | ★☆☆☆☆ | ★☆☆☆☆ | forudsætter #17; spejler #23 |

### Fase 3 — Projektioner & konsolideringer

Den kode der kollapser til tynde lag, når spinen findes.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 13 | 16 | Split `reguleringsPresentation` + `sygeferiegodtgoerelse` | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | reg-del forudsætter #23; SFGG-del uafhængig |
| 14 | 31 | PDF/Word-paritet som struktur | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #24 |
| 15 | 32 | EO-sektion-funktioner → `Block[]` | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #24 |
| 16 | 27 | Samlet række-persistering-kerne | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | beslægtet #25 |
| 17 | 28 | Kollaps persistence læse-sti-lagstak | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | forudsætter #19, #33 |
| 18 | 30 | Konsolider validerings-ejerskab | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | beslægtet #20 |
| 19 | 20 | eoInspektion regex-row-id → struktureret metadata | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | uafhængig |

### Fase 4 — UI-dekomponering

Det yderste lag. #5 etablerer mønstret først; #26 (højeste UI-risiko) laves sidst.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 20 | 5 | Ensartet viewmodel-mønster (meta + guard) | ★★★★★ | ★★★☆☆ | ★★★☆☆ | paraply for resten |
| 21 | 1 | `AnsaettelsesforholdCard` → sektioner | ★★★★☆ | ★★★★☆ | ★★★★☆ | — |
| 22 | 6 | `Aarsloen.tsx` → VM + sektioner | ★★★★★ | ★★★☆☆ | ★★★☆☆ | forudsætter #5, #9 |
| 23 | 18 | `EetDifferencekravTab` + delt forlig-editor | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | forudsætter #5 |
| 24 | 10 | `Forsoergertab.tsx` → sektioner + VM | ★★★☆☆ | ★★★★☆ | ★★★★☆ | forudsætter #5 |
| 25 | 21 | `Indstillinger.tsx` → deklarativt register | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | del af #5-familien |
| 26 | 22 | `IndtaegtFoerSkadenSection` → under-sektioner | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | — |
| 27 | 7 | Headless `StyledDropdown` | ★★★★☆ | ★★★★☆ | ★★★☆☆ | forudsætter `mergeSx` (#12) |
| 28 | 26 | `Container.tsx` → headless keyboard-nav-hook | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | højeste UI-risiko; sidst |

### Fase 5 — Uafhængige oprydninger

Gated af intet. Kør når som helst — især som fyld, mens en keystone afventer
godkendelse. Ordnet efter værdi.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 29 | 2 | `documentService` → deklarativt download-register | ★★★★☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 30 | 3 | `fileHandleStorage` → IndexedDB-kv-primitiv | ★★★★☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 31 | 13 | `meta.schemaFingerprint` → `persistedDataVersion` | ★★★☆☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 32 | 29 | `dateRanges.ts` split + read-time `TODAY` | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | uafhængig |
| 33 | 4 | `utils/` residual parallel-helper-oprydning | ★★☆☆☆ | ★★★★★ | ★★★★★ | uafhængig |
| 34 | 14 | Fjern dupleret `sanitizeFilenamePart` i reports | ★☆☆☆☆ | ★★★★★ | ★★★★★ | uafhængig |
| 35 | 35 | Carry-forward series-opslag | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | uafhængig |
| 36 | 34 | EO schema-variant-dedup — **verificér først** | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | uafhængig |

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

- **Scope:** `varigeMenDocument.ts`, `kapitaliseringDocument.ts`, `eetEfterEalDocument.ts`, `satserDocument.ts`, `renteDocument.ts`, `shDageDocument.ts`, `forsoergertabDocument.ts` m.fl.; delt `documentGeneratorSetup.ts` (106).
- **Problem:** Fælles preamble er fanget, men hver generator gentager samme ydre skelet verbatim (`initStandardDocumentWriter → brevhoved → title → sektioner → footer → save`). Filnavn-buildere er one-liner-duplikater; `resolveDocumentArtifactFileName` hardkoder `'pdf'` før formatet kendes, hvorefter Word-writeren omskriver extension i `save` — filnavn/format-ejerskab splittet over tre filer.
- **Greenfield:** `defineDocument({ title, filenameBase, brevhoved, body: (model) => Block[] })`-factory ejer skelettet. Filnavne resolves ét sted af download-laget med det reelle format.
- **Rød tråd:** Konsolidering; forbereder #24 (label-value-generatorer er allerede næsten deklarative).
- **Afhængigheder:** Kan wrappe eksisterende generatorer før #24; delvis pilot for IR'et.

### 12 — Delt visual/range-fejl-seam for `Styled*Field` · 11

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

- **Status: 🔄 Delvist (2026-07-10).** Fundamentet står færdigt og er bevist **byte-identisk** af et golden-value-net på begge kanaler (`src/__tests__/document/tableChannelParity.golden.test.ts` + `tableGoldenCapture.ts`): (a) ren, unit-testet `resolveColumnWidths.ts` (tekstmåling injiceret; `documentTableRenderer` delegerer), (b) `tableSpec.ts` med `TableSpec`-værditypen + `compileTableSpecToLegacyParams` + `renderTableSpec` (absorberer `resolveDocumentSectionEndY`-ritualet i sin `{endY}`-retur) + `buildSummedTotalRowSpec`/`buildFormattedTotalRowSpec`. **Alle 9 standalone-generatorer migreret** (klLoenaftaler, KRL, forsørgertab, regulering, renteoversigt, løbende ydelser, årsløn, SH-dage, rente) — hver bevist byte-identisk. Compiler-kapabiliteter valideret: flex/fixed/min/auto/grow-bredder, summeret/formateret total, underline, opt-in `clearFill` (ikke alle total-rækker ryddede fill), muted rows, valign, fast `rightInset`. To korrekthedsnuancer fanget og bevaret: total-fill-rydning er ikke universel, og rentes rentedage/rentesats er bevidst PDF-højrejusteret/Word-centreret. **Mangler:** de ctx-baserede sektion-renderers inde i EO-dokumentet (`loenindkomstSection`, `offentligeYdelserSection` + `renderMidlertidigtEetSection`, `shDageSection`, `eoBilagSections`, `reguleringSection` — sidstnævnte er sværest med grow + **dynamisk** inset, hvis gren er kodet men først køres ved den migrering); opdatering af per-sektion-tests der asserterer den gamle repræsentation (justering flyttet fra `columnStyles.halign` til celler); fjernelse af døde `documentTableRenderer`-exports når sidste konsument er migreret; samt `docs/architecture/document-output-architecture.md` §7.
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
- **Rød tråd:** Bevarer ét `DocumentRenderer`-interface routet via `documentGenerationContext`; blok-modellen *er* snapshot→dokument-kontrakten, så canonical ikke kan drifte fra presentation.
- **Afhængigheder:** Keystone — opløser #15, #31, #32 og dele af #11. Højeste risiko/laveste lethed i dokument-laget; pilot på label-value-generatorerne (#11) først.

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

### 34 — EO schema-variant-dedup (uverificeret) · 7

- **Scope:** `schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` (16 KB — største schema).
- **Problem:** `eo*`-prefiksede varianter ved siden af base-modstykker (`loenudviklingOgSatserSchema` vs `eoLoenudviklingOgSatserSchema`; `loenudviklingManuelRowSchema` vs `loenudviklingManuelProcentsatsRowSchema`) antyder to parallelle former for samme domænekoncept — hvor et felt tilføjet til den ene kan drifte fra den anden. **NB: uverificeret** — filen blev ikke læst linje-for-linje, så reel duplikering vs. legitim strukturel forskel skal bekræftes først.
- **Greenfield:** Hvis varianterne har delmængde/embedding-relation: udled den ene af den anden (`base.pick()/.extend()` eller delt inder-schema wrappet to gange). Split 16 KB-sektionen i per-feature-schema-filer (svie/smerte, TAF, ferie, offentlige ydelser, lønudvikling).
- **Rød tråd:** Zod som eneste runtime-sandhed; ingen parallel schema-form.
- **Afhængigheder:** **Verificér duplikeringen først.** Schema-ændringer rører `PERSISTED_DATA_VERSION` + fingerprint-drift-gate + hver save/load-sti; må ikke ændre inferrede typer eller bryde backward-tolerant load.

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

---

## Tematisk sammenfatning

Det stærkeste gennemgående tema er, at princippet **"kanonisk beregnet én gang,
projiceret mange gange"** — som EO's snapshot/canonical/`MoneyOre`-rygrad er et
forbilledligt eksempel på — er anvendt **inkonsistent**:

- **Regulering** (#23): beregning konvergeret, præsentation ikke.
- **Dag-sæt** (#17): beregnet på begge sider af lag-grænsen. ✅ løst.
- **EET** (#36): adopterede aldrig rygraden.
- **Dokument-output** (#24, #31, #32): "format-neutralt" kun på kontrakt-niveau;
  paritet holdes af hånd-synkede stier.
- **Felt-state** (#25, #27): form-stien og tabel-stien er to kopier af samme
  trust-kritiske draft-maskine.

Det næststærkeste tema er **parallel boilerplate der aldrig blev generaliseret**:
store-slices (#19), atomiske mutationer (#33), IndexedDB-wrappers (#3),
download-funktioner (#2), download-knapper (#9), fane-scaffolding (#8),
settings-rækker (#21) — alle "samme mønster N gange" som ét factory/register
kollapser.

**Anbefalet rækkefølge (indefra-og-ud):** Byg først fase 1's kanoniske primitiver
(#17, #15, #11, #12, #19, #33) + de delte UI-primitiver (#9, #8) — de er billige,
isolerede og bærer alt det senere. Lav derefter fase 2's spine-keystones (#23, #24,
#25, #36) én ad gangen som separate, testtunge spor med golden-value-net og
godkendelse **før** første ændring. Fase 3's projektioner (#16, #31, #32, #27, #28,
#30, #20) kollapser nu til tynde lag oven på spinen. Fase 4 dekomponerer UI'et yderst
(#5 først som mønster, #26 sidst som højeste risiko). Fase 5's uafhængige
oprydninger (#2, #3, #13, #29, #4, #14, #35, #34) er gated af intet og bruges som
fyld, når en keystone afventer brugerens godkendelse. #36 (EET-rygrad) er den eneste
kandidat, der kan flytte juridisk følsomme beløb — den kræver den grundigste
golden-value-dækning før berøring.
