# R5 — Domæneprojektioner og beregningsflow

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** projektionskernen og de otte consumerslices Satser, Renteberegning, Stamdata, Årsløn,
Varige mén, Forsørgertab, Erhvervsevnetab og Erstatningsopgørelse; snapshot-scope; raw-section-grænsen;
motor-callsites; række-/aggregatgates; dokumentets og `.eo`-savens tokenfriskhed  
**Angreb udført:** maskeret værdi; under- og overblokering; bred raw-section-capability; grøn af tomhed;
parallel blocker-model; upræcis dependency; rækkeisolering og aggregat; parallel beregningsvej; stale token;
snapshot-scope  
**Evidens:** AST-kortlægning af motor-/snapshotcallsites; syntetisk mutation af raw-section-værnet;
runtime-falsifikation af Årsløn; 9 målrettede testfiler/193 tests grønne; 8 beregnings-/golden-/paritetsfiler/
144 tests grønne  
**Fund:** 2 (R5-F01, R5-F02)  
**Hypoteser:** 1 (R5-H01)  
**Handling:** R5-F01 er godkendt til implementering; R5-F02 er parkeret; ingen produktionsfiler ændret  
**Næste skridt:** Implementér R5-F01 som godkendt; luk raw-section-grænsen systemisk; gennemfør den resterende
transitive EO-dependencyanalyse og af-/bekræft R5-H01

### R5-F01 — Årsløn viser en deltotal fra en fejlende række

**Lokation:** `src/domain/aarsloen/aarsloenProjection.ts:83-86,131-184,283-298`;
`src/components/pages/Aarsloen.tsx:133-134,453`; `src/contracts/aarsloen-contract.md:20`;
`src/contracts/error-contract.md:27,74-79`  
**Problem:** Årslønsprojektionen erstatter en celle med aktiv rød feltfejl med cellens tomværdi, men dens
manuelle beregningsgate omfatter kun fem procentfelter og `antalFeriedage`. En fejlende tabelcelle blokerer
derfor dokumentgaten gennem `tableValidation`, men ikke selve beregningen. Projektionen returnerer heller ikke
`ready | blocked`; dens særmodel er `calculation | null`, hvor `null` kun styres af den smallere skalar-gate.  
**Evidens:** En read-only runtime-probe gennem produktionskataloget oprettede to Årsløn-rækker:
`r1.col2 = 1000` og rejected `r2.col2 = "abc"`. Resultatet bar både rejected-adressen og
`tableValidation`-issuet `invalid` for `r2.col2`, men gav samtidig `calculationNull = false`,
`beregnetAarsloen = 1000` og `fieldIssues = 0`. Sidekoden afgør resultatvisningen alene af
`calculation === null || calculation.harFatalBeregningsFejl` og viser derfor `1.000 kr.` som
“Beregnet årsløn”. De målrettede tests var grønne, fordi den eksisterende Årsløn-suite kun hævder, at en rød
celle ikke blokerer rekonstruktionen; den hævder ikke, at aggregatet bliver uanvendeligt.  
**Angrebet der fandt det:** Den maskerede værdi, præcis dependency og rækkeisolering/aggregat.  
**Konsekvens:** Brugeren ser en tilsyneladende autoritativ årsløn, som udelader den fejlende rækkes værdi. Det
er ikke blot en lydløs dokumentblokering: det synlige beregningstal er en deltotal, selv om aggregatet ikke har
alle valgte rækkers anvendelige input.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Tegn på et bredere problem i Årsløn-slicen. Den manuelle skalar-gate konkurrerer med
readerens strukturelle dependencies og `ready | blocked`-modellen; runtimefejlen er et symptom på den parallelle
blocker-model.  
**Overvejelse:** Rækkeisolering betyder, at en fejl i række 2 ikke skal ødelægge række 1. Det gør ikke en sum af
række 1 og række 2 autoritativ, når række 2 er ukendt. Dokumentgaten har allerede den nødvendige
tabelklassifikation, men beregningsprojektionen bruger den ikke som dependency.  
**Anbefaling:** Konsolidér Årsløn om én typed `ready | blocked`-projektion, hvor rækkernes konkrete refs afgør
anvendeligheden, før aggregatmotoren kaldes. Bevar isolerede rækkevisninger, men fremstil ikke aggregatet som
gyldigt, når en inkluderet række er blokeret.  
**Forslag til løsning:** Lad projektionsgrænsen bygge motorinput gennem collector/typed rækkeprojektioner og
returnere `blocked` for det samlede Årsløn-output, når en inkluderet celle har et rødt issue. Dokumentdefinition
og sidevisning skal aftage samme resultat i stedet for hver sin gate. Eksisterende gyldige fixtures og tal skal
forblive byte-/værdiidentiske.  
**Kræver godkendelse:** Godkendt 2026-07-28. Brugeren har godkendt, at det samlede årslønsresultat
skjules/blokeres, indtil den røde celle er rettet; gyldige enkeltoplysninger bevares.  
**Status:** **Rettet 2026-07-28** (etape 5, sammen med GM-F04 — samme fund fra to vinkler)

