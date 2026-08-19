# Brugerblik – status

Fremdrift for UI/UX-fornufts- og edge case-gennemgangen. Se `.claude/skills/brugerblik/SKILL.md`.

- **Næste flade:** Varige mén (`/varigemen`, pr. fane)
- **Næste fund-ID:** BB-062
- **Senest opdateret:** 2026-08-19 (Global shell **afgjort**: alle 13 fund besvaret – 6 gennemført,
  6 afvist, 1 delvist gennemført efter modpres. M-17 og M-18 er afgjort og gennemført samme dag;
  M-06's udløsende fund gennemført, M-08's afvist og sporet lukket)

## Flader

Rækkefølgen er fastlagt i `.claude/skills/brugerblik/references/flader.md` (små flader først).
Status: `Ikke startet` · `I gang` · `Gennemgået` · `Afventer bruger`.

| # | Flade | Status | Fund | Dokument |
|---|---|---|---|---|
| 1 | Stamdata | Gennemgået | 10 (BB-001–BB-010) | [stamdata.md](stamdata.md) |
| 2 | Om | Gennemgået | 12 (BB-011–BB-022) | [om.md](om.md) |
| 3 | Indstillinger | Gennemgået | 8 (BB-023–BB-029, BB-036) | [indstillinger.md](indstillinger.md) |
| 4 | Satser | Gennemgået | 6 (BB-030–BB-035) | [satser.md](satser.md) |
| 5 | MinProcesrente | Afgjort | 12 (BB-037–BB-048) | [minprocesrente.md](minprocesrente.md) |
| 6 | Global shell | Afgjort | 13 (BB-049–BB-061) | [globalshell.md](globalshell.md) |
| 7 | Varige mén | Ikke startet | – | – |
| 8 | Renteberegning | Ikke startet | – | – |
| 9 | Årslønsberegning | Ikke startet | – | – |
| 10 | Forsørgertab | Ikke startet | – | – |
| 11 | Erhvervsevnetab | Ikke startet | – | – |
| 12 | Erstatningsopgørelse | Ikke startet | – | – |

## Global shell – afgjort 2026-08-19

**Alle tretten fund er afgjort** – seks accepteret og gennemført, seks afvist og ét delvist gennemført
efter modpres. Det fulde grundlag med begrundelser står i [globalshell.md](globalshell.md).

| ID | Kort | Udfald |
|---|---|---|
| BB-049 | `Gem` kan skrive den ene sag ind i den anden sags fil, når Mineo er åben i to faner | **Gennemført** (Kritisk) – håndtaget genbruges kun, når dets `name` er fanens eget. Mit eget løsningsforslag forkastet som for kompliceret |
| BB-050 | Ctrl+Z ændrer sagen bag en åben bekræftelsesdialog; Ctrl+S starter et gem bag den | **Gennemført** – begge genveje spørger overlay-stakken; dækker alle fem overlays |
| BB-051 | Sidemenuen kan ikke nås med tastaturet, når fokus én gang har været i indholdet | **Afvist** – Tab-ringen findes for hurtig indtastning på ÉN side; mus til sidenavigation er et accepteret kompromis |
| BB-052 | Programmet ved, om sagen er gemt, og siger det aldrig; sagen har intet filnavn på skærmen | **Afvist** – brugeren gemmer selv; browserens advarsel ved lukning er den primære beskyttelse |
| BB-053 | Den anden besked arver den førstes resttid og kan være helt usynlig | **Gennemført** – identiteten kommer fra kilden som React-`key`; et fade-ud kan ikke længere lukke en nyere besked |
| BB-054 | Ctrl+Z gør ingenting, mens et felt er åbent – heller ikke browserens egen fortrydelse | **Delvist gennemført efter modpres** – den dobbelte adfærd afvist (brugeren har ret), men spærringen af tasten fjernet |
| BB-055 | Korrekt adgangskode med et usynligt mellemrum afvises som «Forkert adgangskode» | **Gennemført** – `trim()` ét sted, hvor case-neutraliseringen allerede bor; garantien for afledte virkninger er udfoldet |
| BB-056 | Kan ikke logge ind, når browseren ikke må gemme login-status – én besked for to årsager | **Gennemført** – forgrening på fejlKLASSEN, ikke på tekst |
| BB-057 | 404-siden er en hvid blindgyde uden menu og uden vej tilbage | **Gennemført** – siden ligger inde i shellen; brugerens to betingelser er efterprøvet strukturelt og målt |
| BB-058 | `Slet alt` advarer og kvitterer, også når der intet er at slette | **Afvist** – `Slet alt` skal garantere, at alt er væk; en «der var intet»-besked har ingen værdi |
| BB-059 | Genindlæsning (F5) advarer om et tab, der ikke sker | **Mitigering afvist** – brugerens regel tiltrådt som princip, men browseren har ét fælles `beforeunload` for lukning og F5. Ingen kodeændring |
| BB-060 | `Slet alt` og `Erstat` kan ikke fortrydes, og dialogerne siger det ikke | **Afvist** – brugeren forventer, at `Slet alt` er irreversibel |
| BB-061 | Der findes ingen vej ud af login igen | **Afvist** – professionelle brugere logger kun ind på egen eller en kollegas maskine |

