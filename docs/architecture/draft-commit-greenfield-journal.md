# Gennemførelsesjournal: draft/commit-omlægningen

**Type:** Rent historisk. Ikke normativ, ikke en plan, og ikke en beskrivelse af nutiden.

Denne fil rummer den kronologiske journal over, hvordan draft/commit-arkitekturen blev bygget:
faseforløbet, de eksterne reviewrunder og de work items, der lukkede dem. Den blev udskilt fra
`draft-commit-greenfield-design.md` 2026-07-29 (reviewfund R1-F01), fordi designdokumentets hoved
havde samlet tre uforenelige ting i samme tekst: målarkitekturens norm, en statusflade og denne
journal. Samtidige statusudsagn fra forskellige tidspunkter kunne derfor ikke alle beskrive nutiden,
og en læser kunne ikke afgøre, hvad der var gældende.

**Vil du vide, hvad der GÆLDER?** Læs `draft-commit-greenfield-design.md`s statusafsnit og de
normative kontrakter i `src/contracts/`. Intet i denne fil er bindende.

---

## Journalen, som den stod i designdokumentets hoved (2026-07-16 – 2026-07-25)

**Status:** Krav og produktadfærd er genfastlagt 2026-07-16. Den tidligere faseinddeling er forkastet som
migrationsgrundlag. Fase 0–4 har leveret nyttige karakteriseringstests, codecs, inventarer og tekniske erfaringer, men
ingen af faserne betragtes længere som en færdig del af målarkitekturen. Implementeringen skal rebaseres efter §8.

**Implementeringsstatus (rebase):** Fase 0 og 1 blev gennemført, reviewet og kvalitetssikret 2026-07-16. Den afgrænsede
kravændring 2026-07-18 er indarbejdet: parsebare out-of-bounds-værdier committes canonical med afledte bounds-issues,
mens `.eo`-save kun blokeres af aktivt rejected råinput. String-backed felter validerer desuden tolerant indlæste
canonical strenge gennem deres codec, så schema-tolerance ikke kan føre ufortolkelige værdier til consumers.
Fase 2 blev gennemført, verificeret og kritisk reviewet 2026-07-18. Mineo monterer kun greenfield-runtime, og alle
persisted formular- og tabelsurfaces — inklusive hele Erstatningsopgørelse med nested ansættelsesforhold — bruger nu
feltrefs, editorlokationer og den fælles collection-/grid-adapter. EO læses gennem
`buildErstatningsopgoerelseReaderProjection`; den tværgående EET-import bygges fra samme tokenbundne `InputReader`, og
dokumentklik genopbygger både EO- og EET-projektionen fra én frisk afsluttet revision. Det afsluttende review fjernede
rå store-læsning i EET-importen, en stale EET-kilde ved dokumentpreflight, konkurrerende EO-rækkekopier og de afløste
EO-viewmodels, tabeller, row-hooks og implementeringstests. En arkitekturvagt håndhæver nul legacy-editor-/tabelcallsites
på EO-overfladen. Fase 2 er fortsat et internt kontrolpunkt: domæneprojektioner/validatorer færdiggøres i fase 3, og
case-, shell- og persistence-ansvar flyttes i fase 4–5 før deployhandoff.

De tidligere reviews rettede desuden replacement/no-op-matricen, synkron editorregistrering,
dispatch-rollback i UI-laget, settings-only issue-abonnement, særskilt replacement-generation, schema-defaultede
tomværdier og rå section-bypass i Stamdata/Satser. Det efterfølgende review af Årsløn-kontrolpunktet rettede faste
og dynamiske datogrænser, periodeorden som feltissues, inputdrevet relevans, grid-editorens synkrone lifecycle,
rejected-only-rækkesletning, byte-verificeret rollback, settingssnapshot og frisk dokumentpreflight. Katalogets
paths/counts, row factories, collection-adaptere og aktive editorlokationer er komplette efter sidste callsite-cutover.
Den systematiske domænedækning af relevans og validators blev gennemført i fase 3 (se Fase 3-status nedenfor).

