# Udtræk 6 – testdækningsgennemgangen

Kilder: `docs/testing/testdaekningsgennemgang.md` (TDG), `docs/testing/testdaekningsgennemgang-audit/STATUS.md` (ST),
`docs/testing/testdaekningsgennemgang-audit/AFVENTER-BESLUTNINGER.md` (AB). Alle tre er læst hele vejen igennem.
TDG og ST er læst i parallelle bidder. Langt det meste er logs fra batches og releasegates uden varigt indhold.

På hovedlisten står kun punkter, der mangler eller er ufuldstændige i `src/contracts/`, `docs/architecture/`,
`docs/domain/`, `AGENTS.md` og `src/__tests__/AGENTS.md`. Allerede dækkede punkter står samlet til sidst.

E2E-filerne `td-NNN-*` er allerede omdøbt (fx `e2e/kontrolfaner-toggle-browsergren.spec.ts`,
`e2e/file-load-preflight-report.spec.ts`, `e2e/renteberegning-dokumentafrunding.spec.ts`), så den del udgår.

**Varsel om `docs/aabne-beslutninger-og-daekningshuller.md`:** memory henviser til filen, men den findes ikke i repoet.
Åbne punkter (C) foreslås derfor placeret i den ejende kontrakt eller i `docs/oprydning-1.0.md` §4.

## A. Udviklerens afgørelser (UI/UX og beregning)

**A1. Afrundede værdier summeres.** Overalt (skærm, PDF og Word) gælder: et beløb, der vises afrundet, indgår med den
viste værdi i efterfølgende totaler. Den eneste undtagelse er KL-lønaftalernes trinvist afrundede, regulerede løn,
så fx 20.000 kr. ender præcist på den trinvist beregnede 21.000 kr.
- Kilde: AB:237–247, :300; TDG:119, :693, :848.
- Status: UFULDSTÆNDIG. `document-output-contract.md:566` dækker kun dokumenttotaler; skærmen og undtagelsen mangler.
  `docs/domain/renteberegning/renter.md:90` («Samlet rente afrundes til 2 decimaler») er tvetydig og ender i
  modstrid med reglen. Reglen står kun som kodekommentar i `renteberegningEngine.ts:36-38` og i
  `e2e/renteberegning-dokumentafrunding.spec.ts`.
- Hjem: `src/contracts/document-output-contract.md` ved :566, udvidet til at gælde skærmen og med undtagelsen nævnt.
  Ret `renter.md:90` til «total = sum af afrundede periodebeløb».

**A2. Interne udviklingsfiler.** `.eo`-filer fra interne udviklingsudgaver er ikke omfattet af kompatibilitetsforpligtelsen.
Der indføres ingen særlig indlæsning af deres struktur, og en preflight-advarsel for sådan en fil er accepteret.
- Kilde: AB:41, :292; ST:14, :26; TDG:805, :5934.
- Status: UFULDSTÆNDIG. `persistence-contract.md:26` siger «tidligere udgivet» uden at nævne interne udgaver.
- Hjem: `src/contracts/persistence-contract.md` §indledning (:26–40), med en henvisning fra `schema-evolution.md` (~:409).

**A3. Fejl med samme årsag samles.** Skyldes flere fejl i samme situation grundlæggende det samme problem (fx samme
manglende reguleringssats), vises de som én samlet fejlbesked. Fejl med forskellig årsag vises særskilt.
- Kilde: AB:283, :299.
- Status: MANGLER (findes kun i kode/test).
- Hjem: `src/contracts/error-contract.md`, nyt afsnit «Sammenlægning af issues».

**A4. Identiske issues dedupliceres.** EO-validatoren dedupliserer issues med samme `path`, besked og severity til ét råt
issue. Forskellige årsager bevares. (EET dedupliserer på `severity + message`, `fejlkatalog.md:540`.)
- Kilde: AB:356–358; TDG:5948.
- Status: MANGLER (kun kodekommentar i `erstatningsopgoerelseValidator.ts:1353`).
- Hjem: samme nye afsnit i `src/contracts/error-contract.md`.

**A5. Ugyldige datoer.** En ugyldig dato afvises altid med den sædvanlige brugerfeedback: rød ring og tooltip på det felt,
der har udløst fejlen, og en post i «Fejl og advarsler» med link til feltet. Når en ugyldig dato alligevel når
beregningen, gælder: den kanoniske `utcDayMath`-grænse afviser ugyldige `Date`-instanser straks, i stedet for at
returnere `NaN`.
- Kilde: AB:113, :294; TDG:115, :807.
- Status: MANGLER (kun `src/utils/utcDayMath.ts:9`).
- Hjem: `src/contracts/date-contract.md`, afsnittet om dagtælling.

