# R0 — Baseline, kortlægning og værnenes troværdighed

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** branch/arbejdstræ, alle planlagte baseline-gates, `src/inputCore/`, `src/persistence/`,
`src/document/`, domæneprojektioner, porte/shell, arkitekturharness, allowlists, slettelsesledger og acceptmatrix  
**Angreb udført:** syntetisk brud af alle 36 arkitekturregler; tomhedsangreb mod `liveTarget`; fysisk
fravær; døde allowlist-poster; skippede/arvede testdeklarationer; manglende WI-reference  
**Evidens:** HEAD `676a3d85461412c6cc731dd65bb3b4e4ae0dd46a`; 493 testfiler/6172 tests; ledger
239 felter/16 collections/8 beregninger/4 sagsfilstier/18 dokumentoutputs; fem quality-filer/109 tests;
begge builds exit 0  
**Fund:** 3 (R0-F01, R0-F02, R0-F03)  
**Hypoteser:** Ingen  
**Handling:** Parkeret som reviewfund; ingen produktionsfiler ændret  
**Næste skridt:** kør baseline på den deklarerede Node/npm-version og luk værnenes tekstbaserede
tomhedsprober

## Efterprøvet baseline

- Branch: `greenfield`.
- Arbejdstræ før og efter gates: kun den allerede untrackede reviewplan; ingen tracked ændringer.
- `npm run typecheck`: grøn.
- `npm run typecheck:test`: grøn.
- `npm run lint`: grøn.
- `npm run test`: 493 filer og 6172 tests grønne.
- `npm run verify:ledgers`: 2 filer og 16 tests grønne; 239/16/8/4/18 registrerede enheder.
- `npm run build:all`: begge apps bygget; to kendte `INEFFECTIVE_DYNAMIC_IMPORT`-advarsler i standalone-buildet.

## Scopekort

- `src/inputCore/`: aggregate, katalog/descriptors, codecs, reader/issues, reducer, editor, runtime,
React-adaptere, history og ledgers.
- `src/persistence/`: save/load/reset-porte og `.eo`-saveprojektion.
- `src/domain/`: navngivne readerprojektioner, dependency-gates og beregningsmotorer.
- `src/document/`: typed definitioner, katalog, lifecycle, runtime, generatorer, writer og layout.
- `src/components/pages/` og app-shell: consumers og orkestrering omkring de offentlige porte.
- `src/__tests__/quality/architecture/`: 36 registrerede AST-regler med fixtures, levende mål,
fraværsregler, scan-rødder og allowlist-anti-rot.

De navngivne legacy-stier i deletion-ledgeren er fysisk fraværende, inklusive `src/input/`,
`src/criticalActions/`, den gamle table-inputmappe og de slettede persistence-contexts.

## Værn reviewet stoler på

- AST-evalueringen af den aktuelle kildegraf: alle registrerede regler og deres overtrædende/rene fixtures.
- Fraværsreglernes tovejsbevis: navnet er fraværende, og prædikatet kan finde et syntetisk brud.
- Scan-røddernes eksistenskontrol.
- Arkitektur- og afrundingsallowlisternes fil- og triggerbaserede anti-rot.
- Deletion-ledgerens fysiske fravær for de faktisk registrerede stier.
- Acceptmatrixens AST-kontrol af aktive testdeklarationer og eksisterende WI-reference.

## Værn reviewet ikke stoler fuldt på

- `liveTarget.kind === 'precondition'`, når proben læser rå filtekst; R0-F02 viser et konkret falsk
levende mål.
- Acceptpunkt 14 som fuld format-invarians; registret dokumenterer selv, at 16 ready-grene ikke nås.
- Den grønne baseline som miljøuafhængigt bevis, før den er gentaget på understøttet runtime.

### R0-F01 — Baseline kørt på ikke-understøttet runtime

**Lokation:** `package.json:22-24`  
**Problem:** Projektet kræver Node `>=24.18.0 <25` og npm `>=11.16.0 <12`, men reviewkørslen brugte
Node `26.5.0` og npm `11.13.0`.  
**Evidens:** `node --version`, `npm --version` og package-engines; alle gates var grønne på dette miljø.  
**Angrebet der fandt det:** Baseline måles, ikke overtages.  
**Konsekvens:** Den grønne baseline er reel for det lokale miljø, men kan ikke alene bære påstanden om den
understøttede toolchain.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Miljø-/procesbrud.  
**Overvejelse:** Der fandtes ingen installeret Node 24-version eller version manager at skifte til.  
**Anbefaling:** Gentag hele baselinen på de deklarerede versioner.  
**Forslag til løsning:** Brug projektets godkendte Node 24/npm 11.16+-miljø og gem udfaldet i rapporten.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29** (etape 12)

