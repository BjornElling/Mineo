# Parallelt redesign-review — Mineo

> **Status:** Arbejdsdokument for greenfield-designet på `greenfield`-branchen.
> **Pr. 2026-08-07 er ALLE kandidater lukket.** 17 af 18 er gennemført; #46 er lukket som
> bevidst ikke gennemført efter brugerbeslutning. Ét UI/UX-spørgsmål afventer stadig brugeren
> (enhedsvalget på Anciennitetstillæg) og blokerer intet.
>
> **⇒ Start med afsnittet [START HER — arbejdsstatus](#start-her--arbejdsstatus-2026-08-07) i
> bunden af filen.** Det angiver hvad der er gjort, hvad der mangler, i hvilken rækkefølge, og
> hvilke af planens oprindelige skæringer der er modbevist og IKKE må implementeres som skrevet.
>
> **11 af planens påstande er nu modbevist** (tabellen i «Kodeverificeret baseline»). Læs den
> tabel før enhver kandidat implementeres efter sin oprindelige tekst.
>
> Fase-tabellerne og `✅`-markeringerne nedenfor er **historik**: flere af dem beskriver slettede
> mellemtrin, gamle storagekeys og gamle lifecycle-politikker. Brug dem som kontekst, ikke som
> arbejdsplan. Den kodeverificerede statuskilde er afsnittet
> **Kodeverificeret baseline (2026-08-06)**.

> **Arkitekturstatus pr. 2026-08-01:** Den tidligere `docs/architecture/draft-commit-greenfield-design.md` er afsluttet
> og fjernet. Den aktuelle inputarkitektur beskrives af `docs/architecture/input-architecture.md` og de normative
> kontrakter, og den faktiske kode i `src/inputCore/` er autoritativ. Historiske statuslinjer og formuleringer i den
> oprindelige kandidatliste må derfor ikke læses som instruktioner om at genindføre slettede slices, hooks, contextlag,
> draft-kopier eller storagekeys.

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

`AGENTS.md` fastlægger mandat og godkendelsesgrænser. De normative kontrakter er opdateret efter den samlede
greenfield-målarkitektur og gælder ved implementering. Alt der berører UI/UX med synlig betydning
eller beregningslogik forelægges, før det ændres.

**Arbejdsbranch:** Al fremtidig implementering og test af denne plan foregår på
`greenfield`-branchen. `main` forbliver produktionsgrundlag for hjemmesiderne, indtil
greenfield-arbejdet er færdigt, godkendt og særskilt integreret.

## Central instruktion til mig selv (læs først)

Dette er ikke en passiv observationsliste. **Jeg har det fulde ansvar for at
implementere ændringerne** og for at føre hver kandidat helt i mål — ikke blot at
beskrive den. Mit ansvar er at sikre, at kandidaterne faktisk opnår **det bedst
mulige slutprodukt**, og at foretage **alle** de rettelser af programmet, der kræves
for at nå dertil.

Den afsluttede draft/commit-omlægning vurderes som en gennemført, selvstændig
greenfield-etape. Nye ændringer inden for input, settle, persistence, history,
issues og kritiske handlinger skal tage udgangspunkt i den samlede `src/inputCore/`
og dens typed commands/read projections — ikke i de historiske mellemtrin, som
denne kandidatliste oprindeligt beskrev.

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
  tabellen eller i den aktuelle revurdering + en kort **Status**-linje i
  detalje-afsnittet. Planen skal altid afspejle den faktiske tilstand.

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
| 12 | 33 | ✅ Atomisk mutations-primitiv | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | muliggør #28, #41 |
| 13 | 13 | ✅ `meta.schemaFingerprint` → `persistedDataVersion` | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør #42 |
| 14 | 9 | ✅ `DocumentDownloadButton`-konsolidering | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør fase 4 |
| 15 | 8 | ✅ `PageTabs` + `SideTab`-komponenter | ★★★☆☆ | ★★★★☆ | ★★★★☆ | muliggør fase 4 |

**Første foreløbige fase-1-review (2026-07-11):** Dette var en første gennemgang af
alle 15 spor — ikke et endeligt eller udtømmende review. Gennemgangen kontrollerede kode,
kontrakter og parallelle rester og lukkede fem ikke-synlige efterarbejder: runtime-immutable
dokument-session, én fælles tom-sektionskonstruktor, fjernet ubrugt runtime-store-reference,
scope-korrekte arkitektur-fixtures og fælles kildecache også for de bevarede tekstværn.
Den fulde release-gate er kørt igen efter rettelserne. Méngradens range-adfærd er efter
brugerbeslutning gjort eksplicit: 1–120 % er gyldigt, mens over 120 % er en blokerende fejl;
øvrige procentfelters visual-only-adfærd fra #12 er uændret.

### Fase 2 — Spine-keystones (karakteriseringsnet + godkendelse FØRST)

De store centrale byggekloder. Hver laves som et separat, testtungt spor. Brug
golden-values til tal/output og en eksplicit transitionsmatrix til persistence- og
workflow-spor. Forelæg før første ændring, når UI/UX eller beregningslogik berøres.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 16 | 23 | ✅ Regulering → kanonisk forløb | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #17 |
| 17 | 24 | ✅ Deklarativt dokument-IR (blok-model) | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #15, #11, #38 |
| 18 | 25 | ✅ Samlet felt-state-kerne | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #12 |
| 19 | 42 | ✅ Versionsbåret schema-evolution for `.eo` | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | forudsætter #13 |
| 20 | 40 | ✅ Eksplicit critical-action-/commit-barriere | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #25 |
| 21 | 41 | ✅ Save/load som typed use-case + tilstandsmaskine | ★★★★★ | ★★☆☆☆ | ★☆☆☆☆ | forudsætter #33, #40, #42 |
| 22 | 51 | ✅ Typed beregningsdatakatalog + provenance | ★★★★☆ | ★★☆☆☆ | ★☆☆☆☆ | selvstændig data-keystone |
| 23 | 36 | ✅ EET på kanonisk `MoneyOre`/canonical-spine | ★★★★☆ | ★☆☆☆☆ | ★☆☆☆☆ | forudsætter #17, #37, #49; spejler #23 |

**Grundigt fase-2-review (2026-07-12):** Alle otte spor er gennemgået igen mod kode,
kontrakter, tests og repo-brede parallelle implementeringer. Reviewet lukkede de
godkendelsesfrie rester: fuldt katalogiserede offentlige overenskomstdata; rå reguleringsserier
ud af læselagene; schema-afledte EET-outputtyper og blocking-invariant; exhaustiv/synkron
dokument-IR med styrkede arkitekturværn; fælles epoch-first felt-resync; eksplicit boolsk
persistence-kvittering gennem felt-, grid- og critical-action-kæden; samt fail-closed
save/load-metadata-, migrations- og ukendt-sektionshåndtering. Tal- og dokumentgoldens er
uændrede. Den godkendte concurrency-policy i #41 er efterfølgende implementeret og testet.

### Fase 3 — Projektioner & konsolideringer

Den kode der kollapser til tynde lag, når spinen findes.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 24 | 16 | ✅ Split `reguleringsPresentation` + `sygeferiegodtgoerelse` | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | reg-del afsluttet i #23; SFGG-del gennemført |
| 25 | 31 | ✅ PDF/Word-paritet som struktur | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #24 |
| 26 | 32 | ✅ EO-sektion-funktioner → `Block[]` (omskåret) | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #24 |
| 27 | 50 | ✅ TAF-graf → ren scene-model + Canvas-renderer | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | beslægtet #24 |
| 28 | 27 | Samlet række-persistering-kerne | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | beslægtet #25 |
| 29 | 45 | ✅ Rækkefølge-lag samlet (IKKE `GridSpec` — omskåret) | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #25, #27 |
| 30 | 28 | Kollaps persistence læse-sti-lagstak | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | forudsætter #19, #33, #39 |
| 31 | 30 | ✅ Konsolider validerings-ejerskab (var reelt afsluttet) | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | beslægtet #20 |
| 32 | 20 | ✅ eoInspektion regex-row-id → struktureret metadata | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | uafhængig |

### Fase 4 — UI-dekomponering

Det yderste lag. #43 etablerer app-shellens stabile grænse; #5 etablerer
side-mønstret; #26 (højeste lokale keyboard-risiko) laves sidst.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 33 | 43 | ✅ Kanonisk page-manifest + persistent app-shell | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | forudsætter #40; før øvrig UI-dekomponering |
| 34 | 5 | Ensartet viewmodel-mønster (meta + guard) | ★★★★★ | ★★★☆☆ | ★★★☆☆ | paraply for resten |
| 35 | 44 | Feature-slicede EO-viewmodels | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | forudsætter #5; før #1, #22 |
| 36 | 1 | ✅ `AnsaettelsesforholdCard` → delt Lønudvikling-flade (omskåret) | ★★★★☆ | ★★★★☆ | ★★★★☆ | forudsætter #44 |
| 37 | 6 | `Aarsloen.tsx` → VM + sektioner | ★★★★★ | ★★★☆☆ | ★★★☆☆ | forudsætter #5, #9 |
| 38 | 18 | ✅ `EetDifferencekravTab` dekomponeret (forlig-editor bevidst urørt) | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | forudsætter #5 |
| 39 | 10 | `Forsoergertab.tsx` → sektioner + VM | ★★★☆☆ | ★★★★☆ | ★★★★☆ | forudsætter #5 |
| 40 | 21 | ✅ Enum-etiketter fik ét hjem (IKKE register — omskåret) | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | uafhængig; §2.2, uden for #5's VM-invariant |
| 41 | 22 | ✅ `IndtaegtFoerSkadenSection` → delt Lønudvikling-flade (omskåret) | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | forudsætter #44 |
| 42 | 7 | Headless `StyledDropdown` | ★★★★☆ | ★★★★☆ | ★★★☆☆ | forudsætter `mergeSx` (#12) |
| 43 | 26 | ✅ `Container.tsx` → `containerNavigation/` | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | højeste UI-risiko; sidst |

### Fase 5 — Uafhængige oprydninger

Gated af intet. Kør når som helst — især som fyld, mens en keystone afventer
godkendelse. Ordnet efter værdi.

| Sekv | ID | Kandidat | For | Let | Sik | Nøgle-afhængighed |
|:---:|:---:|---|:---:|:---:|:---:|---|
| 44 | 2 | `documentService` → deklarativt download-register | ★★★★☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 45 | 3 | ✅ `fileHandleStorage` → IndexedDB-kv-primitiv | ★★★★☆ | ★★★★☆ | ★★★★☆ | uafhængig |
| 46 | 46 | ⛔ Variant-ejede styles og build-assets (brugerbeslutning: ikke gennemført) | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | uafhængig; synlig QA/godkendelse |
| 47 | 29 | ✅ read-time `TODAY` (split ikke lavet) | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | uafhængig |
| 48 | 4 | `utils/` residual parallel-helper-oprydning | ★★☆☆☆ | ★★★★★ | ★★★★★ | uafhængig |
| 49 | 14 | ✅ Kanonisk ASCII-slug (omskåret — de to var forskellige concerns) | ★☆☆☆☆ | ★★★★★ | ★★★★★ | uafhængig |
| 50 | 35 | ✅ Carry-forward series-opslag | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | uafhængig |
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

### 5 — Ensartet viewmodel-mønster på alle persisterede fagsider (meta) · 11

- **Scope:** Alle **persisterede fagsider** (kontraktens §2.1). Har VM: EO Oplysninger/Beregning, Loenindkomst. Mangler: `Aarsloen`, `Forsoergertab`, `Satser`, `Renteberegning` (samt de tab-tunge sider `Erhvervsevnetab`/`VarigeMen`, hvis substantielle tabs — `EetDifferencekravTab`, `MenberegningTab`, `OffentligeYdelserTab` — får feature-slicede under-VM'er, jf. #44). System-/indstillingssiden (§2.2 `Indstillinger`) og informationssiden (§2.3 `Mineo`) er **bevidst uden for scope** — en VM dér ville være tom ceremoni og kollidere med kontraktens §12/§13.
- **Problem:** Tre uforenelige svar på "hvor bor afledt state + handlers": VM+kontekst, snapshot-funktion, eller alt inline. En vedligeholder kan ikke forudsige hvor logik bor.
- **Greenfield:** Én kanonisk form per persisteret fagside: `useXxxViewModel(form)` + `XxxVmProvider`/`useXxxVm()` + side reduceret til sektions-komposition. `compute*`-snapshot bevares som beregningskerne. **Invariant (afløser den tidligere ~250 LOC-gate): hver §2.1-side *har* en VM — ingen størrelses-undtagelse.** LOC-gaten var både et magisk tal og reelt tom (alle §2.1-sider ligger langt over 250); en kategorisk invariant matcher kodebasens "ét sandt sted"-linje bedre. For tab-tunge sider er enheden ét kanonisk VM-indgangspunkt per side; tab-niveau-under-VM'er er tilladt/ønskede hvor tabben er et substantielt subview (ikke et absolut "hver tab skal have VM"-krav).
- **Anti-refactor-back:** Hver VM bærer en kort rationale-linje: enten *"naturlig arkitektur"* (gælder næsten alle §2.1-sider) eller *"bevidst bevaret for ensartning"* (fx `Satser`, der er mest visning). Så en senere "denne VM er tynd, inline den"-oprydning møder et eksplicit designvalg i stedet for at gætte. Invarianten løftes samtidig ind i `page-component-contract.md` som normativ regel (dens rette hjem), så den gælder alle fremtidige §2.1-sider.
- **Rød tråd:** Håndhæver `page-component-contract`s tiltænkte mål for §2.1 — kategorisk, ikke størrelses-gated.
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

- **Status: ✅ Gennemført (2026-07-11).** To delte præsentationskomponenter i
  `components/layout/`: `PageTabs` (indkapsler den absolut-positionerede `<Tabs>`-header med
  fælles placering/`sx` + fane-guard; `minTabWidth` default 140, Erhvervsevnetab bruger 130;
  `value` accepterer `false` så EO's kontrolfaner kan markere ingen hoved-fane) og `SideTab`
  (den roterede 90° højrekant-blok med `top`-prop). Alle fire fane-sider
  (`Erstatningsopgoerelse`, `Erhvervsevnetab`, `VarigeMen`, `Renteberegning`) samt begge
  side-fane-callsites (`Erstatningsopgoerelse` ×2, `Stamdata`) er ruttet gennem dem; de
  per-side `handleTabChange`/`isAllowedTab`-wrappere til `<Tabs onChange>` er slettet (guarden
  bor nu i `PageTabs`; sidernes `usePersistedActiveTab.setActiveTab` guarder allerede selv).
  Byte-identisk styling bevaret (ren relokation, ingen synlig UX-ændring). Ny værn-test
  `PageTabs.test.tsx` (7 tests); typecheck (kilde+test), lint og page-/quality-suiterne grønne.
- **Scope:** Identisk `<Tabs>`-scaffold i `Erstatningsopgoerelse.tsx`, `Erhvervsevnetab.tsx`, `VarigeMen.tsx`, `Renteberegning.tsx`; roteret 90° `side-tab`-blok dupleret i `Erstatningsopgoerelse.tsx` (×2) og `Stamdata.tsx`.
- **Problem:** Hver fane-side re-implementerer samme absolut-positionerede `<Tabs>`-header med samme `sx` + `handleTabChange`/`isAllowedTab`-guard. Kontrakt §10.2 kræver eksplicit fælles abstraktionspunkt hvis stylingen skal være identisk — den er identisk ved copy-paste.
- **Greenfield:** Delt `<PageTabs items={[{key,label}]} activeTab onChange/>` (indkapsler positionering + sx + guard) og `<SideTab label active onClick/>`. Centraliserer også `usePersistedActiveTab`-wiringen.
- **Rød tråd:** Opfylder kontrakt §10.2's krav om fælles abstraktion.
- **Afhængigheder:** Ingen; præsentationel.

### 9 — `DocumentDownloadButton`-konsolidering · 11

- **Status: ✅ Gennemført (2026-07-11).** Alle ~14 hånd-rullede download-ikoner på tværs af 10
  filer er ruttet gennem én affordance. Den nye præsentationskerne `inputs/DownloadIconButton.tsx`
  ejer den fokusérbare 32×32 `IconButton` med delt hover/active-styling, shake-feedback og
  tooltip=aria-label; `DocumentDownloadButton` er nu en tynd, `useAppSettings`-bevidst wrapper
  (nye props: `label` til CSV-/ikke-dokumentformat-overstyring og `dataTestId`). De format-injicerede
  kald i den standalone MinProcesrente-app (`BeregnetRenteTable`, uden `AppSettingsProvider`) bruger
  kernen direkte med formatet fra prop — så konsolideringen dækker også dem uden at bryde standalone.
  Efter aftale (2026-07-11) er de tidligere adfærdsforskelle behandlet som utilsigtede og ensrettet:
  alle knapper er nu tastatur-fokusérbare (var `tabIndex={-1}` på 7 sider) og har den kontrakt-krævede
  format-bevidste tooltip/aria-label (§11.1); `renderPdfDownloadIcon` (Aarsloen) og den side-lokale
  `SnapshotDownloadButton` (EOberegningTab ×4) er slettet. Bevidst bevarede specifikke aria-labels:
  `BeregnetRenteTable` (pr. række) og RenteberegningTab-oversigten ("Download samlet oversigt"),
  så de skelnes fra per-række-downloads. Ny værn-test `DocumentDownloadButton.test.tsx` (8 tests);
  fuld suite grøn (516 filer / 6139 tests), typecheck + lint grønne. Kontrakt §11.2 mandaterede
  allerede genbrug af fælles download-knapper — ingen kontraktændring nødvendig.

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
  De statiske one-line-filnavnsbuildere er fjernet; `defineDocument` resolver nu den
  endelige `.pdf`/`.docx`-endelse fra den aktive genereringssession, og Word-writerens
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
  rene committed-projektorer uden parallel range-state/rapportering; `getVisualError`-seamen findes
  fortsat på procent (og er den ikke-blokerende form via `enforceRange={false}`).
  `numericFieldConfig` samler finite/order/fortegns-valideringen for de fem form-/tabelfelter, og
  `mergeSx` bevarer MUI's object/callback/array-kontrakt i hele `Styled*Field`-familien samt
  `StyledDropdown` og de berørte numeriske tabelfelter. Målrettet net: 8 filer/67 tests; fuld suite,
  source/test-typecheck og lint grønne.
- **Review-opfølgning (2026-07-11, brugergodkendt):** Det oprindelige #12 gjorde procent-form-feltet
  ikke-blokerende (værdi > UI-max committede + advarede uden at spærre Gem), hvilket efterlod tre
  forskellige svar på "tal uden for interval": procent-form (advarede), vs. heltal/beløb/méngrad +
  alle tabelceller (afviste straks i feltet). Efter forelæggelse valgte brugeren den strengeste,
  ensartede adfærd: `StyledPercentField.enforceRange` defaulter nu til `true`, så et tal uden for
  intervallet afvises straks i feltet og aldrig når ind i beregningen — som resten af felt-familien.
  Sikkert uden at afvise gyldige værdier, da alle nuværende procentfelters UI-interval er identisk
  med schema-grænsen (percentageDecimal 0–100, méngrad 0–120). Den ikke-blokerende seam bevares som
  eksplicit opt-in (`enforceRange={false}`) for felter hvis UI-interval bevidst er snævrere end schema.
  Beslutningen er efterfølgende afløst af fase-2-greenfield-kontrakten 2026-07-14: parsebare
  rangeværdier er canonical, mens intervalfejl afledes som issues. `enforceRange=true` er derfor kun
  migrationsadfærd for endnu ikke flyttede callsites og må ikke bruges i den nye feltmotor.
  Samtidig blev `mergeSx`-konsolideringen ført helt igennem (ud over #12's oprindelige felt-familie-scope):
  de resterende usikre `...sx`-object-spreads i tabel-inputs (`TableYear/Week/Date/Text/Amount/Dropdown`,
  `GridReadOnlyLockedCell`, `FloatingActionButton`) og de inline array-merge-former i
  `StandardGridTable`/`StandardLooseTable`/`StandardDisplayTable`/`Container`/`ContentBoxFrame` er nu
  ruttet gennem `mergeSx` — ét sted for sx-sammenfletning, MUI's callback/array-kontrakt bevaret overalt.
  Bevidst omvendt præcedens (faste layout-styles vinder over caller-`containerSx` i `StandardDisplayTable`)
  er bevaret og kommenteret. Identitets-bevarende; fuld suite grøn.
- **Scope:** `StyledIntegerField.tsx:205-292`, `StyledDateField.tsx:140-341`, `StyledPercentField.tsx:214-246`, `StyledAmountField.tsx`; kontrast: `tableInputAdapter.ts:76-87` (`getCommittedVisualError`).
- **Problem:** "Commit tilladt, men uden for UI-range → ikke-blokerende `blocksSave:false`-fejl" er re-implementeret per form-felt (state + `useEffect` + `onFieldError`), inkonsistent: Percent folder range ind i `parse` → hard block, en anden UX end Integer/Date. Config-validering (`"Ugyldig konfiguration: minValue er større end maxValue"`) er verbatim-dupleret i 5 filer.
- **Greenfield:** Tilføj `getVisualError(value)`-seam til `useStyledFieldAdapter` (spejler tabel-adapterens seam). Udtræk numerisk config-validering til delt `numericFieldConfig.ts`. Ensret Percent med Integer/Date.
- **Rød tråd:** Bringer form-felterne til tabel-cellens allerede-løste seam.
- **Afhængigheder:** Beslægtet med #25 (samme felt-familie).

### 13 — `meta.schemaFingerprint` → `persistedDataVersion` rename · 11

- **Status: ✅ Gennemført (2026-07-11).** `FormPersistenceMeta`-feltet er omdøbt fra
  `schemaFingerprint` (der aldrig holdt et fingerprint) til `persistedDataVersion`, og de to lange
  advarsels-kommentarer er væk — feltet er nu selv-forklarende. Guard'en `assertMetaFingerprintMatch`
  → `assertMetaVersionMatch` (fejlbesked `persistedDataVersion mismatch`). Stemplingen er centraliseret
  i én `stampMeta`-primitiv som `resolveMeta` og alle write-sites (hydrate/replace/clear/rollback/
  restoreHistoryFrame) nu deler — ingen inline `hydrated:true`+version-stempling mere. Den bevidste
  opdeling er bevaret: runtime-version-guarden (`PERSISTED_DATA_VERSION`) vs. den test-tids CI-drift-gate
  (`computeSchemaFingerprint` i `schemaFingerprint.ts`) er urørt. Ingen persisteret struktur berørt —
  `meta` stemples altid friskt ved hydrering (læses aldrig fra den persisterede blob). Fuld suite grøn
  (6131 tests / 515 filer), typecheck + lint grønne; 33 testfiler mekanisk migreret.

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

- **Status: ✅ Gennemført (2026-07-10).** Fundamentet + alle konsumenter blev migreret og bevist **byte-identisk** af golden-value-net på begge kanaler: `src/__tests__/document/tableChannelParity.golden.test.ts` (+ `tableGoldenCapture.ts`) for de 9 standalone-generatorer, og `src/__tests__/document/eoSectionTableParity.golden.test.ts` for EO-dokumentets ctx-baserede bilag-sektioner. Byggekloderne var den rene, unit-testede kolonnefordeling og `TableSpec` med total-builders. **Alle 9 standalone-generatorer** (klLoenaftaler, KRL, forsørgertab, regulering, renteoversigt, løbende ydelser, årsløn, SH-dage, rente) **OG alle ctx-baserede EO-sektioner** blev migreret. Compiler-kapabiliteterne dækker flex/fixed/min/auto/grow-bredder, summeret/formateret total, underline, universel total-række-rydning, muted rows, valign samt fast og dynamisk `rightInset`. #31 har efterfølgende gjort `TableSpec` helt kanalneutral og flyttet kompilering/rendering til hver kanal; PDF-goldens er uændrede, mens Word-goldens er opdateret til den godkendte paritetspræsentation.
- **Scope:** `src/document/layout/documentTableRenderer.ts` (1006), `documentTableBridge.ts` (56); `getDoc()` + `renderDocumentTable` + `resolveDocumentSectionEndY`-dansen i ~15 generatorer.
- **Problem:** Nominelt i det format-neutrale lag, men importerer `jspdf-autotable`; ~900 linjer er ren PDF (adaptiv kolonne-redistribution, symbol-keyed layout, underline via `didDrawCell`). Word er én early-return-branch der rekonstruerer alignment fra et **separat** beregnet map → canonical-vs-presentation-drift. `finalY`-returværdien er meningsløs på Word, men hver generator udfører `resolveDocumentSectionEndY`-ritualet.
- **Greenfield:** En `TableSpec`-værditype (rows, per-kolonne-intent fixed/flex/grow + align, total-descriptors) uden render-viden. Kolonne-bredde bliver en ren, unit-testet funktion. Hver renderer forbruger `TableSpec` nativt → alignment defineres én gang, begge kanaler læser samme felt.
- **Rød tråd:** Format-neutralt lag bliver faktisk format-neutralt; bygbar bag eksisterende `renderDocumentTable`-signatur, tabel-for-tabel.
- **Afhængigheder:** Delmængde af #24; mest tilgængelige høj-forbedrings-dokument-kandidat. Rører tal → kræver bredde/afrundings-tests.

### 16 — Split `reguleringsPresentation` + `sygeferiegodtgoerelse` · 10

- **Status: ✅ Gennemført (2026-07-13).** Reguleringsdelen blev afsluttet i #23. Den
  1.535-linjers SFGG-monolit er slettet og erstattet af afgrænsede moduler for kilde,
  referencesats, periodisering, segmentering, beregning pr. ansættelsesforhold, resultatmodel
  og warnings. `sfggEngine.ts` er nu en 110-linjers orkestrator, der kun etablerer det globale
  TAF-/loftgrundlag, kalder ansættelsesberegningen og samler totaler/per-år. Validator og
  viewmodel læser kun referencesats/kilde; snapshot og row-builder læser warnings; øvrige
  konsumenter bruger den særskilte resultatmodel. Præsentationstekst forbliver i den
  eksisterende teksthelper. Den gamle 2.491-linjers testmonolit er tilsvarende opdelt efter
  modulerne, og et nyt komplet flerårs-golden låser hele resultatobjektet inklusive segmenter,
  tekster, ansættelses-/global `perYear` og øre-restfordeling. Fire AST-grænser låser desuden
  engine-, ansættelses-, segmenterings- og warning-ejerskabet. Tal og synlig adfærd er uændrede.
- **Scope:** `engines/reguleringsPresentation.ts` (1792; to store præsentationsflows), `engines/sygeferiegodtgoerelse.ts` (1535; `computeSygeferiegodtgoerelse` alene 374 LOC).
- **Problem:** To organisk-voksede monolitter der hver ejer ren beregning, penge-afrunding, display-streng-samling og orkestrering. `sygeferiegodtgoerelse.ts` importeres af validator, snapshot og row-builders uden internt seam mellem "ren SFGG-matematik" og "SFGG-præsentation".
- **Greenfield:** Split langs de faktiske ansvarsgrænser: `sfggKilde.ts`,
  `sfggReferencesats.ts`, `sfggPeriodisering.ts`, `sfggSegmentering.ts`,
  `sfggAnsaettelsesforhold.ts`, `sfggResult.ts`, `sfggEngine.ts` (tynd orkestrator) og
  `sfggWarnings.ts` (snapshot-/row-builder-vendt). Præsentationstekst bliver i
  `helpers/sygeferiegodtgoerelseTexts.ts`. `reguleringsPresentation.ts` foldes ind i #23.
- **Rød tråd:** SFGG har allerede `Calculable`/`MoneyOre`-disciplin; split udnytter det.
- **Afhængigheder:** Regulerings-delen forudsætter/overlapper #23.

### 17 — Kanonisk dag-set-algebra · 10

- **Status: ✅ Gennemført (2026-07-09; genverificeret 2026-07-11).** Duplikeret `buildSHDageSet` i kontrol-laget slettet; den range-baserede ferie-builder flyttet til motoren som `buildFerieDageSetForPeriode`, nu en tynd komposition over `buildFerieDageSet` + `placeLoseFeriedage` (parallel kopi elimineret). `eoInspektion` forbruger read-only. Byte-identitet bevist i `tafDaySets.equivalence.test.ts`. Dag-set-algebraen bliver bevidst i `engines/tafDaySets.ts`, fordi ferie-/TAF-sættene er EO-domænepolitik; kun den reelt neutrale SH-primitiv ligger i `domain/dates/`.
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
  (#28) er bevidst ikke rørt her. Det første foreløbige fase-1-review fjernede desuden de to parallelle
  tom-sektionskonstruktorer i runtime/context; begge bruger nu factoryens eksporterede
  `createEmptyFormPersistenceSections`.

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

- **Status: ✅ Gennemført 2026-08-07, men OMSKÅRET — intet register.** Kandidaten som skrevet
  må ikke implementeres: kun 7 af 18 felter er ensartede. Det faktisk løste problem var, at
  enum-etiketterne var duplikeret 3× pr. enum, heraf ind i `eoRowEvaluation`. Se «Gennemført
  2026-08-07 (tredje omgang)».

- **Scope:** `src/components/pages/Indstillinger.tsx` (628).
- **Problem:** ~20 nær-identiske `row--label-right-hover`-blokke, hver hånd-wirer en kontrol til `updateSettings({...})` med inline type-guard og bespoke closure. Directory-picker-side-effekt blandet ind. En statisk form beskrevet imperativt 20 gange.
- **Greenfield:** Deklarativt settings-register: `SettingsRow` drevet af descriptor (`{ label, control, key, options, guard }`) grupperet i sektioner. Directory-picker → `useDefaultDirectorySetting()`. 628 linjer → data-tabel + lille renderer; ny indstilling = én descriptor.
- **Rød tråd:** Deklarativt frem for imperativt gentaget; device-lokale settings (ikke `.eo`).
- **Afhængigheder:** Uafhængig af #5's VM-invariant — `Indstillinger` er en §2.2-side og bevidst uden for VM-kravet. Beslægtet med #5-familiens side-dekomponerings-tema, men målet her er et deklarativt control-descriptor-register, ikke en VM. Kræver kun en lille typet control-descriptor-abstraktion.

### 22 — `IndtaegtFoerSkadenSection` → under-sektioner · 10

- **Scope:** `eoOplysninger/sections/IndtaegtFoerSkadenSection.tsx` (791 — største fil i den ellers eksemplariske `sections/`-mappe).
- **Problem:** Selve reference-dekomponeringens største sektion er selv en god-komponent (større end de fleste hele sider): samler indkomst-før-skade-input, løntrin-finder-trigger og lønudviklings-håndtering.
- **Greenfield:** Split i `sections/indtaegtFoerSkaden/`-undersektioner med samme `useEoOplysningerVm()`-mønster mappen allerede bruger. Afslutter det arbejde mappen startede.
- **Rød tråd:** Samme etablerede kontekst-mønster; ren JSX-split.
- **Afhængigheder:** Ingen.

### 23 — Keystone: Regulering → kanonisk forløb · 9

- **Status: ✅ Gennemført (2026-07-11).** De fire reguleringsformer med en selvstændig
  kildeserie (`Manuel procentsats`, `KRL satstabel`, almindelig `Statistik` og
  `KL-lønaftaler`) emitterer allerede serien sammen med segmenterne fra formregisteret; den
  manglende snapshotbro er nu lukket, så både dokument- og kontrolprojektionen modtager præcis
  dette forløb. Alle `build*IndexEntries`-fallbacks er fjernet fra
  `reguleringsPresentation` og `eoInspektionRegulationCore`: manglende/mismatchet forløb
  fail-closer tabellen i stedet for at genindlæse rå satsdata. Et AST-værn forbyder fremtidige
  direkte serie-imports i de to læselag. Kontrollaget genberegner fortsat selve indeksforholdet
  ud fra den kanoniske serie; dette er en bevidst, værdifuld krydskontrol og ikke en parallel
  kilderegel. Visionens universelle `forloeb` for alle former er præciseret: ASL,
  `Manuelt angivet` og overenskomst har ikke en selvstændig serie, der bør opfindes alene for
  at passe i unionen; de deler allerede deres kanoniske opslag/formelprimitiver, mens kontrollens
  aritmetik forbliver uafhængig. Tal, tekster og dokumentlayout er uændrede; golden-nettet dækker
  169 regulerings-/kontrol-/snapshottests før/efter omlægningen.

- **Scope:** `engines/reguleringsPresentation.ts` (1726), `eoInspektion/eoInspektionRegulationCore.ts` (966), R1-strategi-registret `engines/regulering/` + `forms/*`.
- **Problem:** R1 konvergerede *beregnings*-stien (registret `FORM_REGISTRY`), men de to *præsentations*-stier adopterede det aldrig: både `reguleringsPresentation` og `eoInspektionRegulationCore` re-deriverer per-form-serier direkte (`buildStatistikIndexEntries`, `buildKrlIndexEntries`, `buildKlLoenaftalerIndexEntries`) med `forloeb`-fallback. Per-form-regulerings-viden findes i **tre** parallelle steder. Arch-doc flagger det selv som uafklaret gæld (§8, §16.A).
- **Greenfield:** Udvid R1 til endestationen: hver form med en selvstændig kildeserie udsender
  serien sammen med segmenterne som ét kanonisk resultat. Læselagene formatterer/krydstjekker
  resultatet uden at genindlæse serien. Former uden selvstændig serie deler i stedet deres
  kanoniske opslag/formelprimitiver; der opfindes ikke et kunstigt forløb alene for typeuniformitet.
  Slet alle `buildXIndexEntries`-fallbacks.
- **Rød tråd:** "Kanonisk beregnet én gang, projiceret mange gange" — snapshot-first-princippet, som EO-kernen ellers følger.
- **Afhængigheder:** Opløser regulerings-delen af #16; forudsætning for at #15/#24 kan rendere regulering rent. Trust-kritisk kerne → golden-value-net (`reguleringSilentPathAlignment.test.ts` m.fl.) før arbejde.

### 24 — Keystone: Deklarativt dokument-IR · 9

- **Status: ✅ Gennemført (2026-07-11).** Alle generator-entrypoints og EO-sektioner bygger
  nu én immutable, kanalneutral `DocumentModel` gennem `DocumentComposer`. Den lukkede
  blokalgebra dækker tekst, label/value, spacing/keep-with-next, sideskift, `TableSpec`,
  atomiske grupper, underskrift, brevhoved, vandmærke, flow-billede og footer.
  `DocumentGenerationSession` ejer rendering og udleverer ikke længere writer-fabrikken;
  generatorlaget har nul adgang til kanal, cursor eller dokumentmål. Tre AST-regler
  håndhæver grænsen, og PDF-/Word-golden-nettet er uændret. `DocumentWriter` er bevaret som
  intern render-target-adapter. #31 har efterfølgende afsluttet kanalprimitiv-pariteten;
  #32 ejer fortsat oprydning af EO-sektionernes store formatter-/dependency-contexts.
- **Scope:** `document/writer/documentWriter.ts` (kontrakt), `pdf/infrastructure/pdfWriter.ts` (953), `docx/infrastructure/docxWriter.ts` (760), alle ~18 generatorer.
- **Problem:** `DocumentWriter` er en imperativ PDF-cursor (`getY/setY/ensureSpace/advanceY`) — i Word er hver af disse no-ops. `getDoc()` er en "ærlig union" der indrømmer at kanalen lækker; `getPageWidth()` returnerer mm på PDF, twips på Word; `getTextWidth` divergerer. Paritet holdes af hånd-synkede kodestier + kommentarer, ikke af struktur.
- **Greenfield:** Vend retningen om: generatorer udsender en **deklarativ blok/flow-model** (Title, Section, LabelValueRow, Table, Signature, PageBreak…) uden Y-koordinater. To rene renderere (`PdfRenderer`, `DocxRenderer`) forbruger modellen; paginering bliver internt PDF-anliggende. Paritet bliver strukturel (begge går samme træ).
- **Rød tråd:** Bevarer ét `DocumentRenderer`-interface, men routet via den eksplicitte session fra #38; blok-modellen *er* snapshot→dokument-kontrakten, så canonical ikke kan drifte fra presentation.
- **Afhængigheder:** Keystone — forudsætter #15, #11 og #38; opløser #31 og #32. Højeste risiko/laveste lethed i dokument-laget; pilot på label-value-generatorerne (#11) først.

### 25 — Keystone: Samlet felt-state-kerne · 9

- **Status: ✅ Gennemført (2026-07-11).** Efter forelæggelse valgte brugeren en **ren, surface-agnostisk
  invariant-kerne** frem for planens bogstavelige "én mega-hook, to adaptere" (som blot ville flytte den
  parallelle adfærd ind i konfigurationsflag). De seks spejlede trust-kritiske stykker er nu samlet i
  `src/hooks/fieldState/`, som BEGGE hooks forbruger: (1) `fieldResyncMachine.ts` — én ren, React-uafhængig
  beslutningsfunktion for pendingCommit-guard + autoritativ-epoch-resync + aktiv-redigering-guard (events
  ind → deklarativt `FieldResyncCommand` ud; de to hooks udfører `setDraft`/ryd-pending/epoch-ref/touched-
  side-effekter); (2) `useInvalidDraftSlot.ts` — den bundne-kanal-vs-lokal-fallback-forgrening; (3)
  `shouldDeriveInvalidDraftError.ts` — den delte "vis kun fejl når draften VISER råstrengen"-gate; (4)
  `elementHasPhysicalFocus.ts` — det fysiske-fokus-værn. Restore-suppression var allerede delt
  (`isRestoreFocusInProgress`). `useDraftField` og `useTableInputCore` forbliver bevidst to adskilte, tynde
  surface-ejere (DOM/editor/keyboard/paste/lifecycle) med deres egne adapter-kontrakter (`DraftParse` vs
  `TableInputAdapter` — genuint forskellige surfaces, IKKE forenet). **Klassificeret divergens:** karakteriserings-
  nettet afslørede ét reelt adfærdspunkt hvor de to afveg (epoch-bump midt i et pending-hold: form udskyder,
  grid resyncer straks). Efter brugerens reservation blev det IKKE stiltiende ophøjet til "golden"; det er
  efter review konvergeret til den fælles epoch-first-invariant, fordi formens no-op commit ellers
  kunne blokere et senere autoritativt replace permanent. Net: nye
  `fieldResyncMachine.test.ts` (adfærdsmatrix, 8) + `useInvalidDraftSlot.test.ts` (2); det eksisterende
  felt/grid/undo-net (56 filer / 471 tests) beviser identitet på begge surfaces; typecheck + lint grønne.
- **Scope:** `hooks/useDraftField.ts` (320) + `useStyledFieldAdapter.ts` (416) vs `hooks/tableInput/useTableInputCore.ts` (663); parallelle kanaler `useFieldInvalidDraftChannel` vs `useCellInvalidDraftChannel`; parallelle adapter-kontrakter `DraftParse` vs `TableInputAdapter`.
- **Problem:** To hooks implementerer den *samme* trust-kritiske draft-state-maskine to gange, med kommentarer der åbent kryds-refererer hinanden ("spejler useDraftField"): optimistisk-commit-guard, authoritative-epoch-resync, physical-focus-guard, undo-restore-suppression, fejl-re-derivation, invalid-draft-branching. Hver fremtidig draft/undo-rettelse skal spejles i to filer.
- **Greenfield:** Én felt-state-kerne parameteriseret af én adapter-kontrakt, med en tynd "surface"-seam (`<input>` vs grid-celle-editor-handle). De delte parse-kerner (`integerDraftCore` m.fl.) bliver kernens parse-lag; én invalid-drafts-kanal-abstraktion; én epoch-resync; én `pendingCommit`-guard. `useStyledFieldAdapter` og grid-editor-handlen bliver to adaptere over kernen.
- **Rød tråd:** Realiserer den "delte commit/edit-lim" som `useStyledFieldAdapter`s header allerede stræber mod — tabel-stien tilsluttede sig aldrig.
- **Afhængigheder:** Relateret til #27 (række-persistering) og #12 (fejl-seam). Højeste blast-radius i appen (hvert input + undo/redo + save-gating) → tung test før ændring.

### 26 — `Container.tsx` → headless keyboard-nav-hook · 9

- **Status: ✅ Gennemført 2026-08-07.** Container 584 → 107 l.; navigationen i
  `containerNavigation/` delt efter fejlmåde. Det stærke argument var utestbarhed (jsdom har
  intet layout), ikke LOC-andelen. Se «Gennemført 2026-08-07 (tredje omgang)».

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

- **Status: ✅ Gennemført (2026-07-13).** #24's fælles `DocumentModel` er nu den eneste
  indholdskilde helt frem til begge kanalrenderere. `DocumentWriter` er semantisk og eksponerer
  ingen kanalobjekter, cursor, koordinater eller tekstmåling. `TableSpec` er ren data og renderes
  direkte af PDF og Word; tabelbroen er slettet, og PDF's tabelmotor ligger i PDF-kanalen.
  Vandmærke og footer har én modelautoritet. Den godkendte synlige Word-paritet er gennemført:
  korte totalstreger, samlet og centreret signatur, fælles tabelbredder/alignment, dæmpede rækker,
  totalrækker, tabeltypografi samt fælles overskrifts-, spacing- og keep-intentioner. PDF-outputtet
  er bevaret af eksisterende goldens; Word-goldens låser den godkendte nye præsentation.
- **Scope:** `pdf/infrastructure/pdfWriter.ts` (953) vs `docx/infrastructure/docxWriter.ts` (760); `docxStyles.ts`, `docxWatermark.ts`, `pdfBrevhovedRenderer.ts`, `documentFooterImage.ts`.
- **Oprindeligt problem:** #24 sikrede én fælles bloksekvens, men kanal-targets fortolkede
  flere semantiske intentioner forskelligt. `writeLeftRightText` målte præcist i PDF og
  estimerede i Word; signatur, brevhoved og tabeller havde parallel layoutlogik; Word-tabeller
  tabte bl.a. kolonnebredder, dæmpning og totalstreg i tabelbroen. Sum-linjen over totaler blev
  tegnet som en præcis linje i PDF, men som hele højre celles topkant i Word.
- **Greenfield:** Behold #24's deklarative IR som eneste input, men lad hver kanal fortolke
  hele semantiske blokke uden fælles PDF-cursor-API. `TableSpec` bliver ren semantisk data og
  renderes direkte af hver kanal; sumstreg, signatur, brevhoved, vandmærke og footer har én
  modelautoritet. Modeldispatch-tests og kanal-goldens låser både struktur og godkendt præsentation.
- **Rød tråd:** Struktur frem for hånd-synk; navngivne docx-styles bevares.
- **Afhængigheder:** Koblet til #24; svær standalone uden bare at flytte duplikeringen. Rører de præcise pixels brugeren inspicerer i signerede dokumenter.

### 32 — EO-sektion-god-funktioner + DI-container · 8

- **Scope:** `document/generators/eo/sections/opgoerelseSection.ts` (836), `reguleringSection.ts` (680), `eoBilagSections.ts` (558); samlet i `erstatningsopgoerelseDocument.ts`.
- **Problem:** `renderOpgorelseSection` tager en `OpgorelseSectionContext` med ~40 felter der re-bundter writer-metoder + et dusin penge/dato-formattere + invariant-assertere — en bespoke DI-container hånd-wiret som objekt-literal. Penge-formatter-sættet defineres lokalt *og* trådes gennem context'en, mens implementeringerne allerede bor i `documentFormatUtils.ts`. `writer` sendes både som løftede metoder *og* som nested `writer`-sub-objekt.
- **Greenfield:** Sektioner bliver rene `(EoModel) => Block[]`-funktioner der returnerer IR'et fra #24 — ingen writer, ingen formatter-bundle (formattering påføres ved bygning af IR-noder, kun fra `documentFormatUtils`). Udvid `eoSnapshotToEoDocument` så sektioner modtager en fuldt projiceret model.
- **Rød tråd:** Snapshot→dokument-projektion; ét formatter-sted.
- **Afhængigheder:** Koblet til #24; context-objektet er dybt viklet ind i cursoren. Flagskibs-dokumentet → høj konsekvens.

### 33 — Atomisk mutations-primitiv i `FormPersistenceContext` · 8

- **Status: ✅ Gennemført (2026-07-11).** `runAtomicPersistenceMutation({ operation,
  affectedStorageKeys, captureUndo?, mutate })` i `utils/persistenceStoreRollback.ts` ejer nu
  backup/commit/rollback for ALLE seks muterende metoder. Primitiven sikkerhedskopierer de berørte
  sessionStorage-nøgler + hele committed-tier store-state (og valgfrit undo/redo-historikken via
  `captureUndo`), kører `mutate`, og gendanner fail-closed ALT hvis den kaster — hvorefter en samlet
  rollback-fejl kastes videre. De fem-seks strukturelt identiske try/catch-transaktioner er væk;
  hver metode er nu en tynd beskrivelse af "hvad ændres" (+ sit eget notice/return-fejlrapport-lag).
  De private `attemptRollbackStep`/`createRollbackError`/`restoreStorageValue` er flyttet ind i
  primitiven. Undo-frame-**coalescing** ("ét felt-commit → præcis ÉN frame") er flyttet fra en
  React-ref i provideren ned i undo-laget som `undoRedoStore.captureValueCommit` /
  `captureCoalescing` / `consumeCoalesceMarker` (det er undo-semantik); den asymmetriske markør +
  microtask-backstop er byte-identisk bevaret. Adfærd er bevist uændret af det eksisterende tunge net
  (persistData/replaceAll/clearPage/clearAll-revision/epoch + rollback-injektion + cross-channel
  coalescing-værn), suppleret med `runAtomicPersistenceMutation.test.ts` (backup/commit/rollback +
  captureUndo-toggle + rollback-fejl-aggregering) og direkte coalescing-tests i `undoRedoStore.test.ts`.
  Grønt: fuld suite (515 filer / 6131 tests), `typecheck` + `typecheck:test` + `lint`.
- **Review-note (2026-07-11):** Fase-1-reviewet bekræftede, at `atomicWritePersistenceSections`
  (`persistenceSnapshotStorage.ts`) bevidst lever videre som en *anden* atomisk-skrive-primitiv i
  undo-stien med en snævrere rollback-scope (kun sessionStorage, caller-ejet store-rollback). #33's
  status hævder ikke at have merget dem, så det er ærligt — men den fulde sammenlægning (undo-stien
  føres over på `runAtomicPersistenceMutation`, eller den bevidste forskel dokumenteres ved callsite)
  hører til **#41** (save/load-tilstandsmaskinen), ikke fase 1. Ikke en fase-1-mangel.

- **Scope:** `contexts/FormPersistenceContext.tsx`: `persistData`, `writeInvalidDraft`, `replaceAllPersistedData`, `clearPageData`, `clearAllData`, `reconcileInvalidDrafts`; `utils/persistenceStoreRollback.ts`, `persistenceSnapshotStorage.ts`.
- **Problem:** Hver muterende metode re-implementerer samme transaktion i hånden (læs forrige sessionStorage → capture rollback + undo-snapshot → skriv → capture undo-frame → commit store → på `catch` bespoke rollback-sekvens). 5-6 strukturelt identiske try/catch. `atomicWritePersistenceSections` findes allerede som primitiv (brugt af undo-stien), men context-metoderne bruger den ikke. Undo-coalescing-markør-logik er inline-koblet til mutations-koden.
- **Greenfield:** Én `runAtomicPersistenceMutation({ affectedStorageKeys, mutate, captureUndo })`-primitiv der ejer backup/commit/rollback (udvid `atomicWritePersistenceSections`). De fem metoder bliver tynde beskrivelser af "hvad ændres". Flyt coalescing-beslutningen til undo-laget (det er undo-semantik).
- **Rød tråd:** Én atomisk-write-primitiv; context mod tynd facade (kobler til #28).
- **Afhængigheder:** Trust-kritisk save-sti; coalescing/undo-samspillet er subtilt ("præcis én undo-frame per commit"). Kræver tungt test-net før berøring.

### 34 — EO schema-variant-dedup — udgået · 7

- **Status: ❌ Udgået som kandidat (2026-07-10).** Den efterfølgende verifikation viste, at filen allerede udleder varianterne gennem `createLoenudviklingOgSatserSchema(...)`; den påståede parallelle schema-form findes ikke længere. Filen er 363 linjer, og en ren filopdeling uden et konkret grænseproblem ville være ændring for ændringens skyld. Kandidaten er derfor fjernet fra byggerækkefølgen, men ID'et bevares som historik.

### 35 — Carry-forward series-opslag · 7

- **Status: ✅ Gennemført 2026-08-07. Planens «blokeret» var MODBEVIST** — abstraktionen
  fandtes allerede med 10 callsites og manglede kun en nøglevælger. Se «Gennemført 2026-08-07
  (tredje omgang)».

- **Scope:** `data/offentligLoenLookup.ts` (binær søgning), `data/krlRates.ts`, `data/overenskomstRates.ts`, `data/klLoenaftaler.ts`, `data/statistiskeRates.ts`; allerede-delt: `data/rateSeriesIntegrity.ts`.
- **Problem:** Integritets-primitiverne (sortering, no-interior-gap) er allerede konsolideret (R5, godt). Men *lookup*-halvdelen er stadig per-fil: hver kilde har sin egen "find nyeste entry med `effectiveDate ≤ target`" (én binær søgning, resten lineær scan) + sit eget `getReguleringsDatoIntervalFor*`. Samme carry-forward-semantik implementeret 4-5 gange — hver et sted en subtil off-by-one kunne give stille mis-regulering.
- **Greenfield:** Delt generisk `carryForwardSeries<T>(sortedDescendingByDate)` → `{ at(date), interval(), datoer() }`, parallelt til de eksisterende integritets-primitiver. Hver kilde bygger sin typede serie én gang.
- **Rød tråd:** Delt primitiv som integritets-laget; generede satstabeller urørt.
- **Afhængigheder:** Lav-forbedring (den risikable integritets-del er allerede delt). Fodrer faktiske erstatningstal → høj bar; signaturer varierer.

### 36 — EET på kanonisk `MoneyOre`/canonical-spine · 6

- **Status: ✅ Gennemført (2026-07-12).** Alle offentlige pengebeløb i EET's fire
  projektioner og mer-erstatning er nu branded `MoneyOre` efter de hidtidige, domænespecifikke
  afrundingspunkter; procent-, faktor- og højpræcisionsmellemregninger forbliver tal. Det fulde
  `EetSnapshot` er ét strengt Zod-valideret canonical output, og schema-/runtimefejl fail-closer
  med eksplicit blokerende issue. Differencekravets skjulte søsterkald er flyttet til en
  eksplicit beregningsgraf, mens aggregatoren kun modtager komponerede resultater; et AST-værn
  låser grænsen. EO modtager nu en revisionsbåret, Zod-valideret EET-import-context i stedet for
  rå EET-values, og øre konverteres først til kroner ved `AmountValue`-porten. Forsørgertab bruger
  en eksplicit EAL-adapter uden at mutere EET-output. Før migrationen blev hele snapshotet,
  alle fire projektioner, mer-erstatning, afrundingsgrænser og EO-importen låst med
  krone-normaliserede goldens; de er fortsat identiske efter omlægningen. Den fulde
  `verify:release`-gate er grøn med 528 testfiler og 6.252 tests.
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

- **Status: ✅ Gennemført (2026-07-11; genverificeret 2026-07-11).** Den modul-globale `activeContext`, fallback-
  fabrikken, pending-promise-listen og writer-routeren er fjernet. Hvert downloadforløb
  får nu en immutable `DocumentGenerationSession` med format og writer-fabrik; alle
  generatorer modtager sessionen eksplicit og returnerer et `DocumentArtifact` med blob
  og formatkorrekt filnavn. Begge writere afslutter via `build(): Promise<Blob>`, og kun
  service-laget udløser browser-downloaden. Et nyt samtidighedsnet afslutter PDF og Word
  i omvendt rækkefølge og beviser, at format, filnavn og blob ikke krydser sessioner;
  det eksisterende PDF-/Word-/generator-golden-net er bevaret grønt. Reviewet lukkede
  den sidste type/runtime-forskel: sessionsobjektet fryses nu faktisk ved oprettelsen.

- **Scope:** `document/documentGenerationContext.ts`, `writer/documentWriterRouter.ts`, `docxWriter.ts`, `documentService.ts` og alle generator-entrypoints.
- **Problem:** `activeContext` er modul-global state, der lever hen over `await`. Samtidige downloads kan overtage hinandens format/writer og gendanne kontekster i forkert rækkefølge; Word-writerens `save()` registrerer desuden en global pending-promise i stedet for at returnere sit artefakt. #24 bevarede oprindeligt netop denne kontekst og dækkede derfor ikke problemet.
- **Greenfield:** Én eksplicit `DocumentGenerationSession` gives til generator/renderer. Rendereren returnerer `Promise<DocumentArtifact>`; service-laget ejer den eneste download-side-effect. Fjern `activeContext`, fallback-factory, `registerPendingDocumentDownload` og writerens skjulte `save()`-kanal.
- **Rød tråd:** Eksplicit dataflow og én artefaktgrænse for PDF/Word; ingen skjult async-global state.
- **Afhængigheder:** #11 letter callsite-migreringen; #24 er den naturlige slutform. Kræver parallel-download-tests og eksisterende kanal-golden-net.

### 39 — Persistence initialiseres før React-render · 9

- **Status: ✅ Gennemført (2026-07-11; genverificeret 2026-07-11).** `initializePersistenceRuntime()` bygger nu hydration-planen, hydrater det autoritative Zustand-store atomisk og rydder read-model-cache før `root.render`. Begge app-entries kalder initialiseringen i `renderApp` efter variantens namespace/device-gate og før app-træet oprettes; unsupported-device hard-stop initialiserer fortsat ingen sagsstate. Den færdige cleanup-/notice-plan føres eksplicit gennem app-roden til en render-ren `FormPersistenceProvider`, som kun ejer startup-notice og efterfølgende cleanup af afviste storage-nøgler. Provider-remount kan derfor ikke længere genlæse `sessionStorage` eller overskrive committed state. Det nye runtime-karakteriseringsnet beviser første-render-hydrering, uændrede section revisions/committed counter, ét autoritativt epoch-bump, rydning af runtime-fejl, invalid-draft-revision og remount-bevarelse; eksisterende persistence-konsumenttests er migreret til eksplicit runtime. Reviewet fjernede den ubrugte store-reference fra runtime-objektet; storen er fortsat den importerede singleton og hydreres før objektet returneres.

- **Scope:** `contexts/FormPersistenceContext.tsx:120-136`, `persistenceSessionHydration.ts`, `formPersistenceStore.ts`, `bootstrapClientApp.tsx` og begge app-entries.
- **Problem:** `FormPersistenceProvider` læser `sessionStorage`, bygger hydration-plan, muterer det globale store med `hydrate()` og rydder read-model-cache inde i en `useState`-initializer. Begge roots renderer under `React.StrictMode`; render er dermed uren, provider-remount kan rehydrere, og startup-rækkefølgen er bundet til en global singleton.
- **Greenfield:** `initializePersistenceRuntime(...)` kører én gang før `root.render`, efter variantens namespace er fastlagt, hydrerer den autoritative store og returnerer startup-notice/cleanup-planen. Provider modtager den færdige runtime og er en ren facade uden autoritativ init-side-effect.
- **Rød tråd:** Store er source of truth; hydration er én eksplicit autoritativ replacement før nogen children kan læse state.
- **Afhængigheder:** Laves før #19/#28/#33. Revisions-, epoch-, `invalidDrafts`- og notice-semantik skal karakteriseres state-identisk.

### 40 — Eksplicit critical-action-/commit-barriere · 9

- **Status: ✅ Gennemført (2026-07-12).** Én app-lokal, typed
  `CriticalActionCoordinator` ejer nu den navngivne policy for gem, manuel/PWA-load,
  sidenavigation og undo/redo. Formfelter, grid-controllere og tabelrækkernes pending
  persistence registreres eksplicit med symmetrisk lifecycle; coordinatoren returnerer
  `committed | blocked`, serialiserer samtidige preparationer og afventer kun deltagernes
  konkrete commit-/persistence-promises. DOM-tabelscanning, `activeElement`-baseret
  editor-detektion, Promise-tick og to faste animation frames er fjernet sammen med
  `commitFlush.ts`. Den skjulte tabel-row-effect er gjort til en eksplicit kvitteret
  pipeline, så save/load/navigation ikke kan overhale en netop committet grid-række.
  Observerbar policy er bevaret: Gem committer åbne felter/grids; load/navigation
  blokerer åbne form-editorer men forsøger grid-commit; undo/redo er stille no-op ved
  enhver åben editor. En ny tværgående `critical-action-contract.md` og et direkte
  action×surface-transitionstestnet fastholder grænsen.
- **Scope:** `utils/commitFlush.ts`, `gridCoreRegistry`, `MainLayout`, `useFileSaveLoad`, `useUndoRedoShortcuts` og felt-/grid-surface fra #25.
- **Problem:** Save/load/navigation finder aktive grid-editorer via DOM-query + global registry, blur'er `document.activeElement` og venter en Promise-tick plus to animation frames på, at commits "falder til ro". Tre kritiske handlinger bruger to forskellige guard-funktioner, og korrekthed afhænger af render-timing frem for et eksplicit lifecycle-signal.
- **Greenfield:** Én registreret `CriticalActionCoordinator` med typede commit-deltagere. `prepare(action)` returnerer deterministisk `committed | blocked(target)` og afventer kun eksplicitte commit-promises/events — aldrig DOM-scanning eller faste frames. Save, load, navigation og undo bruger samme barriere med navngiven policy.
- **Rød tråd:** Imperative, auditerbare commits og én grænse for alle handlinger der kan unmount'e eller erstatte committed state.
- **Afhængigheder:** Bygger naturligt på #25 (én feltkerne) og føder #41/#43. Fokus-/commit-adfærd skal være bruger-identisk; høj datatabsrisiko kræver transitionsmatrix.

### 41 — Save/load som codec + I/O-porte + tilstandsmaskine · 8

- **Status: ✅ Gennemført (2026-07-12).** Både fundament-tranchen og den fokuserede opfølgning er
  landet som grønne, adfærdsbevarende ændringer. **Opfølgning (anden tranche):**
  - **Diskriminerede resultat-typer** — `SaveFileResult`/`LoadFileResult` er omlagt fra
    `success: boolean` + næsten-alt-optional til `status`-unions: `saved | cancelled` og
    `loaded | preflight | cancelled`. Snapshot findes nu præcis når `status` er `loaded`/`preflight`
    (illegal "success uden snapshot"-tilstand er urepræsenterbar); egentlige fejl kastes fortsat som
    exceptions. `ApplicableLoadFileResult`/`PreflightFileResult` typer load-flow-maskinen og
    apply-laget stramt. De informative metadata-felter (fieldCount/version/sektioner) er markeret
    optional, da de ikke aflæses af apply-/UI-laget; runtime-guarden mod manglende snapshot er bevidst
    bevaret som forsvar-i-dybden med dedikeret test.
  - **Typede I/O-porte** — hvor bytes kommer fra/går hen er trukket ud bag typede porte: en
    `LoadSource` (`fileLoadSource.ts`: manuel FSA-picker, manuel fallback, PWA-handle) leverer en
    `File` + provenance, og `loadFromSource` ejer den ene delte valider→læs→afkod→processér-kæde (den
    tidligere 3×-duplikerede endelse-/størrelses-/læse-sti er elimineret); `resolveSaveTarget`
    (`fileSaveTarget.ts`) resolver et diskrimineret `SaveTarget` (`fileHandle` | `download` |
    `cancelled`), så `saveToFile` kun forgrener på `target.kind` for write+verifikation. Byte-identisk
    adfærd (verify-før-download for fallback, read-back for FSA) bevaret. Nye fokuserede port-tests
    (`fileLoadSource.test.ts`, `fileSaveTarget.test.ts`) + uændrede ende-til-ende save/load-suiter grønne.
  - **Kontrakt:** `persistence-contract.md` §3 udvidet med I/O-porte + diskriminerede resultater.
- **Første tranche (2026-07-12):**
  - **`EoFileCodec` (`utils/eoFileCodec.ts`)** — ÉN grænse mellem `.eo`-bytes og container-model:
    `buildEoFileContainer` + `encodeEoFile` (save) og `decodeEoFile` (load). Den identisk håndrullede
    decrypt+versionstjek+validering i `loadFromFile` og `loadFromFileHandle` er elimineret; samme rå
    bytes afkodes nu ens uanset kilde. Fejl-semantikken (EncryptionError→`FILE_LOAD_FAILED`, versions-/
    struktur-fejl) er bevaret. Ny `eoFileCodec.test.ts`.
  - **Byg-og-verificér-før-sink** — fallback-download verificerede *efter* download; nu verificeres
    artefaktet i hukommelsen *før* download, så et korrupt artefakt aldrig downloades (File System
    Access beholder read-back af de skrevne bytes). Den verbatim-duplikerede fejlbesked-konstruktion i
    de to grene er samlet i én helper med bevaret ordlyd. Pinnet af to nye rækkefølge-tests.
  - **Load-flow-tilstandsmaskine** — de to uafhængige nullable pending-states (`pendingLoadResult`,
    `pendingOverwriteApply`), hvis kombination er en umulig UI-tilstand, er erstattet af én
    diskrimineret `LoadFlowState` (`idle | preflight | overwrite`); dialogerne afledes read-only, og
    de to settere er erstattet af én `dismissPendingLoad`. Ny test dækker preflight→overwrite-sekvensen
    og gensidig udelukkelse.
  - **Styrket karakteriseringsnet** — nye tests for apply-rollback-fejlindsprøjtning
    (`replaceAllPersistedData` kaster → ingen metadata-sideeffekter) og PWA-handle uden læse-tilladelse.
  - **#33-residual (atomisk-skrive-primitiver)** — de to primitiver (`runAtomicPersistenceMutation`
    vs. `atomicWritePersistenceSections`) er bevidst bevaret adskilt: `atomicWritePersistenceSections`
    ejer sektions-serialisering + egen individuelt testet dansk fejl-normalisering, som en sammenlægning
    ville nedbryde uden korrektheds-gevinst. Den snævrere rollback-scope + coexistensbeslutningen er nu
    eksplicit dokumenteret ved definition og callsite (plan-option b).
  - **Kontrakt:** `persistence-contract.md` §3.6 tilføjet (byg-og-verificér-før-sink + codec-grænsen).
- **Concurrency-review (2026-07-12):** Hele filhandlingen er nu serialiseret fra preparation til
  afsluttet I/O og eventuelle beslutningsdialoger. En ny manuel Gem/Hent afvises synligt, mens kun
  den seneste samtidige PWA-request køes. Den indlæses aldrig automatisk efter den aktive handling;
  brugeren vælger eksplicit `Indlæs fil` eller `Ignorer`.
- **Scope:** `utils/fileSave.ts`, `fileLoad.ts`, `fileSaveTarget.ts`, `fileLoadSource.ts`, `fileSaveInternals.ts`, `hooks/useFileSaveLoad.ts`, `types/fileOperations.ts`, `persistenceLoadApply.ts` og `MainLayout`-dialogerne.
- **Problem:** Én trust-kritisk use-case er spredt over ~1.500 linjer. File System Access/fallback og manuel/PWA-load har parallelle kontrolstier; fallback-download sker før in-memory-verifikation; `SaveFileResult`/`LoadFileResult` er booleans med næsten alle andre felter optional; to nullable pending-states kan repræsentere ugyldige UI-kombinationer.
- **Greenfield:** Ren `EoFileCodec.encode/decode`; typede `SaveTarget`/`LoadSource`-porte; byg og verificér ét artefakt før enhver sink; read-back-verifikation hvor sinken understøtter det; diskriminerede resultater (`cancelled | saved | preflight | failed`). Ét reducer-/state-machine-flow ejer preflight → overwrite → apply → metadata og bruges af både picker og PWA.
- **Rød tråd:** Parse én gang, valider én gang, anvend atomisk; filformat, I/O og UI-workflow har hver én klar grænse.
- **Afhængigheder:** Bygger på #33, #40 og #42 (samt #3 for storage-primitiven). Højeste save/load-risiko → fuldt round-trip-, transitions-, fejlindsprøjtnings- og rollback-net før første ændring.
- **Fra #33-reviewet (2026-07-11):** Konsolidér her de to atomisk-skrive-primitiver, der stadig sameksisterer efter #33 — `runAtomicPersistenceMutation` (context-stien: storage + fuld store + valgfri undo) og `atomicWritePersistenceSections` (undo-stien: kun sessionStorage, caller-ejet store-rollback). Enten før undo-stien over på den fælles primitiv, eller dokumentér den snævrere rollback-scope eksplicit ved callsite, så de ikke drifter.

### 42 — Versionsbåret schema-evolution i `.eo` · 9

- **Status: ✅ Gennemført (2026-07-12).** Nye filer stempler nu
  `_metadata.persistedDataVersion`, og save-verifikationen validerer hele den aktuelle
  container. Load accepterer fortsat gamle filer uden stemplet version via en eksplicit
  `legacy-unversioned`-baseline og fører kildeversionen gennem samme inbound-kæde som
  session-hydrering. Et typet per-sektion `fromVersion -> current`-register er etableret
  uden shape-gæt eller opdigtede domænemigrationer; ukendte ældre/nyere versioner går
  fortsat gennem tolerant sanitization og current schema-parse. Save-schemaet kræver
  current-versionen, load-schemaet accepterer enhver ikke-tom version eller manglende
  legacy-metadata, og `FILE_FORMAT_VERSION` er uændret, fordi metadataudvidelsen er
  bagudkompatibel. Kontrakter og coverage-matrix er opdateret; transitionsnettet dækker
  legacy/current/fremtidig version, eksakt migrator-dispatch, fuldt round-trip og afvist
  manglende/forkert save-stempel.

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

- **Status: ✅ Gennemført 2026-08-07, men OMSKÅRET — ingen `GridSpec`.** Rækkefølge-laget er
  samlet i `useSortedCollectionTable` (8 af 10 tabeller) og colId-triplen i
  `bindSortableHeader`. En fælles kolonnespec må IKKE laves; se begrundelsen i «Gennemført
  2026-08-07 (tredje omgang)».

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

- **Status: ✅ Gennemført (2026-07-11).** Batch 3–4 migreret og de gamle scannere reduceret/slettet, så manifestet nu bærer **18 regler** (de 17 arkitekturgrænser her plus `money/money-ore-type-assertion`, som blev tilføjet med #37's MoneyOre-guard). **Batch 3 (fem grænser):** `domain/page-section-access-boundary` (page-lagets persisterede sektionsadgang: per-rod autoriserede sektioner + coverage-completeness i én regel — `PAGE_BOUNDARY_RULES` bor nu i manifestet og eksporteres til `domainBoundaryIsolation`s positive dæknings-assertion); `pdf/download-committed-state` (download-triggende filer må ikke læse committed EO-state, EO-PDF-downloads heller ikke committed stamdata — `pdfDownloadCommittedStateGuard` **slettet**); `layer/minprocesrente-standalone-import-boundary` (import-forbuds-halvdelen af standalone-isolationen; hoisting-rækkefølge + positive brugerdata-forbud beholdt i den reducerede fil); `persistence/committed-section-mirror` (den allerede-AST committed-mirror-dataflow absorberet som custom-`find`-regel — `persistenceCommittedMirrorIsolation` **slettet**); og `form/no-queue-microtask-in-commit-sensitive` + `form/no-promise-tick-in-commit-sensitive` (substring-forbuddene fra `formContractIsolation` — Promise-tick fanges nu strukturelt via `await`/`.then`-parent så en `let q = Promise.resolve()`-initializer IKKE fejlflages; effect-write-grænsen med note-i-samme-vindue-semantik beholdt i den reducerede fil). **Batch 4:** `domain/eo-field-visibility-single-source` (governed EO-felters inline render-gates fanges nu strukturelt via en JSX/logisk-udtryks-forespørgsel — `getChecked(values.X) && …` / `values.X === '…' && …`, inkl. negation/parenteser/multi-line, mens kontrol-bindinger og ikke-governed felter er tilladt; `eoFieldVisibilitySingleSource` reduceret til sin positive prædikat-brugs-assertion). Bevidst afvigelse fra den oprindelige batch-4-liste: `gridRowIdContractGuard`, `fieldIdentityGuard` og `fieldUnchangedGuardInvalidDraft` **forbliver dedikerede guards** og migreres IKKE ind i forbuds-manifestet — de er positive wiring-/runtime-invarianter (createEmptyRowId-determinisme + normalize/reconcile-unikhed, felt-identitets-attributter fra `core.*`, `committedInvalidDraft`/`clearInvalidDraft`-commit-semantik), ikke import-/adgangs-grænser; deres concern er ortogonal til motorens formål, og en tvungen manifest-indpakning ville være et ringere design (deres håndrullede brace/tag-parsing kan hærdes med `astQueries` senere som ren robusthed). Alle grafen overtræder fortsat **nul**, og de nye regler er bevisligt ≥ strengere end de gamle (AST fanger aliasing/negation/multi-line/parent-kontekst). Grønt: fuld quality-suite (29 filer/189 tests), `typecheck` + `typecheck:test` + `lint`. Bevidst bevaret som regex/tekst-kontrakt: `mojibake`, `pwaHeaders`, `pdfPseudoTableGuard`, `dateContractGuard`-idiomerne og tekst-forbuddene i `roundingNormGuard`.
- **Review-efterarbejde (2026-07-11):** `dateContractGuard` og `roundingNormGuard`
  bevarer deres tekstsemantik, men genbruger nu samme cachede `SourceEntry`-graf i stedet
  for hver sin directory-walk og gentagne fillæsninger. Fixture-selvtesten kører nu gennem
  hele `evaluate`-stien, så en fejl i `appliesTo`/allow-scope ikke længere kan bestå som en
  tilsyneladende aktiv regel.
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

- **Status: ✅ Gennemført (2026-07-12).** Ny typed envelope og ét udtømmende registry
  katalogiserer nu 14 kilde-specifikke payloads med stabilt id, provenance, coverage og
  genkørbar fail-closed validator. Registryet er bevidst en verifikationsgrænse og
  eager-importeres ikke i app-entrypoints, så standalone-varianten ikke får hele Mineos
  beregningsdata i sit bundle. Golden-nettet låser alle payloads med SHA-256; for de 33
  kapitaliseringstabeller låser et særskilt før/efter-fingerprint alle faktorer og tabelvalg
  fra før katalogiseringen. Kapitaliseringsregistryet bærer nu også fuldt navn, datering,
  gyldighed og præcis lokal kilde-PDF, validerer aldersrækker/faktorer fail-closed og testes
  1:1 mod 33 tabelmoduler + 33 original-PDF'er uden den tidligere regex-læsning af TS-kode.
  Indskudte løntillæg er flyttet fra `config/` til det kanoniske datalag. KL/RLTN-importen
  har fået `--check`, og release-gaten afviser nu stale genereret output mod alle aktive
  Excel-kilder. En ny tværgående `calculation-data-contract.md` fastlægger katalogets
  invariants. **Bevidst greenfield-justering:** de store kildefiler er ikke mekanisk splittet
  i data-/lookup-aliasfiler; for den låste featureflade ville det skabe flere offentlige
  moduler uden at fjerne en ekstra sandhedskilde. Kilde-specifikke opslag bliver derfor ved
  deres payload, mens tværgående metadata, completeness og verifikation ejes ét sted.
- **Scope:** `data/lovbestemteRates.ts` (957), `overenskomstRates.ts` (1805), kapitaliseringens 33 håndkodede tabelmoduler/original-PDF'er, øvrige satskilder og `scripts/import-offentlig-loen.mjs`.
- **Problem:** Flere datakilder blander rå tal, typer, referenceprosa, coverage, integritetscheck og opslag i samme filer. Kun KL/RLTN har et reproducerbart kilde→valideret-data-flow; årlige opdateringer afhænger ellers af håndholdte formater og parallel dokumentation. #35 konsoliderer kun carry-forward-opslag.
- **Greenfield:** Fælles katalog-envelope (`id`, kilde/provenance, coverage, validator) med kilde-specifikke payloads — ingen tvungen universel sats-shape. Datafiler er data-only; lookup/bounds/reference-projektioner afledes. Generator bruges kun, hvor kilden kan importeres deterministisk; ingen automatisk PDF-ekstraktion uden sikker kildeproces.
- **Rød tråd:** Genbruger KL/RLTN's etablerede validerede importmønster uden at udviske reelle domæneforskelle.
- **Afhængigheder:** Selvstændig data-keystone, lavere prioritet end #41. Alle værdier er beregningslogik → forelæggelse og fuld golden-værdi-identitet.

### 52 — Normative kontrakter: invariant-kerne vs. implementeringskort · 11

- **Status: ✅ GENNEMFØRT 2026-08-07, men OMSKÅRET — planens løsning var forkert.** Se
  «Gennemført 2026-08-07 (fjerde omgang: #52)» nedenfor for den fulde skæring.

- **Scope:** `src/contracts/` (28 kontraktfiler/5.566 linjer — ikke 27/~4.700), `contract-topology.json`, coverage-matrixen og informative arkitektur-/reviewdokumenter.
- **Problem (som planen beskrev det — PRÆMISSEN ER DELVIST MODBEVIST):** Stabile regler, konkrete fil-/symbolnavne, audits og historiske noter står blandet i normative kontrakter. **Begge navngivne drift-eksempler var allerede rettet:** `PdfDocument` findes nul gange i samtlige kontraktfiler, og `app-settings.md` blev omskrevet 2026-08-07 og beskriver den aktuelle `projectSourceSettings`-kobling korrekt. Den præmis, der holdt, var den sidste sætning: **topologi-testen kan kun verificere linkage, ikke sandheden i implementeringskortene.**
- **Greenfield (planens forslag — IKKE fulgt):** flyt fil-/symbolkort og historik ud i informative dokumenter. Det ville have været den forkerte operation: af ~230 fil-stier var **nul** døde, og af 569 unikke symboler var **fem** forkerte. Implementeringskortene var altså 99,7 % korrekte, og de to bedste kontrakter i sættet (`calculation-data-contract.md`, `auth-gate-contract.md`) navngiver netop mange filer i et dedikeret §3. At flytte den *rigtige* del ud og efterlade den *uverificerede* del ville have gjort kontrakterne mindre brugbare uden at fjerne én eneste drift-årsag.
- **Faktisk gennemført:** referencerne blev gjort *kontrollerbare* i stedet for at blive flyttet. Tre værn (liveness af fil-/symbolreferencer inkl. fraværsværn, git-bundet verifikationsstempel, in-file-testkobling mod matrixen) + fem rettede drift-tilfælde.
- **Rød tråd:** Én autoritativ beskrivelse pr. concern — håndhævet frem for aftalt.
- **Afhængigheder:** Uafhængig. Ingen runtime-adfærd; ingen tal eller dokumentværdier berørt.

---

## Tematisk sammenfatning

Det stærkeste gennemgående tema er, at princippet **"kanonisk beregnet én gang,
projiceret mange gange"** — som EO's snapshot/canonical/`MoneyOre`-rygrad er et
godt udgangspunkt for — både er anvendt **inkonsistent** og nogle steder kun
nominelt gennemført:

- **Regulering** (#23): beregning konvergeret, præsentation ikke.
- **Dag-sæt** (#17): beregnet på begge sider af lag-grænsen. ✅ løst.
- **Penge og perioder** (#37, #49): den lukkede pengealgebra og den neutrale
  månedsprimitiv er etableret. ✅ løst.
- **EET** (#36): bruger nu samme lukkede `MoneyOre`-disciplin og et strengt
  valideret canonical output. ✅ løst.
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

---

## Aktuel revurdering efter draft/commit-omlægningen

**Revurderet 2026-08-01 mod den aktuelle kode og de aktuelle kontrakter.** Dette
afsnit er den autoritative arbejdsstatus for dokumentet. De tidligere
`✅`-markeringer og den tematiske sammenfatning ovenfor er bevaret som historisk
reviewmateriale, men flere af dem beskriver nu slettede mellemtrin og må ikke
bruges som implementeringsplan.

### Hvad den store omskrivning ændrede for denne plan

Den tidligere `draft-commit-greenfield-design.md` blev afsluttet og fjernet i
forbindelse med den samlede dokumentationsoprydning. Det er ikke kun et
navneskifte: den tidligere model med sektion-slices, draft-hooks,
`FormPersistenceContext`, `invalidDrafts`, felt-error-bus og separate
storagekeys findes ikke længere som produktionsarkitektur.

Den aktuelle løsning har i stedet én typed inputkerne:

- `src/inputCore/settledInput.ts` ejer det schema-validerede aggregate og
  `rejectedInputs`.
- `src/inputCore/inputReducer.ts` er den typed command-grænse for settle,
  immediate-commit, rækkeændringer, reset og case replacement.
- `src/inputCore/inputReader.ts` er den læsbare projektion for beregning,
  issues, save og dokumenter.
- `src/inputCore/editor/fieldEditorEngine.ts` er den fælles feltmotor.
- `src/inputCore/runtime/dispatchInput.ts` og
  `src/inputCore/runtime/criticalActionCoordinator.ts` ejer henholdsvis
  autoritativ state-ændring og kritiske handlingsgrænser.

Det betyder, at #12, #19, #25, #27, #28, #33 og #39 samt de inputrelaterede
dele af #40 ikke længere skal gennemføres i deres gamle form. De er enten
absorberet af en stærkere løsning eller erstattet af den nye arkitektur. En
videreførelse af denne plan må ikke genåbne de gamle overgangslag.

### Udestående kandidater efter den aktuelle kodegennemgang

Følgende er stadig reelle arbejdsopgaver:

- **#1 — `AnsaettelsesforholdCard`:** Stadig en monolit på over 1.000 linjer,
  hvor indtastning, rækkehåndtering, valideringsvisning og beregningsrelateret
  præsentation ligger samlet. Den nye inputkerne gør feltflowet mere ensartet,
  men har ikke løst komponentens ansvarsspredning.
- **#3 — IndexedDB/file-handle-laget:** `fileHandleStorage.ts` er fortsat et
  stort, selvstændigt persistence-lag uden den generelle port-/adapterstruktur,
  som kandidaten sigtede mod.
- **#4 — beløbs-paste:** Paste-normalisering er fortsat delt mellem den
  generelle input-pastekode og beløbshelperen. Det er stadig en parallel
  løsning for samme concern.
- **#7 — dropdowns:** Den tidligere direkte form-/tabelduplikering er i høj
  grad fjernet: begge overflader bruger nu `StyledDropdown`, og `mergeSx`
  findes som fælles stylinghelper. Den fulde headless opdeling er dog ikke
  gennemført; `StyledDropdown.tsx` er fortsat en stor kombineret
  interaktions-/renderingskomponent. Kandidaten er derfor **delvist løst**,
  ikke et uændret restpunkt.
- **#14 — filnavne:** `ContentBoxReportDialog.tsx` har fortsat en lokal
  `sanitizeFilenamePart` i stedet for at bruge en kanonisk delt helper.
- **#18 — EET-differencekrav:** `EetDifferencekravTab.tsx` er fortsat stor,
  og de EET-specifikke underområder er ikke samlet i den deklarative
  struktur, kandidaten beskrev.
- **#20 — EO-inspektion:** `eoInspektionPageViewModel.ts` parser fortsat
  tabeldata fra formatterede `displayValue`-strenge. Det er stadig en
  skjult serialiseringsaftale mellem viewmodel og præsentation.
- **#21 — indstillinger:** `Indstillinger.tsx` har fortsat mange direkte
  settings-opdateringer og ingen samlet register-/definitionsmodel.
- **#22 — indkomst før skaden:**
  `IndtaegtFoerSkadenSection.tsx` er fortsat en stor sektion med flere
  selvstændige ansvarsområder.
- **#26 — `Container`:** Den store komponent ejer fortsat både layout,
  focus-cache, keyboard-navigation og observer-lifecycle. Den planlagte
  ansvarsopdeling er ikke gennemført.
- **#29 — datoer:** `src/config/dateRanges.ts` beregner fortsat `TODAY` og
  `CURRENT_YEAR` ved module import. Det er fortsat en potentiel stale-date-
  og testdeterminismefejl.
- **#30 — valideringskilder:** Kandidatens oprindelige problem er ændret,
  ikke fjernet. Format/schema/bounds og rejected-input-issues er nu samlet i
  inputkernen, men tværgående domænevalidering, EO-row-gating og snapshot-
  validering ligger fortsat i flere lag. Restopgaven er derfor at afklare og
  konsolidere ansvarsgrænsen — ikke at genindføre endnu en feltvalidator.
- **#32 — dokumentsektioner:** Det formatneutrale `DocumentModel` og
  `TableSpec` er etableret, men `opgoerelseSection.ts` er fortsat en stor,
  writer-/context-orienteret sektion. Den imperative gamle form er derfor
  ikke helt udfaset.
- **#35 — carry-forward-opslag:** Den generiske
  `findLatestByDateInSortedList` er nu fælles for flere engine-/presentation-
  opslag. Kandidaten er kun **delvist løst**, fordi data-lagets konkrete
  opslag stadig har parallelle binary-search-, linear-search- og
  intervalimplementeringer.
- **#43 — sidekatalog og shell:** `pageNavigation.ts` er blevet et kanonisk
  rutekatalog for de vigtigste sider, men `App.tsx` har fortsat parallelle
  lazy-loadere, route-loadere, route-wrapperes og route-definitioner. Der er
  stadig ikke én persistent shell med ét autoritativt route-/layoutflow.
- **#44 — page/viewmodel-grænser:** De persistente hovedsider har nu
  viewmodels, og flere sider er splittet. Det overordnede mønster er derfor
  etableret, men store featureinterne view-/sektionfiler — blandt andet EET
  og EO — har fortsat for mange ansvar. Kandidaten er delvist løst.
- **#45 — deklarative tabeller:** `cellSpecBuilder` og
  `useCollectionTable` samler nu row-/cell-binding og inputsemantik, men der
  findes fortsat ingen fælles `GridSpec`/`EditableGridSpec`. Kolonneidentitet,
  headers, widths, renderers, errors og focus metadata beskrives fortsat
  manuelt i de enkelte tabeller.
- **#46 — app-varianternes build-output:** CSS-loading er nu variant-ejet via
  `bootstrapClientApp`, og Mineo/MinProcesrente styles blandes ikke længere
  i samme runtime-entry. Buildet kræver dog fortsat efterbehandling med
  copy/delete/rewrite-scripts for at få det endelige variant-output. Den
  arkitektoniske kerne er løst, men output-pipelinen er ikke helt ren.
- **#50 — TAF-grafen:** `tafKravGrafChart.ts` blander fortsat dataprøvetagning,
  akser/layout og Canvas-rendering i én stor fil. Der mangler stadig en
  formatneutral scene-/spec-projektion mellem beregning og bitmap-rendering.
- **#52 — kontrakternes implementeringskort:** Kontrakterne er blevet
  opdateret og topologien er tydeligere, men flere normative dokumenter
  blander fortsat invarianten med konkrete fil-, type- og callsite-kort.
  Der er derfor stadig ikke en ren og stabil adskillelse mellem “hvad der
  skal være sandt” og “hvordan den aktuelle kode opfylder det”.

Kandidat **#2** skal ikke længere stå som et åbent arbejde i sin oprindelige
form. De gamle download-/document-serviceproblemer er absorberet af den
aktuelle document definition/catalog- og generation-session-struktur. En
eventuel videre forbedring skal formuleres som et nyt, aktuelt fund og ikke
som en genoplivning af den gamle service-model.

### Systematisk vurdering af de hidtil udførte dele

#### Mål der faktisk er opfyldt

På målniveau er følgende kandidater gennemført og kan betragtes som afsluttede:

**#5, #6, #8, #9 og #10** har opnået den ønskede konvergens i de berørte
side-/tab-/downloadmønstre. Persistente sider har viewmodels, tabs og side-
navigation bruger fælles mønstre, og dokument-download har fælles lifecycle-
og præsentationskomponenter.

**#11, #13, #15, #16 og #17** er gennemført som fælles primitiver og registre:
document-definitioner, versionsmærket input, `TableSpec`/kanalrendering,
opdeling af SFGG-regulering samt det fælles dag-sæt er etableret. Her er
slutproduktet bedre end den oprindelige kandidatliste: flere af løsningerne
er ikke blot flyttet, men samlet omkring én autoritativ kilde.

**#23, #24, #31, #36, #37, #38, #42, #47, #48, #49 og #51** er også realiseret
på arkitekturniveau. Det gælder især den centrale reguleringspræsentation,
det formatneutrale dokumentmodel-lag, de lukkede penge-/periodeprimitiver,
den eksplicitte dokumentgenereringssession, schema-/versionshåndtering,
release-/arkitekturværn samt den samlede reference-dataregistrering.

De præcise tal, coverage-procenter og antal regler, som står i de gamle
statuslinjer, er derimod historiske observationer. De er ikke i sig selv en
aktuel måling og skal ikke bruges som bevis for, at den nuværende kode fortsat
har præcis samme filstruktur eller testtal.

#### Mål der er opfyldt gennem en stærkere omskrivning

**#12, #19, #25, #27, #28, #33 og #39** er ikke bare udført som beskrevet i
den gamle plan; de er afløst af en mere konsekvent løsning. Den aktuelle kode
har ét settled aggregate, én rejected-input-repræsentation, én reduceret
command-grænse, én fælles feltmotor og eksplicitte runtime-/replacement-porte.
Collection rows skriver gennem reducerens commands i stedet for at holde en
parallel row-draft. Initialization er flyttet ud af React-render-flowet.

Det opfylder de oprindelige mål om atomisk settle, XOR mellem canonical og
rejected input, ingen live preview, ingen implicit props-til-state-overskrivning
og ingen parallel persistence-model. Det ville være en regression at vurdere
disse kandidater ud fra, om de gamle hooks eller contextlag stadig findes.

**#40 og #41** er tilsvarende realiseret på grundidéen: kritiske handlinger går
gennem en typed coordinator, og save/load/reset bruger en samlet codec-,
preflight- og replacement-struktur. Der er dog en vigtig ændring i forhold til
den gamle plan: load/reset bruger nu bevidst no-settle replacement, mens
save/download/navigation finaliserer åbne editors. Den aktuelle
`critical-action-contract.md` er autoriteten for denne policy; den gamle
beskrivelse af alle handlinger som samme settle-flow er forældet.

#### Vurdering af den faktiske greenfield-tilgang

Den centrale omskrivning har den ønskede greenfield-karakter. Den bygger ikke
ukritisk videre på de gamle draft-/commit-lag, men reducerer i stedet antallet
af autoritative stateformer og gør grensene eksplicitte:

- state har én aggregate-model i stedet for parallelle sektion-slices;
- læsning sker gennem `InputReader`, og mounted views rapporterer ikke issues
  til en central store;
- skriveadgang sker gennem typed commands og en systemport;
- save/load og kritiske handlinger har eksplicitte transactions-/replacement-
  grænser;
- dokumenter bygges som formatneutrale modeller før kanalrendering.

Det er derfor en reel greenfield-kerne og ikke blot en legacyrefaktor med nye
navne. Den konklusion gælder dog ikke hele programmet endnu. De åbne punkter
#1, #3, #4, #18, #20, #21, #22, #26, #29, #32, #35, #43, #44, #45, #46,
#50 og #52 viser, at flere ydre lag stadig har monolitter, parallelle registre
eller håndholdt koordinering. Det næste arbejde bør derfor fortsætte med disse
konkrete rester og samtidig bevare inputkernen som fast arkitektonisk
forudsætning.

---

## Kodeverificeret baseline (2026-08-06)

Afsnittene ovenfor er skrevet ud fra læsning på deres eget tidspunkt. Dette afsnit er
**verificeret mod den faktiske kode 2026-08-06** ved fire uafhængige gennemgange og er
derfor den autoritative statuskilde for de åbne kandidater. Hvor en tidligere formulering
er modbevist, står korrektionen her — den gamle tekst er ikke redigeret, men er ikke
længere gyldig som arbejdsgrundlag.

### Påstande der er modbevist og ikke må implementeres som beskrevet

| Kandidat | Påstand i planen | Hvad koden faktisk viser |
|---|---|---|
| **#4** | Beløbs-paste er "en parallel løsning for samme concern" | Envejs-lagdeling, ikke parallel: `inputPasteNormalization.ts` **importerer** `normalizePastedAmount` fra `amountInputUtils.ts` og bygger felt-bounds ovenpå. Der er én paste-sti. Det reelle fund var mindre: `sanitizePastedAmount` var død produktionskode holdt i live af sine egne tests. |
| **#14** | "Importér den kanoniske `sanitizeFilenamePart`; slet den lokale kopi" | De to funktioner løser **forskellige** concerns. Den kanoniske bevarer bevidst danske tegn/store bogstaver/mellemrum (brugervendt filnavn); den lokale er en ASCII-slug. En blind udskiftning ville have ændret filnavnsformatet. Se det faktisk løste problem nedenfor. |
| **#21** | `Indstillinger.tsx` har "mange direkte settings-opdateringer" der kan blive et register | API'et `updateSetting` **findes ikke** (det heder `updateSettings`, plural partial patch). Og siden er ikke mekanisk gentagelse: 18 felter med 5 kontroltyper, 3 opdateringssemantikker, DEV-gating og async File-System-Access-handlers. Kun 8 af 18 er ensartede — et register ville kræve escape-hatches til de 10 øvrige. Det reelle fund er, at ~63 linjers label-metadata bor i komponenten. |
| **#30** | Valideringsansvar "ligger fortsat i flere lag" og skal konsolideres | **Reelt afsluttet.** Lagene er dokumenteret komplementære (validation-filerne afgrænser sig eksplicit mod hinanden i kildekommentarer), konvergerer i én `EoInvariant`-valuta i `eoSnapshotInvariants.ts`, og ansvarsdelingen er kontraktfæstet i `error-contract.md` §2/§11. Ingen regel er håndhævet to steder. Den eneste redundans er tilsigtet fail-closed forsvar i dybden — med eget test-værn (`eoReguleringInvariantReachability.test.ts`). |
| **#32** | `opgoerelseSection.ts` er en efterladt imperativ rest | Ikke en rest — **normen**. Alle 7 sektioner i `document/generators/eo/sections/` er `=> void` + ctx-objekt. `opgoerelseSection` er blot den største (825 l.). Kandidaten er dermed væsentligt større end beskrevet. |
| **#46** | Buildet kræver "copy/delete/rewrite-scripts" for variant-output | Efterbehandlingen rammer **kun** MinProcesrente, og hovedparten er **deploy-artefakter**, ikke build-hygiejne: `_headers` (Cloudflare/Netlify-cachepolitik), `robots.txt`, `sitemap.xml` og `llms.txt` med hardkodede produktions-URL'er. Kun sletningen af `sw.js`/`manifest.json`/`icons` er build-hygiejne, og den skyldes at begge varianter deler én `public/`-mappe. |
| **#35** | Foreningen er blokeret, indtil der findes en fælles dato-nøgle-abstraktion; der er 3-4 implementeringer | **Modbevist 2026-08-07.** Abstraktionen fandtes allerede: `findLatestByDateInSortedList` med 10 callsites. Den krævede blot, at datofeltet hed `startIso` — og præcis derfor havde to ISO-serier med samme semantik overlevet med hver sin re-derivation. Der var 7 carry-forward-implementeringer, ikke 3-4. Gennemført; se «tredje omgang». |
| **#45** | Sort-plumbingen er "identisk i alle 10 tabeller" | Overdrevet. Hook-kaldet er nær-identisk i 8; destruktureringen deler sig 4/3/3 over tre former; de to `Loenudvikling*` har materielt anden `isRowEmpty` og reorder. Det reelt duplikerede var **fire koblede ting** (reorder-persistering, render-orden, save-order, header-pil) plus colId-triplen ~22 steder. Planen nævnte hverken save-order-koblingen eller `useRegisterTableSaveOrder` (8 af 10). |
| **#21** | Det reelle fund er, at ~63 linjers label-metadata bor i komponenten og hører i `settings/` | Halvt rigtigt, men ramte forbi det væsentlige: etiketterne var duplikeret **3× pr. enum**, og et af stederne var `eoRowEvaluation` — dokumentteksten i et bilag. Etiketterne hører ved ENUMMET (og brevhoved-navnene ved dokument-lagets nøgleliste), ikke i `settings/`. Sidens største enkeltansvar er desuden ikke metadata, men `defaultDirectoryHandleId` (~143 af 605 l.). |
| **#26** | Argumentet er "keyboard-nav er ~320 l. = 55 % af filen" | Rigtigt tal, men det svage argument. Det stærke: **geometrien kunne ikke rammes af test**, fordi jsdom ikke har layout — alle rects er 0×0, så række-grupperingen så ens (og tom) ud uanset reglen. De 37 eksisterende tests dækkede tastesemantik, ikke nabo-udpegning. |
| **#1** | Spejl den eksisterende `loenindkomst/sections/`-dekomponering | Der findes **ingen** `loenindkomst/sections/`-mappe, og kun **én** `sections/`-mappe i hele `src/components/` (`eoOplysninger/sections/`). |
| **#5/#44** | Mønstret er `useXxxViewModel(form)` | Ingen af de 11 VM'er tager en `form`. De tager values/projektioner. Context-varianten er heller ikke universel (5 af 11 har context; resten sender `vm` som prop) — og `page-component-contract.md` §4.4 l. 190 gør netop det til et **frit valg**. |

**Vigtig fælles korrektion for alle view-kandidater (#1, #18, #21, #22, #44):** der findes
**ingen LOC-tærskel og intet `sections/`-mappe-krav i nogen kontrakt.**
`page-component-contract.md` §4.4 l. 196 siger eksplicit *"Reglen er kategorisk, ikke
størrelses-gated. Der er ikke en LOC-tærskel"*, og §12–13 advarer mod tom ceremoni. En
omlægning af disse filer skal derfor begrundes i **ansvarsspredning og konkret
duplikering** — ikke i filstørrelse. Af de 20 største filer i `src/components/` er kun 2
klar ansvarsspredning, 1 delvis og 3 grænsetilfælde; de øvrige 14 er store men fokuserede
infrastruktur-primitiver.

### Det største uidentificerede fund

Planen har aldrig registreret den reelt største duplikering i UI-laget:
**`AnsaettelsesforholdCard.tsx:617-903` og `IndtaegtFoerSkadenSection.tsx:305-652` er ~290
linjers næsten ordret identisk "Lønudvikling"-flade** — samme grundlagsmenu, samme to
filter-dropdowns med ~30 linjers inline `sx` hver, samme offentlig-løn-blok med
løntrin-finder, samme statistik-/KRL-grene, samme manuelle tabeller, samme
reguleringsinterval + downloadrække. Forskellen er alene feltbinding og location-prefix.

Én delt Lønudvikling-komponent løser derfor substansen i **både #1 og #22 samtidigt** og er
det højest forrentede enkeltindgreb i hele fase 4. Det bør være indgangen til de to
kandidater — ikke en sections-opsplitning pr. fil.

### Bekræftede kandidater, med den præcisering arbejdet skal bygge på

- **#3 — IndexedDB:** bekræftet, og **værre end beskrevet**. `fileHandleStorage.ts` (735 l.)
  har 10 hånd-wrappede IndexedDB-funktioner over 4 nøgle-concerns i ét delt store, plus
  ~130 linjers urelateret permission-verifikation. `typeof indexedDB`-guarden er gentaget 9
  steder med **inkonsistente returværdier** (`false`/`null`/`true`), og `getDirectoryDisplayInfo`
  mangler den helt. Afgørende tilføjelse: `src/utils/logStorage.ts` er en **anden, uafhængig
  IndexedDB-wrapper** med sin egen `openDatabase`-kopi — *dét* er den reelle parallelle
  implementering. Testdækningen er 2 tests, som kun rammer de to funktioner der **ikke**
  bruger IndexedDB. Sammenlign med `safeSessionStorage.ts` + `storageManifest.ts`, der er
  det tilsvarende ordentligt abstraherede lag for session/localStorage.
- **#20 — eoInspektion:** bekræftet. `parseSfggTable` (l. 121-146) splitter en formatteret
  multiline-streng på `\n` og `|` og genkender totalrækken ved at **strengmatche `'I alt'`**.
  Kolonneantallet er variabelt (betinget af `hasReguleringsindeks`), så aftalen er dobbelt
  skjult. De strukturerede segmenter findes i produceren
  (`eoRowSygeferiegodtgoerelseRows.ts:299-329`) men **ikke** i viewmodellen — `EoRowModel`
  bærer kun `displayValue: string`, så kanalen skal udvides først. Det rigtige mønster
  findes allerede i nabofilen: `CellValue<T>` med både `rawValue` og `displayValue`
  (`eoInspektionRegulationViewModel.ts`). Dertil 4 regex-baserede row-id-parsere (l. 66-118)
  med kildens egen NOTE om at de skal erstattes af struktureret metadata.
- **#43 — app-shell:** bekræftet. Der er **tre** parallelle sidelister med tre forskellige
  nøglebegreber: `APP_PAGE_DEFINITIONS` (pageKey, 8 sider), `App.tsx routes` (path, 11 sider,
  hardkodede strenge — importerer **ikke** `APP_ROUTES`) og `SideMenu menuItems` (menu-id +
  labels/ikoner). Kataloget er reelt kun kanonisk for undo/redo-destinationer. Dertil:
  `createPageWrapper` wrapper **hver side** i sin egen `<MainLayout>`, så der ikke findes en
  layout-route med `<Outlet/>`. Ingen test hævder at App.tsx-routes matcher kataloget.
  **Rettelse (målt 2026-08-06):** den oprindelige observation om at shellen dermed
  *remountes ved hver navigation* — inkl. `Container`s focus-cache — er **modbevist**. React
  reconciler samme komponenttype på tværs af søskende-routes, så layoutet blev bevaret i begge
  former. Kandidaten er reel, men rent strukturel. Bemærk også at `app-shell-contract.md`
  **ikke** kræver én persistent shell; det er en arkitekturforbedring, ikke et kontraktbrud.
- **#45 — GridSpec:** bekræftet at der ingen `GridSpec`/`EditableGridSpec` findes. Men en
  fælles kolonnespec ville **ikke** være et rent løft: to shells med uforenelige
  bredde-API'er (`StandardGridTable` via `<colgroup>` + `tableWidth`; `StandardLooseTable`
  via `sx` på header-celler), kolonneindeks der ikke er 1:1 med visuelle kolonner
  (`StandardLoenTable` mapper 3 feltnøgler til ét col-index), og ikke-uniforme cell-renderers.
  **Det eneste reelt mekanisk duplikerede er sort-plumbingen** (`useTableSort` →
  `handleHeaderClick`/`getSortRole`/`getSortDirection`, identisk i alle 10 tabeller) samt
  `RowDeleteButton`-mønstret. Skær kandidaten efter det, ikke efter en fuld kolonnespec.
- **#50 — TAF-graf:** bekræftet (800 l., 4 concerns). Det stærkeste argument er dog et
  planen ikke nævner: `renderTafKravGrafChartPng` og **alle** `draw*`-funktioner (l. 395-786)
  er **uden testdækning**, fordi jsdom ikke har et canvas-API — filen dokumenterer det selv
  ved `__tafKravGrafChartTestables`. En scene-model flytter netop de 390 linjer ind i det
  testbare. Bemærk også at der ikke findes nogen anden chart-renderer i repoet at rette sig
  ind efter; denne definerer konventionen.
- **#35 — carry-forward:** bekræftet, men foreningen er blokeret. Der er 3-4 reelle
  carry-forward-implementeringer med hver sin strategi (binary search nyeste-først; linear
  scan med parsing pr. iteration; forlæns scan med `0`-fallback; `.filter().reduce()`-max),
  men datamodellerne afviger faktisk: `DanishDateString` (ikke leksikografisk sorterbar) vs.
  `ISODateString`, forskellige feltnavne, modsat sorteringsretning, `undefined` vs. `0`.
  Sygedagpenge (lukkede intervaller), lovbestemte satser (per-år-eksakt) og KL-lønaftaler
  (eksakt-dato-Map) er **domænemæssigt andre modeller** og hører ikke ind under kandidaten.
  En fælles dato-nøgle-abstraktion er derfor forudsætningen.
- **#52 — kontrakter:** bekræftet, og løsningen findes allerede. `contract-template.md`
  definerer præcis den ønskede adskillelse (§2 Normative Regler = invariant, §3 Autoritative
  Kilder = implementeringskort, §4 Testkobling, §5 Kendte Undtagelser), men
  `contract-topology-procedure.md` l. 41 gør de øvrige template-afsnit **anbefalede, ikke
  håndhævede** — og 15 af 29 kontrakter afviger derfor. Værste blanding:
  `document-output-contract.md` (614 l., 38 filreferencer i den normative brødtekst) og
  `app-settings.md` (10 filrefs på 80 l. — filnavne og callsites står i det afsnit der
  hedder "normative, ikke-forklarende"). Bedste forbilleder: `calculation-data-contract.md`,
  `auth-gate-contract.md`. Fire kontrakter har 0 filreferencer og viser at det er muligt.
- **#26 — Container:** bekræftet (584 l.; keyboard-navigation er ~320 l. = 55 %). Vigtig
  præcisering: `keyboard-navigation.md` §Implementeringsfrihed (l. 228-237) **tillader
  eksplicit** refaktoreringen, så længe adfærden bevares. Og grid'ets
  `tableKeyboardNavigation.ts` er **ikke** duplikering — grænsen er kodet og bevidst
  (`isInTableNavigation`, `markTableBoundaryExit`, delte selectors). Dækningen er stærk (29 +
  ~15 cases i to testfiler, normativt nævnt i kontraktens §Testkrav), så omlægningen har et net.
- **#18 — EET-differencekrav:** bekræftet (761 l.), men skær den om. De tre fil-lokale
  underkomponenter (l. 87-391 = 305 l., 40 % af filen) er allerede rene, props-tagende
  komponenter uden VM-kobling og kan flyttes mekanisk og risikofrit. Derimod er "delt
  forlig-editor" kun ~35 linjers duplikering, og de to callsites er **kontraktkrævet**
  forskellige på ref-niveau: EET går gennem porten `forligInputPort.ts`, fordi
  `domain-boundary-contract.md` §10.4 forbyder EET at importere EO's descriptor-katalog —
  håndhævet af et arkitekturværn. En naiv sammenlægning ville bryde værnet.

### Gennemført i denne omgang

- **#14 — ASCII-slug konsolideret (afløser kandidatens oprindelige formulering).** Der var
  ikke én dupleret funktion, men **tre** parallelle ASCII-slug-varianter med hver sin
  separator og hver sin fejl: `eoSnapshotToTafKravGrafDocument.ts:88` (`-`, med NFKD),
  `ContentBoxReportDialog.tsx:29` (`-`, uden NFKD) og `safeComputation.ts:33` (`_`, uden
  NFKD). Alle tre var forkerte for dansk, fordi `ø` **ingen** NFKD-dekomposition har og
  derfor blev spist som separator: «Årsløn» blev `rsl-n` i skærmprint-filnavnet og `arslon`
  i graf-serie-id'et, og «Ærø» blev `a-r-`. Ny kanonisk primitiv `src/utils/asciiSlug.ts`
  translittererer eksplicit efter kodebasens egen konvention (`ø`→`oe`, `æ`→`ae`, `å`→`aa`
  — verificeret mod 492+ filer med `aarsloen`/`opgoerelse`/`loenindkomst`, nul afvigelser),
  med separator og fallback som parametre. Alle tre callsites er ruttet igennem den.
  Den ikke-injektive egenskab er dokumenteret og fastholdt som et bevidst valg i test.
  Dertil slettet død kode: `sanitizePastedAmount` (ingen produktions-callsites; dens
  test-fixture-brug i `inputSelectionUtils.test.ts` er erstattet af en lokal normalisator,
  så testen nu hævder sit eget emne). Ny test `asciiSlug.test.ts`; 42 tests grønne.
  Bemærk som synlig følge: skærmprint-filnavnet ændres fra `Mineo-skærmprint-rsl-n-…` til
  `Mineo-skærmprint-aarsloen-…`. Det er en genskabelse af tilsigtet adfærd (danske
  bogstaver skulle aldrig være tabt), ikke en ny UX-beslutning.

- **#1 + #22 — delt Lønudvikling-flade (det store fund ovenfor).** Ny
  `pages/erstatningsopgoerelse/loenudvikling/LoenudviklingFields.tsx` (386 l.) +
  `loenudviklingBinding.ts` (71 l.) ejer nu fladen for begge overflader.
  `AnsaettelsesforholdCard.tsx` 1033 → 818 l. og `IndtaegtFoerSkadenSection.tsx` 705 → 532 l.
  — ~500 linjers duplikering erstattet af ét sted.
  Bindingen er en **typet record** (ét felt pr. logisk felt), ikke en `field(name)`-accessor:
  felterne har reelt forskellige værditypér, og `FieldDescriptor<T>` er invariant i `T`, så en
  fælles accessor ville kræve en usikker assertion. Overenskomst-rækken er en `overenskomstSlot`,
  fordi de to overflader viser reelt forskellige ting (read-only etiket vs. fuld vælger).
  Lukket undervejs, som direkte følge af sammenlægningen:
  - **Manglende basisdato-tooltip på EO-oplysninger.** VM'en beregnede allerede
    `loenudviklingBaseDateReferenceText`, men sektionen sendte den aldrig til de to manuelle
    tabeller — så låst basisdato stod uforklaret dér, modsat Lønindkomst. Propen er nu
    **påkrævet** (ikke optional), så en overflade ikke kan glemme den igen.
  - **To utilsigtede divergenser** ensrettet: feltbredden på «Navn på reguleringsform» (350 vs.
    300 → 350) og en let omskrevet kommentar om samme gate-regel.
  - **To identiske IIFE'er** i `AnsaettelsesforholdCard` (l. 786-798 og 838-850) der genberegnede
    `resolveAnvendtReguleringsdatoReferenceText` med præcis de argumenter, filen allerede havde
    beregnet på l. 173.
  - **Duplikeret filter-dropdown-styling** (~30 linjers inline `sx` skrevet ordret to gange lige
    efter hinanden) samlet i tre modul-konstanter.
  Fuld suite grøn (521 filer / 6642 tests), typecheck + lint grønne.

- **#29 — dags dato læses nu på opslagstidspunktet.** `TODAY`/`CURRENT_YEAR` var
  `const`-øjebliksbilleder taget ved modulets import. Det gav en reel brugerfejl: appen er
  100 % client-side og kan stå åben over midnat (eller genoptages fra bfcache), og så blev
  «Skadedato», «Opgørelse lavet den» m.fl. fortsat validéret mod **gårsdagens** maksimum —
  brugeren kunne ikke indtaste dagens dato uden at genindlæse. Kodebasen havde desuden to
  svar på "hvad er i dag", fordi `utils/dateInputValidation.ts` allerede læste året live.
  Nu: `getToday()`/`getCurrentYear()` + gettere på de dato-afhængige felter i
  `dateRanges_*`-objekterne, så alle callsites' syntaks er uændret.
  To præciseringer værd at bevare:
  - Årsgrænser i felt**validatorerne** tager nu en `YearBound = number | (() => number)`, fordi
    validator-closures ellers indfanger året permanent. Codec-argumenterne beholder tal-formen,
    da `createYearFieldCodec` bevidst *stripper* `minYear`/`maxYear` (de bruges kun til en
    assertion) — bounds håndhæves af validatorerne.
  - `SATSER_INITIAL_VALUES` er **bevidst** stadig et øjebliksbillede: det er et initialværdi-objekt
    med krav om stabil referenceidentitet, og en live default kunne overskrive brugerens valgte
    årgang midt i en session. `seedSatserNewCase` læser derimod live, så en ny sag efter et
    årsskifte seedes med det nye år.
  Fire nye tests i `dateRanges.test.ts` krydser midnat og årsskifte med `vi.setSystemTime`.
  **Mutationstestet:** genindføres den frosne form, fejler præcis de fire nye tests og intet
  andet. De gamle tests kunne kun se selv-konsistens og fangede derfor ikke fejlen.
  Fuld suite grøn (521 filer / 6646 tests), typecheck (kilde+test) + lint grønne.

- **#18 — EET-differencekrav dekomponeret efter den korrigerede skæring.** De to fil-lokale
  bokse er flyttet til `erhvervsevnetab/differencekrav/` (`EetProformaKapitaliseringBox.tsx`
  190 l., `EetMerErstatningPensionsalderBox.tsx` 167 l. — sidstnævnte bærer også
  `EetMerErstatningEventRows`, som kun den bruger). `EetDifferencekravTab.tsx` 761 → 435 l.
  Underkomponenterne var allerede rene og props-tagende, så det er en ren relokation.
  Undervejs: `formatMaaneder` er flyttet til `domain/erhvervsevnetab/eetFormatUtils.ts`, hvor
  `formatFaktor`/`formatPct` allerede bor — den var en fil-lokal formatter for et tværgående
  concern, og både tabben og den udskilte boks har brug for den. To dublerede imports fra
  `eetFormatUtils` i tabben er samtidig slået sammen.
  Den "delte forlig-editor" er **bevidst ikke** lagt sammen: duplikeringen er ~35 linjer, og de
  to callsites er kontraktkrævet forskellige på ref-niveau (`domain-boundary-contract.md` §10.4
  + arkitekturværn). En naiv sammenlægning ville bryde værnet for en meget lille gevinst.
  302 EET-tests grønne.

- **#1 rest — SFGG-afledningen flyttet fra kortet til VM'en.** De 10 løse booleans/etiketter i
  `AnsaettelsesforholdCard` er nu ét `getSfggPresentation(af)` i
  `viewModel/loenindkomstDerivations.ts` — samme sted som de øvrige per-af-afledninger, hvis
  kommentar allerede sagde at netop denne slags var flyttet dertil. Flagene er samlet i ÉN
  funktion (ikke 10 selvstændige), fordi de er indbyrdes afhængige (kilde × overenskomst ×
  satsmodel) og kun giver et konsistent billede afledt i én omgang.
  Følgevirkning: `SygeferiegodtgoerelseSection` gik fra **10 props til 3**, og kortet importerer
  ikke længere `getOverenskomstMetaById`, `getOverenskomstSfggPolicy` eller
  `hasSfggSelectedOverenskomst` — dvs. viewet rører ikke længere overenskomst-datalaget direkte.
  `AnsaettelsesforholdCard.tsx` er nu 781 l. (fra 1033). Fuld suite grøn (6646 tests).

- **#3 — én IndexedDB-primitiv; begge wrappers samlet.** Ny `utils/indexedDbStore.ts` (177 l.)
  ejer forbindelse, transaction-livscyklus og promisificering. `fileHandleStorage.ts` 735 → 177 l.
  (kun de domænenavngivne operationer tilbage), nøglerne + deres typer i
  `utils/file/fileHandleKvStore.ts` (126 l.), og permission-verifikationen — som slet ikke rørte
  IndexedDB — i `utils/file/fileHandleVerification.ts` (185 l.).
  `logStorage.ts` er migreret til samme primitiv og har ikke længere sin egen
  `openDatabase`-kopi. **Der findes nu nul rå `indexedDB`-referencer uden for primitivet.**
  De to *databaser* er bevidst holdt adskilte: `mineo_file_handles` er et keyed kv-store,
  `MineoLogs` et append-only log-store med `autoIncrement`-keyPath og to cursor-læste indexes.
  At presse dem sammen ville blande to datamodeller for at spare én DB-definition.
  Reelle fejl lukket undervejs (ikke kun oprydning):
  - **Inkonsistent utilgængelighedssvar.** `typeof indexedDB`-guarden var gentaget 9 steder med
    returværdier `false`/`null`/`true` — og manglede helt i `getDirectoryDisplayInfo`.
    Utilgængelighed er nu én eksplicit `unavailable`-tilstand, som hver kalder oversætter til
    sin egen fail-safe værdi.
  - **Forbindelseslæk.** Den gamle form lukkede kun i `transaction.oncomplete`, så en fejlende
    transaction efterlod forbindelsen åben; `logStorage.ts` lukkede **aldrig**. Nu lukkes der i
    `finally`.
  - **Manuel flag-koordinering.** `saveDefaultDirectoryHandle`/`deleteDefaultDirectoryHandle`
    koordinerede to requests med `handleDone`/`metaDone`-flag. Nu er begge nøgler én
    transaction, hvis commit afventes — handle og metadata kan ikke længere komme ud af sync.
  - **Cursor-sletning uden ventetid.** `logStorage`s cleanup satte kun `onsuccess`-handlere på
    sine slette-cursors og stolede på, at de var færdige før `oncomplete`. Løkken afventes nu.
  Ny test `indexedDbStore.test.ts` (8 tests) med en lokal IndexedDB-stub — bevidst uden ny
  dependency (`fake-indexeddb`), fordi de hævdede invarianter er primitivets egne
  (unavailable-tilstand, forbindelse lukkes altid, flere writes som én enhed, åbningsfejl),
  ikke IndexedDB-specifikationens semantik. **Testen fangede en reel ordningsfejl i primitivet
  før den nåede videre:** `oncomplete` kunne fyre, før `work`-promisen afviste, så en fejlet
  skrivning blev rapporteret som `ok`. Transaktionsudfaldet oprettes nu som en selvstændig
  promise FØR `work` afvikles. Læsninger venter bevidst ikke på commit (værdien er i hånden).
  Fuld suite grøn (522 filer / 6654 tests) — inkl. den eksisterende `logStorage`-test, som gik
  fra 15 s timeout til 161 ms.

- **#20 — den skjulte serialiseringsaftale er lukket i begge ender.**
  `EoRowModel` har nu et valgfrit `table: EoRowTable` (kolonner + rækker, med `isTotal` som
  **eksplicit flag**), og `serializeEoRowTable` projicerer det til `displayValue`. Strukturen er
  dermed kilden, og strengen er outputtet — modsat før, hvor strengen var den eneste kilde og
  viewmodellen splittede den op igen på `\n` og `|`.
  `parseSfggTable` → `projectSfggTable`: ingen parsing, intet udledt kolonneantal, og ingen
  genkendelse af totalrækken ved at strengmatche celleteksten «I alt» (en etiketændring kunne
  før ændre, hvad der var en totalrække). Betingelsen for "vis som tabel" er nu rækkens egen
  `table`-struktur i stedet for et `sfgg.tabel.`/`sfgg.aarsfordeling.`-id-præfiks-gæt.
  **Regex-row-id'erne er væk:** builderne sætter nu `employmentId` eksplicit — de HAVDE
  allerede id'et i hånden — så `getLoenindkomstAnsaettelsesforholdId` og `getSfggEmploymentId`
  er slettet. I SFGG-builderen stemples feltet på hele gennemløbets række-slice ét sted, så et
  enkelt glemt felt blandt ~30 `rows.push`-kald ikke kan give en lydløst uplaceret række.
  `getRegulationEmploymentId` er bevidst bevaret og begrundet i koden: dens kilde er en
  *sektion* (uden rækkefelt at bære id'et i), ikke en række.
  `displayValue` er bevist byte-identisk (dokumentgeneratorerne læser den; `serializeEoRowTable`
  reproducerer også totalrækkens dobbelte mellemrum for både 6- og 7-kolonneformen).
  Ny test `eoRowTable.test.ts` (5 tests). **Mutationstestet:** en ændret separator dræber tre af
  dem — og blev IKKE fanget af `eoSectionTableParity.golden`, hvilket er præcis grunden til at
  værnet hører på serialiseringen. 25 fixture-rækker i `EOInspektion.test.tsx` er opdateret med
  `employmentId`, og SFGG-tabel-fixturet bærer nu den strukturerede form, så det tester den
  faktiske vej. Fuld suite grøn (523 filer / 6659 tests).

- **#43 — ét rute-inventar og ét layout-flow.** `pageNavigation.ts` har nu også
  `APP_SYSTEM_PAGE_DEFINITIONS` (de tre routes der ikke er persisterede sagssektioner:
  `/open`, `/indstillinger`, `/mineo`) plus `ALL_APP_PAGE_ROUTES`. `App.tsx` deriverer sine
  `<Route>`-elementer HERFRA i stedet for at gentage pathstrengene, og en **import-tids-guard**
  fejler hårdt, hvis loader-listen og kataloget driver fra hinanden. Tidligere stod de 8
  sagssider i to lister (kataloget + hardkodede strenge i `App.tsx`, som ikke importerede
  `APP_ROUTES`), og de 3 systemsider fandtes kun i `App.tsx`.
  De 11 `createPageWrapper`-wrappere er erstattet af ÉN `<Route element={<AppShell />}>` med
  `<Outlet/>`. Bemærk at `APP_PAGE_DEFINITIONS` bevidst forbliver nøglet på
  `PersistedSectionKey` — det er dét, der gør den brugbar som sektion↔route-kilde for
  undo/redo-destinationer og feltlokationer, og systemsiderne hører derfor i et separat kort.
  Ny test `App.appShell.test.tsx` (4 tests).

  **Vigtig korrektion af kandidatens præmis:** planen (og min egen første formulering) sagde,
  at den gamle per-route-wrapper remountede shellen ved hver navigation og dermed smed
  `Container`s focus-cache væk. **Det er ikke rigtigt.** Jeg målte mount-tællingen på begge
  former isoleret: React reconciler samme komponenttype på tværs af søskende-routes, så
  `MainLayout` blev bevaret i *begge* varianter (`mounts === 1` efter navigation i både
  per-route- og layout-route-formen). Gevinsten ved #43 er derfor **strukturel** — ét
  autoritativt rute-inventar og ét layout-sted frem for elleve — ikke en adfærdsrettelse.
  Testen er skrevet som et VÆRN mod en fremtidig ændring der ville bryde egenskaben (fx et
  `key` på shell-elementet), og den bærer et selvstændigt mutationsværn, der beviser at
  mount-tællingen faktisk kan fange en per-route-identitet. Uden det ville tællingen være
  grøn af tomhed.

### Efterslæb lukket 2026-08-07 (revision af de allerede gennemførte kandidater)

Efter opfordring til at rette *alle* tilbageværende fejl i den hidtidige implementering blev de
seks gennemførte kandidater revideret mod koden. **Fire var leveret som beskrevet** (#14, #29, #3
og #43's strukturelle kerne). Tre bar reelle efterslæb — hver af **samme fejlklasse som den
kandidat, der skulle have lukket den**, hvilket er grunden til at de er værd at registrere:
en kandidat kan se gennemført ud, fordi dens navngivne symptom er væk, mens mekanismen består.

- **#20 — den skjulte serialiseringsaftale var IKKE lukket i begge ender.** Beskrivelsen
  overdrev resultatet: én aftale overlevede. `sviesmerte.beregnetPeriode` byggede sin værdi med
  `.join('\n')` i `eoRowSvieSmerteRows.ts`, og `useEoBeregningViewModel.ts` splittede den op igen
  på `\n`. Den var **ikke** kosmetisk: linjeantallet driver synlig UI-forgrening
  (`harSvieSmertePerioder`, og ental/flertal i etiketten «Svie/smerte-periode(r)»), så et skift
  til fx `'; '` som separator ville lydløst kollapse listen til én linje og vende etiketten.
  Lukket med `lines?: readonly string[]` på `EoRowModel` + `serializeEoRowLines` — samme design
  som `table`/`serializeEoRowTable`: strukturen er kilden, strengen er outputtet. Builderens
  tomme-udfald returnerer nu `[]` frem for `'-'`, så forbrugerens gamle `'-'`-filtrering ikke
  længere er nødvendig for at ramme samme adfærd. Følgevirkning: «antal dage»-rækkens
  «ingen perioder»-test aflæser nu `lines.length === 0` i stedet for sentinel-strengen `'-'`.
  Builderens udfald er modelleret som en **union af to arter** (`{lines}` eller `{displayValue}`)
  frem for ét objekt med valgfrie felter — ellers kan en ny gren glemme begge.
  **To fejl i mit eget arbejde undervejs, begge fanget af test:** først ramte `lines`-grenen for
  bredt, så en fejlbesked («Der er overlappende perioder») blev behandlet som en periodeliste;
  derefter ramte den for smalt, så `!harPerioder` mistede sin `'-'`→`'Nej'`-omskrivning. Det
  andet fandt kun den nye test — det var en reel, synlig regression, ingen eksisterende test så.

- **#1/#22 — Anciennitetstillæg-blokken var ikke med.** ~50 linjers næsten identisk markup stod
  fortsat begge steder, umiddelbart efter `LoenudviklingFields`. Den slap igennem, fordi den
  ligger *uden for* selve Lønudvikling-fladen, men det er samme duplikering af samme grund. Ny
  `AnciennitetstillaegFields.tsx` + `AnciennitetstillaegBinding`.
  **Den bar en udokumenteret funktionsforskel**, som sammenlægningen tvang frem: Lønindkomst
  lader brugeren VÆLGE satsens enhed (`anciennitetstillaegSatsAngivesPer`: Time/Måned), mens
  EO-oplysninger UDLEDER den af `beregnesUdFra` og viser intet valg. Forskellen er hverken
  besluttet eller beskrevet noget sted. Den er **bevaret nøjagtigt som den er** og gjort synlig
  via en `satsEnhedSlot` (samme mønster som `overenskomstSlot`) — at ensarte den ville ændre
  brugerfladen under dække af en refaktorering, og det er en UI/UX-sag for brugeren.
  *Åbent spørgsmål til brugeren: skal EO-oplysninger også have enhedsvalget, eller er
  udledningen den ønskede adfærd dér?*

- **#43 — der var TRE rutelister, ikke to.** Beskrivelsen sagde «de 8 sagssider stod i to
  lister». `SideMenu.tsx` bar en tredje: alle otte sagssider plus to systemsider som bare
  strenge, og filen importerede slet ikke `pageNavigation`. Guarden i `App.tsx` sammenholder kun
  *loader*-listen med kataloget, så en omdøbt route gav en **lydløst død menupost** — og der
  fandtes nul tests for `SideMenu`. Lukket i to lag, fordi ét ikke rækker:
  - **Typen** (`MenuPageKey` + `getRouteForMenuPageKey`) gør et forkert id til en compile-fejl,
    og `/${pageId}`-interpolationen i `MainLayout` — selve mekanismen, der gjorde enhver streng
    til en gyldig route — er erstattet af et opslag. Mutationsbevist: `'satserXX'` fejler i tsc.
  - **Testen** (`SideMenu.routeInventory.test.tsx`, 4 tests) dækker typens loft: en *manglende*
    post typechecker fint. Mutationsbevist: fjernes en menupost, fejler completeness-testen.

  Samtidig er 10 hardkodede `navigate('/…')`-literaler i fem filer rutet gennem `APP_ROUTES` —
  præcis de «hardkodede route-strenge i domæne-lokale navigation-objekter», som
  `pageNavigation.ts:7` navngiver som grunden til at modulet findes. `MainLayout`s håndrullede
  `substring(1) || 'stamdata'` er erstattet af `routeToPageId`, som filen allerede importerede.
  `serviceWorkerBootstrap.ts` beholder bevidst sin `'/open'`-literal (bootstrap-sti uden
  config-import).

Dertil rettet: `asciiSlug.ts`s doc-kommentar sagde `ø`→`o`, mens tabellen 26 linjer længere nede
korrekt gør `ø`→`oe` — netop den fejl, kandidaten handlede om.

**Metodenote:** alle tre efterslæb blev fundet ved at revidere de FÆRDIGMELDTE kandidater mod
koden, ikke ved at læse beskrivelserne. To af dem (#20, #43) var beskrevet med formuleringer
(«lukket i begge ender», «stod i to lister»), der var stærkere end virkeligheden. En
færdigmelding er en påstand, der skal verificeres som enhver anden.

### Tilfældighedsfund registreret under gennemgangen

- **`sfgg.aarsfordeling.*` var død kode i tre steder — RETTET.** Ingen row-builder producerer
  nogensinde et `sfgg.aarsfordeling.`-id; en eksisterende test hævder eksplicit
  `toBeUndefined()` for det. Alligevel fandtes der en branch for præfikset i
  `eoInspektionPageViewModel.ts` (fjernet som del af #20) og **to filtre** i
  `EOInspektionEmploymentSections.tsx` (`sfggFooterTables`/`sfggPrimaryTables`), der delte
  tabellerne op efter et præfiks, som aldrig optræder — så `sfggFooterTables` var altid tom, og
  dens ~24 linjers `StandardDisplayTable`-render-blok kunne aldrig nås. Opdelingen og den døde
  blok er fjernet; alle SFGG-tabeller renderes nu ad én vej.

- ~~`SiblingSitesFooter.tsx` og `RenteberegningTab.tsx` bærer breakpointstyret styling i delte
  komponenter.~~ **LUKKET 2026-08-07** efter brugerens beslutning 1. Præmissen var kun halvt
  rigtig (begge er delt med standalone minProcesrente, og breakpointsene tænder aldrig på
  desktop), men den underliggende svaghed var reel og bredere end de to filer: undtagelsen stod
  kun som PROSA i `app-shell-contract.md` §5.3, og prosaen var allerede drevet fra koden — den
  navngav to filer og kaldte stylingen «variant-lokal, ikke delt», mens fem TS/TSX-filer bar den,
  heraf to delt med Mineo. §5.3 er nu en tabel med begrundelse pr. fil, og fillisten er
  **håndhævet** af `shell/viewport-responsive-styling-allowlist` i arkitektur-harnesset.
  Skæringen er per kategori: input-modalitet (`pointer: coarse`, `hover:`) er ikke responsivt
  layout og er tilladt overalt. **Mutationstestet:** fjernes en allowlist-post, fejler præcis den
  ene regel på den rigtige fil. To fund undervejs: `UnsupportedDevicePage.tsx` bruger slet ingen
  breakpoints (flydende bredder), og `ScrollToTopButton.tsx`s `max-width: 640px` er reelt
  nåbar — device-gaten kræver **touch-lighed**, så et smalt ikke-touch desktopvindue slipper
  igennem — og er derfor auditeret ind frem for fjernet.
- Flere af den gamle plans fase-/statuslinjer beskriver nu slettede filer,
  gamle storagekeys og gamle lifecycle-politikker. Det er dokumentdrift,
  ikke en produktionsfejl, men den aktuelle revurdering ovenfor skal fremover
  bruges som statuskilde, så planen ikke utilsigtet genintroducerer legacy-
  arkitekturen.

---

### Gennemført 2026-08-07 (anden omgang: #50 og #32)

- **#50 — TAF-grafen har nu en scene-model, og tegningen er dækket af test.** Grafens
  beslutninger — koordinater, farver, skrifter, tekster, rækkefølge — er flyttet til
  `document/generators/tafFordelt/tafKravGrafScene.ts` som en ren værdi (en ordnet liste af
  tegneprimitiver). `tafKravGrafCanvasRenderer.ts` oversætter dem 1:1 til canvas-kald og
  træffer bevidst ingen beslutninger; `tafKravGrafChart.ts` er reduceret til at skaffe det
  canvas, ingen af de to kan skaffe selv. Tekstmåling injiceres som en `MeasureText`-funktion —
  det er den ene ting scenen ikke selv kan afgøre — så scenen forbliver ren og testbar.
  De 390 tidligere utestede linjer er dermed inde i det testbare.
  **Pixel-troskaben er bevist, ikke antaget** (brugerbeslutning 3): en midlertidig
  parity-harness kørte den gamle monolit og den nye vej mod den samme optagende ctx-stub og
  krævede *identiske* kaldsekvenser på to fixtures. Den fandt tre reelle afvigelser i mit eget
  arbejde, hvor jeg havde slået separate stier sammen til én. Det er ikke kosmetik: en stiplet
  streg fortsætter sit dash-mønster hen over delstier i samme sti, så en samlet sti ville have
  forskudt stiplingen på alle linjer efter den første. Scenen skelner derfor nu eksplicit mellem
  `strokeLines` (egen sti pr. stykke — gridlinjer, tick-mærker) og `strokeSubpaths` (én sti,
  ubrudt stipling — periode-kanter, aksernes vinkel). Harnessen er mutationstestet
  (`PLOT_TOP` 150→151 dræber begge cases) og derefter slettet.
  Nyt varigt net: `tafKravGrafScene.golden.test.ts` (2 snapshots + 10 strukturelle invarianter,
  bl.a. at clip/restore balancerer, at båndene ligger inde i clippet og signaturen uden for, og
  at alle koordinater holder sig inden for lærredet). **Ingen tegnefejl fundet** — der er derfor
  intet at forelægge under undtagelsen i beslutning 3. 34 tests grønne.

- **#32 — kandidaten var skåret forkert; den reelle defekt var ctx-objektet.** Planen (og den
  kodeverificerede baseline) sagde, at de 7 sektioner skulle flyttes fra imperativ rendering til
  `Block[]`. **De producerer allerede blokke:** `writer` er en `DocumentComposer`, hvis eneste
  output er `DocumentBlock[]`. `=> void` er akkumuleringsformen, ikke et manglende IR — der er
  ingen imperativ rest at migrere.
  Det faktiske problem var, hvad ctx bar: `opgoerelseSection` modtog **13 rene modulfunktioner**
  (formattere, datohjælpere) plus **7 omdøbte aliaser af writer-metoder** — `renderSubheader`
  *var* `writer.writeBoldSubheader`. Omdøbningslaget skjulte, at sektionen allerede skrev til
  composeren. Funktionerne importeres nu direkte, og kun kalder-ejet tilstand sendes ind.
  `NBSP` og de `Calculable`-bevidste beløbsrenderere lå duplikeret i to filer og bor nu ét sted
  (`documentFormatUtils` hhv. den nye `generators/eo/eoMoneyText.ts`).
  **Én skjult funktionsforskel afdækket og bevaret:** `renderMoneyWithKrOrError` opførte sig
  forskelligt afhængigt af kalderen — EO-dokumentet viser «Fejl (…)», mens
  TAF-opreguleret-dokumentet *kaster*, fordi lønnen dér er gated fail-closed i projektionen.
  Forskellen lå usynligt i, at hver kalder sendte sin egen variant ind. En sammenlægning ville
  have fjernet et fail-closed værn på et tillidskritisk dokument i det stille; den er i stedet
  gjort til et eksplicit, dokumenteret ctx-felt.
  **Bevidst urørt:** `loenindkomstSection` og `reguleringSection`. Deres injektion er
  load-bearing som *testseam* — sektionstestene overstyrer afhængighederne per case ~20 steder
  for at styre tabeldata og rækkefiltrering. At rive den ud ville svække et fungerende testnet
  for en ren oprydningsgevinst. Registreret her frem for skjult.
  Goldens byte-uændrede; ingen tal og ingen dokumentværdi flytter sig. Fuld suite grøn
  (526 filer / 6688 tests), typecheck (kilde+test) og lint grønne.

**Metodenote fra denne omgang:** begge kandidater var beskrevet forkert i planen — #50's
argument var stærkere end skrevet (utestbarhed, ikke «blandede ansvar»), og #32's præmis var
direkte modbevist af koden. Mønsteret fra 2026-08-07-revisionen gentog sig: *verificér
kandidatens præmis mod koden, før du implementerer dens bogstav.* Og: en refaktorering, der
samler to kopier, skal måles mod den gamle adfærd med et net der kan fejle — begge gange her
afslørede nettet en forskel, jeg ellers ville have fjernet uden at opdage det.

---

### Gennemført 2026-08-07 (tredje omgang: #26, #35, #45 og #21)

Tre af de fire kandidater var skåret forkert i planen. Præmisserne blev verificeret med fire
parallelle gennemgange, før noget blev implementeret — samme arbejdsform som de foregående
omgange, og igen den afgørende del.

- **#26 — Containers fokus-traversering er flyttet ud og er nu testbar.** `Container.tsx` bar
  440 af sine 584 linjer fokus-logik. Det tunge argument stod ikke i planen: **geometrien —
  visuel række-gruppering med tolerance, vandret sortering, cirkulær nabo-udpegning — kunne
  kun rammes gennem en fuld render, hvor jsdom ikke har layout.** Alle rects var 0×0, så
  række-grupperingen så identisk (og tom) ud, uanset hvad reglen var. Den reelle logik var
  dermed udækket, mens de 37 eksisterende tests kun dækkede tastesemantikken.
  Navigationen bor nu i `components/layout/containerNavigation/`, delt efter **fejlmåde**:
  `focusRowGeometry.ts` (rene beslutninger over værdier), `useFocusableInventory.ts` (DOM,
  synlighed, MutationObserver-cache) og `useContainerKeyboardNavigation.ts`
  (tasteoversættelse). `Container.tsx` er 107 linjer: scroll-vært og `<main>`-landmark.
  **Bevaringen er bevist, ikke antaget.** De 37 tests var grønne både før og efter og beviser
  derfor intet om bevaringen. En midlertidig parity-harness kørte den gamle monolit og den nye
  vej mod PRÆCIS samme DOM med et deterministisk layout-stub og krævede identiske fokus-spor
  trin for trin. Tre mutationer beviste, at den kunne fejle — og den tredje afdækkede et hul i
  mit eget fixture: uden et sidefelt på tabellens visuelle linje var udelukkelsen af
  tabel-felter utestet, så mutationen «drop udelukkelsen» overlevede først. Harnessen er
  slettet igen; dens værdi var beviset.
  Varigt net: `focusRowGeometry.test.ts` (24 tests uden jsdom; fire mutationer hver fanget af
  præcis én test) + arkitekturreglen
  `layout/focus-traversal-owned-by-container-navigation`, som pinner ejerskabet af
  traverserings-primitiverne. **To bevarede arv er dokumenteret frem for rettet:** et
  container-løst felt er en vandret blindgyde (kan nås fra rækken, men ikke pile tilbage), og
  piletaster i et tabel-subtræ er blokeret uden kant-exit. Begge ville ændre brugerens
  fokus-oplevelse og er derfor ikke mine at rette.
  Følgevirkning: `popup-semantics-single-source`-reglens `requiredPaths` pegede på
  `Container.tsx` som sidens navigationsflade; den peger nu på det modul, der overtog
  popup-undtagelserne. Harnessets egen liveness-kontrol fangede driften.

- **#35 — planens blokering var forkert; abstraktionen fandtes allerede.** Planen sagde, at
  foreningen var *blokeret indtil der findes en fælles dato-nøgle-abstraktion*, og talte 3-4
  implementeringer. **Begge dele var forkerte.** `findLatestByDateInSortedList` i
  `reguleringSeriesLookup.ts` VAR allerede den konsoliderede abstraktion med 10 callsites — den
  krævede blot, at datofeltet hed `startIso`. To ISO-serier med *præcis samme semantik* havde
  derfor overlevet med hver sin re-derivation, alene fordi feltet hed noget andet:
  `resolveLatestManualRowForDate` (`startDato`) og inspektionens indeks-rækkeopslag (`dato`).
  Begge manglede sorterings-invarianten og gav tavst et forkert satssæt ved usorteret input;
  inspektionens gentog desuden `slice/map/filter/sort` for hver dato, mens den *samme fil* 40
  linjer længere ned brugte den delte funktion.
  Kernen er nu parametriseret på en nøglevælger (`findLatestByDateKeyInSortedList`); den
  ergonomiske `startIso`-form er kernen med en fast vælger, bevist ækvivalent i test, så de to
  ikke kan drive fra hinanden. De 10 eksisterende callsites er urørte.
  **Tie-break'et var det farlige.** Den gamle inspektions-form sorterede *descending* og tog
  `[0]`; kernen scanner baglæns i en *stigende* liste. De to udpeger MODSATTE rækker, når to
  rækker har samme dato. Ækvivalensen er efterprøvet empirisk (ikke ræsonneret frem) og
  tie-break'et bevaret eksplicit i koden. **Ingen fixture havde dobbelt-daterede rækker**, så
  skiftet ville ellers have flyttet et satssæt lydløst — mutationstesten viste netop, at intet
  værn fangede det. Ny test pinner det nu (`expected 300 to be 200` ved mutation).
  `resolveLatestManualRowForDate` havde ingen dækning før; fire tests dækker nu
  carry-forward-semantikken selv frem for bededagssatsen omkring den.
  Bekræftet uden for kandidaten (som planen rigtigt sagde): sygedagpenge (lukkede intervaller),
  lovbestemte satser (per-år-eksakt) og KL-lønaftaler (eksakt-dato-Map) er andre datamodeller.
  Registreret som ikke gjort: `DanishDateString`-datalagets to opslag har hver sin private
  `danishDateToNumber`-kopi, og der findes en separat `.filter().reduce()`-max-familie på seks
  interval-start-resolvere. De hører til et andet spor.

- **#45 — gennemført efter den korrigerede skæring; ingen `GridSpec`.** Planens
  «sort-plumbingen er identisk i alle 10 tabeller» var overdrevet: hook-kaldet er
  nær-identisk i 8, destruktureringen deler sig 4/3/3 over tre former, og de to
  `Loenudvikling*`-tabeller har en materielt anden `isRowEmpty` og reorder.
  De reelt byte-identiske fragmenter var **fire ting, der altid følges**: reorder-persistering
  i samme event, render-rækkefølgen, save-order-registreringen og header-cellens pil. De var
  skrevet i hånden pr. tabel, så en ny tabel kunne få tre af fire rigtigt — og fejlen ville
  først vise sig som **en gemt fil med en anden rækkefølge end skærmen**: ingen typefejl,
  ingen exception. `useSortedCollectionTable` ejer dem nu; 8 tabeller er ruttet igennem.
  `useRegisterTableSaveOrder` har dermed præcis én forbruger.
  `bindSortableHeader` binder header-cellens tre sorterings-props ud fra ét `colId`. Før stod
  id'et **tre gange pr. celle, ~22 steder**, hvor to af de tre kunne stave forkert uden at
  noget fejlede — kolonnen holdt blot op med at vise sin pil, mens klikket virkede. Alle tre
  argumenter er `string`, så hverken typecheck eller en render-test kunne se det.
  **De to `Loenudvikling*`-tabeller er bevidst ikke lagt ind i hooken:** deres reorder ankrer
  den programstyrede basisrække på plads, og de registrerer ingen save-order (også før). At
  presse dem ind ville kræve escape-hatches for netop den semantik, der gør dem forskellige.
  De deler kun `bindSortableHeader`. `renderRows` er derfor valgfri i hooken — de tabeller, der
  bygger render-rækker direkte fra den sorterede orden, har intet at reconcile.
  Nyt net: 6 tests på det koblede lag (tre mutationer, hver fanget af den rigtige test) +
  arkitekturreglen `form/table-sort-order-owned-by-hook`, mutationstestet.
  Registreret som ikke gjort: `RowDeleteButton`-mønstrets omgivende celle (`position:
  relative` + `paddingRight: 28`) er stadig skrevet i hånden 10 steder i fire varianter, og
  `renderRows`-reconciliationens fætter i de fire ikke-`useCollectionTable`-tabeller.

- **#21 — gennemført, og det reelle fund var større end planen sagde.** Planens korrektion var
  rigtig (intet settings-register: kun 7 af 18 felter er ensartede; de øvrige har fem
  kontroltyper, fire opdateringssemantikker, DEV-gating og asynkrone
  File-System-Access-handlere). Men «~63 linjers label-metadata hører i `settings/`» ramte
  forbi: **etiketterne var duplikeret 3× pr. enum**, og et af stederne var
  `eoRowEvaluation/eoRowSvieSmerteRows.ts` — altså rækkeevaluerings-laget, hvor teksten ender
  i et bilag. To flader kunne kalde samme værdi noget forskelligt, uden at nogen kontrol kunne
  se det.
  Etiketterne bor nu ved enummet selv (`schemas/formSchemas/enumLabels.ts`) og
  brevhoved-navnene ved dokument-lagets kanoniske nøgleliste, som allerede ejede nøglerne.
  Begge er fuldt dækkende `Record`s over den exhaustive type. Formen er bevidst et opslag og
  ikke en ternær: «`=== 'fuld' ? … : …`» gav tavst den forkerte etiket, hvis enummet fik et
  tredje medlem. Sidens lokale PDF/Word-tabel er erstattet af den kanoniske
  `getDocumentFormatLabel`, som filen i forvejen importerede fra.
  Indstillingssiden beholder kun det, der reelt er sidens eget: rækkeopdelingen af
  brevhoved-checkbokse. Ny test `enumLabels.test.ts` (5 tests).
  Registreret som ikke gjort: de fire `is…Option`-typeguards på siden er samme mønster fire
  gange og hører principielt ved enummet; og `defaultDirectoryHandleId` alene fylder ~143 af
  filens 605 linjer (fire hooks, to async-handlere, 47 JSX-linjer for én række) — dét, ikke
  metadata, er sidens største enkeltansvar og et selvstændigt spor.

**Metodenote fra denne omgang:** *«blokeret» i planen er også en påstand, der skal
verificeres.* #35 stod som blokeret af en manglende abstraktion, der fandtes med 10 callsites —
ingen havde åbnet filen. Og to gange her var den farlige del ikke refaktoreringen, men en
**tie-break eller en asymmetri, ingen fixture dækkede**: inspektionens dobbelt-daterede
rækker og Containers container-løse blindgyde. Begge ville have flyttet sig lydløst. Reglen der
holdt: mutationstest værnet, og hvis mutationen overlever, er det fixturet der mangler noget —
ikke mutationen der er urimelig.

---

### Gennemført 2026-08-07 (fjerde omgang: #52 — den sidste kandidat)

Mønsteret fra de tre foregående omgange gentog sig i sin reneste form: **planens diagnose pegede på et
reelt problem, men dens ordination ville have gjort skaden større.** Præmissen blev verificeret med tre
parallelle gennemgange af alle 29 filer i `src/contracts/`, før noget blev ændret.

**Begge navngivne drift-eksempler var allerede rettet.** `PdfDocument` optræder nul gange i samtlige
kontraktfiler; `eo-snapshot-contract.md` navngiver de seks `eoSnapshotTo*`-projektioner, som alle findes.
`app-settings.md` blev omskrevet samme dag som review-noten og beskriver den aktuelle
`projectSourceSettings`/`projectEoRowPolicy`/`projectDocumentRenderSettings`-kobling korrekt. Kandidatens
to konkrete beviser var altså forældede — dens egen statuslinje advarede om netop det.

**Og planens løsning var forkert.** Forslaget var at flytte fil-/symbolkortene ud af kontrakterne og over
i informative dokumenter. En optælling viste, hvorfor det ville have været den forkerte operation: af
~230 fil-stier var **nul** døde, og af 569 unikke symboler var **fem** forkerte — implementeringskortene
var 99,7 % korrekte. De to bedste kontrakter i sættet (`calculation-data-contract.md`,
`auth-gate-contract.md`) navngiver netop mange filer i et dedikeret §3 og er *bedre* for det. Planen
ville have flyttet den rigtige del ud og efterladt den uverificerede del.

**Den reelle defekt var den sidste sætning i problemformuleringen:** intet verificerede
implementeringskortene. `contractCoverageMatrix.test.ts` er en linkage-guard — den kontrollerer, at
koblede TESTFILER og topologiens stier eksisterer, og at verifikationsstemplet matcher en regex. Den
åbner aldrig en kontrakts brødtekst. Alle referencer inde i kontrakterne stod uden dækning: hverken
typecheck, lint eller arkitektur-harnesset kan se dem, fordi ingen af dem læser `.md`-filer.
`acceptanceMatrix.test.ts` havde allerede løst nøjagtig samme fejlklasse for §5-registret og døbt den
«grøn af tomhed»; kontraktværnet var det sidste register, der stadig brugte den svage form.

**Tre værn, hver mutationstestet:**

- **`contractReferenceLiveness.test.ts`** udtrækker referencerne af kontraktteksten og kræver, at hver
  navngiven fil og hvert symbol findes. Referencerne UDLEDES frem for at stå i et register — et
  håndholdt register over ~660 referencer ville selv skulle vedligeholdes, og en glemt post ville være
  et nyt hul af samme slags. Kun undtagelserne skrives ned, så en ny kontrakt er dækket i samme øjeblik
  den oprettes.
- **`scripts/check-contract-verification.mjs`** (i `verify:release`) kræver, at
  `**Senest verificeret mod kode:**` ikke er ældre end den seneste commit, der ændrede filen.
- **Testkobling-afstemningen** i coverage-matrixen: hver suite, en kontrakt navngiver i sit eget
  `Testkobling`-afsnit, skal også stå i `COVERAGE_MATRIX`.

**Fraværsværnene var det, der gjorde skæringen svær.** Kontrakterne navngiver bevidst ting, der IKKE må
findes — `document-output-contract.md` skriver ordret «der findes ingen `documentService.ts` — navnet
står her som fraværsværn». En naiv «alt navngivet skal eksistere»-regel ville have presset de værn ud af
kontrakterne og dermed slettet den eneste beskrivelse af, hvad der er revet ned. Hver reference har
derfor en RETNING, og `absent` HÅNDHÆVES som en påstand: mutationstesten genskabte
`src/document/service/documentService.ts` med en `persistData`-eksport, og begge fraværsværn blev røde.

**Fem levende drift-tilfælde, alle i kontrakter stemplet som verificerede:**

| Kontrakt | Skrev | Hedder faktisk |
|---|---|---|
| `mineo-field-pattern.md:39` | `SettledFieldState` | `SettledFieldView` |
| `satser-contract.md:12` | `satserSchema.ts` | `satserSchemas.ts` (og var stavet rigtigt i `schema-evolution.md`) |
| `error-contract.md:90` | `EoInspektionSnapshot` | `EOInspektionSnapshot` (versalt O) |
| `form-contract.md:375` | `EoInspektionSnapshot` | samme |
| `persistence-contract.md` + `schema-evolution.md` | `InputEnvelope` | `CurrentInputEnvelope` |

Alle fem er ét bogstav eller ét ord galt — usynligt for hele værktøjskæden, og præcis den slags, der får
en læser til at søge forgæves efter en type, der ikke findes.

**Stemplet var et ritual.** Skabelonens ENESTE håndhævede felt var kun håndhævet på FORMAT. Seks
kontrakter bar et stempel, der lå FØR deres egen seneste redigering — `auth-gate-contract.md` sagde
2026-07-28, mens filen blev ændret 2026-08-01. Dertil delte 14 filer ét bulk-stempel. Nogen havde
redigeret kontrakternes tekst uden at forny påstanden om, at teksten er sand, og feltets eneste kontrol
kunne per konstruktion ikke se det. Reglen er nu den svageste, der fanger fejlen — ikke «stemplet skal
være friskt», for en kontrakt, ingen har rørt i et halvt år, er ikke af den grund forældet, og en
tidsbaseret udløbsdato ville producere rød farve uden ny information.

**To autoritative lister var uenige.** Fem kontrakter fører et `Testkobling`-afsnit ved siden af
`COVERAGE_MATRIX`. Ingen kontrol sammenholdt dem, og de divergerede: `app-shell-contract.md` navngav
tre suiter, matrixen ikke kendte (`pwaHeaders.test.ts`, `responsiveStylingRules.ts`,
`verify-build-artifacts.mjs`), `auth-gate-contract.md` og `calculation-data-contract.md` hver én. Alle
filerne fandtes — så det var ikke en død reference, men det værre tilfælde: to lister, en læser kunne
slå op i og få forskellige svar. Samme fejlklasse som R1-F04.

**Mutationstesten fangede en fejl i mit eget værn.** Afsnits-mønsteret var ikke ankret i højre side, så
`## 4. Testkobling-omdoebt` stadig talte som et Testkobling-afsnit — mutationen «fjern afsnittet»
overlevede. Og det første gulv (`>= 5` kontrakter med afsnittet) var lig virkeligheden og kunne derfor
per konstruktion ikke se et tab; det er nu en EKSAKT liste. Begge fejl ville have gjort værnet grønt af
tomhed på præcis den måde, det blev bygget for at forhindre.

**Bevidst IKKE gjort — skabelon-ensretningen.** 20 af 28 kontrakter afviger fra skabelonens §1–§5, og
planen ville ensrette dem. Det er droppet efter gennemgangen: afvigelserne er overvejende gode.
`eo-snapshot-contract.md`s 15 domæneafsnit, `schema-evolution.md`s `Del 0`–`Del 5`-tjekliste og de fire
domænekontrakters `Nuværende Model / Kanoniske Regler / Arkitekturvalg / Minimumstestflade` er hver en
form, der passer til sit stof. En ensretning ville koste struktur uden at gøre en eneste kontrakt mere
sand. `contract-topology-procedure.md` siger nu eksplicit, at inddelingen er fri, mens INDHOLDET er
håndhævet — en kontrakt kan vælge sin form, men ikke frit påstå noget forkert om koden.

**Registreret som ikke gjort:** `document-output-contract.md` §B11 er en nummereret 26-punkts
audit-arbejdsliste inde i en normativ kontrakt, og filen har to konkurrerende afsnitsnummereringer
(`## A2` vs. `## 2. Autoritative Kilder`, uden noget `## 1`). Det er den ene kontrakt, hvor planens
oprindelige «audits hører ikke hjemme i en kontrakt»-pointe faktisk holder. Den hører til et selvstændigt
spor sammen med `schema-evolution.md`s domænesti-tabel (~40 stier, som filen selv skriver «skal holdes i
sync med registry»), fordi begge kræver en beslutning om, hvor arbejdslister skal bo — ikke blot en
flytning.

**Værnet ramte sit eget commit — og det var pointen.** Det første commit rettede en reference i fire
kontrakter uden at forny deres stempel, og `check:contract-verification` gjorde straks træet rødt. De
fire blev derfor verificeret mod koden, og verifikationen fandt **fem semantiske fejl, som
liveness-værnet per konstruktion ikke kan se**, fordi symbolnavnene findes:

| Kontrakt | Påstod | Koden gør |
|---|---|---|
| `mineo-field-pattern.md` §3.8 | `HistoryOrigin.field` er valgfri | Diskrimineret union; `FieldHistoryOrigin.field` er PÅKRÆVET, `CollectionHistoryOrigin` har slet ikke feltet. Kildens kommentar siger, at optionaliteten lod et feltcommit sendes uden adresse |
| `persistence-contract.md` §3.8a | Aktive-fane-nøglerne er `deviceScoped` | De står UDEN FOR klassifikationen som dynamisk nøglefamilie; compiler-håndhævelsen dækker kun de statiske nøgler |
| `schema-evolution.md` §3.2 | `erstatningsopgoerelseSchema` er autoritativ ved parse | Load-stien bruger `persistedErstatningsopgoerelseSchema` |
| `satser-contract.md` §1 | `resolveSatserDefaultAargang` fastlægger «alene» ny-sags-defaulten | To bevidst adskilte kaldere |
| `persistence-contract.md` §3 | Versionsfelterne er `string` | `z.literal` — load-bearing for §4, da det er dét, der gør en anden dataversion til korruption |

Det er den vigtigste afgrænsning at tage med: **liveness-værnet fanger navnedrift, ikke betydningsdrift.**
Stempel-reglen er det, der tvinger den menneskelige verifikation, hvor betydningen bliver efterprøvet —
og her fandt den fem fejl på fire kontrakter, ingen maskine kunne have set.

**Metodenote fra denne omgang:** *en korrekt diagnose kan bære en forkert ordination.* #52 pegede rigtigt
på, at kontrakterne kan drive fra koden, og foreslog derefter at fjerne netop det, der var korrekt, mens
årsagen — at intet kontrollerede noget — ville have bestået uændret. Prøven, der afgjorde det, var at
TÆLLE: nul døde stier og fem forkerte symboler ud af 800 gør «flyt kortene ud» til en dyr operation uden
gevinst, mens «gør kortene kontrollerbare» fanger både de fem og alle fremtidige. Og igen: hvert nyt værn
skal mutationstestes — to af mine egne værn var grønne af tomhed, indtil mutationen viste det.

---

## START HER — arbejdsstatus 2026-08-07

Dette afsnit er indgangen for en session uden den foregående kontekst. Læs det FØR
kandidatlisten længere oppe: de gamle fase-tabeller og `✅`-markeringer er historik og
beskriver flere steder slettede mellemtrin.

**Branch:** `greenfield`. **Tilstand ved sidste commit: grøn** — 538 testfiler / 6954 tests,
`typecheck`, `typecheck:test` og `lint` grønne. Alt beskrevet under «Gennemført i denne omgang»,
«Efterslæb lukket 2026-08-07», «Gennemført 2026-08-07 (anden omgang: #50 og #32)»,
«Gennemført 2026-08-07 (tredje omgang: #26, #35, #45 og #21)» og
«Gennemført 2026-08-07 (fjerde omgang: #52)» er committet.

**Seneste omgang (2026-08-07, fjerde del)** lukkede **#52** — den sidste kandidat. Også den blev
omskåret: planens to drift-eksempler var allerede rettet, og dens løsning («flyt fil-/symbolkortene ud
af kontrakterne») ville have fjernet den korrekte del og efterladt årsagen. Se «Gennemført 2026-08-07
(fjerde omgang)».

**Alle kandidater er nu lukket.** 17 af 18 er gennemført; **#46** er lukket som *bevidst ikke
gennemført* efter brugerbeslutning. Ét UI/UX-spørgsmål afventer stadig brugeren (enhedsvalget på
Anciennitetstillæg, se nedenfor); det blokerer intet.

**Registreret som ikke gjort — hører til et senere spor** (fra de fire omganges gennemgange):
`document-output-contract.md` §B11's 26-punkts audit-arbejdsliste og filens to konkurrerende
afsnitsnummereringer; `schema-evolution.md`s domænesti-tabel, som filen selv skriver «skal holdes i sync
med registry»; ~~`RowDeleteButton`-mønstrets omgivende celle (10 steder, fire varianter)~~
**✅ GJORT 2026-08-08, se «Efterslæb lukket 2026-08-08» nedenfor**;
~~`renderRows`-reconciliationens fætter i de fire ikke-`useCollectionTable`-tabeller~~
**✅ GJORT 2026-08-08, se «Efterslæb lukket 2026-08-08 (anden post)» nedenfor**;
`DanishDateString`-datalagets to private `danishDateToNumber`-kopier og `.filter().reduce()`-max-familien
på seks interval-start-resolvere; Indstillingssidens fire `is…Option`-typeguards og
`defaultDirectoryHandleId`s ~143 linjer.

### Rækkefølge for det udestående

| # | Kandidat | Skæring der skal bruges (afviger fra planens oprindelige tekst) |
|---|---|---|
| ~~**#50**~~ | ~~TAF-graf → scene-model~~ | **✅ GENNEMFØRT 2026-08-07** — se «Gennemført 2026-08-07 (anden omgang)». |
| ~~**#32**~~ | ~~EO-sektioner → `Block[]`~~ | **✅ GENNEMFØRT 2026-08-07, men omskåret.** Planens præmis var modbevist: sektionerne producerer allerede `DocumentBlock[]` via composeren. Det reelle fund var ctx-objektets injicerede modulfunktioner. To sektioner er bevidst urørt (testseam). Se detaljerne. |
| ~~**#26**~~ | ~~Container → headless hook~~ | **✅ GENNEMFØRT 2026-08-07.** Container 584 → 107 l.; navigationen i `containerNavigation/` delt efter fejlmåde. Bevaringen bevist med en midlertidig parity-harness, ikke antaget. |
| ~~**#35**~~ | ~~Carry-forward-opslag~~ | **✅ GENNEMFØRT 2026-08-07, og planens blokering var forkert.** `findLatestByDateInSortedList` VAR allerede den fælles abstraktion med 10 callsites; kun feltnavnet manglede at være parametriseret. To ISO-serier re-deriverede opslaget. |
| ~~**#45**~~ | ~~Tabel-konsolidering~~ | **✅ GENNEMFØRT 2026-08-07 efter den korrigerede skæring** (ingen `GridSpec`). Rækkefølge-laget samlet i `useSortedCollectionTable`; colId-triplen erstattet af `bindSortableHeader`. |
| ~~**#21**~~ | ~~Indstillinger~~ | **✅ GENNEMFØRT 2026-08-07 efter den korrigerede skæring** (intet settings-register). Det reelle fund var større end planen sagde: etiketterne var duplikeret 3× pr. enum, én af dem ind i dokumentlaget. |
| ~~**#52**~~ | ~~Kontrakt-struktur~~ | **✅ GENNEMFØRT 2026-08-07, og OMSKÅRET.** Planens to drift-eksempler var allerede rettet, og skabelon-ensretningen er bevidst droppet: af ~230 fil-stier var nul døde og af 569 symboler kun fem forkerte, så «flyt kortene ud» ville have fjernet den korrekte del. I stedet blev referencerne gjort kontrollerbare: liveness-værn (inkl. håndhævede fraværsværn), git-bundet verifikationsstempel og afstemning af in-file-testkobling mod matrixen. Fem drift-tilfælde rettet. |

### Efterslæb lukket 2026-08-08 — `RowDeleteButton`s omgivende celle

Første post fra listen over «registreret som ikke gjort». Den var registreret som «10 steder, fire
varianter», altså som en stil-duplikering. Ved implementeringen viste den sig at være en **uhåndhævet
kontrakt**, ikke bare en gentagelse: `RowDeleteButton` er `position: absolute`, så cellen SKAL være
`position: relative` — ellers positionerer ikonet sig efter nærmeste positionerede forfader, dvs.
tabellens container, og lander i tabellens hjørne i stedet for i rækken. Cellen skal desuden reservere
en 28 px bane med `paddingRight`, ellers ligger skraldespanden oven på celleindholdet.

Kontrakten stod hardkodet på hvert af de ti kaldsteder i fire stavemåder (`sx` med `'28px'`, `sx` med
tal, spredt `style` med `28`, spredt `style` med `'28px'`), var kun beskrevet i knappens docstring, og
intet værn kunne se, om et kaldsted glemte den ene halvdel. Knappens egen test rendrede den endda i en
håndskrevet `<td style={{ position: 'relative' }}>` og beviste derfor intet om produktionens celler.

**Gjort:**

- `ROW_DELETE_LANE_WIDTH_PX` + et privat `ROW_DELETE_LANE_CONTRACT` i `RowDeleteButton.tsx` som eneste
  sted, kontrakten er skrevet.
- To forbrugere, én pr. tabelfamilie: `RowDeleteLaneCell` (MUI-`TableCell`, løse tabeller) og
  `rowDeleteLaneStyle(base)` (rå `<td style>`, grid-tabeller). Begge lægger kontrakten **sidst**, så et
  kaldsteds egen `sx`/`style` ikke kan overskrive den væk — men resten af kaldstedets styling overlever
  (fx `StandardLoenTable`s `padding: '4px'` og dens afledte farve).
- Alle ti kaldsteder omlagt: `BeregnetRenteTable`, `EetAslAfgoerelserTable`, `FerieperiodeTable`,
  `LoenudviklingManuelProcentsatsTable`, `LoenudviklingManuelTable`, `OevrigeKravTable`,
  `OffentligeYdelserTable`, `StandardLoenTable`, `SvieSmerteTable`, `TafPeriodeTable`. Ingen
  `paddingRight: '28px'`/`28` er tilbage i `src/` uden for guardens egen fixture.
- Nyt AST-værn `form/row-delete-lane-cell-single-source`: en `RowDeleteButton` skal stå i en lane-celle;
  en håndrullet celle er en overtrædelse. Værnet har `liveTarget: precondition` med alle ti filer i
  `requiredPaths`, så det ikke kan blive grønt af tomhed.
- Fire nye tests på selve primitivet (kontrakten lagt oven på basisstil; kontrakten kan ikke
  overskrives af hverken `style`-basis eller kaldstedets `sx`; den rendrede celle har faktisk
  `position: relative` + banen).

**Mutationsbevist i tre trin** (jf. guard-selvtest-princippet): (1) fixtures fanger både den fulde
håndrullede kontrakt og den *halvt* glemte; (2) en mutation af den LEVENDE kilde — `TafPeriodeTable`
tilbage til den håndrullede celle — gjorde harnessen rød på præcis den linje med præcis den regel-id;
(3) en mutation af selve primitivet (fjern `position` fra kontrakten) gjorde alle fire nye tests røde
med `expected 'static' to be 'relative'`, altså af den målte mekanisme og ikke af en konkurrerende.

Ingen synlig UI-ændring: kontrakten er byte-identisk med den, de ti celler allerede havde
(`OffentligeYdelserTable`s `textAlign: 'right'` og `StandardLoenTable`s `padding`/farve er bevaret som
basis). Fuldt træ grønt: 537 filer / 6946 tests (+6), `typecheck`, `typecheck:test`, `lint`.

### Efterslæb lukket 2026-08-08 (anden post) — render-modellens to konstruktioner

Anden post fra listen over «registreret som ikke gjort». Den var registreret som
«`renderRows`-reconciliationens fætter i de fire ikke-`useCollectionTable`-tabeller», altså som fire
kopier af en løkke. Skæringen var for snæver på to måder, og begge blev fundet ved at læse koden frem
for beskrivelsen.

**Det reelle fund:** der var **to konkurrerende konstruktioner af den samme render-model**, og de gav
samme resultat ad hver sin vej. Seks tabeller byggede modellen af den USORTEREDE `committedRows` og lod
`useSortedCollectionTable` permutere den tilbage på plads bagefter (`orderedRenderRows`); fire sorterede
først og byggede modellen i hånden af resultatet. Modellen ER «viste rækker i vist orden + placeholders
sidst» — så den første vej var en omvej, og `renderRows?`-parameteren på rækkefølge-hooken fandtes kun
for at bære forskellen. Duplikationen var desuden ikke fire steder, men **seks**: de to
`Loenudvikling*`-tabeller reconcilierede også i hånden (`renderById` + `.at(-1)!`), i en tredje variant.

**Reconciliation-vejen bar en latent defekt, den nye ikke kan have.** Den genfandt placeholderen med
`.find(kind === 'placeholder')` og tog altså kun den FØRSTE. En tabel med `minimumVisibleRows > 1` ville
tavst tabe sine øvrige tomme rækker. Den ramte ikke produktionen — men kun fordi netop de to tabeller,
der viser flere tomme rækker (`StandardLoenTable`, `EetAslAfgoerelserTable`), var blandt dem, der gik
uden om hooken. Altså præcis den «tre af fire rigtigt»-fejlmåde, hele rækkefølge-laget findes for at
forhindre.

**Gjort:**

- `useCollectionTable.buildRenderRows(displayRows)` er nu render-modellens ENE konstruktion.
  `useSortedCollectionTable` bygger ingen render-rækker mere — den leverer `sortedRows`, kalderen giver
  dem videre. `renderRows?`-parameteren, `orderedRenderRows`-reconciliationen og hookens
  `TRenderRow`-typeparameter er væk.
- `buildRenderRows` er en FUNKTION og ikke en `displayRows`-parameter, fordi rækkefølge-laget har brug
  for `reorderRows` fra collection-hooken, mens render-modellen har brug for rækkefølge-lagets
  `sortedRows`. Som parameter ville de to hooks skulle kaldes i en rækkefølge, ingen af dem kan opfylde.
- Alle ti tabeller omlagt. De fire hand-rullede har ikke længere deres egen identitetskæde
  (`useCollectionRows` + `committedIdSet` + `placeholderCount` + `usePlaceholderSlotIds` +
  `useCollectionCellSpecBuilder`, ~28 linjer hver); de to `Loenudvikling*`-tabellers håndreconciliation
  er erstattet af `buildRenderRows(existing)`, så deres «basisrække først, resten sorteret» blot er en
  visningsorden som enhver anden.
- De to reelle forskelle er udtrykt som hook-parametre frem for som escape-hatches ved kaldstedet:
  `minimumVisibleRows` (fandtes) dækker `StandardLoenTable`/`EetAslAfgoerelserTable`, og det nye
  `countsAsEmptyEntryRow` dækker rentekrav-reglen «en semantisk tom committet række ER selv
  indtastningsrækken» (før `shouldAppendRentekravPlaceholder` ude i tabellen).
- **Rettet undervejs:** `StandardLoenTable` brugte TO forskellige lokationspræfikser for samme tabel —
  `standardLoen:${section}.${collection}` til rækkehandlinger og `collectionLocationPrefix(collection)`
  til celle-bindingen. Det første udelader ejer-id'erne, så EO's løntabeller på to ansættelsesforhold
  delte ÉN editorlokation for deres rækkehandlinger; en undo af en rækkehandling kunne dermed navigere
  til det forkerte kort. Begge bruger nu den kanoniske form. History er in-memory, så ingen migrering.
- Værnet `form/placeholder-identity-single-owner` er omskrevet mod det nuværende mål: dets probe var
  pinnet til de fire tabellers direkte `usePlaceholderSlotIds`-kald og blev korrekt meldt INERT af
  liveness-gaten. Det dækker nu alle ti tabeller, og det afviser desuden et direkte
  `usePlaceholderSlotIds`-kald fra en tabel — den «halve ejerskabsform», hvor identiteten er delt, men
  render-modellen egen.
- Ny testfil `useCollectionTable.test.tsx` (8 tests): visningsorden, identitet-følger-mængden-ikke-orden,
  alle placeholders op til `minimumVisibleRows`, og `countsAsEmptyEntryRow`s to retninger.
  Rentekrav-reglen havde **ingen dækning på render-niveau** før — kun som ren funktion.

**Bevist mod den GAMLE adfærd, ikke kun mod den nye kode.** Før første ændring blev begge konstruktioner
kørt mod hinanden i en midlertidig paritets-harness over 2000 tilfældige tilstande; den bekræftede
identitet og afdækkede `.find`-defekten som den ENESTE afvigelse. Harnessen er slettet igen — dens værdi
var beviset, ikke koden.

**Mutationsbevist i tre trin:** (1) en mutation af den LEVENDE kilde — `TafPeriodeTable` tilbage til den
håndrullede model — gjorde harnessen rød på præcis den linje med præcis den regel-id; (2) neutralisering
af `countsAsEmptyEntryRow` fældede præcis den ene test, der måler den regel — og afslørede først, at
reglen slet ikke var dækket, så testen blev skrevet; (3) genindførelse af `.find`-defekten
(`placeholderIds.slice(0, 1)`) og en ombytning af placeholder-rækkefølgen fældede hver sine tests, altså
af den målte mekanisme og ikke af en konkurrerende.

Ingen synlig UI-ændring og ingen tal berørt. Fuldt træ grønt: 538 filer / 6954 tests (+8), `typecheck`,
`typecheck:test`, `lint`.

### Brugerens beslutninger 2026-08-06 (bindende for resten af arbejdet)

De fire udestående mandatspørgsmål er forelagt samlet og besvaret. Beslutningerne herunder er
**afgjorte** og må ikke genåbnes uden ny forelæggelse.

1. **Breakpoint-styling: bevares som i dag.** Planens præmis var kun halvt rigtig, og
   korrektionen er en del af beslutningen: `SiblingSitesFooter.tsx` og `RenteberegningTab.tsx`
   er **delt** mellem Mineo (`/mineo`-siden hhv. `Renteberegning`) og den **standalone
   minProcesrente-app** (`MinProcesrenteCalculatorPage`), som er den dokumenterede
   mobil-undtagelse. Breakpointsene betjener minProcesrente-mobilbrugeren; på desktop tænder de
   aldrig, så Mineo er upåvirket. Bemærk desuden at `RenteberegningTab`s mobiladfærd i øvrigt
   kører på en **eksplicit `isMobile`-prop**, ikke på breakpoints — den ene reelle
   breakpoint-regel er `overflowX: { xs: 'hidden', sm: 'auto' }` (l. 218).
   **Beslutning:** behold begge; udvid `desktop-only`-undtagelsen til at dække delte komponenter
   der også forbruges af standalone minProcesrente, og pin den dækkede filliste med et værn, så
   undtagelsen ikke breder sig. En split i to varianter blev afvist, fordi den ville give to
   kopier af samme flade uden nogen synlig gevinst.
2. **#46 — variant-build-output: bevidst ikke gennemført.** Brugeren mærker hverken før eller
   efter nogen forskel, og deploy-artefakterne (`_headers`, `robots.txt`, `sitemap.xml`,
   `llms.txt` med hardkodede produktions-URL'er) er host-specifikke og virker i dag.
   **Beslutning:** kandidaten lukkes som *bevidst ikke gennemført*; tiden bruges på #50 og #32.
   Den kendte restrisiko dokumenteres, men afhjælpes ikke: da begge varianter deler én
   `public/`-mappe og buildet efterbehandler ved at **slette**, kan en fejlende sletning i
   princippet give minProcesrente et Mineo-`manifest.json`/`sw.js` eller gøre Mineo indekserbar.
3. **#50 — TAF-graf: pixel-troskab med undtagelse for reelle tegnefejl.** Scene-modellen skal
   reproducere den nuværende tegning, bevist med et golden-net på scene-modellen (koordinater,
   farver, tekst), så en utilsigtet afvigelse fejler i test. **Undtagelse:** finder jeg egentlige
   tegnefejl — afklippede akselabels, overlappende signaturforklaring, manglende enhed på et
   beløb — retter jeg dem og **fremlægger hver enkelt ændring for brugeren bagefter**. Rene
   smagsændringer (farvevalg, skriftstørrelse, omplacering) er IKKE omfattet og må ikke laves.
4. **Tallene: intet beregnet tal må flytte sig.** Alle resterende kandidater (#50, #32, #52,
   #45, #21, #26, #35) er struktur-, testdæknings- og dokumentationsspor. Åbnes en gammel sag
   efter arbejdet, skal hvert beløb, hver procent og hver dokumentværdi stå identisk.
   **Ved afvigelse: stop og forelæg** — et ændret tal skal aldrig vurderes som "nok rigtigere"
   undervejs. Tal- og dokument-goldens holdes uændrede gennem hele resten af sporet.

### Nyt UI/UX-spørgsmål der afventer brugeren (rejst 2026-08-07)

**Satsens enhed på Anciennitetstillæg.** Sammenlægningen af den duplikerede blok afdækkede en
funktionsforskel, ingen har besluttet:

| Overflade | Adfærd i dag |
|---|---|
| Lønindkomst (pr. ansættelsesforhold) | Brugeren VÆLGER enheden i et Time/Måned-felt (`anciennitetstillaegSatsAngivesPer`). |
| EO-oplysninger («angivet løn») | Enheden UDLEDES af `beregnesUdFra` (`'Angivet dagsløn'` → time, ellers måned). Intet valg vises. |

Begge adfærd er bevaret uændret; forskellen er gjort synlig via `satsEnhedSlot` frem for skjult
bag en betingelse. **Spørgsmålet er, om EO-oplysninger også skal have valget, eller om
udledningen er den ønskede adfærd dér.** Det ændrer brugerfladen og er derfor ikke mit at afgøre.
Ingen ændring foretages, før det er besvaret.

### Arbejdsmåde der viste sig at betale sig

- **Verificér planens påstande mod koden før implementering.** Syv af dem var forkerte eller
  forældede (se «Påstande der er modbevist»). Fire parallelle Explore-agenter over hver sit
  delsystem var den effektive form.
- **Mutationstest hvert nyt værn.** To gange fangede det fejl i mit EGET arbejde: en
  ordningsfejl i IndexedDB-primitivet (en fejlet skrivning blev rapporteret `ok`), og et
  shell-værn der var grønt af tomhed. Et værn der ikke kan fejle, beviser intet.
- **Mistro præmisser om React-adfærd.** #43's antagelse om at per-route-wrapping remountede
  shellen var forkert; jeg målte begge former (`mounts === 1` i begge). Mål frem for at slutte.
- **`npm run typecheck` fanger ikke `import type` brugt som værdi.** En manglende runtime-import
  af `serializeEoRowTable` var grøn i typecheck og fejlede først i test. Kør målrettede tests
  efter nye cross-modul-imports.
- **Revidér færdigmeldte kandidater mod koden — ikke mod deres egen beskrivelse.** Revisionen
  2026-08-07 fandt tre reelle efterslæb i seks «gennemførte» kandidater, og to af dem var
  beskrevet stærkere end virkeligheden («lukket i begge ender», «stod i to lister»). Fejlklassen
  er den samme hver gang: kandidatens navngivne SYMPTOM er væk, mens MEKANISMEN består ét sted
  til, som kandidatens skæring ikke kiggede på.
- **Når en type og en test dækker hvert sit hul, så brug begge.** `MenuPageKey` fanger et forkert
  id ved compile-tid, men en *manglende* menupost typechecker fint. Stop derfor ikke ved typen,
  når dens loft er kendt — skriv testen, der dækker resten, og mutationsbevis dem hver for sig.
- **En refaktorering skal måles mod den GAMLE adfærd, ikke kun mod sin egen nye test.** Et golden-net
  skrevet ud fra den nye kode låser kun fremtiden; det siger intet om, hvorvidt omlægningen bevarede
  noget. Ved #50 kørte jeg derfor den gamle monolit og den nye vej mod den samme optagende stub og
  krævede identiske kald. Det fangede tre afvigelser, en ren gennemlæsning ikke ville have set —
  bl.a. at sammenslåede stier forskyder et stiplet mønster. Harnessen er midlertidig og slettes
  bagefter; dens værdi er beviset, ikke koden.
- **Verificér kandidatens PRÆMIS, ikke kun dens tal.** #32 var beskrevet som «sektionerne er
  imperative og skal blive til `Block[]`». De producerede allerede blokke — hele skæringen var
  forkert, og den rigtige defekt (injicerede modulfunktioner i ctx) stod ikke i planen. To
  gennemgange havde gentaget præmissen uden at åbne `documentModel.ts`.
- **En sammenlægning af to kopier afslører funktionsforskelle — de skal ikke ensartes undervejs.**
  Anciennitetstillæg-blokken skjulte, at de to overflader afgør satsens enhed forskelligt. Det
  rigtige træk var at bevare begge adfærd bag en slot og forelægge forskellen, ikke at vælge en
  vinder i en refaktorering.