Reviewet 2026-07-18 samlede de nye slices om `InputReader` + `runProjection` og fjernede den parallelle
`domain/inputIntegrity`-blockermodel. Det rettede desuden manglende feltgrænser i Renteberegning, Varige mén og
Erhvervsevnetab, dependency-gating i differencekravet, ASL-rækkefejl fra readeren, fail-closed dokumentgates,
multiline-Enter, rejected-only-rækkesletning, destruktiv reset uden forudgående settle og stale async downloads.
Fase 4 er gennemført og verificeret 2026-07-24: `.eo`-save/load, session-/startupstatus og de kritiske
sagsoperationer kører nu gennem de rene caseporte (`CaseFileOperations`/`CaseResetOperations`) på greenfield-runtime.
Hovedshellens atomiske navigation-/undo-cutover blev gennemført i fase 4 (WI-002), og fuld lokationsbaseret
fokusrestore fulgte i fase 4 (WI-003): route/fane bæres nu som eksplicit typed metadata på history-origin, og en
gennemført undo/redo navigerer til origin-lokationens route+fane og re-fokuserer feltet, ændringen kom fra.
Current-session-korruption håndteres fail-closed hele vejen (§1.12), og kun brugerens eksplicitte `Slet alt` kan
rydde en bevaret korrupt kilde. **Trin 13 er gennemført 2026-07-25 efter et eksternt strukturelt review:** hele
den parallelle legacy-inputarkitektur (`FormPersistenceContext*`, `inputRuntimeStore`/`formPersistenceStore`,
den gamle runner, `criticalActions/`, `rowDrafts/`, `tableInput/`, `Styled*Field`-vejen m.fl.) er SLETTET, ikke
udskudt. Den tidligere reachability-begrundelse holdt ikke: de resterende callsites var en DEV-only showcase-fane
og tre transiente flader, som nu kører på en lille, eksplicit `transient`-inputfamilie uden for den autoritative
inputtilstand. En AST-regel forbyder at genindføre nogen del af klyngen.

**Fase 0–4's restfund er lukket 2026-07-25 (WI-004) efter fire eksterne reviewrunder.** De trust-kritiske
rettelser: (1) EO's dependency-gating læser nu det STRUKTURELLE `FieldIssueSnapshot` — ikke det afledte
`eoErrors`-map, som kun kendte 11 top-level feltnavne og derfor var blind for røde RÆKKECELLER, så motorerne
regnede på readerens maskerede tomværdier; (2) grenlisterne er udledt af hvad motorerne FAKTISK læser, inkl.
klipningsgrænserne (EO-perioden, mén-/EET-/differencekravsdatoerne og `stamdata.skadedato` på tværs af
sektionsgrænsen) — en maskeret grænse fjerner ellers klipningen lydløst og viser et uklampet forløb som gyldigt;
(3) forliget er en egen gren, så en rød ansvarsgrad kun neutraliserer efter-forlig-resultatet og lader
før-forlig-grundlaget bestå; (4) de gyldige, uafhængige grene bæres nu frem til Beregning-fanen gennem
`readyBranches` — fanen ser ikke `inspektionSnapshot`, så brugerbeslutning 2 var ellers ikke opfyldt i praksis;
(5) en strukturel rækkecommand kan ikke længere dispatches uden history-origin, håndhævet både i typen og af et
runtime-værn før nogen mutation. Se `work-items/WI-004-fase34-restfund.md` og
`docs/reviews/codex-fase34-restfund.md`.