**Løsningen.** Fundets oprindelige anbefaling — gentag hele baselinen på Node 24/npm 11.16+ — kunne IKKE
udføres: der findes hverken en installeret Node 24 eller en version manager på maskinen. Det står som en ærlig
afgrænsning frem for som et udført skridt.

Fundets SUBSTANS er derimod lukket strukturelt. Efterprøvningen viste, at grænsen faktisk ER håndhævet to
steder, som fundet ikke havde målt: `.npmrc` har `engine-strict=true`, så `npm install`/`npm ci` afviser en
forkert version med `EBADENGINE` (verificeret i en isoleret probe), og CI pinner Node fra `.nvmrc` (24.18.0) og
kører hele `verify:release` ved hver PR og push. Hullet var derfor smallere end fundet beskrev: **kun
SCRIPT-KØRSEL på et allerede installeret træ var ugated.** Netop dét var reviewkørslens situation.

`scripts/check-runtime-version.mjs` er nu `verify:release`s FØRSTE trin: enten er hele gaten kørt på den
erklærede runtime, eller den er slet ikke kørt. Kontrollen læser `engines` fra ÉN kilde (så en bump ikke kan
efterlade den bagud) og **fail-closer på en operator, den ikke forstår** — et udtryk, kontrollen ikke kan
evaluere, må ikke passere som opfyldt. Der findes bevidst ingen `--warn-only`: en advarsel ville blive støj, man
scroller forbi, og det er præcis den tilstand, fundet beskriver.

**Efterprøvet i BEGGE retninger** (en altid-rød kontrol ville ikke være evidens): rød på denne maskine med
begge dimensioner navngivet (Node OG npm), grøn i en kontrolprøve mod et interval, runtimen opfylder, og hård
fejl på et `^`-udtryk.

### R0-F02 — Tekstprober kan holde døde værn levende

**Lokation:** `src/__tests__/quality/architecture/rules/storageRules.ts:27-42`; tilsvarende prober i
`domainRules.ts:28-31,58-61,148-151`, `formRules.ts:232-239,916-923` og
`inputBoundaryRules.ts:61-74,192-206`  
**Problem:** Flere precondition-prober bruger `entry.text.includes(...)` eller regex mod hele filteksten.
En kommentar kan derfor opfylde liveness, selv om det levende AST-mål er slettet.  
**Evidens:** Storage-reglens egen rene fixture er `// merge af settings fra localStorage`; evaluatorens
clean-fixture-test accepterer den, mens `liveTarget`-regexen returnerer `true` for samme tekst. Den isolerede
quality-kørsel var grøn, så harnesset opdager ikke denne falske liveness.  
**Angrebet der fandt det:** Den grønne af tomhed.  
**Konsekvens:** Et værn kan fremstå load-bearing efter mekanismens faktiske sletning.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systemisk svaghed i liveness-laget; selve AST-evaluatorerne er ikke ramt.  
**Overvejelse:** `input/source-settings-projection-boundary` har allerede den stærkere løsning med
`hasIdentifier`; mønstret er dermed tilgængeligt i harnesset.  
**Anbefaling:** Omskriv strukturelle preconditions til AST-signaler eller eksakte levende paths plus AST-bevis.  
**Forslag til løsning:** Brug artsrelevante AST-queries og tilføj en kommentar-only mutationstest.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 9)**

**Rettelsen er systemisk, ikke en liste af rettede prober.** Fundet er en svaghed i liveness-LAGET, så det
løses i harnesset: en ny generisk kontrol tager for HVER forudsætningsregel en fil, der faktisk opfylder
proben, og kommenterer hele filen ud linje for linje. Kildeteksten er dermed uændret ord for ord, mens hver
eneste AST-node er væk. En probe, der stadig svarer `true`, måler tekst — og testen navngiver reglen samt
hvilke AST-queries den kan bruge i stedet.

**Undtagelsen er selv maskinel frem for en liste:** en probe, der også er opfyldt af en TOM fil på samme sti,
spørger kun "findes modulet?". Det er et legitimt, AST-uafhængigt signal (`requiredPaths` beviser filens
eksistens), og kommentar-mutationen kan pr. konstruktion ikke sige noget om det. Kun en probe, der er opfyldt
af KOMMENTARER men IKKE af tomhed, læser filens indhold som tekst.

**De konverterede prober** (alle med begrundelsen på stedet): `storage/local-storage-boundary`,
`storage/session-storage-boundary`, `satser/fail-open-display-lookup-import`,
`satser/asl-aarsloensmaksimum-raw-subscript`, `money/money-ore-type-assertion`, `input/write-boundary`,
`domain/raw-section-access-boundary`, `input/cell-binding-single-source`,
`input/programmatic-commit-uses-settle`, `input/issue-snapshot-capability-boundary`,
`input/derived-writes-materialize-in-reduction`, `form/persistence-committed-mirror`,
`form/restore-target-attributes` og `form/popup-semantics-single-source`.

