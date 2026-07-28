# R3 — Feltvurdering, issue-model og gates

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** validation/public reader, issueafledning og prioritet, `.eo`-savegate, range-beskeder,
EET-import, EO dependency-gates/snapshot og repræsentative dokument-/beregningsgates  
**Angreb udført:** overblokering; underblokering; lydløs blokering; bred issue-capability; stale resultat;
format/bounds/missing/warning-matrix; `min > max`  
**Evidens:** 6 målrettede testfiler/183 tests grønne; AST/property-read-analyser; runtime-falsifikation af
EET-import og tooltips; uafhængig Sol/high-efterprøvning af R3-F01 og R3-F02  
**Fund:** 4 (R3-F01, R3-F02, R3-F03, R3-F04)  
**Hypoteser:** 0 åbne (R3-H01 bekræftet og lukket 2026-07-28)  
**Handling:** R3-F01, R3-F02 og R3-F04 rettet 2026-07-28 (etape 4); R3-F03 parkeret til etape 7  
**Næste skridt:** R3-F03 (min-max-tooltips) i etape 7

### R3-F01 — Midlertidig EET-import overblokeres sektionsvist

**Lokation:** `src/domain/erhvervsevnetab/eetImportPort.ts:39-54`;
`eetLoebendeYdelserCalculation.ts:600,850-857`  
**Problem:** `buildMidlertidigtEetInsertSource` gør ethvert rødt issue i hele `erhvervsevnetab` til en
blokerende source-fejl. Importmotoren læser ikke `ealEetPct`, men en bounds-fejl på dette felt blokerer
alligevel importen.  
**Evidens:** Runtime med canonical `ealEetPct = 101` gav
`erhvervsevnetab.ealEetPct.bounds`, en source-fejl og derefter `snapshot.data === null`. Uafhængig
efterprøvning bekræftede, at motorens reads er ASL-årsløn, ASL-afgørelser, datoer og eventuelt EAL-årsløn,
ikke EAL-afvigelsesprocenten.  
**Angrebet der fandt det:** Overblokering og den brede capability.  
**Konsekvens:** En bruger kan miste den midlertidige EET-import og dens grupper på grund af et rødt felt,
som importens beregning ikke bruger.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Sektionsfilter over `issues.all` erstatter præcise reader-dependencies.  
**Overvejelse:** Overblokering er ikke en sikker fail-closed-adfærd; den modsiger §1.10.  
**Anbefaling:** Lad importprojektionen læse og blokere på de konkrete refs, motoren faktisk bruger.  
**Forslag til løsning:** Erstat sektionsfilteret med en typed EET-importprojektion og dependency-tests.  
**Kræver godkendelse:** Beregningslogik — brugeren vil i den konkrete situation få en import og tal,
hvor programmet i dag blokerer. **Godkendt af brugeren 2026-07-28.**  
**Status:** **Rettet 2026-07-28** (etape 4). `hasFieldIssueInSection` er erstattet af
`hasBlockingDependencyIssueInSection`, som måler `IMPORT_DEPENDENCY_FIELD_IDS` — de felter, importens
transitive call-graph faktisk læser. Sektionen er bevaret som argument, fordi de tre kilder giver hver sin
brugerbesked, men afgørelsen træffes nu på det konkrete felt.

**Kortlægningen korrigerede fundets egen antagelse:** `faellesAarsloen.aslAarsloen` ER load-bearing —
`grundloen` ganges ind i hvert periodebeløb, og feltet giver selv `aarsloen-missing`/`aarsloen-zero`. Kun
`ealAarsloen` er ren advarsel (`warn-asl-aarsloen-is-max`, severity `warning`). Sektionsgaten for
`faellesAarsloen` var altså for BRED, ikke overflødig. Tilsvarende for `stamdata`: `skadedato` og
`skadelidteFodselsdato` er reelle afhængigheder; brevhovedfelterne er det ikke.

Dækning: `useMidlertidigtEetInsertSource.test.ts` (7 tests). Den test, der tidligere PINNEDE
overblokeringen (`ealEetPct: 101` ⇒ blokeret import), hævder nu det modsatte, og to modretningstests
(`aslAfgoerelser.eetPct`, `aslAarsloen`) sikrer, at gaten ikke er blevet tandløs. To completeness-tests måler
dependency-listen mod produktionskataloget, så et omdøbt felt gør testen rød frem for lydløst at falde ud af
gaten. Mutationsbevis: gøres gaten sektionsvis igen, fejler netop
"blokerer IKKE importen ved et rødt felt, importberegningen ikke læser".

### R3-F02 — EO globaliserer feltissues uden faktisk dependency