**Løsning:** `buildAarsloenReaderProjection` gater nu `calculation` på den tabelklassifikation, dokumentgaten
allerede brugte. Har en medregnet række en `invalid` celle, er `calculation === null`, og siden viser `—` som
den allerede gjorde ved en rød skalarfejl — samme kodesti, ingen ny visningsgren. Sideberegning og
dokumentdefinition kan dermed ikke længere give hver sit svar på, om input er anvendeligt.

Anbefalingens bredere retning — at flytte hele Årsløn til typede rækkeprojektioner over en `ProjectionResult`
— er IKKE gennemført, og det er en bevidst afgrænsning: `AarsloenReaderProjection` er en samlet
consumer-projektion med fire flader (values, tableValidation, omregningGate, calculation), som siden,
tabellen og dokumentgaten deler. En omlægning til `ready | blocked` ville tvinge alle fire gennem én global
status og dermed genindføre netop den overblokering, §1.10 forbyder (samme afvejning som Forsørgertab/EET/EO,
jf. `mapReadyProjection`s egen note). Den konkrete defekt — at aggregatet ikke fulgte sine dependencies — er
lukket uden den omlægning.

**Afgrænsning:** kun `invalid` gater, ikke `partial_period`. En ufuldstændig periode er en almindelig
mellemtilstand under indtastning; at skjule totalen der ville være bredere end det godkendte.

**Dækning:** tre nye tests i `aarsloenProjection.test.ts` (fundets egen probe, et beregnende anker, og
`partial_period`-afgrænsningen). Mutationsbevis: fjernes celle-gaten, fejler probe-testen med
`beregnetAarsloen: 1120` — deltotalen fra række 1 alene, altså præcis det tal, evidensen ovenfor beskrev.

### R5-F02 — Raw-section-værnet overser property- og spread-adgang

**Lokation:** `src/__tests__/quality/architecture/rules/inputBoundaryRules.ts:177-184,187-236`;
`src/domain/satser/satserNewCaseSeed.ts:26`  
**Problem:** `domain/raw-section-access-boundary` erklærer, at kun `src/inputCore/` og
`src/persistence/eoSaveProjection.ts` må eje rå sektionsadgang, men dens AST-finder bruger kun
`collectElementAccess`. Den fanger derfor bracket-formen `input.sections["satser"]`, men ikke
property-formen `input.sections.satser`, en reference til hele `input.sections` eller spread/destrukturering.
En levende produktionsfil uden for de erklærede ejere spreder allerede hele `empty.sections` under
ny-sags-seeding.  
**Evidens:** Direkte syntetisk kørsel af den levende regels `findInFile` gav:

```text
const x = input.sections["satser"]; => 1
const x = input.sections.satser;    => 0
```

