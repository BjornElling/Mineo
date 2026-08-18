# Brugerblik — status

Fremdrift for UI/UX-fornufts- og edge case-gennemgangen. Se `.claude/skills/brugerblik/SKILL.md`.

- **Næste flade:** MinProcesrente (selvstændig app)
- **Næste fund-ID:** BB-037
- **Senest opdateret:** 2026-08-18 (Satser færdigbehandlet: alle seks fund og begge åbne spørgsmål
  afgjort; BB-030 og BB-031 gennemført i kode)

## Flader

Rækkefølgen er fastlagt i `.claude/skills/brugerblik/references/flader.md` (små flader først).
Status: `Ikke startet` · `I gang` · `Gennemgået` · `Afventer bruger`.

| # | Flade | Status | Fund | Dokument |
|---|---|---|---|---|
| 1 | Stamdata | Gennemgået | 10 (BB-001–BB-010) | [stamdata.md](stamdata.md) |
| 2 | Om | Gennemgået | 12 (BB-011–BB-022) | [om.md](om.md) |
| 3 | Indstillinger | Gennemgået | 8 (BB-023–BB-029, BB-036) | [indstillinger.md](indstillinger.md) |
| 4 | Satser | Gennemgået | 6 (BB-030–BB-035) | [satser.md](satser.md) |
| 5 | MinProcesrente | Ikke startet | — | — |
| 6 | Global shell | Ikke startet | — | — |
| 7 | Varige mén | Ikke startet | — | — |
| 8 | Renteberegning | Ikke startet | — | — |
| 9 | Årslønsberegning | Ikke startet | — | — |
| 10 | Forsørgertab | Ikke startet | — | — |
| 11 | Erhvervsevnetab | Ikke startet | — | — |
| 12 | Erstatningsopgørelse | Ikke startet | — | — |

## Fund der afventer brugerens beslutning

**Ingen.** Alle fire gennemgåede flader er færdigbehandlet.

## Satser — afgjort 2026-08-18