**A6. Fallback ved filvalg.** File System Access bruges kun, når begge pickerfunktioner faktisk kan kaldes; ellers bruges
den almindelige filvælger både ved Gem og Hent. En fejl i filvælgeren ved Gem må aldrig koste brugeren
indtastninger. Den ordinære Gem/Hent prioriteres, så fallback helst aldrig bliver relevant.
- Kilde: AB:132, :295; TDG:114, :221.
- Status: UFULDSTÆNDIG (`app-settings.md:125` dækker kun `showDirectoryPicker`).
- Hjem: `src/contracts/persistence-contract.md`, afsnittet om filkilde og filmål.

**A7. Fjernet Windows-filtilknytning.** Har brugeren fjernet Mineo som standardprogram for `.eo` i Windows, kan Mineo ikke
selv komme tilbage på Windows' forslagsliste. Det er en accepteret Windows-begrænsning, som ikke omgås. Dobbeltklik
på `.eo` i den installerede app virker.
- Kilde: AB:155–164, :296.
- Status: MANGLER (`app-shell-contract.md` beskriver kun launchQueue-flowet).
- Hjem: `src/contracts/app-shell-contract.md`, afsnittet om PWA-filåbning.

**A8. Luk i fejlrapportens preview.** Når brugeren vælger «Luk» i previewet efter «Send fejloplysninger», lukkes både
previewet og den underliggende preflight-dialog. Det er tilsigtet.
- Kilde: AB:318–320.
- Status: kun i test: `e2e/file-load-preflight-report.spec.ts` (`persistence-contract.md:351–359` nævner det ikke).
- Hjem: `src/contracts/persistence-contract.md` §7 ved preflight-valgene.

**A9. Fejlbeskeder ved Hent.** En ugyldig filtype ved Hent giver «Valgt fil er ikke en .eo fil» og ændrer hverken sag,
journalnr. eller URL. En flyttet eller slettet PWA-fil (eller en fil uden adgang) giver en handlingsanvisende
besked («… Vælg filen igen via Hent») uden læseforsøg.
- Kilde: TDG:3619, :3658, :3677, :1032–1041; ST:723, :1503.
- Status: UFULDSTÆNDIG. Annulleret Gem/Hent og «Stop og gør intet» er dækket i `persistence-contract.md` §5–§7.
  Filtypefejlen og beskeden ved flyttet fil står kun i kode/test (`fileLoadSource.ts`, `fileSystemAccess.ts:50`,
  `e2e/file-load-invalid-preserves-case.spec.ts`).
- Hjem: `src/contracts/persistence-contract.md` §6, nyt punkt om load-fejl.

**A10. Kontrolfaner slået fra.** Slås «Vis kontrolfaner» fra, mens en EO-kontrolfane er aktiv, skifter visningen til
fanen «EO-oplysninger».
- Kilde: TDG:903, :3438.
- Status: kun i test: `e2e/kontrolfaner-toggle-browsergren.spec.ts`.
- Hjem: `src/contracts/eo-snapshot-contract.md` §5 ved kontrolfanerne (:533) eller `app-shell-contract.md` :164–185.

**A11. Standard for «Fuld løn under ferie».** Indstillingen `defaultFuldLoenUnderFerie` er som standard `false`, så nye
sager og rækker får «Fuld løn under ferie» = Nej.
- Kilde: TDG:1304, :1826.
- Status: kun i test: `src/__tests__/quality/newCaseSettingsDefaults.test.ts`, `erstatningsopgoerelseInitialValues.test.ts`.
- Hjem: `src/contracts/app-settings.md`, afsnittet om sags-defaults.

**A12. Rækker i Øvrige krav.** «Udgift til» og «Beløb» er påkrævede, mens datoen er valgfri. Uden dato skrives rækken uden
datopræfiks. En dato uden for «Vedrører perioden» giver kun en gul advarsel og må aldrig blokere.
- Kilde: TDG:1272.
- Status: kun i kode/test (`oevrigeKravRowValidation.ts:13,47–49`, `oevrigeKravRowValidation.test.ts`).
- Hjem: `src/contracts/input-field-behavior-contract.md`, nyt underafsnit om tabellen Øvrige krav.