Den almindelige arkitektursuite var samtidig grøn. Repo-søgning fandt
`sections: Object.freeze({ ...empty.sections, satser: ... })` i `satserNewCaseSeed.ts:26`. Der blev ikke fundet
en aktuel rå sektionslæsning i beregnings-, save- eller dokumentconsumers ud over den udtrykkeligt tilladte
save-projektion, men fraværet er ikke bevist af det eksisterende værn.  
**Angrebet der fandt det:** Den brede capability, den grønne af tomhed og en mutation rettet direkte mod
AST-mekanismen.  
**Konsekvens:** En fremtidig domain-, beregnings- eller dokumentconsumer kan omgå `InputReader` med almindelig
property-, alias- eller spread-syntaks uden at CI bliver rød. Dermed kan en canonical værdi bag et rødt issue nå
en motor eller gate, selv om §10-kriterium 28 ser maskinelt beskyttet ud. Den nuværende Satser-seed er en
systemoperation og giver ikke i sig selv et påvist forkert tal, men den demonstrerer, at capabilityen allerede
er eksponeret uden for den erklærede grænse.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systemisk værn-/capabilityproblem. Reglen måler én syntaksform, mens arkitekturgrænsen
handler om adgang til en værdi og dens importgraf.  
**Overvejelse:** Den bedste sluttilstand er at flytte ny-sags-seedens rå replacement ind bag en navngiven
inputinfrastrukturport og derefter lade AST-værnet dække alle resterende adgangsformer. En større allowlist ville
bevare den brede capability. Fundet genåbner troværdigheden af netop dette R0-værn.  
**Anbefaling:** Luk capabilityen i inputinfrastrukturen og udvid værnet til property access, reference,
destrukturering, spread og relevante aliaser. Tilføj en violating fixture pr. syntaksform.  
**Forslag til løsning:** Lad Satser levere den typed defaultværdi eller en snæver seed-beslutning, mens
`initializeInputRuntime`/kataloget ejer sektionskonstruktionen. Ret derefter AST-reglen mod alle reads af
`SettledInput.sections`, ikke kun element access.  
**Kræver godkendelse:** Nej — ændringen er en intern capability- og værnrettelse uden tilsigtet synlig eller
beregningsmæssig forskel.  
**Status:** **Rettet 2026-07-29 (etape 9)**

**Rettelsen fulgte fundets egen prioritering: luk capabilityen FØRST, udvid derefter værnet.**

*Capabilityen (den strukturelle halvdel).* `NewCaseSeed` gav domænet hele den tomme `SettledInput` og bad det
returnere en ny — seeden MÅTTE derfor spread'e `empty.sections`. Signaturen er nu
`() => Partial<SettledInput['sections']> | undefined`: seeden siger HVAD der seedes, og
`initializeInputRuntime` ejer konstruktionen og frysningen. Grænsen er dermed lukket i TYPEN frem for ved en
allowlist-post — en seed kan hverken fjerne en sektion, tilføje en ukendt nøgle eller røre `rejectedInputs`.

*Værnet (alle fire syntaksformer).* `domain/raw-section-access-boundary` måler nu element access (den
oprindelige), property access, reference/spread og destrukturering. Den nye `collectDestructuredProperties`
i `astQueries.ts` er det, der manglede i harnesset.

**To fund, udvidelsen selv afslørede:**

1. `src/persistence/caseFileOperations.ts` er en LEGITIM rå ejer (`buildLoadReplaceCaseCandidate` +
   `settledInputHasAnyData`) og er tilføjet `RAW_SECTION_SERIALIZERS`. Den var ejer i praksis, mens reglen kun
   målte bracket-formen.
2. Tre EO-inspektions-komponenter har en PROP, der hedder `sections` (`readonly InspektionSection[]` —
   view-modeller uden relation til `SettledInput`). En navnebaseret regel ville have flaget dem og presset mod
   en allowlist af uskyldige filer. Sondringen er derfor strukturel: kun en `VariableDeclaration` med et
   initialiseringsudtryk udtrykker en LÆSNING; en parameter-binding modtager noget, kalderen har bygget — og
   hvis dét kaldssted rakte i den rå form, flages det dér af member-access-benet.