**Én afvisning, hvor jeg pressede tilbage og fik delvist ret (BB-054).** Brugerens hovedindvending var
rigtig: min anbefaling ville have givet Ctrl+Z to betydninger, og «én tast, én funktion» er den stærkere
regel. Men fundet indeholdt et andet forhold, begrundelsen ikke dækkede – genvejen kaldte
`preventDefault()`, FØR den så, at editoren var åben, og slog dermed browserens egen tekstfortrydelse
ihjel uden selv at gøre noget. Nul funktioner plus en spærring er ikke «én funktion». Spærringen er
fjernet; den dobbelte adfærd er det ikke.

**Fem afvisninger accepteret uden indvending** (BB-051, BB-052, BB-058, BB-060, BB-061 – hvoraf to
korrigerede en fejlslutning i mit eget grundlag): BB-058's sammenligning med `Gem` holdt ikke, fordi
`Gem` faktisk ÆNDRER sin handling efter svaret, og `Slet alt` ikke gør. BB-052's begrundelse hvilede
delvis på, at et ekstra `Gem` kunne ramme forkert fil – det er bortfaldet med BB-049's rettelse.

**Sporet, STATUS lagde ud til denne flade, er lukket:** `Gem` med et satsår uden for det dækkede
interval (1999) blokerer ikke, og det er korrekt efter `form-contract` §1.6 – en bounds-fejl på en
ellers repræsenterbar værdi må gemmes. Ingen fund.

**Det væsentligste dækningshul består efter rettelserne:** filvælgeren kan ikke betjenes headless, så
BB-049's mekanisme er mutationstestet frem for målt i drift. Efterprøv manuelt med to faner og to
rigtige filer. Tilsvarende kan den browser-adfærd, BB-054 frigiver (Ctrl+Z fortryder tegn i et åbent
felt), pr. konstruktion ikke måles i jsdom.

**Konsekvenser for de resterende flader – tre lukkede spor.** Foreslå dem ikke igen:
1. **Tastaturnavigation er til indtastning, ikke til navigation.** Sidemenuen, `PageTabs` og `SideTab`
   skal ikke ind i Tab-ringen. En kontrol uden for ringen er kun et fund, hvis den er nødvendig for at
   færdiggøre indtastningen på den side, brugeren står på.
2. **Programmet skal ikke vise gemt/ugemt-tilstand eller filnavn.** Brugeren gemmer selv; det er
   åbenbart for professionelle brugere.
3. **En «Log ud» skal ikke foreslås**, og gatens formålssætning om «delt enhed» er ikke et løfte om at
   kunne fjerne adgangen igen.

**Gennemført i kode:** `utils/fileSaveTarget.ts`, `inputCore/react/useUndoRedoShortcuts.ts`,
`components/layout/MainLayout.tsx`, `auth/auth.ts`, `auth/LoginPage.tsx`, `App.tsx` og den nye
`components/system/PageNotFound.tsx`. Fire kontrakter har fået normative afsnit:
`persistence-contract.md` §5 (filhåndtagets identitet), `keyboard-navigation.md` (globale genveje og
overlay-stakken + beskedernes nedtælling), `auth-gate-contract.md` §2.3/§2.7 og
`app-shell-contract.md` §2.2. Nye/udvidede tests: `fileSaveTarget.test.ts`,
`useUndoRedoShortcuts.test.tsx`, `MainLayout.shortcutsAndMessages.test.tsx` (ny),
`PageNotFound.test.tsx` (ny), `auth.test.ts`, `LoginPage.test.tsx` og en rettet påstand i
`MainLayout.undoRedoEditorGuard.test.tsx`. **Alle nye værn er mutationstestet.** Fuld vitest grøn.