**A13. TAF-ydelsesforbeholdet.** Forbeholdet vises, når kontanthjælp og/eller ressourceforløbsydelse indgår i
TAF-periodens indtægter. Teksten bøjes i ental eller flertal efter antallet af ydelser.
- Kilde: TDG:1263, :1265.
- Status: kun i test: `tafForbehold.test.ts`.
- Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md`, afsnittet om TAF-indtægter (~:124).

**A14. Tidligere svie/smerte over maksimum.** Overstiger den tidligere opgjorte svie/smerte maksimum, vises en advarsel,
men beregningen blokeres ikke, fordi beløbet kan være korrekt. Beløbet sammenlignes med det forligsreducerede
maksimum. Der gives ingen advarsel ved præcis lig maksimum, i satsår uden maksimum eller når beløbsfeltet er skjult.
- Kilde: ST:2877–2881.
- Status: kun i test: `src/__tests__/domain/eoRowEvaluation/eoRowSvieSmerteTidligereTotalWarning.test.ts`.
- Hjem: `src/contracts/eo-snapshot-contract.md` §16 (svie/smerte-satsår).

**A15. Gaten for SH-dage-dokumentet.** Dokumentet blokeres kun af de felter, det selv bruger: periodecellerne og
«Løn på helligdage». Et gyldigt input med 0 SH-dage blokerer (`sh-zero`), fordi dokumentet ellers ville være tomt.
Det samme gør et antal, der ikke kan beregnes (`sh-no-count`). Identiske lønrækker er en gul advarsel.
- Kilde: TDG:1178–1188, :4586, :4674.
- Status: MANGLER (kun kodekommentar i `aarsloenDownloadGate.ts:161–191`).
- Hjem: `src/contracts/aarsloen-contract.md` §2, ny regel.

**A16. ASL-fejl og EAL.** Fejl i ASL-årsløn (`field-aarsloen-asl`) og i ASL-afgørelser (`field-asl-afgoerelser`) blokerer kun
EAL, når den tilsvarende EAL-primærværdi mangler, dvs. når fallback faktisk bruges.
- Kilde: TDG:1216, :5766.
- Status: UFULDSTÆNDIG. Fallback er beskrevet i `eal-beregning.md:236–238`, men `fejlkatalog.md:420–421` angiver
  afhængigheden uden betingelse.
- Hjem: `docs/domain/eet/fejlkatalog.md`, tabellen «Felt-fejl».

**A17. Mer-erstatning ved 0 % kapitalisering.** Er kapitaliseringen 0 %, gives ingen mer-erstatning og ingen issues.
En forskel i kapitalværdi på 0 eller derunder udelades stille.
- Kilde: TDG:4421.
- Status: MANGLER for 0 %-delen.
- Hjem: `docs/domain/eet/mer-erstatning-pensionsalder.md`, afsnittet «Hvornår udløses mer-erstatning?».

**A18. Lønudvikling efter overenskomst.** Følgende skal være ens for alle aktive ansættelsesforhold: overenskomst, løn på
helligdage, det effektive valg af Store Bededagstillæg, felterne for anciennitetstillæg og de offentlige løndata.
Det gælder også feriepct, når lønnen ikke er angivet og flere ansættelser har synlige satser. Skjulte værdier
sammenlignes ikke. En forskel er en validatorfejl; motoren kaster kun som invariant.
- Kilde: TDG:1401.
- Status: MANGLER (kun `overenskomstForm.ts:44–78`).
- Hjem: `src/contracts/eo-snapshot-contract.md`, afsnittet om regulering og lønudvikling (~:877).

**A19. Statistikregulering før basisdatoen.** Segmenter før den effektive basisdato giver ingen ændring (zero-delta).
Indekset anvendes først fra basisankeret.
- Kilde: TDG:1398.
- Status: UFULDSTÆNDIG (`eo-snapshot-contract.md:877–886` dækker kun manuelle rækker).
- Hjem: samme afsnit.

**A20. Reguleringsforløb med flere kilder.** En ansættelse i en sag med flere kilder arver aldrig det globale
reguleringsforløb, når der ikke er et match. Det globale forløb bruges kun som fallback, når listen pr. ansættelse
er tom (én kilde).
- Kilde: TDG:1252.
- Status: MANGLER (kun kodekommentar i `reguleringForloeb.ts:24–30`).
- Hjem: `src/contracts/eo-snapshot-contract.md`, reguleringsafsnittet.

**A21. Midlertidigt EET i TAF-indtægter.** Beløbet afrundes til hele kroner, mens øvrige ydelser og manuelle rækker
afrundes til 2 decimaler. Fradraget hentes fra bilagets afrunding pr. periode og aldrig fra en afrundet totalsum.
- Kilde: TDG:1292.
- Status: UFULDSTÆNDIG. Bilagskilden er dækket i `eo-snapshot-contract.md:716–721`; hele-krone-reglen står kun i
  `indtaegtPerioder.ts:188–207`.
- Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md`, afsnittet om TAF-indtægter.

**A22. Negative beløbsudtryk.** Et negativt resultat af et beløbsudtryk afvises i et felt, der forbyder negative beløb,
præcis som et negativt tal. Udtryk må ikke være en vej uden om fortegnsreglen.
- Kilde: TDG:1373.
- Status: UFULDSTÆNDIG (`input-field-behavior-contract.md:365` nævner kun unært minus).
- Hjem: `src/contracts/input-field-behavior-contract.md` §2.2.

**A23. Linket fra Store Bededag-advarslen.** Advarslen fører i «Fejl og advarsler» til selve togglefeltet. At advarslen
ikke blokerer, er allerede dækket.
- Kilde: TDG:3480.
- Status: UFULDSTÆNDIG (`indskudte-loentillaeg-contract.md` §2a.5 nævner ikke linkmålet).
- Hjem: samme afsnit, én sætning.