**Mutationsbevis mod den LEVENDE kilde (ikke kun fixtures):** genindføres de tre tidligere blinde former i
`satserNewCaseSeed.ts`, bliver reglen rød på alle tre med fil:linje:kolonne. Dertil 4 nye seed-tests, der nu
går gennem den ÆGTE bootstrap-vej og derfor beviser, at værdien LANDER i den hydrerede baseline — hvor den
gamle test kun beviste, at seeden byggede et gyldigt objekt.

## Efterprøvet uden fund

- `src/domain/inputIntegrity/` er fysisk fraværende, og der blev ikke fundet produktionssymboler for den gamle
  `InputBlocker`-/`global | section | row`-model.
- Renteberegningens rækkeprojektion læser kun rækkens egne refs plus den fælles beregningsdato. Aggregatet
  itererer alle aktuelle row ids, og `computeRentekravRow` nås gennem `mapReadyProjection` efter
  `ready | blocked`-afgørelsen.
- Satser og Stamdatas dokumentprojektioner læser konkrete refs gennem `InputReader`.
- Forsørgertab, EET og EO gater deres motorer før kaldet pr. navngiven dependency-gruppe. Reviewet fandt ingen
  ny konkret masked-value-motorvej i de gennemgåede grupper.
- Snapshot-first er begrænset til de tre normative domæner EO, EET og Forsørgertab. Årsløn,
  Renteberegning og Varige mén bruger fortsat projektion/engine uden et domænesnapshot.
- Produktionscallsites for de autoritative hovedmotorer var konsoliderede til deres projektion/snapshot. Rentes
  rækkeengine køres både til række- og aggregatresultat, men gennem samme rene motor og samme reader-afledte input,
  ikke gennem to forskellige beregningsimplementeringer.
- `EvaluationSourceToken` indeholder både input- og settingsrevision, og `sourceTokensEqual` sammenligner begge.
  Dokumentlivscyklussen genlæser tokenet efter settle/capture og efter dev-preflight, renderer-load, writer-load
  og rendering, før fil-downloaden udløses.
- `.eo`-save bærer hele tokenet fra den friske save-projektion og kontrollerer det efter filmålet er resolveret
  og umiddelbart før første skrivning.
- De målrettede golden-/paritetschecks for gyldige fixtures var grønne; reviewet ændrede ingen tal.

## Hypotese

### R5-H01 — Varige mén omgår projektionskernens typed motorgate

`src/inputCore/projection.ts:116-118` fastslår, at `runProjection`-bodyen udføres før statusafgørelsen og derfor
aldrig må kalde en beregningsmotor. `src/domain/varigemen/varigeMenReaderProjection.ts:58-84` kalder alligevel
`computeVarigeMenEngine` inde i bodyen.

De fire `require`-resultater kontrolleres før kaldet, og reviewet kunne derfor ikke fremkalde et motorkald ved en
aktuelt `blocked` projektion. Det er således ikke et verificeret talbrud. Formen gør dog sikkerheden afhængig af,
at enhver fremtidig blokerende read stadig huskes i den manuelle guard, i stedet for at `mapReadyProjection`
gør bruddet strukturelt umuligt.

**Af-/bekræftelse:** Flyt i en mutation motoren før én af de manuelle guards eller tilføj en ny blokerende
dependency uden at udvide guarden, og kontrollér om en eksisterende test fejler specifikt på motorkaldet. Kortlæg
desuden AST-baseret alle motorkald inde i `runProjection`-callbacks. Bekræftes hypotesen som et aktivt værnhul,
flyttes motorinput og motorkald til samme mønster som Renteberegningens `mapReadyProjection`.

## Resterende kontrolpunkter

- Der er ikke gennemført et udtømmende, genereret engine-read → descriptor → dependency-gruppe-bevis for alle
  dybt nestede EO-løn- og rækkefelter. Eksisterende completeness- og engine-gate-tests var grønne, men de beviser
  ikke automatisk, at en ny engine-read er føjet til den rigtige gruppe.