## MinProcesrente – afgjort 2026-08-19

**Alle tolv fund er afgjort** – ni accepteret og gennemført, tre afvist. Det fulde grundlag med målte
før/efter-tal står i [minprocesrente.md](minprocesrente.md).

| ID | Kort | Udfald |
|---|---|---|
| BB-037 | Tillægstid kan skubbe rentedatoen forbi beregningsdatoen; rækken holder tavst op med at regne | **Gennemført** – brugerens løsning: `rule`-validator på Tillægstid med «Beregnet rentedato kan senest være …» |
| BB-038 | 0 kr. accepteres af feltet, afvises af beregningen | **Gennemført** – «Beløbet skal være større end 0 kr.» |
| BB-039 | Blokeringen siger «Indtastning mangler», selv om intet mangler | **Bortfaldet** – min præmis var for bred; gatens præmis er nu SAND, fordi BB-037/038 giver røde felter |
| BB-040 | Renten regnes fem år ud over de fastsatte satser; kun PDF'en advarer | **Afvist** – accepteret brist; jeg pressede med en enklere løsning, afvisningen fastholdt |
| BB-041 | Sortering kan ikke slås fra og kan ikke fortrydes | **Afvist** – tilsigtet designvalg i alle tabeller |
| BB-042 | Samme indsatte dato giver to forskellige resultater | **Gennemført** – brugerens valg: tolerancen bevaret, tilstandsafhængigheden fjernet ét sted for alle tre paste-flader |
| BB-043 | Fejlen navngiver «dags dato» i stedet for Beregningsdato | **Gennemført** – «Datoen er efter beregningsdatoen (…)» med brugerens ordlyd |
| BB-044 | Bekræftelsen taler om `.eo`-filer, som ikke findes i standalone | **Gennemført** – egen ordlyd pr. variant via `hasEoFiles` |
| BB-045 | Telefonlayout i et smalt musevindue, men 1200 px indholdsboks | **Gennemført** – brugerens løsning: opstillingen låses til ENHEDEN, aldrig til vinduet |
| BB-046 | Tillægstiden regner videre, men er usynlig i telefonlayoutet | **Gennemført** – løst af BB-045's device-lås; overgangen findes ikke længere |
| BB-047 | «Slet alle indtastninger» kan ikke nås med tastaturet | **Gennemført** – `data-mineo-focusable-button` |
| BB-048 | Arbejdet kan lukkes væk uden varsel | **Gennemført** – Mineos guard genbrugt; baselinen flyttes af et gennemført hent |

**To brugerafklaringer traf jeg ikke selv, fordi de var reelle valg:**

1. **BB-042 var en modsigelse mellem to af brugerens egne afgørelser.** BB-003 (16-08): indsættelse må
   gerne være mere tolerant end tastning. Denne tilbagemelding (19-08): paste skal altid opføre sig som
   tastning. Forelagt med begge udfald; brugeren valgte at bevare tolerancen og kun rette
   tilstandsforskellen. `input-field-behavior-contract.md` §1.2a punkt 7 er rettet tilsvarende – den
   påstod det absolutte forbud, som modsagde BB-003 fem dage før.
2. **BB-045 krævede en definition af «mobil».** Browseren kan ikke sige «telefon» – kun «berøring» og
   «skærmstørrelse». Brugeren valgte, at skærmens fysiske størrelse afgør, så en berøringsfølsom
   bærbar er en desktop.

**Én afvigelse fra en tilbagemelding, forelagt og bekræftet:** ved BB-037 viser downloadknappen den
konkrete sætning i stedet for «Fejl i indtastning», fordi der kun er ÉT rødt felt – brugerens egen
lempelse af 13-08-2026. Bekræftet beholdt 19-08.

**To åbne spørgsmål står fortsat uafklarede:** skal Beregningsdato være forudfyldt med dags dato ved
første besøg, og skal tillægstid kunne bruges på telefon. Det sidste er efter BB-046 ikke længere et
fund, men et valg om telefonudgavens omfang.

