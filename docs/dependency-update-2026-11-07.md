# Afhængigheder og værktøjer – 7. november 2026

## Beslutninger

Versioner er kontrolleret mod npm-registret og projekternes egne udgivelsesnoter.
Der bruges stabile udgivelser; agenternes Playwright-værktøjer beholder deres eget afhængighedstræ.

| Område | Før | Efter |
| --- | --- | --- |
| Node i CI | 24.18.0 | 26.13.0 LTS |
| npm, erklæret version | 11.16.0 | 12.2.2 |
| GitHub-runner | ubuntu-latest, under migration | ubuntu-26.04 |
| ESLint | 10.12.0 | 10.14.0 |
| Vitest og V8-coverage | 5.0.5 | 5.1.0 |
| Vite | 8.3.5 | 8.3.6 |
| Playwright E2E | 1.63.0 | 1.64.1 |
| jsdom | 30.0.1 | 30.1.3 |
| Stryker | 10.0.0 | 10.1.1 |
| MUI og ikoner | 9.4.0 | 9.5.0 |
| React og React DOM | 19.3.0 | 19.3.1 |
| React Router | 7.18.3 | 7.18.5 |
| Zustand | 5.0.15 | 5.1.0 |
| jsPDF AutoTable | 5.0.8 | 5.0.9 |
| Wrangler, låst version | 4.152.0 | 4.158.0 |
| Playwright CLI / MCP | 0.1.18 / 0.0.79 | 0.1.23 / 0.0.84 |

Desuden opdateres Node-typer til 26.6.6, typescript-eslint til 8.72.1,
React-lintplugin til 5.28.8, Vites React-plugin til 6.2.1, globals til 17.14.0
og Testing Library user-event til 14.6.8. Manifest og lockfiler angiver alle konkrete versioner.

Node 26.13.0 blev LTS 28. oktober og var allerede installeret lokalt.
GitHub flytter ubuntu-latest til Ubuntu 26.04 mellem 19. oktober og 19. november.
Den eksplicitte runner-version fjerner denne gradvise forskel mellem CI-kørsler.
Actions er allerede på aktuelle major-tags: checkout/setup-node/upload-artifact v7 og download-artifact v8.
Deres egen Node 24-runtime er uafhængig af den Node 26, setup-node installerer til Mineo.
Runtime-kontrollen og regressionstests afspejler nu denne forskel.

npm 12 blokerer afhængigheders install-scripts som udgangspunkt. Den eksisterende
versionsbundne allowlist videreføres med esbuild, workerd og core-js. SheetJS-tarballen
i rodmanifestet tillades med `allow-remote=root`.
CI installerer npm fra `packageManager` før `npm ci`, så den angivne npm-version faktisk anvendes.
I PowerShell skal videresendte scriptflag køres gennem `npm.cmd`, fordi PowerShell fjerner
`--` fra `npm.ps1`; npm 12 afviser så flagene som ukendte npm-indstillinger.
Dette er efterprøvet med begge launchere og dokumenteret i README. Bash/CI videresender separatoren korrekt.

Licensvinduets testvært lukker nu faktisk vinduet
ved `onClose`, ligesom appens vært gør, så historiknavigationen ikke udløser endnu
en lukning af et kunstigt åbent testvindue.
Produktkode og eksisterende facitter ændres ikke af disse testtilpasninger.

Konkrete fokushandlinger afventer nu også MUI-ripplens efterarbejde i async `act`.
Fem klik anvender den eksisterende fælles helper, som afventer save/load-handlingerne.
Den globale rAF-testscheduler og den fælles helpers implementering er uændrede.
Testenes fejlguard, animationer og timeout-grænser bevares.
Bekræftelsesdialogens Escape-test lukker også dialogen gennem en rigtig testvært.

Strykers genererede `.stryker-tmp`-kopier udelukkes fra Vitest og Git. Under en
samtidig mutationskørsel kunne Vitest ellers indsamle gamle kopier af de samme tests.

## Bevidst tilbageholdt