- Settings-only drift blev ikke runtime-injiceret ved hver enkelt dokument-`await`. Implementeringen
  sammenligner beviseligt hele tokenet, mens den kørte lifecycle-matrix flytter inputrevisionen.
- Generatorernes dokumentindhold og output-invariants hører til R6 og er ikke overtaget her.
- Den fulde test-/buildgate blev ikke kørt; reviewet brugte de smalleste målrettede tests, der dækkede
  projektions-, gating-, token- og talrisikoen.

## Tilfældighedsfund

- `src/__tests__/domain/renteberegning/renteberegningProjectionMatrix.test.ts:132-135` siger, at motoren kaldes
  inde i `runProjection`-bodyen. Produktionskoden flyttede kaldet ud gennem `mapReadyProjection` ved
  `renteberegningReaderProjection.ts:105-107`; kommentaren er forældet.
- `src/domain/aarsloen/aarsloenProjection.ts:39-55` beskriver stadig “greenfield”, “legacy” og “Pass 1” frem for
  slutarkitekturen. Det er sluttilstandssprogsdrift og hører til R1-oprydningen.
- Den rene Årslønsberegning bor fortsat i `src/hooks/useAarsloenBeregning.ts`, selv om
  `computeAarsloenBeregning` er domænekode og React-hooket kun er en tynd memo-adapter. Placeringen svækker den
  tydelige model → projektion → output-sammenhæng.

## Kørte kommandoer og udfald

```text
npx vitest run \
  src/__tests__/inputCore/inputCore.test.ts \
  src/__tests__/domain/aarsloen/aarsloenProjection.test.ts \
  src/__tests__/domain/renteberegning/renteberegningProjectionMatrix.test.ts \
  src/__tests__/domain/varigemen/varigeMenReaderProjection.test.ts \
  src/__tests__/domain/forsoergertab/forsoergertabEngineGate.test.ts \
  src/__tests__/domain/erhvervsevnetab/eetEngineGate.test.ts \
  src/__tests__/domain/erstatningsopgoerelse/eoEngineGate.test.ts \
  src/__tests__/document/documentLifecycleMatrix.test.ts \
  src/__tests__/quality/architecture/architectureRules.test.ts \
  --maxWorkers=100%

9 testfiler / 193 tests — grøn
```

```text
npx vitest run \
  src/__tests__/domain/aarsloen/aarsloenCalculations.test.ts \
  src/__tests__/domain/aarsloen/aarsloenRowCalculations.test.ts \
  src/__tests__/domain/renteberegning/renteberegningEngine.test.ts \
  src/__tests__/domain/renteberegning/procesrenteCalculatorOracle.test.ts \
  src/__tests__/domain/varigemen/varigeMenEngine.test.ts \
  src/__tests__/domain/forsoergertab/forsoergertabCalculation.test.ts \
  src/__tests__/domain/erhvervsevnetab/eetMoneyMigration.characterization.test.ts \
  src/__tests__/domain/erstatningsopgoerelse/eoCanonicalOutput.parity.test.ts \
  --maxWorkers=100%

8 testfiler / 144 tests — grøn
```

Read-only Vite-SSR-prober målte desuden R5-F01 og R5-F02 direkte. `npm run test` blev bevidst ikke brugt,
fordi pretest-scriptet genererer build-info og dermed ville bryde reviewets read-only-grænse.

## Fasekonklusion

Rente-, snapshot- og tokenflowets centrale invarianter er efterprøvet, og de kørte gyldige talfixtures er
uændrede. Exitkriterierne er ikke opfyldt: Årsløn kan vise en deltotal fra en fejlende række,
raw-section-værnet beviser ikke den grænse det påstår, Varige mén-gaten står som åben hypotese, og den fulde
transitive EO-dependencyanalyse mangler. R5 forbliver derfor **Delvist gennemgået**.