**A24. EO-rækkeregler.**
- Manglende øvrige fraværsdage vises som «-» i beregningsgrundlaget, mens tabelgrundlaget bevares.
- To beløbsfri dagpengeperioder samles i én advarselsrække.
- Der dannes ingen offentlig løndag før første gældende regulering.
- Der dannes ingen svie/smerte-satsdag uden valgt satsår.
- Kilde: ST:693–695, :727–728, :742–745.
- Status: UFULDSTÆNDIG. Fraværsdagene er delvist dækket i `periodisering-contract.md:179`; resten står kun i test
  (`eoRowIndkomstModelIndependent.test.ts`, `eoInspektionLoenCoreModel*Independent.test.ts`).
- Hjem: `docs/architecture/eo-row-evaluation-architecture.md` eller `eo-snapshot-contract.md`.

**A25. Ingen manuel kontrol.** Udvikleren vil ikke være afhængig af manuel kontrol: så meget som muligt kontrolleres
automatisk, også release og deploy. Manuel kontrol bruges kun til helt specifikke enkeltdele og kun med nøjagtige
anvisninger om, hvad der skal fremprovokeres, og hvordan.
- Kilde: AB:188, :213, :297–298.
- Status: MANGLER.
- Hjem: `AGENTS.md` §Browser-testadgang (eller §Kvalitet), som et princip.

## B. Varige regler (testmetodik og udviklingspraksis)

**B1. Opsætning af mutationstest.** Stryker kører med core command-runneren, en eksplicit Vitest-kommando,
`coverageAnalysis: off`, én worker og modulvis mutation (`npm run test:mutation`).
- `@stryker-mutator/vitest-runner` er fravalgt: dens dry-run var grøn, men den dræbte 0 af 58 åbenlyse mutanter.
  Valget revurderes ved en ny Stryker/Vitest-kombination.
- En runner er først kvalificeret, når en bevidst svækket test giver overlevende mutanter.
- Store motorer (EET, over 20 min) muteres i udsnit.
- Kilde: TDG:722–729, :806, :3460; ST:70–89, :1273.
- Status: MANGLER (kun `stryker.config.json` og `strykerCommandRunnerConfig.test.ts`).
- Hjem: `src/__tests__/AGENTS.md`, nyt afsnit «Mutationstest».

**B2. Triage af overlevende mutanter.** Hver overlever får en konkret afgørelse: manglende test, ækvivalent, utilgængelig
vej, runnerfejl eller bevidst undtagelse.
- Ækvivalens kræver en algebraisk, type- eller kontraktmæssig begrundelse for, at intet repræsentabelt input kan
  skelne mutanten fra originalen.
- Timeout og compiler- eller runnerfejl tæller ikke som dræbt.
- Der skrives ingen produktionskode alene for mutatorens skyld, og der sættes ingen global score uden analyse.
- Kilde: TDG:760–771; ST:1800.
- Status: MANGLER.
- Hjem: samme afsnit.

**B3. Prioritering af mutationstest.** Ren, trust-kritisk TypeScript muteres først: engines, afrunding, dato og satser,
derefter schemas og validatorer, så persistens. React-komponenter muteres kun selektivt og med begrundelse.
- Kilde: TDG:736–746.
- Status: MANGLER.
- Hjem: samme afsnit.

**B4. Hvornår en test er bevis.**
- En test tæller kun, hvis den bliver rød ved mindst én realistisk fejl.
- Fixturen skal kunne skelne reglen fra nærliggende forkerte regler.
- Testen skal ligge på det rette niveau: unit, integration, E2E eller statisk værn.
- Ved risiko for falsk positiv kræves en negativ assertion eller en kontrolgruppe.
- Der bruges ingen betingede assertions (`if (blocked) expect(...)`).
- Kilde: TDG:73–85, :530–537, :1188.
- Status: UFULDSTÆNDIG (`src/__tests__/AGENTS.md` §2.5.2 har det kun for guards).
- Hjem: `src/__tests__/AGENTS.md` §6 og §8.

**B5. Uafhængigt facit.**
- Facit og fixtures skrives i hånden og typet.
- De genbruger aldrig produktionens helpers, defaults (`create*InitialValues`, schema-defaults), satstabeller eller maps.
- Validatortests hævder præcis feltsti, besked og severity.
- Synlighed bevises med `toBeVisible()`.
- Floating point kontrolleres med en snæver, eksplicit tolerance.
- Et transformationsfacit beviser ikke kildens proveniens, og et data-fingerprint viser kun ændring fra baseline,
  ikke korrekthed.
- Kilde: TDG:271–304, :791–795, :824–825, :877–885, :1144–1149; ST:1170, :1315, :1377.
- Status: UFULDSTÆNDIG (§2.1 og §4 kræver kun konkrete tal og fejlstruktur).
- Hjem: `src/__tests__/AGENTS.md` §2.1, §4 og §6. Bemærkningen om fingerprint hører også til i
  `calculation-data-contract.md`.

**B6. Gendan delte data.** En test, der midlertidigt ændrer delte satstabeller, bekendtgørelsestabeller eller katalogdata
for at nå en fail-closed-gren, gendanner dem i `finally`.
- Kilde: TDG:1164–1206; ST:3837, :3887.
- Status: MANGLER (§6 siger kun «ikke dele mutable state»).
- Hjem: `src/__tests__/AGENTS.md` §6.

