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
**Hypoteser:** 1 (R3-H01)  
**Handling:** R3-F01 og R3-F02 er godkendt til implementering 2026-07-28; øvrige fund er parkeret;
ingen produktionsfiler ændret  
**Næste skridt:** implementér R3-F01/F02 systemisk og kortlæg øvrige brede issue-reads

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
**Status:** Godkendt til implementering

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
**Status:** Godkendt til implementering

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
**Status:** Parkeret

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
**Status:** Parkeret

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

- **R3-H01:** Andre sektionsvise læsninger af `evaluation.issues.all` kan overblokere, herunder
fællesårsløn/stamdata i EET-importen og yderligere EO-projektioner. Af-/bekræftes consumer for consumer
mod de konkrete reader-reads.

## Fasekonklusion

Save-sondring, missing/tomhed, prioritet og ren afledning er efterprøvet. Exitkriterierne er ikke opfyldt:
de to uafhængigt efterprøvede overblokeringer er godkendt, men endnu ikke implementeret, og den brede
issue-capability skal kortlægges færdig.