jsdom 31.0.0 er afprøvet, men dets nye selector-motor vurderer `:focus-visible`
som almindeligt `:focus`, uden den tidligere skelnen mellem mus og tastatur.
Det udløser blandt andet MUI-fokus/ripple-arbejde ved andre tidspunkter end før.
En målrettet A/B-prøve med seks filer og 52 tests gav ti ukontrollerede fejl med
jsdom 31 og ingen med 30.1.3, mens de øvrige nye pakker, inklusive MUI 9.5, var ens.
En separat prøve med MUI 9.4 og jsdom 31 gav også de samme ti fejl.
Derfor beholdes jsdom på den nyeste 30.x-udgave, 30.1.3, indtil fokusadfærden kan
verificeres korrekt. Globale schedulerforsøg og de nye CSS-assertions er ikke leveret.

TypeScript 7.0.2 er nyeste stabile udgivelse, men typescript-eslint 8.72.1 erklærer
kun støtte til `>=4.8.4 <6.1.0`. Mineos AST-kvalitetsværn bruger også compilerens API,
som ændres i TypeScript 7. Derfor beholdes 6.0.3, indtil både lint og compiler-API
kan opdateres samlet. Peer-kontrollen omgås ikke.

docx 9.15.3 er afprøvet, men beholdes på præcis 9.7.1. Tolv eksisterende Word-golden-tests
fejlede med den nye version. De fleste forskelle er eksplicit `w:val="clear"` ved
baggrundsfarver, men tabellen i »Løbende ydelser (EET)« ændrer også alle syv gridbredder
fra 100 til 1377. Det kan flytte kolonner og linjeombrydninger i brugerens Word-dokument
og kræver særskilt vurdering.
Snapshots er ikke opdateret for at acceptere ændringen. Den eksakte versionsbinding
forhindrer en senere almindelig `npm update` i at genindføre den uafklarede ændring.