**Lokation:** `snapshot/eoSnapshotInvariants.ts:83-98`; `snapshot/eoDependencyGroups.ts:227-230`;
`snapshot/eoSnapshot.ts:377-450`; `erstatningsopgoerelseReaderProjection.ts:555`  
**Problem:** Alle EO- og stamdataissues sættes til autoritativ blokering, og `aggregate` bliver blokeret ved
ethvert stamdataissue, også når ingen dependency-gren matcher. Et bounds-issue på skadelidtes fødselsdato
globaliseres, selv om EO-motorerne ikke læser feltet.  
**Evidens:** Uafhængig kodeefterprøvning bekræftede issue-flowet:
`stamdata.skadelidteFodselsdato.bounds` → alle stamdataissues til snapshot → `aggregate: true` →
`data` fjernes. Den eneste EO-læsning af fødselsdatoen er en ikke-blokerende folkepensionswarning i
`eoRowTaftRows.ts:86`, ikke en beregnings- eller dokumentværdi. Eksisterende tests pinner den globale
adfærd i `eoDependencyGroups.test.ts:186-197,233-239`.  
**Angrebet der fandt det:** Overblokering og stale resultat.  
**Konsekvens:** Gyldige totaler, canonical output og EO-dokumentprojektioner fjernes af et felt uden faktisk
outputdependency.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Det manuelle globale invariantlag konkurrerer med dependency-grupperne og blander
total, præsentation og dokument.  
**Overvejelse:** Den isolerede fødselsdato-case er kodebevist fra to uafhængige vinkler; en dedikeret
runtime-regressionstest mangler.  
**Anbefaling:** Udled blokering fra de refs, hver beregning og hvert dokument faktisk læser.  
**Forslag til løsning:** Fjern den ukonditionerede aggregate-globalisering og opdel snapshot-output efter
reelle dependencies.  
**Kræver godkendelse:** Beregningslogik og synlig adfærd — brugeren vil kunne se totaler og hente dokumenter
i en situation, som i dag blokerer. **Godkendt af brugeren 2026-07-28.**  
**Status:** **Rettet 2026-07-28** (etape 4). Stamdatafelterne klassificeres nu efter, hvad EO's motorer og
dokumentindhold faktisk læser (`isEoRelevantStamdataIssue`). Filteret sidder ÉT sted — i `eoSnapshot.ts`, hvor
`stamdataFieldIssues` modtages — så grengaten (`resolveEoBlockedDependencies`) og de strukturelle invarianter
(`buildStructuralFieldIssueInvariants`) ikke kan divergere. `skadestype` er tilføjet som periodegrænse ved
siden af `skadedato`: den afgør gennem `buildTaftContext`, om erhvervssygdomsgrænsen er aktiv.

**Fundets evidens var ufuldstændig på to punkter, som blev afklaret under rettelsen (begge uden at ændre
konklusionen):**

1. Der findes en ANDEN EO-læsning af fødselsdatoen end folkepensionswarningen:
   `eoPeriodeBlockingContext.ts:71` lægger den på `TaftContext`. Den læses dog kun ét sted —
   `eoRowTaftRows.ts:87` → netop folkepensionsadvarslen (`status: 'warning'`, hardcodet). Ingen
   beløbs- eller dagberegning rører den, og ingen EO-generator printer den.
2. Den globale invariantvej var på rettelsestidspunktet det ENESTE, der gjorde EO-dokumenterne fail-closed
   på et rødt stamdatafelt: `documentStamdata` på EO's projektion var tildelt men aldrig læst (registreret
   som INC-F04). En ren sletning af globaliseringen ville derfor have åbnet et reelt hul — derfor er
   brevhovedfelterne (`journalnr`, `skadelidte`, `advokat`, `sagsbehandler`) klassificeret som EO-relevante:
   de bærer ingen validator og kan kun blive røde ved format-afvist råtekst, men bliver de det, må
   dokumentet ikke udgives med en tom brevhovedlinje.

Dækning: `eoDependencyGroups.test.ts` (110 tests) med et completeness-led, der hævder, at HVERT
stamdatafelt i produktionskataloget er eksplicit klassificeret som relevant eller ikke — så et nyt felt ikke
lydløst defaulter til "blokerer ikke". `eoEngineGate.test.ts` (23 tests) hævder virkningen end-to-end gennem
den ægte `computeEoSnapshot`, i begge retninger: rød fødselsdato ⇒ `data` bevaret og ingen gren blokeret;
rød skadedato ⇒ begge periodegrene blokeret; rødt brevhoved ⇒ aggregat blokeret, men ingen motorgren.
Mutationsbevis: fjernes filteret, fejler netop "en rød FØDSELSDATO blokerer intet" med
`expected null not to be null`, mens alle modretningstests forbliver grønne.