**B7. Coverage.**
- V8-coverage måler kun `src/domain`, `utils`, `hooks`, `rowDrafts` og `contexts` (`vite.config.ts:171`). Øvrige
  mapper dækkes på andre testniveauer.
- Tests under `src/__tests__/components/` tæller ikke med i domænets aggregat.
- Tærskler ændres aldrig for at få gaten grøn.
- En uopnåelig defensiv gren er et designspørgsmål og tvinges ikke dækket.
- Er en reservegren maskeret af en gate højere oppe, testes den synlige gate.
- Kilde: TDG:87–90, :694–700, :1298, :1697, :4194, :4538; ST:67.
- Status: UFULDSTÆNDIG (§1 siger kun «Coverage-procent er irrelevant»).
- Hjem: `src/__tests__/AGENTS.md` §1 eller §9.

**B8. DEV og produktion.** Moduler, der kaster under `import.meta.env.DEV` men falder tilbage i produktion, testes i begge
tilstande.
- Kilde: TDG:1763–1767, :2187, :2284.
- Status: MANGLER.
- Hjem: `src/__tests__/AGENTS.md` §2.3 eller §8.

**B9. Platformscases holdes adskilt.** Cases for IndexedDB og File API ligger adskilt fra hook- og orkestreringstests,
så mocks ikke bliver falsk platformsbevis.
- Kilde: TDG:217.
- Status: UFULDSTÆNDIG (§5).
- Hjem: `src/__tests__/AGENTS.md` §5.

**B10. Arkitekturværn.**
- Værnene fanger alle importformer: default, namespace, side-effect, `require`, `import =`, dynamisk `import()` og
  wildcard-re-export.
- Rå storage-adgang fanges også i bracket-form (`globalThis["localStorage"]`).
- Registret over regler har en separat forventningsliste over regel-ID'er og en AST-søgning efter regler, der ikke er
  registreret.
- Ved liveness gælder: et bart testfilnavn holder ikke en produktionsreference i live, og symboler i kommentarer eller
  strenge tæller ikke.
- Kilde: TDG:465–486, :2864–2890, :3313, :3576, :4057; ST:2006–2343.
- Status: UFULDSTÆNDIG (§2.5.2 nævner kun alias-import).
- Hjem: `src/__tests__/AGENTS.md` §2.5.1–2.5.2. Liveness-delen hører også til i
  `docs/architecture/contract-topology-procedure.md`.

**B11. PDF/Word-paritet.**
- Paritet mellem PDF og Word er et værn mod drift mellem kanalerne, ikke et domænefacit.
- Paritet sammenlignes på hele den normaliserede tekstsekvens.
- Normaliseringen må kun fjerne footeren (også midt i sekvensen ved sideskift), XML-entiteter og dokumenterede
  tabelmellemrum.
- PDF-kontrollen kræver header og `%%EOF` og springer billedstreams over.
- Skærm, beregning og dokument sammenlignes i en case, hvor forskellige inputvalg giver synligt forskellige tal.
- Kilde: TDG:421, :594, :1142, :4246; ST:1112–1163.
- Status: UFULDSTÆNDIG (`document-output-contract.md:671`, §C2 nævner paritet uden normaliseringsreglen).
- Hjem: `src/contracts/document-output-contract.md` §C2.

**B12. Nye dokumentoutputs.** Et nyt dokumentoutput registreres i `documentDefinitionFixtureRegistry.test.ts`, og en ny
lifecycle-fase registreres i `documentLifecycleMatrix.test.ts`.
- Kilde: TDG:819–820.
- Status: UFULDSTÆNDIG (`document-output-contract.md:662` nævner kun matricen).
- Hjem: samme kontrakt, i testafsnittet.

**B13. Historiske `.eo`-fixtures.** Persistens testes mod historiske fixtures. Fixturerne i
`src/__tests__/fixtures/persistence/` er rekonstruerede og SHA-256-låste, men beviser ikke, hvad en udgivet version
faktisk gemte.
- Kilde: TDG:201, :794, :5929.
- Status: UFULDSTÆNDIG (`schema-evolution.md:322,409` kræver fixtures uden at gøre denne skelnen).
- Hjem: `src/contracts/schema-evolution.md` ved :409.

**B14. Releasekæden i CI.**
- E2E i CI kører mod præcis det uploadede og verificerede produktionsartefakt, som deployes; der bygges ikke et
  separat `--mode e2e`.
- Preview-smoke kører mod det eksakte build.
- Matrixen omfatter alle lane-projekter og de dedikerede browserprojekter.
- Deploy blokeres automatisk.
- Kilde: TDG:810; AB:298.
- Status: kun i test: `githubActionsRuntimeCheck.test.ts`, `githubActionsLaneMatrixLiveness.test.ts`.
- Hjem: `AGENTS.md` §Browser-testadgang (eller et release-/CI-afsnit).