**Nye AST-primitiver, konverteringen krævede** (i `astQueries.ts`): `hasAnyIdentifier`, `hasTypeReference`
(et typenavn findes ofte KUN i typepositioner), `hasImportFrom`, `hasJsxAttribute`, `hasDeclaredMember` og
`hasMemberRead`.

**Et sidefund, konverteringen afdækkede:** `form/restore-target-attributes` var tekstbaseret i BEGGE ender —
ikke kun i sin probe. Dens `find` accepterede en manglende gennemføring, hvis blot filen NÆVNTE
`restoreTargetAttributes` i en kommentar. Begge ender måler nu identifiers.

**Mutationsbevist:** sættes `localStorage`-probens signal tilbage til `/\blocalStorage\b/.test(entry.text)`,
bliver den nye kontrol rød og navngiver præcis `storage/local-storage-boundary` samt filen
(`src/utils/safeLocalStorage.ts`).

### R0-F03 — Dokumentformatværnet dækker kun to ready-grene

**Lokation:** `src/__tests__/quality/acceptanceMatrix.test.ts` (kriterium 27's `knownLimitation`); WI-014  
**Problem:** Acceptpunkt 14 sammenligner begge formater for alle 18 Mineo-outputs, men kun 2 projektioner
når deres `ready`-gren. De øvrige 16 sammenlignes blocked-mod-blocked.  
**Evidens:** Registrets egen `knownLimitation`, WI-filens eksistens og den grønne AST-bundne acceptmatrix.  
**Angrebet der fandt det:** Værnet skal kunne fejle på den relevante mekanisme.  
**Konsekvens:** En formatafhængighed skjult i en af de 16 ready-grene kan bestå.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Åben capability i projektionskonteksten, allerede sporet i WI-014.  
**Overvejelse:** Et større fixturekatalog er svagere end at gøre afhængigheden til en typefejl.  
**Anbefaling:** Fjern dokumentformatet fra projektionens synlige settingskontekst.  
**Forslag til løsning:** Gennemfør WI-014 og fjern derefter `knownLimitation`.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** sammen med R6-F03, hvis rettelse den ER. Historikken nedenfor
forklarer, hvorfor fundet stod åbent gennem etape 10.

**Lukningen:** `documentDownloadFormat` er ikke længere synligt i projektionskonteksten — gate- og
render-settings er to disjunkte halvdele af kildesnapshottet, og en formatlæsning i en `project` er en
compilerfejl (TS2339). Spørgsmålet "nåede fixturen ready-grenen?" er dermed ikke længere relevant: der findes
ingen formatakse at variere. `knownLimitation` er fjernet fra kriterium 27, og registrets gulv hævder nu, at der
er NUL kendte begrænsninger — så en ny note skal begrundes frem for at kunne glide ind. WI-014 er lukket.

Etapens omlægning af acceptregistret (R8-F01) flyttede begrænsningen fra det gamle punkt 14 til §10-kriterium
27 og bevarede den ordret, inklusive kravet om at den sporende WI-fil FINDES. Registret hævder desuden, at
kriterium 27 er den ENESTE post med en `knownLimitation`, så en ny begrænsning ikke kan snige sig ind, og
denne ikke kan forsvinde uden at nogen har fjernet den bevidst.

Fundet er derimod ikke løst, og det er en bevidst afgrænsning frem for en forglemmelse: anbefalingen er at
gøre `documentDownloadFormat` til en TYPEFEJL i projektionskonteksten. Det er en produktionsændring i
`DocumentSourceContext`/`SourceSettings` — altså R6-F03's rettelse — og den hører til etape 11 sammen med
resten af R6-F03. En større fixture i stedet ville, som fundets egen overvejelse siger, være svagere end at
fjerne capabilityen.

**Én ting fra etapen forbedrer dog dækningen af den underliggende risiko:** `documentGatePreflightParity`
(R6-F04) måler nu alle 18 definitioner på tre inputtilstande, hvoraf én gør flere outputs `ready`. En
formatafhængighed i en ready-gren ville ikke blive fanget dér — pariteten kører samme format i begge kanaler
— men de 18 definitioners årsags- og synlighedsben er nu målt i deres ready-gren, hvor de før kun var målt
for fire.

## Fasekonklusion

Baseline, scope og værninventar er målt. Fasen forbliver delvist gennemgået, fordi den understøttede
toolchain ikke var tilgængelig, og precondition-liveness ikke kan betragtes som generelt troværdig.