### R3-F03 — Min-max-tooltips mangler inputnavne

**Lokation:** `src/inputCore/catalog/dateRangeErrorMessages.ts:49-55`;
`erstatningsopgoerelseDescriptors.ts:267-276,494-503`; tilsvarende
`renteberegningDescriptors.ts:49` og `forsoergertabDescriptors.ts:83-88,108-113`  
**Problem:** `min > max`-beskeden tilføjer kun årsagsinput, når callsite leverer
`noValidRangeInputs`; flere descriptors udelader dem.  
**Evidens:** Med `skadedato = 2099-01-01` viste Forligsdato og Øvrige krav-dato begge de faktiske
grænser 01-01-2099/28-07-2026, men hverken “Skadedato” eller det andet årsagsinput.  
**Angrebet der fandt det:** Range-tooltip med ingen gyldige værdier.  
**Konsekvens:** Brugeren får at vide, at ingen dato er gyldig, men ikke hvilke inputs der skal rettes.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systemisk callsite-policy-hul; helperen gør et kontraktkrav valgfrit.  
**Overvejelse:** Kontrakten dokumenterer allerede den tilsigtede synlige adfærd.  
**Anbefaling:** Gør årsagsinputs obligatoriske i den typed `min > max`-gren.  
**Forslag til løsning:** Modellér range-årsagen strukturelt og opdatér alle descriptors samlet.  
**Kræver godkendelse:** Nej — det genskaber den bindende tooltip-adfærd.  
**Status:** **Rettet 2026-07-29** (etape 7, andet pas)

**Løsningen.** Anbefalingen var at gøre årsagsinputs obligatoriske i den typede `min > max`-gren; det er
gennemført som en DISKRIMINERET union frem for blot et påkrævet felt. `noValidRangeInputs?: string` er afløst
af `bounds: DateRangeBoundsOrigin` = `{ kind: 'static' } | { kind: 'derived'; causeInputs: string }`.

Sondringen er den saglige kerne: er begge grænser konstanter fra `dateRanges`, er et umuligt interval
urepræsenterbart, og der findes intet brugerinput at nævne. Udledes en grænse af et ANDET felt, er intervallet
reachable, og `causeInputs` er da PÅKRÆVET af typen. Et nyt dynamisk datofelt kan derfor ikke længere glemme
årsagen uden en compilerfejl — og det var netop VALGFRIHEDEN, ikke manglende evne, der var fejlen: helperen
kunne allerede tilføje årsagen, men kun 2 af 14 callsites gjorde det.

Compileren enumererede alle callsites; hver er klassificeret efter sin faktiske grænseudledning. Otte flader
navngiver nu en årsag, de før var tavse om — herunder fundets egen reproduktion (forligsdato og øvrige
krav-dato ved `skadedato = 2099-01-01`), EETs beregningsdato og Forsørgertabs beregnings-/virkningsdato.
EET-rækkernes datovalidator er værd at fremhæve: den satte årsagen for to af sine fire datoroller og
`undefined` for de to andre — præcis den asymmetri, et valgfrit felt inviterer til.

Dækning: 3 nye helper-tests (udledt / statisk / kun-i-den-umulige-gren) plus 3 descriptor-tests gennem det
ÆGTE produktionskatalog, som måler `issue.message` frem for blot `status` — en status-only assertion havde
været grøn hele vejen igennem. Mutationsbevist mod den levende kilde: sættes EETs beregningsdato tilbage til
`static`, fejler netop dens test med fundets oprindelige, halve besked.

### R3-F04 — Den offentlige reader eksponerer hele issue-snapshottet

**Lokation:** `src/inputCore/inputReader.ts:27-36,130-135`; design §3.4  
**Problem:** Designets faste offentlige `InputReader` har kun token, `read` og `listEntities`. Koden tilføjer
`fieldIssues: FieldIssueSnapshot`, og `InputEvaluation` gør hele `issues.all` offentligt tilgængeligt.
ValidationReader-factoryen er desuden moduleksporteret frem for rent intern.  
**Evidens:** Typeformen i design §3.4 sammenholdt med koden og de sektions-/globalfiltre, der skaber
R3-F01 og R3-F02.  
**Angrebet der fandt det:** Den brede capability.  
**Konsekvens:** Consumers kan blokere efter sektion eller globalt uden at deklarere konkrete reads; præcis
dependency bliver en konvention frem for en typegrænse.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systemisk rodårsag bag de observerede overblokeringer.  
**Overvejelse:** UI kan fortsat få et issue-snapshot gennem en særskilt, navngiven præsentationsport.  
**Anbefaling:** Genskab den lille reader og giv kun eksplicitte infrastrukturejere adgang til issue-snapshottet.  
**Forslag til løsning:** Split reader, issuepræsentation og consumerprojektion i snævre capabilities; tilføj
et import-/typeværn.  
**Kræver godkendelse:** Nej for capabilityændringen; adfærdsrettelserne er dækket af R3-F01/F02.  
**Status:** **Rettet 2026-07-28** (etape 4). `fieldIssues` er FJERNET fra den offentlige `InputReader`, så
grænsen primært er en TYPE og ikke et værn: et genindført sektionsfilter over readerens snapshot er nu en
compilerfejl. Har en consumer et sagligt behov for en sektions strukturelle issues — rækkeceller maskeres til
tomværdi og kan ikke ses gennem `read` alene — beder den om dem eksplicit med
`readSectionFieldIssues(section)`, som navngiver sektionen i kildekoden og efterlader klassifikationen hos
consumeren.