**B15. Release- og CI-værn.**
- Buildverifikationen afviser en `index.html`, der peger på `/src/`.
- Wranglers `assets.directory` er lig Vites `outDir` for begge builds.
- Hver ekstern `uses:` har `@version`.
- CI kører ved `pull_request` og ved push til `main`.
- `test:e2e` kører preflight, så portoprydning, så Playwright.
- Kilde: TDG:1099–1123.
- Status: kun i test.
- Hjem: samme sted som B14.

**B16. E2E-konventioner.** `openPage` og `login` skal awaites. Den transiente blinkklasse hævdes ikke med
`toHaveClass`; observationen noteres, mens klassen står, og hævdes bagefter.
- Kilde: TDG:829, :985–1014, :3485.
- Status: UFULDSTÆNDIG. `AGENTS.md:55–60` siger «alle fem», men lister kun fire; reglerne håndhæves i
  `e2eSuiteConventions.test.ts` og `e2e*AwaitGuard.test.ts`.
- Hjem: `AGENTS.md` §Browser-testadgang (:55–60).

**B17. Grænser for browsertest.**
- OS-filaflevering til en installeret PWA (`launchQueue`) kan ikke fremkaldes i Playwright.
- Den native LaunchQueue-måling er Chromium-specifik, så skips i Firefox og WebKit er forventede.
- Filvælgeren har et dedikeret Firefox-projekt.
- En virtuel filvælger-fixture skal have et `.eo`-navn og samme bytes som den rigtige fil.
- Kilde: TDG:832; ST:1098–1100, :1192, :1496.
- Status: MANGLER (`AGENTS.md:61` nævner kun bfcache).
- Hjem: `AGENTS.md` §Browser-testadgang.

**B18. Støj fra `playwright-cli`.** På Windows afslutter `playwright-cli` med en `uv_async`-assertion og en
versionsadvarsel. Det er værktøjsstøj; bindende browserbevis er alene `npm run test:e2e`. Den bundlede
playwright-cli-skill installeres ikke uændret, fordi den erstatter projektets en-dash med em-dash i tracked
skillfiler.
- Kilde: TDG:915; ST:1829.
- Status: UFULDSTÆNDIG (`AGENTS.md:42–44`).
- Hjem: `AGENTS.md` §Browser-testadgang.

**B19. Vedligeholdelse af testdækningen.**
- Nye features, beregningsregler, persisterede felter og brugerrejser lander kun med en testplan.
- Ændrede kritiske, rene moduler får selektiv mutationstest.
- Der laves en fuld gennemgang efter en væsentlig arkitekturændring, en ny persistensversion, en ny
  beregningsfamilie eller en opgradering af browser eller toolchain.
- Slipper en regression forbi et værn, styrkes værnet.
- Kilde: TDG:6066–6075.
- Status: MANGLER.
- Hjem: `src/__tests__/AGENTS.md`, nyt afsnit «Vedligeholdelse».

**B20. Klient-id og logger.**
- Hver fane får sit eget klient-id. Mangler `crypto.randomUUID`, bruges et `client-*`-id. Fejler skrivningen til
  sessionStorage, beholdes et stabilt id i hukommelsen. En ugyldig gemt værdi erstattes.
- Loggeren hasher filnavne. En fejl i logpersistensen bliver aldrig til en runtimefejl. Loggen rummer højst 1.000
  poster (FIFO) med 30 dages levetid.
- Kilde: TDG:1058–1066, :1236.
- Status: UFULDSTÆNDIG (`persistence-contract.md:254,297`; `error-contract.md:357`; tallene står kun i
  `logStorage.ts:8–9`).
- Hjem: `src/contracts/persistence-contract.md` (klient-id) og `src/contracts/error-contract.md` (logger).

**B21. File System Access-skrivning.** Efter en fejlet write kaldes `close()` ikke. Fejler `close()` efter en vellykket
write, er resultatet en fejl, ikke en succes. Ved afvist adgang kaldes `getFile()` ikke.
- Kilde: TDG:1081–1083.
- Status: MANGLER.
- Hjem: `src/contracts/persistence-contract.md`, afsnittet om load- og save-porte.

**B22. Standardmappens handle og metadata.** Handle og metadata skrives og slettes atomisk; afbrydes transaktionen,
bevares begge.
- Kilde: TDG:1072–1078.
- Status: MODSTRID. `app-settings.md:138–139` siger, at de «ligger i hvert sit lager og kan ryddes uafhængigt».
  Skal afstemmes mod koden i fase 2.
- Hjem: `src/contracts/app-settings.md` :138.

**B23. Issue-input til EO-rækkebuilders.** Rækkebuilders får en afgrænset issue-projektion pr. ansættelsesforhold, aldrig
hele `eoErrors.all`.
- Kilde: TDG:1145.
- Status: kun i regelmanifestet `src/__tests__/quality/architecture/rules/inputBoundaryRules.ts`.
- Hjem: `docs/architecture/eo-row-evaluation-architecture.md`, afsnittet om builder-input.