Playwright 1.65.0 tilbageholdes på grund af en lokalt reproduceret regression i det
automatiserede filvalg. En minimal side med en knap, et skjult `<input type="file">`
og det [officielle FileChooser-mønster](https://playwright.dev/docs/api/class-filechooser)
er afprøvet uden Mineo:

- 1.65.0 med Firefox 159.0, revision 1572: `cancel` leveres med en tom filliste,
  før testen kalder `setFiles`; derefter leveres `change`.
- 1.64.1 med den tilhørende Firefox 157.0, revision 1555, i et separat midlertidigt
  afhængighedstræ: ingen event før `setFiles`, derefter kun `change` med den valgte fil.

Mineos oprydning afslutter korrekt et annulleret filvalg, så den efterfølgende kunstige
`change` ikke må genåbne det. Derfor bruges præcis 1.64.1, indtil det nye filvalg kan
verificeres. Produktets filindlæsning og den eksisterende Firefox-save/load-test ændres
ikke for at skjule driverens eventforskel. Der er ikke fundet en specifik offentlig
upstream-fejlrapport; regressionsvurderingen bygger på denne lokale A/B-prøve.

SheetJS beholdes på 0.20.3 fra den officielle CDN; det er fortsat den aktuelle udgave.
De øvrige uændrede direkte pakker er allerede aktuelle efter registry-kontrollen.
Cloudflares `compatibility_date` er en adfærdsaftale, ikke en pakkeversion, og ændres ikke
automatisk ved opdatering af deployværktøjet.

## Oprydning i versionsoverstyringer

Overstyringerne for sharp, Miniflares undici, flatted og DOMPurify fjernes, fordi
de opdaterede forældre allerede kræver eller tillader de rettede versioner.
Lockfilen beholder de sikre udgaver: sharp 0.35.5, undici 7.30.1,
flatted 3.4.4 og DOMPurify 3.4.17.

Minimatch-overstyringen beholdes og opdateres til 11.0.5, fordi forældrenes
10.x-intervaller fortsat udelukker den krævede 11.x-udgave. qs-overstyringen opdateres
til 6.17.1, fordi Strykers typed-rest-client 2.3.1 låser qs til 6.15.1.
Begge kan fjernes, når forældrenes krav inkluderer rettelserne.

Det oprindeligt installerede minimatch var 10.2.6 trods lockfilens 11.0.4.
Derfor geninstalleres hele projekttræet med `npm ci` før verifikation.

## Primære kilder

- [Node 26.13.0 LTS](https://nodejs.org/en/blog/release/v26.13.0)
- [GitHubs Ubuntu-migration](https://github.com/actions/runner-images/issues/14748)
- [Playwrights understøttede platforme](https://playwright.dev/docs/intro)
- [npm 12 og ændrede installationsregler](https://github.com/npm/cli/releases/tag/v12.0.0)
- [npm 12.2.2](https://github.com/npm/cli/releases/tag/v12.2.2)
- [TypeScript 7 og typescript-eslint](https://github.com/typescript-eslint/typescript-eslint/issues/12518)
- [jsdom 31](https://github.com/jsdom/jsdom/releases/tag/v31.0.0)
- [jsdom 31's fokusvurdering](https://github.com/jsdom/jsdom/blob/v31.0.0/lib/jsdom/living/css/match/selector.js)
- [jsdom 30.1.3](https://github.com/jsdom/jsdom/releases/tag/v30.1.3)
- [MUI 9.5](https://github.com/mui/material-ui/releases/tag/v9.5.0)
- [Vitest 5.1](https://github.com/vitest-dev/vitest/releases/tag/v5.1.0)
- [Playwright 1.65](https://github.com/microsoft/playwright/releases/tag/v1.65.0)
- [Zustand 5.1](https://github.com/pmndrs/zustand/releases/tag/v5.1.0)
- [docx-udgivelser](https://github.com/dolanmiu/docx/releases)
- [SheetJS-installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)

## Verifikation

Kontrollerne fra `verify:release:core` er gennemført i etaper. Den afsluttende kørsel
af alle fire typechecks, lint, coverage og begge builds sluttede med exitkode 0.

- Fuld Vitest med coverage: 1.041 filer og 11.148 tests bestået, ingen ukontrollerede fejl,
  213 sekunder. Coverage: statements 96,51 %, branches 90,76 %, functions 98,99 % og lines 98,06 %.
- Hele Playwright-banesuiten med 1.64.1: 328 bestået og to forventede skip for Chromiums
  LaunchQueue-kapabilitet i Firefox/WebKit, ingen fejl, 4,2 minutter.
- Målrettet browserkontrol af filforløb og brøkfelt: 14/14 bestået.
- Det færdige produktionsbuild: separat opstart og navigation til Satser bestået,
  uden console-/page-fejl eller eksterne requests.
- Begge produktionsbuilds og deres artefaktkontroller bestået. Vite udsteder fortsat en
  advarsel om hovedchunks over 750 kB; grænsen er ikke hævet.
- Manifest/lock/install-script-politik, tool-isolation, runtime, actions, løndata,
  kontrakter, E2E-baner/-belastning, inputregistre, LF, encoding og filnavnscasing bestået.
- Projektets sikkerhedskontrol finder ingen sårbarheder på moderate-niveau eller derover.
  Det separate agentværktøjstræ har ingen registrerede sårbarheder.
- Desktop-dialogen og indtægtstabellen er visuelt inspiceret.

- `npm run test:mutation`: gennemført med 58 mutationer, 56 dræbt, to overlevende,
  ingen timeouts eller tekniske fejl. Score 96,55 %. Der er ikke ændret beregningskode.
- CLI-, MCP- og Wrangler-launchere rapporterer de valgte versioner.

Ubuntu-jobbene er ikke udført lokalt; de skal verificeres ved næste GitHub-kørsel.
Den gamle fulde 4×4-browsermatrix er ikke kørt, fordi den normale banesuite allerede
dækker de relevante browser- og viewportforskelle i denne vedligeholdelsesopgave.
Alle ad hoc-servere er lukket efter kontrollen.

Lokal verifikation er kørt på Windows med Node 26.13.0 og en separat npm 12.2.2-installation
i den midlertidige mappe. Maskinens globale npm-installation er uændret; en almindelig
PowerShell finder fortsat npm 11.13.0. README beskriver opgradering, versionskontrol
og PATH-rækkefølgen på Windows. CI installerer selv præcis npm 12.2.2.