## Satser – afgjort 2026-08-18

**Alle seks fund og begge åbne spørgsmål er afgjort** – to accepteret og gennemført, fire afvist. Det
fulde grundlag, inklusive de målte før/efter-tal, står i [satser.md](satser.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-030 | Satsspecifikationen udelod den sats på 0 %, skærmen viste (år 2024) | **Accepteret – gennemført**; dokumentets prøve er nu «findes værdien?» |
| BB-031 | Samme indsatte tekst gav to forskellige årstal, alt efter om feltet var tomt | **Accepteret – gennemført**; begge paste-only fortolkere slettet. Mit eget løsningsforslag forkastet |
| BB-032 | Det dækkede årsinterval 2005–2026 vises kun, når man har gættet forkert | Afvist – brugere rammer i praksis aldrig den nedre grænse |
| BB-033 | Fire steder hedder «Satser», og de viser satser på forskellige måder | Afvist – formen følger et fagligt behov pr. satstype |
| BB-034 | «Reguleringsprocent … (fra 2024)» står alene og forklarer ikke sig selv | Afvist – 2024-lovændringen er almindeligt fagkendskab |
| BB-035 | Specifikationen på papir mangler grundlaget for fri proces-beløbene | Afvist – tooltippen er akademisk baggrund, ikke en forudsætning |

**Begge åbne spørgsmål er lukket.** Satser-siden er et **opslagsværk**, ikke en del af sagsbehandlingen:
den skal ikke oplyse, at satsåret ikke påvirker beregninger, og et satsår langt fra sagens skadedato skal
ikke give en advarsel.

**Konsekvenser for de resterende flader – fem lukkede spor.** Foreslå dem ikke igen:
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
forskelligt indhold – `23,2025` kunne tastes, men blev afvist ved settle. Nu én erklæring, begge læser.
Efter brugerens beslutning er **mellemrum ikke længere ugeseparator**, så `uge 23/2025` kan indsættes;
prisen er, at `23 2025` ikke kan.

**Indstillinger er færdigbehandlet 2026-08-18. Alle otte fund er afgjort** – tre accepteret og
gennemført, fem afvist. Det fulde grundlag står i [indstillinger.md](indstillinger.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-024 | Farvetemaet kunne ikke stilles tilbage til at følge computeren | **Accepteret – gennemført**; `themeMode` er tre-værdig, `'system'` er default, systemskift følges live |
| BB-028 | Måneds-grænsen virker uafhængigt af den toggle, den står under | **Accepteret – gennemført**; rækkerne byttet om, tolerancen omformuleret selvstændigt |
| BB-036 | «Nulstil» fik browserens sorte fokusramme (brugerens eget fund) | **Accepteret – gennemført**; ny `.text-action-button` genbruger programmets egen fokusmarkering |
| BB-023 | «Standardværdier» slår ikke igennem på den åbne sag | Afvist – begge tidspunkter for virkning er de forventede; ingen forklarende linje |
| BB-025 | Indstillinger forsvinder tavst, hvis browserens lagring ryddes | Afvist – bæres bevidst; forbuddet mod `.eo` er nu normativt |
| BB-026 | Alle ni brevhoveder kan slås fra uden oplysning om konsekvensen | Afvist – brevhovedet er et tilbud, ikke en integritetsegenskab |
| BB-027 | Ctrl+Z virker overalt i programmet undtagen på indstillinger | Afvist – fraværet er et **værn**; nu normativt |
| BB-029 | «0 måneder» – ordlyden skulle pege det modsatte vej | Afvist – «forældet efter 0 måneder» læses naturligt som «straks» |

**Begge åbne spørgsmål er lukket.** Standardværdier anvendes aldrig på en åben sag (heller ikke på
brugerens anmodning), og de fire bokse skal ikke forklare, hvornår deres indhold virker.
**Konsekvens for de resterende flader: «fladen bør sige hvornår en indstilling virker» er et lukket
spor** – foreslå det ikke igen.

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
| BB-011 | Teksten siger «når browseren lukkes» – sagen forsvinder med **fanen**, og «Gem» nævnes ikke | **Accepteret efter modpres – gennemført**; adfærden bevares |
| BB-012 | «Ingen data … eller anden information» lover bredere end det, sætningen skal bære | **Delvist accepteret efter modpres – gennemført**; nøgleordene bevares, tre unøjagtigheder rettes |
| BB-013 | Søskendesiderne åbner i samme fane og erstatter programmet | **Accepteret efter modpres – gennemført** som generel linkregel |
| BB-014 | Rul-til-toppen-knappen dækker 19 px af det sidste søskendelink | Accepteret risiko – få står præcis på 1536×864, og zoom-løsningen ændrer præmissen |
| BB-015 | Fast indholdsbredde; 1366 px-skærm kræver vandret rul | Afgjort – 1536×864 er designmålet; shell-kontrakten dækker 1244×620 CSS-px ved 100 % browserzoom |
| BB-016 | Sidens fem links kan ikke nås med tastaturet | Afgjort – bevidst designvalg, nu håndhævet af `ExternalLink` |
| BB-017 | Hjælpeprogrammets tilstand vises først, når man klikker | Afgjort – acceptabelt kompromis |
| BB-018 | Tre ord for samme handling: download, hente, installere | **Accepteret – gennemført.** Brugeren leverede brødteksten |
| BB-019 | To browserikoner uden tekst | Afvist – ikonerne er en genkendelsesnøgle, ikke en oplysning |
| BB-020 | Startside-valget står under «Teknisk» | Afvist – bevidst undtagelse; Om vises af juridiske grunde |
| BB-021 | «Mineo» og «minEO.dk» på samme skærm | Afvist – ét navn i to sammenhænge |
| BB-022 | Forsiden peger ikke ind i programmet | Afvist – der findes ikke ét rigtigt startsted |

**Gennemført fra Om:** to tekstrettelser i `Mineo.tsx`, lavet i én omgang –
«Persondata»-boksens sætning 2 og 3 (BB-011 + BB-012) og «Teknisk»-boksens ord for handlingen
inklusive knaplabelen «Installér hjælpeprogram» (BB-018). Ordlyden står ordret i [om.md](om.md).

**Gennemført undervejs:** BB-013's generelle linkregel – `ExternalLink`/`InternalLink`, AST-reglen
`a11y/web-link-policy-single-source` og `e2e/web-link-policy.spec.ts`. Brugerens eget arbejde.

Stamdatas ti fund er afgjort 2026-08-16; afgørelserne står i [stamdata.md](stamdata.md).
Tre rettelser derfra står klar til gennemførelse: BB-002 + BB-010's ordlyd (samme kodeændring),
BB-004's nye længdekategori (6 tegn til initialfelterne) og BB-007's normalisering af indsat tekst.

## Åbne spørgsmål

**Fire.** To fra Global shell – de står udfoldet i [globalshell.md](globalshell.md): skal Ctrl+S kunne
ses nogen steder i brugerfladen, og hvad skal `Gem` gøre, når skadelidtes navn rettes efter et gem
(i dag skifter det tavst, hvilken fil der skrives til). **Begge står stadig åbne efter afgørelserne
2026-08-19**, og det første er skærpet af BB-051's afvisning: når `Hent` og `Slet alt` bevidst ikke har
genveje, er Ctrl+S den eneste tastaturvej til nogen af de tre filhandlinger. Det andet spørgsmål deler
beslutningspunkt med BB-049's rettelse, men er uændret af den – et svar skal skrives ind i
`resolveSaveTarget` og bør læse `persistence-contract.md` §5 først.

**To fra MinProcesrente** – de står udfoldet i [minprocesrente.md](minprocesrente.md):
forudfyldt beregningsdato ved første besøg, og om tillægstid skal kunne bruges på telefon.

Fra de tidligere flader er der ingen. BB-017's alternative overskrift til fejldialogen blev udeladt
som aftalt; BB-018's tekstrettelse ændrede derfor ikke denne overskrift.

**Efterfølgende implementering.** Det tidligere planlagte skaleringsarbejde er gennemført og ligger
nu som bindende regel i [app-shell-kontrakten](../../../src/contracts/app-shell-contract.md): Mineo
dækker mindst 1244×620 CSS-px ved 100 % browserzoom. Fysisk 1366×768 alene er ikke en garanti, fordi
systemskalering ændrer den faktiske CSS-viewport.

## Tværgående mønstre

Atten mønstre i [TVAERGAAENDE.md](TVAERGAAENDE.md).

- **M-17** og **M-18** er tilføjet 2026-08-19 fra Global shell og **begge afgjort og gennemført samme
  dag**; begge er nu normative i kontrakterne:
  - **M-17 – én oplysning delt over to lagerscoper.** `sessionStorage` hører til ÉN fane;
    `localStorage` og IndexedDB hører til hele browseren. En sagsnær oplysning, der er delt over to
    af dem, er kun konsistent, så længe der er én fane åben. Prøven er konkret: åbn programmet i to
    faner, lad hver sætte sin egen værdi, og se om den første stadig læser sin egen (BB-049).
    **Mønsterets skarpeste lære kom af rettelsen, ikke af fundet:** den bedste identitet er den, der
    ikke skal vedligeholdes. Spørg altid, om den manglende identitet allerede findes PÅ objektet
    (`handle.name`), før der lægges en parallel kopi ved siden af, som selv kan drifte.
  - **M-18 – globale genveje kender ikke overlay-stakken.** En `keydown`-lytter på `window` rammer
    uanset hvad der ligger ovenpå, så handlingen sker bag den åbne dialog, hvor brugeren hverken
    kan se den ske eller se dens resultat (BB-050). **Halvdelen om `preventDefault()` er tilføjet af
    BB-054:** en genvej må heller ikke SPÆRRE en tast, den ikke bruger – så mister brugeren også
    browserens egen adfærd, og tasten bliver et sort hul.
- **M-06 og M-08 har fået hver sin skærpelse samme dag – med modsat udfald.** M-06 rammer også, når to
  led i SAMME beslutning normaliserer teksten forskelligt (login trimmede i «har du skrevet noget», men
  ikke i «er koden rigtig»); **dens fund er gennemført**, og normaliseringen har nu ét sted.
  M-08 er større end links – hele sidemenuen ligger uden for `Container`s ring, så prøven er ikke «er
  elementet med i selectoren?», men «findes der en vej TILBAGE?» – men **dens fund er AFVIST**, og
  sporet er lukket: Tab-ringen findes for hurtig indtastning på én side, ikke for navigation.

- **M-15** og **M-16** er tilføjet 2026-08-19 fra MinProcesrente og **afgjort samme dag**:
  - **M-15 – skærmen tier, hvor dokumentet taler.** Spejlbilledet af M-13: generatoren skriver et
    forbehold til tallet, og skærmen har ingen pendant. **Afvist for MinProcesrentes vedkommende**
    (BB-040): brugerne bruger PDF'erne, og bristen er accepteret. Mønsteret står som en åben
    kandidat for EO's dokumenter og reguleringsbilaget, hvor tallet oftere læses på skærmen.
  - **M-16 – en komplet række, programmet ikke vil regne på.** Motoren har flere afvisningsgrunde
    end feltmodellen har fejl; afvisningen kommer derfor ud som et fravær (`-`, forsvundet ikon, grå
    knap) og spærrer hele fladens dokumenter. **Gennemført for rentetabellen** (BB-037, BB-038): de
    to afvisningsgrunde er flyttet ind i feltmodellen som `rule`-validatorer. **Mønsterets anden
    halvdel viste sig unødvendig:** jeg troede, blokeringsklassen også skulle udledes pr. tilstand
    (BB-039), men når årsagen er et rødt felt, udleder den eksisterende gate klassen korrekt af sig
    selv. Rettelsen hører altså i feltmodellen, ikke i gaten – det er mønsterets skarpere form.
- **M-14's sidste åbne kandidat er efterprøvet 2026-08-19, havde fejlen og er rettet** (BB-042).
  Datofelternes segmentbaserede paste kaldtes kun i et tomt felt. Prøve 2 var derimod bestået: en dato
  uden for grænsen bevares uafkortet. Segmentfortolkningen er BEVARET efter brugerens valg (den er en
  truffet beslutning, BB-003); det er tilstandsafhængigheden, der er væk. Afgørelsen tvang samtidig en
  rettelse af `input-field-behavior-contract.md` §1.2a punkt 7, som påstod et absolut forbud mod
  paste-only fortolkning og dermed modsagde BB-003 fem dage før.
- **M-02 og M-09 har fået hver sin skærpelse samme dag.** M-02 rammer også beskeder, der genkender
  en grænse på dens *værdi* i stedet for dens *ophav* («Datoen er efter dags dato», når maksimum i
  virkeligheden er et andet felt). M-09: når layoutskiftet og breddefrigørelsen hviler på hvert sit
  kriterium (viewport kontra input-modalitet), findes der altid en tilstand mellem dem.

- **M-13** og **M-14** er tilføjet 2026-08-18 fra Satser og **begge afgjort og gennemført samme dag**.
  Begge handler om, at **to steder træffer samme afgørelse hver for sig og bliver uenige**, uden at
  brugeren kan se det:
  - **M-13** – *nul er en oplysning, ikke et fravær.* Skærmen skjuler en række, når værdien
    mangler; dokumentet skjulte den, når værdien ikke var større end nul. **Bekræftet bindende af
    brugeren:** rækker, hvor værdien findes men er 0, vises begge steder. En `> 0`-prøve på synlighed
    er altid mistænkelig. Åben kandidat: reguleringsbilagets **kolonnevalg** i `reguleringDocument.ts`
    (otte tillægssatser + grundlønnen) – hører til Erstatningsopgørelse.
  - **M-14** er **omskrevet** – læs den nye form. Den hed *«indsat tekst samles af cifre uden hensyn
    til formens positioner»*, og **den præmis blev afvist**: brugeren fastholder, at paste altid skal
    give samme resultat som tastning, også når `01-02-2026` derved bliver `102` i et årsfelt. Mønsteret
    hedder nu *«en anden fortolkningsvej ved siden af tastningen»* og handler om paste-only fortolkere,
    der udleder en værdi af hele teksten – og som kun kaldes i et tomt felt. Åben kandidat:
    datofelternes `normalizeDatePaste`, den ene tilbageværende fortolker.

- **M-12 er KRAFTIGT INDSNÆVRET samme dag efter brugerens afgørelser – læs den nye form, ikke den
  oprindelige.** Mønsteret samlede oprindelig tre fravær (ingen kvittering, forskudt virkning, ingen
  vej tilbage), og **alle tre udløsende fund blev afvist**: forskudt virkning er den forventede
  adfærd, og fraværet af fortrydelse er et værn frem for en mangel. Tilbage står den skarpere prøve,
  BB-024 bestod:
  > *Er et valg blevet til en tilstand, brugeren ikke kan komme **ud** af igen?*

  Det handler altså nu om **en manglende valgmulighed**, ikke om manglende forklaring – typisk hvor
  en startværdi udledes af omgivelserne (systemtema, dato, en anden sides værdi) og fryses af
  brugerens første valg. **Et fund, hvis rettelse er «tilføj en forklarende linje», hører ikke
  længere hjemme her.**

- **M-01 til M-07** stammer fra Stamdata og handler om indtastning. Fire er omskrevet 2026-08-16
  efter brugerens afgørelser – læs dem i deres nye form, ikke i fundenes oprindelige.
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
- MinProcesrente var nr. 5 som planlagt, men var ikke en lille flade: den er en hel app med egen
  indgang, eget layoutspor (den eneste, der må vises på telefon) og en beregningstabel, den deler
  med Renteberegning. Rækkefølgens præmis holdt alligevel – otte af de tolv fund er generelle og
  gælder også Mineo-udgaven. **Konsekvens for flade nr. 8 (Renteberegning):** BB-037, BB-038,
  BB-039, BB-041, BB-043 og BB-047 stammer fra den delte fane, er afgjort her og skal ikke genopdages
  dér – rettelserne til dem virker allerede i Mineo-udgaven, fordi fanen er den samme komponent. Tilbage
  til nr. 8 står det Mineo-specifikke: brevhoved, stamdata-afhængighed, Word-formatet, fanens plads
  i sagen og samspillet med Gem/Hent.
- **Tre spor er lagt ud til senere flader:** M-13's kolonnevalg i reguleringsbilaget hører til
  Erstatningsopgørelse (nr. 12); M-14's to tabelcelle-årsfelter hører til Årsløn (nr. 9) og
  Erstatningsopgørelse; og Gem/Hent med et ugyldigt satsår hører til Global shell (nr. 6), fordi
  filgemmedialogen ikke kan afprøves headless.