**B24. Aktive overrides.** De aktive `overrides` i `package.json` (`qs`, `minimatch`) er manuelle afvigelser og fjernes,
når forældrepakkens range tillader den rettede version. `qs` overstyres, fordi `typed-rest-client@2.3.1` (via
Stryker) låser 6.15.1.
- Kilde: TDG:808, :2758; ST:90.
- Status: UFULDSTÆNDIG. Den generelle regel står i `AGENTS.md:112`; begrundelsen pr. post står kun i procesdokumentet
  `docs/dependency-update-2026-11-07.md`.
- Hjem: `AGENTS.md` §Afhængigheder, med en kort liste over overrides og betingelse for fjernelse.

**B25. Kendte, ikke-blokerende Vite-advarsler.** Advarslerne om `configLoader: 'native'` og om chunks over 750 kB er
kendte og blokerer ikke.
- Kilde: ST:73, :351.
- Status: MANGLER (lav værdi).
- Hjem: `AGENTS.md`, afsnittet om gates (én linje).

## C. Åbne punkter (efterprøvet mod kode)

**C1. Sygedagpengesats 2005.** Produktdata angiver 88,51 kr./time (`src/data/sygedagpengeRates.ts:74`), mens den officielle
kilde (retsinformation `eli/mt/2004/102`) angiver 88,30. Det er en beregningsafgørelse og skal forelægges.
- Kilde: TDG:271, :2765; ST:104, :442.
- Hjem: `docs/oprydning-1.0.md` §4.

**C2. Differencekrav uden 2024-reguleringssats.** `round2(NaN)` giver 0 (`src/utils/rounding.ts:96`), før `Number.isFinite`
tjekkes. Derfor kan den lokale blokering i `eetDifferencekravCalculation.ts:447–452` aldrig udløses. I dag blokerer
gaten alligevel via løbende ydelser. Punktet blev forelagt, men der er ingen registreret afgørelse.
- Kilde: TDG:1172, :1210; ST:2485, :3878.
- Hjem: `docs/oprydning-1.0.md` §4.

**C3. Proveniens for satser og tabeller.**
- KL/RLTN-satserne har kun lokale Excel-kilder uden udgiverlinks.
- Kapitaliseringstabeller før 2025 har ikke et autoritativt facit (2025/2026 tabel A/B har).
- Oprindelsen af KRL-kataloget og RLTN- og Læreroverenskomst-facitterne er ubekræftet.
- Kilde: TDG:275, :674, :2747, :2764; ST:425, :3606.
- Hjem: `src/contracts/calculation-data-contract.md`, nyt afsnit «Proveniens».

**C4. Ingen arkiverede `.eo`-filer fra udgivelser.** Repoet har kun rekonstruerede fixtures og ingen release-tags.
- Kilde: TDG:201, :805, :5929; ST:3910.
- Hjem: `src/contracts/schema-evolution.md` (sammen med B13).

**C5. Fysisk dokumentkontrol mangler.** Rendering, klipning, sideskift og sidehoved/-fod i PDF og Word testes ikke
automatisk; miljøet mangler renderer (LibreOffice/pdf2image), og der er ingen parserafhængighed. Det er åbent, om
generel semantisk paritet skal omfatte alle katalogoutputs, og en ny dependency skal begrundes særskilt. Den fulde
EET-kæde engine → snapshot → UI → dokument er heller ikke dækket for alle kombinationer.
- Kilde: TDG:421, :821–823, :2746, :3354; ST:3909.
- Hjem: `docs/architecture/document-output-architecture.md`, testafsnittet (~:152).

**C6. Ikke-forklaret flakiness.** `Loenindkomst.nestedLoentabel.integration.test.tsx` timede ud under parallel belastning
med en `act`-fejl fra Tooltip. Én parallel 2020 → Word-download gav `document:download_failure`. Begge er grønne
serielt, og årsagen er ukendt.
- Kilde: TDG:830, :2753, :3389; ST:432, :1258, :1714, :3902.
- Hjem: `src/__tests__/AGENTS.md`, under kendte forhold, eller udviklerens accept af restrisiko i
  `docs/oprydning-1.0.md` §4.

**C7. Smalle coverage- og mutationsgrænser.**
- Coverage instrumenterer ikke `inputCore`, `persistence`, `document`, `pdf`, `docx`, `schemas`, `validators`, `data`
  og `components`.
- Mutation omfatter kun `money.ts` (`stryker.config.json`) og kører ikke i CI.
- EET har ingen afsluttet mutationsscore.
- Kilde: TDG:391, :694, :723; ST:86.
- Hjem: `src/__tests__/AGENTS.md`, afsnittet om coverage og mutationstest (sammen med B1/B7).

**C8. Platformsbevis.**
- Den samlede kæde IndexedDB → hook → browser er ikke bevist i ét forløb.
- Recovery ved manglende lazy chunk er kun bevist med jsdom og mocks.
- Native `launchQueue`-filaflevering kontrolleres kun manuelt.
- Kilde: TDG:114, :221, :827; ST:424, :1008.
- Hjem: `src/contracts/app-shell-contract.md` (PWA) og `persistence-contract.md`.