**Alle seks fund og begge åbne spørgsmål er afgjort** — to accepteret og gennemført, fire afvist. Det
fulde grundlag, inklusive de målte før/efter-tal, står i [satser.md](satser.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-030 | Satsspecifikationen udelod den sats på 0 %, skærmen viste (år 2024) | **Accepteret — gennemført**; dokumentets prøve er nu «findes værdien?» |
| BB-031 | Samme indsatte tekst gav to forskellige årstal, alt efter om feltet var tomt | **Accepteret — gennemført**; begge paste-only fortolkere slettet. Mit eget løsningsforslag forkastet |
| BB-032 | Det dækkede årsinterval 2005–2026 vises kun, når man har gættet forkert | Afvist — brugere rammer i praksis aldrig den nedre grænse |
| BB-033 | Fire steder hedder «Satser», og de viser satser på forskellige måder | Afvist — formen følger et fagligt behov pr. satstype |
| BB-034 | «Reguleringsprocent … (fra 2024)» står alene og forklarer ikke sig selv | Afvist — 2024-lovændringen er almindeligt fagkendskab |
| BB-035 | Specifikationen på papir mangler grundlaget for fri proces-beløbene | Afvist — tooltippen er akademisk baggrund, ikke en forudsætning |

**Begge åbne spørgsmål er lukket.** Satser-siden er et **opslagsværk**, ikke en del af sagsbehandlingen:
den skal ikke oplyse, at satsåret ikke påvirker beregninger, og et satsår langt fra sagens skadedato skal
ikke give en advarsel.

**Konsekvenser for de resterende flader — fem lukkede spor.** Foreslå dem ikke igen:
1. Et tilladt interval behøver ikke annonceres, hvis brugere i praksis aldrig rammer grænsen.
2. Fælles navn på forskellige visningsformer er ikke en inkonsistens, når formen følger et fagligt behov.
3. En fagligt velkendt lovhenvisning behøver ingen forklaring i brugerfladen.
4. Et informationsikons indhold er ikke automatisk noget, dokumentet mangler.
5. **Mineo er en samling selvstændige værktøjer, og brugeren forventes at vide det.** Et fund af formen
   «brugeren kan tro, at de to sider hænger sammen» kræver, at der faktisk ER en kobling, som virker
   anderledes end den ser ud.

**Gennemført i kode:** `inputPasteNormalization.ts` (begge fortolkere erstattet af det delte
tegn-for-tegn-filter; tre dødе hjælpere fjernet), `numericDraftAdmission.ts` (års- og ugeprædikaterne
flyttet hertil som ét sandt sted, plus `normalizeWeekSeparators`), `draftAdmission.ts` og
`weekDraftCore.ts` (læser nu de delte prædikater frem for egne kopier),
`satserDocument.ts` (`hasRateValue`, 18 kaldssteder, plus fri proces pr. linje). Kontrakten
`input-field-behavior-contract.md` har fået **§1.2a punkt 7** og en ny **§2.9 om års- og ugefelter**.
Tests: `inputPasteNormalization.test.ts` skrevet om (de gamle prøver pinnede den forkerte adfærd) med et
nyt værn for tomt-vs-udfyldt-ligheden; to nye værn i `satserWordContent.test.ts`, hvoraf det ene er
mutations-efterprøvet. Fuld vitest grøn: 605 filer / 7977 tests.

**En sideeffekt fundet undervejs og rettet med:** ugefeltets separatorsæt var erklæret to gange med
forskelligt indhold — `23,2025` kunne tastes, men blev afvist ved settle. Nu én erklæring, begge læser.
Efter brugerens beslutning er **mellemrum ikke længere ugeseparator**, så `uge 23/2025` kan indsættes;
prisen er, at `23 2025` ikke kan.

**Indstillinger er færdigbehandlet 2026-08-18. Alle otte fund er afgjort** — tre accepteret og
gennemført, fem afvist. Det fulde grundlag står i [indstillinger.md](indstillinger.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-024 | Farvetemaet kunne ikke stilles tilbage til at følge computeren | **Accepteret — gennemført**; `themeMode` er tre-værdig, `'system'` er default, systemskift følges live |
| BB-028 | Måneds-grænsen virker uafhængigt af den toggle, den står under | **Accepteret — gennemført**; rækkerne byttet om, tolerancen omformuleret selvstændigt |
| BB-036 | «Nulstil» fik browserens sorte fokusramme (brugerens eget fund) | **Accepteret — gennemført**; ny `.text-action-button` genbruger programmets egen fokusmarkering |
| BB-023 | «Standardværdier» slår ikke igennem på den åbne sag | Afvist — begge tidspunkter for virkning er de forventede; ingen forklarende linje |
| BB-025 | Indstillinger forsvinder tavst, hvis browserens lagring ryddes | Afvist — bæres bevidst; forbuddet mod `.eo` er nu normativt |
| BB-026 | Alle ni brevhoveder kan slås fra uden oplysning om konsekvensen | Afvist — brevhovedet er et tilbud, ikke en integritetsegenskab |
| BB-027 | Ctrl+Z virker overalt i programmet undtagen på indstillinger | Afvist — fraværet er et **værn**; nu normativt |
| BB-029 | «0 måneder» — ordlyden skulle pege det modsatte vej | Afvist — «forældet efter 0 måneder» læses naturligt som «straks» |

**Begge åbne spørgsmål er lukket.** Standardværdier anvendes aldrig på en åben sag (heller ikke på
brugerens anmodning), og de fire bokse skal ikke forklare, hvornår deres indhold virker.
**Konsekvens for de resterende flader: «fladen bør sige hvornår en indstilling virker» er et lukket
spor** — foreslå det ikke igen.

**Gennemført i kode:** `appSettingsSchema.ts` (`themeModeEnum` + `resolveThemeMode` +
`ResolvedThemeMode`), `appSettingsParse.ts`, `AppSettingsContext.tsx` (+`.shared.ts`),
`themeBootstrap.ts`, `appTheme.ts`, `App.tsx`, `Indstillinger.tsx`, `DefaultDirectoryRow.tsx`,
`layout.css`. Ny test `themeBootstrapParity.test.ts`. Kontrakten `src/contracts/app-settings.md` har
fået tre nye normative afsnit (tema-tredelingen, `.eo`-forbuddet, undo/redo). Fuld vitest grøn:
605 filer / 7971 tests.

**Tidligere flader.** Om-fladens tolv fund blev besvaret i to runder og er alle afgjort; fire af dem
efter modpres fra agenten. Det fulde grundlag står i [om.md](om.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-011 | Teksten siger «når browseren lukkes» — sagen forsvinder med **fanen**, og «Gem» nævnes ikke | **Accepteret efter modpres — gennemført**; adfærden bevares |
| BB-012 | «Ingen data … eller anden information» lover bredere end det, sætningen skal bære | **Delvist accepteret efter modpres — gennemført**; nøgleordene bevares, tre unøjagtigheder rettes |
| BB-013 | Søskendesiderne åbner i samme fane og erstatter programmet | **Accepteret efter modpres — gennemført** som generel linkregel |
| BB-014 | Rul-til-toppen-knappen dækker 19 px af det sidste søskendelink | Accepteret risiko — få står præcis på 1536×864, og zoom-løsningen ændrer præmissen |
| BB-015 | Fast indholdsbredde; 1366 px-skærm kræver vandret rul | Afgjort — 1536×864 er designmålet; shell-kontrakten dækker 1244×620 CSS-px ved 100 % browserzoom |
| BB-016 | Sidens fem links kan ikke nås med tastaturet | Afgjort — bevidst designvalg, nu håndhævet af `ExternalLink` |
| BB-017 | Hjælpeprogrammets tilstand vises først, når man klikker | Afgjort — acceptabelt kompromis |
| BB-018 | Tre ord for samme handling: download, hente, installere | **Accepteret — gennemført.** Brugeren leverede brødteksten |
| BB-019 | To browserikoner uden tekst | Afvist — ikonerne er en genkendelsesnøgle, ikke en oplysning |
| BB-020 | Startside-valget står under «Teknisk» | Afvist — bevidst undtagelse; Om vises af juridiske grunde |
| BB-021 | «Mineo» og «minEO.dk» på samme skærm | Afvist — ét navn i to sammenhænge |
| BB-022 | Forsiden peger ikke ind i programmet | Afvist — der findes ikke ét rigtigt startsted |

**Gennemført fra Om:** to tekstrettelser i `Mineo.tsx`, lavet i én omgang —
«Persondata»-boksens sætning 2 og 3 (BB-011 + BB-012) og «Teknisk»-boksens ord for handlingen
inklusive knaplabelen «Installér hjælpeprogram» (BB-018). Ordlyden står ordret i [om.md](om.md).

**Gennemført undervejs:** BB-013's generelle linkregel — `ExternalLink`/`InternalLink`, AST-reglen
`a11y/web-link-policy-single-source` og `e2e/web-link-policy.spec.ts`. Brugerens eget arbejde.

Stamdatas ti fund er afgjort 2026-08-16; afgørelserne står i [stamdata.md](stamdata.md).
Tre rettelser derfra står klar til gennemførelse: BB-002 + BB-010's ordlyd (samme kodeændring),
BB-004's nye længdekategori (6 tegn til initialfelterne) og BB-007's normalisering af indsat tekst.

## Åbne spørgsmål

**Ingen.** BB-017's alternative overskrift til fejldialogen blev udeladt som aftalt; BB-018's
tekstrettelse ændrede derfor ikke denne overskrift.

**Efterfølgende implementering.** Det tidligere planlagte skaleringsarbejde er gennemført og ligger
nu som bindende regel i [app-shell-kontrakten](../../../src/contracts/app-shell-contract.md): Mineo
dækker mindst 1244×620 CSS-px ved 100 % browserzoom. Fysisk 1366×768 alene er ikke en garanti, fordi
systemskalering ændrer den faktiske CSS-viewport.

## Tværgående mønstre

Fjorten mønstre i [TVAERGAAENDE.md](TVAERGAAENDE.md).

- **M-13** og **M-14** er tilføjet 2026-08-18 fra Satser og **begge afgjort og gennemført samme dag**.
  Begge handler om, at **to steder træffer samme afgørelse hver for sig og bliver uenige**, uden at
  brugeren kan se det:
  - **M-13** — *nul er en oplysning, ikke et fravær.* Skærmen skjuler en række, når værdien
    mangler; dokumentet skjulte den, når værdien ikke var større end nul. **Bekræftet bindende af
    brugeren:** rækker, hvor værdien findes men er 0, vises begge steder. En `> 0`-prøve på synlighed
    er altid mistænkelig. Åben kandidat: reguleringsbilagets **kolonnevalg** i `reguleringDocument.ts`
    (otte tillægssatser + grundlønnen) — hører til Erstatningsopgørelse.
  - **M-14** er **omskrevet** — læs den nye form. Den hed *«indsat tekst samles af cifre uden hensyn
    til formens positioner»*, og **den præmis blev afvist**: brugeren fastholder, at paste altid skal
    give samme resultat som tastning, også når `01-02-2026` derved bliver `102` i et årsfelt. Mønsteret
    hedder nu *«en anden fortolkningsvej ved siden af tastningen»* og handler om paste-only fortolkere,
    der udleder en værdi af hele teksten — og som kun kaldes i et tomt felt. Åben kandidat:
    datofelternes `normalizeDatePaste`, den ene tilbageværende fortolker.

- **M-12 er KRAFTIGT INDSNÆVRET samme dag efter brugerens afgørelser — læs den nye form, ikke den
  oprindelige.** Mønsteret samlede oprindelig tre fravær (ingen kvittering, forskudt virkning, ingen
  vej tilbage), og **alle tre udløsende fund blev afvist**: forskudt virkning er den forventede
  adfærd, og fraværet af fortrydelse er et værn frem for en mangel. Tilbage står den skarpere prøve,
  BB-024 bestod:
  > *Er et valg blevet til en tilstand, brugeren ikke kan komme **ud** af igen?*

  Det handler altså nu om **en manglende valgmulighed**, ikke om manglende forklaring — typisk hvor
  en startværdi udledes af omgivelserne (systemtema, dato, en anden sides værdi) og fryses af
  brugerens første valg. **Et fund, hvis rettelse er «tilføj en forklarende linje», hører ikke
  længere hjemme her.**

- **M-01 til M-07** stammer fra Stamdata og handler om indtastning. Fire er omskrevet 2026-08-16
  efter brugerens afgørelser — læs dem i deres nye form, ikke i fundenes oprindelige.
- **M-08 til M-11** er tilføjet fra Om-fladen 2026-08-16 og handler om siden som helhed:
  M-08 links uden for tastaturrækkefølgen, M-09 fast indholdsbredde, M-10 flydende knapper der
  dækker indhold, M-11 programmets egne påstande om sig selv. Alle fire er skrevet om samme dag
  efter brugerens afgørelser og skal læses i den nye form:
  - **M-08** er afgjort for eksterne links i hele programmet: `ExternalLink` sætter `tabIndex={-1}`
    fast, og en AST-regel håndhæver det. Tilbage står kun **interne** links, der bærer noget,
    brugeren skal kunne handle på.
  - **M-09** har fået en grænse: 1536×864 er designmålet, og under den er afskæring accepteret.
    Mønsteret er dermed kun relevant **på eller over** den bredde.
  - **M-10** er skærpet: det afgørende er ikke, at en knap kan dække noget, men at indholdssøjlen
    ved designmålet går helt ud til vinduets kant, så en fast placeret knap altid lander oven i den.
  - **M-11** står uændret; begge fund bag det er nu afgjort som tekstrettelser. Mønsterets fælde er
    skrevet ind: et tekstfund om programmets egne påstande bliver let besvaret som et adfærdsfund.

## Noter til rækkefølgen

- Ingen justeringer. Om var nr. 2 som planlagt og viste sig at være en mindre flade at betjene, men
  en større at bedømme end antaget: den er programmets standard-startside og det eneste sted,
  programmet udtaler sig om, hvad der sker med brugerens oplysninger.
- Indstillinger var nr. 3 som planlagt. Fladen har tyve rækker og er dermed større end de to
  foregående, men hver enkelt kontrol er enkel; det tunge lå i at spore, **hvor** hver indstilling
  får virkning. Rækkefølgens præmis holdt: fundene her er generelle og vil kunne genkendes senere
  frem for at skulle genopdages.
- **To fund bør efterprøves igen på Erstatningsopgørelse-fladen** (nr. 12): BB-028 og BB-029 om de
  beregningstekniske valg er bedømt fra reglerne, men den konkrete oplevelse på EO-kontrolfanen er
  ikke set. Det samme gælder brevhovedernes virkning i et færdigt dokument (BB-026).
- Satser var nr. 4 som planlagt og var den mindste flade indtil nu at betjene: ét felt, én knap,
  fire rene visningssektioner. Til gengæld var den den mest udbytterige at **måle**, netop fordi
  den er lille nok til at kunne sammenlignes række for række med sit eget dokument for hvert af de
  22 dækkede år. Rækkefølgens præmis holdt igen: begge nye mønstre (M-13, M-14) er generelle og
  bærer konkrete kandidatsteder ind i de store flader.
- **Tre spor er lagt ud til senere flader:** M-13's kolonnevalg i reguleringsbilaget hører til
  Erstatningsopgørelse (nr. 12); M-14's to tabelcelle-årsfelter hører til Årsløn (nr. 9) og
  Erstatningsopgørelse; og Gem/Hent med et ugyldigt satsår hører til Global shell (nr. 6), fordi
  filgemmedialogen ikke kan afprøves headless.