**Fase 0–4 er endeligt lukket 2026-07-25 (WI-007).** Den sidste rest var ikke funktionel, men strukturel:
trin 13 slettede den parallelle legacy-inputklynges KONSUMENTER, men efterlod den infrastruktur, der alene
eksisterede for at betjene dem — kaldeløse eksporter, en persisteret nøgle uden læser/skriver, og kommentarer,
der beskrev den slettede model i nutid. Modulerne typecheckede, så intet værn fangede dem. Lukket ved at
SLETTE frem for at omdøbe: hele den per-sektion-baserede sessionStorage-nøglefamilie (`getStorageKey`,
`getKnownStorageKeys`, `isValidStorageKey`s legacy-grene, `mineo_invalidDrafts`, `mineo_input`) er væk —
sagsinput ligger i ÉN envelope (`input_v2`). `persistenceRegistry` er nu den ENE KILDE til sektionsmængden:
`PersistedSectionKey` udledes af den (og hedder ikke længere `StorageKey`, som sammenblandede sagssektion med
browserlager-nøgle), listen er frosset, og `fileLoad`s to gennemløb læser nu samme kilde i stedet for hver sin.
`cellInvalidDraftScopes` er
reduceret til sit levende ansvar og hedder nu `cellFocusPaths` med den ene funktion, der har en kalder.
Skrivegrænsen er gjort STRUKTUREL: `safeSessionStorage`s skrivefunktioner tager en `ManifestStorageKey`,
som kun `storageManifest` kan producere, så en genindført legacy-nøgle afvises af COMPILEREN — også når
den kommer ind som en variabel, hvor en AST-regel principielt er blind.
`storage/session-storage-manifest-key` bevares som sekundær diagnostik og dækker nu begge skriveveje.
Se `work-items/WI-007-fase04-exit.md`.

**Fase 3+4-restarbejdet er implementeret 2026-07-25 (WI-004).** De fund, der stod åbne efter
`codex-fase34-followup.md`, er nu implementeret — inklusive de seks fund fra en yderligere ekstern review-runde
(R1–R6, hvoraf to var kritiske). R1–R6's lukning blev efterfølgende bekræftet eksternt i WI-004's runde 3 og 4,
hvor R1 og R4 viste sig IKKE lukket og blev rettet, og de afsluttende re-reviews (T1–T3, U1–U3) blev grønne.
Det implementerede omfatter: den strukturelle dependency-gate før motorkald i
Forsørgertab, EET og EO (F2), den komplette kanoniske feltadresse→destination-afbildning inkl. kontekst-delte
felter (F4), og de dokumenterede dækningshuller (transient input, grid dropdown/to-trins-genindtræden,
Renteberegnings projektionsmatrix, origin-fuldstændighed). To ægte fejl blev fundet undervejs af den nye dækning:
`TransientDateInput` afviste ENHVER gyldig dato (bounds-helperen melder "ingen fejl" med en tom streng, ikke
`undefined`), og destinationsafbildningen slog collection op før property, så `eoAngivetLoenLoenudvikling`s nestede
tabeller routede til den forkerte fane. Konsekvensmatricen i `error-contract.md` §1.1 håndhæves nu også for
`bounds`: en gembar værdi er ikke dermed beregnbar.

Den tidligere
Fase 0–4-implementering på `greenfield`-branchen (typed spor, sentinel-adresser, Satser-kernelprojektion m.m.) er
forkastet som migrationsgrundlag og betragtes udelukkende som historiske karakteriseringstests/erfaringer. Den
bindende migrationsplan er §8 (Fase 0–7). Fase 0 har rebaset kontrakterne og etableret de midlertidige, maskinverificerede
inventarer i `src/inputCore/ledger/`. Fase 1 har genopbygget den framework-frie inputkerne i `src/inputCore/` med
XOR-invariant, issue-model uden `blocksSave`, `ValidationReader`→`InputReader`, statisk katalog og
`ready | blocked`-projektioner. Fase 3 er gennemført: alle otte consumerslices (Satser, Renteberegning, Stamdata,
Årsløn, Varige mén, Forsørgertab, EET og EO) forbruger nu rene reader-projektioner, og de afløste
component-reporter-hooks er slettet. Fase 4 (`.eo`/session/caseporte, shell-cutover OG trin 13's sletninger) er
gennemført; kun Fase 5 (de 18 dokumentoutputs) udestår. Legacy-inputvejen findes ikke længere at reparere med.

Fase 1–4-rækkefølgen i det parallelle redesign-review er historik for den oprindelige kandidatliste og er ikke en aktiv
migrationsplan for inputområdet. Kun §8 nedenfor er bindende. Afsluttede, ikke-inputrelaterede resultater, herunder
dokumentlayout og numeriske primitiver, bevares som selvstændige resultater.