**C9. Øvrige dækningshuller.**
- Validatorfixtures genbruger stadig delvist produktionsdefaults.
- Fallbackgrenen `LoenudviklingKildeError` og fallbackteksten for fødselsdato i EET-importen er ikke dækket.
- `reguleringsPresentation.ts` har lav branch-dækning (ca. 68 %).
- DATE-001 mangler en uafhængig håndregning.
- Kilde: TDG:824, :1140, :1192; ST:3283, :3910.
- Hjem: `src/__tests__/AGENTS.md`, kendte huller, eller udelad. Lav prioritet; vurdér i fase 3.

**Forældede passager, der ikke skal udtrækkes:**
- TDG:122/:784 og ST:1016 kalder TD-016 åben; den er afgjort (`periodisering-contract.md` §3A).
- TDG:4587/:4664 siger, at rød ferieprocent og identiske lønrækker blokerer SH-dokumentet; koden siger noget andet.
- TDG:750 kalder `fromKroner`-grænsen åben; den er triageret som ækvivalent.

## Allerede dækket (udeladt fra hovedlisten)

| Regel | Dækket i |
|---|---|
| Weekend- og ferieydelse medregnes via fald-tilbage; kontroltabellen bruger samme dage | `periodisering-contract.md` §3A (:114) |
| Totalen i dokumenter summerer afrundede rækkeværdier | `document-output-contract.md:566` |
| Annulleret Gem/Hent og «Stop og gør intet» ændrer intet | `persistence-contract.md` §5–§7 |
| Lazy-chunk-recovery vises synligt og genindlæser ikke automatisk | `app-shell-contract.md:19,65,250` |
| Mobil-hard-stop og standalone-isolation | `app-shell-contract.md:43–47` |
| Manifestet i standalone-buildet verificeres | `scripts/verify-build-artifacts.mjs` + test (kode/test er ejer) |
| Flade PWA-asset-stier; kun faktiske, ikke-tomme assets | `verify-build-artifacts.mjs:120–123`, `app-shell-contract.md:61` |
| Forlig på 100 % er en no-op | `eet-snapshot-contract.md:175`, `differencekrav.md:236` |
| `no-endelig-afgoerelser` filtreres fra på F5 | `fejlkatalog.md:26` |
| Ikke-endelig afgørelse efter endelig giver advarsel | `domain-boundary-contract.md:119`, `fejlkatalog.md:462` |
| Kapitalisering under 15 % giver advarsel; køn kræves før 1. marts 2015 | `fejlkatalog.md:238,502`, `kapitaliseret-eet.md:88` |
| Femårsgrænsen ved erhvervssygdom regnes fra anmeldelsesdatoen | `eo-snapshot-contract.md:142,896` |
| TAF-række uden arbejdsdage giver gul advarsel | `tabt-arbejdsfortjeneste.md:59` |
| TAF pr. år: afvigelse over 1 kr. er fail-closed | `eo-snapshot-contract.md:589–591` |
| Ydelsesfordeling på arbejdsdage eller kalenderdage | `tabt-arbejdsfortjeneste.md:135` |
| Store Bededag-advarslen blokerer ikke | `indskudte-loentillaeg-contract.md` §2a.5 |
| Forlig angivet både som procent og brøk giver to røde fejl | `input-field-behavior-contract.md` §4.11 |
| `Løn`/`Løn (2)` summeres; opdelingen er visuel | `form-contract.md:395` |
| Stamdata blokerer kun ved aktivt brevhoved | `document-output-contract.md:122` |
| Gamle labels for ydelsestype indlæses | `eo-snapshot-contract.md:482` |
| Ét svie/smerte-overlap afvises | `eo-snapshot-contract.md:220` |
| `null` → `undefined` før strip ved load | memory/migrator (kontrol i fase 2) |
| E2E-fixtures `runtimeErrors`/`externalRequests`; browserbegrænsning som rest-evidens | `AGENTS.md:49–61` |
| Kun systemgrænser mockes; observerbart resultat | `src/__tests__/AGENTS.md` §4–5 |
| Rene testændringer kræver ikke ny fuld E2E | `AGENTS.md:249` |
| En E2E-kørsel med død buildserver er ikke evidens | `AGENTS.md:53,62–63` |
| Visuel PDF/Word-kontrol er et residualkrav, ingen pixel-goldens | `document-output-contract.md` §C2.1 |
| Overrides fjernes, når forælderen tillader det (generelt) | `AGENTS.md:112` |
| Tokenizerbaseret lane-vagt; værnet mod bart basename | Værnene selv + `src/__tests__/AGENTS.md` §2.5 |

## Optælling

- Kandidater i alt efter sammenlægning af dubletter: 88.
- 29 var allerede dækket (tabellen ovenfor).
- Hovedlisten: **A 25, B 25, C 9**. Heraf 16 «kun i test/kode»: A4, A5, A8, A10–A15, A18, A20, A24, B1, B14, B15
  og B23.
- B22 er i modstrid med kontrakten og skal afstemmes.
- C1 og C2 skal forelægges udvikleren (beregning).