`InputEvaluation.issues` bærer fortsat snapshottet, fordi dokumentlivscyklussen skal have tokenet. Den
resterende vej (`evaluation.issues.all`) kan ikke lukkes med en type og dækkes derfor af AST-reglen
`input/issue-snapshot-capability-boundary`. Reglen måler AST-medlemskæder, ikke tekst, så en
historik-kommentar om `issues.all` ikke bærer den (jf. INC-F03). Dens `liveTarget` hviler på TRE
forudsætninger — det brede `all`, den smalle erstatning og præsentationsundtagelsen — så den ikke kan stå
halvt død; harnessets egen dødt-værn-kontrol afviste den første udgave, hvor `requiredPaths` var
selvmodsigende.

`ValidationReader`-factoryens moduleksport er bevaret bevidst: `deriveFieldIssueSet` og `inputReducer`s
før/efter-procedure ligger i andre filer i inputkernen og har brug for den. Den er ikke en consumervej —
`input/issue-snapshot-capability-boundary` og `domain/raw-section-access-boundary` holder den inden for
`src/inputCore/`.

Mutationsbevis: `reader.fieldIssues.all` i en ny fil giver TS2339; `evaluation.issues.all` genindført i
`eetImportPort` gør AST-reglen rød med fil:linje:kolonne og den præcise besked.

## Efterprøvet uden fund

- Ingen identifiers `blocksSave` eller `blocksProjection`.
- `.eo`-save udledes direkte af relevante `rejectedInputs`.
- Den offentlige `read(field)` skjuler værdien ved aktiv feltfejl.
- Tomhed springes over ved feltissue-afledning; `missing` udledes consumer-lokalt.
- Feltissue-prioritet er central og deterministisk.
- Ingen aktiv skrivbar issue-bus eller mounted issue-reporter blev fundet.
- De seks målrettede suites dækkede inputmatrix, save, dokumentgate, renteprojektion og EO-gates
med 183 grønne tests.

## Hypotese

- ~~**R3-H01**~~ — **bekræftet og lukket 2026-07-28 (etape 4).** En fuldstændig kortlægning fandt PRÆCIS fem
brede filtre over issue-sættet i produktionen: `erstatningsopgoerelseReaderProjection.ts:552` og `:555`
(consumerblokering, R3-F02), `eetImportPort.ts:42` og `:63` (consumerblokering, R3-F01) samt
`inputDiagnosticsProjection.ts:50` (ren UI-diagnostik, ingen gate læser den). De fire blokerende er rettet;
den femte er en navngivet, gate-fri devtools-læsning. Hypotesen kan ikke genopstå som en ukendt mængde, fordi
den brede capability er fjernet fra readerens type og AST-reglen
`input/issue-snapshot-capability-boundary` håndhæver den resterende vej.

`eoInputIssues.ts` (`topLevelFieldIssue`, `selectBlockingLoenindkomstEntityIds`) blev vurderet særskilt: det
modtager et ALLEREDE sektionsafgrænset sæt som parameter frem for at læse et bredt snapshot, og
`selectBlockingLoenindkomstEntityIds` matcher på konkrete entity-collections. Det er derfor en registreret
præsentationsundtagelse i AST-reglen, ikke en overblokering.

## Fasekonklusion

Save-sondring, missing/tomhed, prioritet og ren afledning er efterprøvet. **Opdateret 2026-07-28 (etape 4):**
begge overblokeringer er rettet, den brede issue-capability er kortlagt færdig og fjernet fra readerens type,
og R3-H01 er bekræftet og lukket. Fasens exitkriterier er dermed opfyldt for "ingen lydløs blokering og ingen
overblokering" og for save-sondringen.

Ét fund står tilbage: R3-F03 (min-max-tooltips uden inputnavne) hører til etape 7 sammen med de øvrige
fokus-/navigations- og beskedfund. Fasen er derfor fortsat `Delvist gennemgået`.
