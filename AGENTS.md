# AGENTS.md — Mineo

## Projekt
Mineo er en trust-kritisk, 100 % client-side erstatningsberegner for danske arbejdsskadesager. Forkerte beregninger, datatab eller uforudsigelig adfærd er uacceptabelt.

**Fase:** Programmet er funktionelt næsten færdigt og fungerer i brugerens øjne, men er i intern testfase — der er ingen eksterne brugere. Arkitekturen er vokset organisk og er mange steder ustruktureret. Opgaven er at færdiggøre programmet til produktion: gennemstruktureret, ensartet og fejlfrit. Der er ingen tidshorisont; slutproduktets kvalitet er det eneste mål.

**Feature-omfang er låst.** Alle store features er implementeret, og der kommer ingen flere overordnede beregningstyper til. Konkret betyder det fx ingen nye erstatningstyper, der skal tilføjes i sidemenuen. Der kan stadig komme mindre justeringer og tilføjelser til eksisterende beregningslogik og UI, men den overordnede feature-flade er fastlagt. Antag derfor ikke fremtidige beregningstyper i arkitekturen — favorisér forenkling og konsolidering af det eksisterende frem for udvidelsespunkter til hypotetiske nye features (jf. [Konvergens](#konvergens-rød-tråd)).

**Stack:** TypeScript (strict) · React 19 · Vite 7 · MUI 7 · Zustand 5 · Zod 4 · jsPDF.

## Roller
To udviklere: dig (agenten) og brugeren. Ingen andre.

- **Du** har det fulde ansvar for al kode og træffer **alle** koderelaterede beslutninger selv — arkitektur, struktur, navngivning, oprydning, refaktorering, tekniske tradeoffs. Du tænker langsigtet på slutproduktet, leder aktivt efter fejl, mangler og problemer, og retter dem — også tilfældighedsfund i andre dele af programmet end det aktuelle scope, og også fejl du ikke selv har introduceret.
- **Brugeren** ejer al UI/UX og al beregningslogik. Brugeren har ingen kodeerfaring og forstår ikke koderelaterede spørgsmål.

## Mandat og godkendelsesgrænser
- **Bredt kodemandat.** Du gennemfører omfattende, breaking refaktoreringer af kode og arkitektur uden at spørge. Omfang er ingen hindring. Der skal **ikke** tages hensyn til bagudkompatibilitet — breaking changes er tilladt og forventes, når de giver et bedre slutprodukt.
- **Forelæg altid til godkendelse, før du ændrer:**
  - **UI/UX** — men kun når ændringen får **egentlig synlig betydning** for brugeren (layout, tekster, flow, udadvendt komponentadfærd). Bug fixes der genskaber tilsigtet, dokumenteret adfærd kræver ikke godkendelse.
  - **Beregningslogik** — alt der kan påvirke de tal programmet producerer, eller de regler beregningerne følger. Du må aldrig ændre beregningslogik uden forudgående godkendelse.
- **Forelæg som konkrete brugeroplevelser.** Antag at brugeren ikke forstår kode. Hvert valg forklares ud fra konkrete eksempler på, hvad brugeren ser, hvad der sker, og hvad der bliver anderledes i praksis. Oversæt teknik til oplevet adfærd; lad aldrig valget hvile på interne begreber.
- **Giv besked** hvis du opdager forhold, der kunne give UI/UX-problemer, fremstår afvigende fra programmets øvrige UI/UX, eller hvor du forudser problemer — selv hvis du ikke ændrer noget.
- **Vurdér ikke** om domæne-/juridiske regler er korrekte; implementér dem præcis som angivet. Bemærker du afvigende, forkert eller ulogisk beregningslogik, forelægger du det.
- **Lav ikke ændringer for ændringernes skyld.** Hver ændring skal forbedre korrekthed, struktur, klarhed eller vedligeholdbarhed.

## Kommunikation
Hold kommunikation på et absolut minimum. Meget kortfattede orienteringer ved væsentlige ændringer eller milepæle. Ingen forklaring ud over det strengt nødvendige.

## Browser-testadgang
- Browser-verifikation er tilgængelig i Codex CLI og VS Code gennem projektets Playwright-opsætning. Brug den selvstændigt, når browseradfærd er relevant; henvis ikke arbejdet til Codex-appen.
- Brug det mest reproducerbare niveau, der dækker behovet: (1) eksisterende eller nye Playwright E2E-tests til stabil adfærd og regressionsbeskyttelse; (2) den projektlokale `playwright-cli`-skill til hurtig udforskning og konkret kontrol; (3) Playwright MCP til længere interaktive forløb, hvor vedvarende browserkontekst og accessibility snapshots er en fordel. MCP-konfigurationen ligger i `.codex/config.toml` og bliver synlig efter genstart af Codex-sessionen; CLI og E2E-tests kan altid køres direkte fra terminalen.
- **To adskilte Playwright-træer.** `@playwright/test` er projektets E2E-motor i `node_modules`; `@playwright/cli` og `@playwright/mcp` pinner en anden Playwright-runtime og bor derfor i deres eget træ under `.agents/tools` (installeres med `npm run tools:install`). Læg dem aldrig i projektets `package.json`: begge familier deklarerer kommandoen `playwright`, og npm kan kun give den ene `node_modules/.bin/playwright` — så kører `npx playwright test` e2e-filerne med en anden runner-instans, end filerne importerer, og hver fil fejler med «did not expect test.describe() to be called here». `npm run check:tool-isolation` (del af `check:dependencies`) håndhæver adskillelsen.
- Før ad hoc-browserstyring kontrolleres installationen med `node .agents/tools/playwright-cli.mjs --version`. Mangler browserbinæren, installeres den med `npx playwright install chromium`. Start først derefter udviklingsserveren.
- Start Mineo uden Vites `--open`, så brugerens almindelige browser ikke åbnes: kør først `npm run generate:build-info` og derefter `npx vite --config vite.mineo.config.ts --host 127.0.0.1`.
- `npm run test:e2e` starter og stopper selv denne udviklingsserver gennem `playwright.config.ts`. Brug `npm run test:e2e:headed`, når det er relevant at se browseren; automatiseret kontrol køres ellers headless.
- **Maskinprofil.** `e2e/support/machineProfile.ts` måler maskinens kerner, hukommelse og faktiske hastighed og sætter worker-antal og timeout-lofter derefter. På referencemaskinen og i CI giver den præcis de værdier, konfigurationen havde i forvejen; en svagere maskine får færre samtidige browsere og højere lofter, så den ikke fejler med `Target crashed` eller timeouts, der alene skyldes maskinen. Kører suiten på en svagere maskine, skriver den én linje om det. Overstyr med `PLAYWRIGHT_WORKERS` eller `PLAYWRIGHT_TIMEOUT_SCALE`, når en konkret kørsel skal reproduceres.
- Ved browser-tests af Mineo bruges det dedikerede testpassword `Mineo-Codex-Test-2026`.
- Passwordet er bevidst delt i klartekst her, fordi auth-gaten kun er en svag UX-barriere. Det må ikke genbruges til andre systemer eller af rigtige brugere.
- Log ind gennem den synlige loginformular. Omgå ikke gaten ved at manipulere browser-storage.
- Kontrollér som minimum den ændrede brugerrejse, forventet synlig tekst/tilstand samt nye `console.error`- og ukontrollerede page-fejl. Ved synlige UI-ændringer inspiceres også et screenshot i relevant desktop-viewport. Stop alle ad hoc-browser- og udviklingsserverprocesser efter kontrollen.

## Git-rettigheder
Du må læse frit fra git (log, diff, blame, show m.m.) og bruge ikke-destruktive arbejdsværktøjer som `git stash` i det omfang, du finder det relevant. Men du må ikke ændre den historik eller de ændringer, der allerede ligger i git. Konkret:
- **Commit kun på eksplicit besked.** Du committer kun, når brugeren udtrykkeligt beder om det. Udgangspunktet er, at du committer **alle** uncommittede ændringer i working tree. Hvis brugeren specifikt beder om kun at committe ændringerne fra den konkrete opgave, afgrænser du committen til disse ændringer og lader øvrige uncommittede ændringer stå urørte. Du committer som udgangspunkt altid til main, medmindre brugeren specifikt beder om at der oprettes en branch.

### Commit-praksis (hold det simpelt)
- **Lav opdeling let, ikke perfekt.** Saml ændringer der tydeligt hører sammen, i hver sin commit med en dækkende besked. Men brug minimal energi på det: grupér efter hvad der er åbenlyst sammenhængende, og acceptér at en enkelt fil eller hunk kan lande i en nabocommit hvor den ikke passer 100 %. Det er et acceptabelt udfald — ikke noget at bruge tid på at jagte.
- **Default = få commits.** Når ændringerne i praksis udgør ét sammenhængende stykke arbejde, så lav **én** commit. Opdel kun når der er to-tre klart adskilte temaer. Sigt efter det laveste antal commits der stadig giver en ærlig historik.
- **Undgå kirurgisk staging som standard.** Brug ikke `git stash`, `git add -p`, hunk-opdeling eller fil-for-fil-staging blot for at gøre en normal commit pæn. Hvis brugeren specifikt beder om en opgaveafgrænset commit, må du bruge præcis fil- eller hunk-staging for at holde øvrige ændringer ude. Manuel hunk-patch er da kun til at adskille den konkrete opgaves ændringer fra andres, ikke til at pynte på commit-grænser.
- **Subject-linjen skal stå alene.** Første linje er det eneste der vises i `git log` og historik-visningen. Den skal være én selvstændig, beskrivende dansk linje (~50–70 tegn) der giver fuld mening uden body.
  - **Aldrig** et bart præfiks/scope som subject (skriv `login: synligt fokus på Log ind-knap`, ikke `@ login` med detaljen i body). Læg aldrig kernen i bodyen og efterlad en tom eller triviel subject.
  - Start ikke subject med tegn der tolkes eller render dårligt: ikke `#` (strippes som kommentar af git), og undgå at lade `@` stå som det første meningsbærende ord.
  - Body er valgfri og kun til kontekst der ikke kan rummes i subject (hvorfor, ikke hvad). Saml relateret arbejde i subject frem for at flytte det til body.
- **Slet aldrig andres uncommitted ændringer.** Du må aldrig bruge `git checkout`, `git restore`, `git reset`, reverse-patches (`git apply -R`) eller tilsvarende til at føre filer tilbage til en tidligere git-version, hvis det kan slette uncommitted ændringer, du ikke selv med sikkerhed har lavet. Er der tvivl om ejerskab eller formål, stopper du og spørger. Skal du fjerne dine egne ændringer i en fil, hvor der også findes andres ændringer, må du kun fjerne præcist dine egne hunks med manuel patch efter at have inspiceret diffen.
- **Push aldrig.** Du må under ingen omstændigheder pushe til git, og du må heller ikke spørge om lov til at pushe. Kun brugeren pusher.
- **Pre-commit hook (forventet).** En Husky-hook (`.husky/pre-commit`) kører automatisk ved hvert commit: encoding/mojibake-tjek (`check:mojibake`) og filnavns-casing-tjek (`check:filename-case`). Programversion regenereres ikke i pre-commit; build-info genereres af `scripts/generate-build-info.mjs` før dev/build/test/CI. Hooken printer `HUSKY PRE-COMMIT KØRER`. Omgå den aldrig med `--no-verify`. Fejler den (typisk mojibake eller casing), så ret årsagen i stedet for at springe den over.

## Reviews og subagents
En væsentlig del af arbejdet er reviews. Ved hvert review skal du overveje at uddelegere til subagents, og du gør det gerne — er du i tvivl, så gør det. Du har fri beslutningsret over hvornår og hvor mange. Begrundelse: dit eget kontekstvindue bliver hurtigt ustruktureret ved brede gennemgange; fan-out til subagents holder hovedtråden ren, så du kun beholder konklusionerne, ikke fil-dumps.

## Krav-håndtering
- Brugeren leverer krav, hensigt og domæneregler.
- Er krav tvetydige, modstridende eller ufuldstændige: stop og påpeg det, før du koder.
- Sig fra, hvis du ikke forstår den relevante del af systemet — gæt ikke; markér antagelser eksplicit.

## Ufravigelige constraints
- 100 % client-side. Indfør **aldrig** serverkommunikation, eksterne API'er, telemetri eller ekstern logging.
- Enhver sti der kan flytte brugerdata ud af browseren er en alvorlig GDPR-risiko og skal påtales.
- Indfør ikke nye dependencies medmindre nødvendigt; begrund da bundle-, vedligehold- og risikokonsekvenser, og hvorfor eksisterende ikke kan løse problemet.
- Al brugervendt tekst er dansk. Citeret UI-tekst i kode/kommentarer/docs skal matche den faktiske danske UI-tekst.

## Sprogpolitik (ét ensartet princip)
Sproget skal være ensartet overalt efter disse regler — afvigelser rettes, hver gang du støder på dem:
- **Brugervendt tekst:** dansk (jf. ovenfor).
- **Kontrakter** (`src/contracts/*.md`): dansk uden undtagelse.
- **Kodekommentarer, JSDoc og øvrige docs (`docs/`):** dansk prosa. Etablerede tekniske fagudtryk uden naturlig dansk pendant beholdes på engelsk i deres faste form (fx *blur*, *focus state*, *debounce*, *commit*, *render*, *mount*) — oversæt dem ikke kunstigt. Selve sætningen, forklaringen og strukturen er dansk; kun det enkelte fagudtryk er engelsk. Skriv ikke hele engelske kommentar- eller dokumentafsnit.
- Identifikatorer i koden (variabel-, funktions-, type- og filnavne) er ikke omfattet og ændres kun efter de almindelige struktur- og navngivningsregler.

## Før du ændrer (obligatorisk)
- Inspicér nærliggende moduler og følg eksisterende mønstre (navngivning, struktur, validering, state-flow, fejlhåndtering). Identificér det mønster du retter dig ind efter, før du implementerer.
- **Genbrug før du skaber.** Søg aktivt i delte placeringer før du laver en ny helper/utility: `src/utils/`, `src/validators/`, `src/schemas/`, `src/domain/`, `src/calculation/`, `src/settings/`, `src/types/`, `src/components/tables/` — samt nærliggende feature-lokale moduler og repo-bred søgning på nøgleord/funktionsnavne.
- Genbrug eller udvid den kanoniske helper; lav ikke parallelle eller smallere varianter. Overlapper helpers, konsolidér til én. Placér nye helpers det kanoniske sted for det concern — aldrig feature-lokale inline-helpers til tværgående concerns (datoer, formattering, afrunding, parsing, validering).

## Konvergens (rød tråd)
- Al brugervendt adfærd og udseende skal være ensartet. Løs samme problem med samme mønster; undgå parallel logik og konkurrerende implementeringer for samme concern.
- Foretræk forenkling og konsolidering over nye abstraktioner og lag. Indfør ikke abstraktioner til hypotetisk fremtidig genbrug; kun aktuel duplikering eller grænse-smerte retfærdiggør dem.
- Afvig kun når domænet reelt adskiller sig, eller unifikation skader sikkerhed/klarhed. Uundgåelige undtagelser begrundes eksplicit i kode ved callsite (årsag, risiko, re-evaluerings-trigger). Opdatér denne fil kun, når en undtagelse etablerer en ny generel regel.
- **Begrund ikke-indlysende rettelser i koden.** Når en ændring løser et konkret problem, og koden ikke i sig selv afslører hvorfor den ser ud som den gør, tilføjer du en kort kommentar om baggrunden (hvilket problem den løser, og hvorfor den naive form ikke virker). Det værner mod, at rettelsen senere fjernes ved en fejl i en refactor, fordi den fremstod overflødig. Hellere én linje for meget end en regression.

## Type- og schema-autoritet
- Strict TypeScript. Ingen `any`. Type-assertions kun når beviseligt sikre.
- Zod-schemas er **eneste** sandhedskilde for runtime-validering og afledte typer (ingen Zod↔TS-mismatch).
- Persisteret brugerinput skal være fuldt dækket af Zod-schemas og må ikke kunne eksistere uden for schema-dækning.
- Design/opdatér schemas og typer **før** du ændrer implementeringslogik.

## Form-kerneregel: Ingen live preview
- **Åben draft** = igangværende tekst under redigering. **Afsluttet input** = enten schema-valideret canonical værdi eller rejected rå tekst efter settle. **Domæneprojektion** = beregningsklart input afledt gennem `InputReader`.
- Settle sker ved blur/Enter gennem samme feltmotor på formular- og tabeloverflader. Beregn/validér/vis **aldrig** afledt feedback fra `onChange`-draft. Mens editoren er åben, bruger visning, beregning og dokumentgate senest afsluttede revision.
- Escape annullerer universelt til feltets tilstand ved editorens åbning og må ikke committe ved efterfølgende blur.
- **Eneste 3 immediate-commit-undtagelser:** (1) Delete/Backspace på et fokuseret ikke-redigerende formularfelt eller en celle rydder og committer straks; (2) valg af dropdown-menupunkt committer straks (ikke søge-/filter-tekst); (3) toggle/radio-aktivering committer straks.
- En korrekt formateret tal-/år-/ugeværdi, som kan valideres af det persisterede Zod-schema, committes canonical. Feltets aktive min/max samt kronologiske og tværgående domænegrænser afledes som røde feltissues og må ikke gøre en ellers repræsenterbar værdi rejected. Ved et ugyldigt formatsettle ryddes feltets canonical slot til dets tomværdi, og den rå fejlende tekst gemmes atomisk — samme felt kan aldrig samtidig have en ikke-tom canonical værdi og rejected råtekst (XOR-invarianten). Den tidligere canonical værdi findes derefter **kun** i undo-historikken, aldrig maskeret i den aktuelle tilstand, og hverken den eller den rejected værdi må nå en beregning, selector, save-model eller dokumentmodel.

## Runtime data-integritet
- I en aktiv session må afsluttet canonical eller rejected brugerinput ikke forsvinde, nulstilles eller muteres implicit pga. navigation, re-renders, tab-skift eller intern sync.
- State-synkronisering må aldrig overskrive afsluttet input med afledte/default-værdier uden eksplicit brugerhandling. Effekter der synker props→state må aldrig overskrive allerede afsluttet input.
- Brug eksplicitte immutable opdateringer; undgå skjult mutation i domæne-/state-flows.

## Save/load (.eo) — trust-kritisk
- Stille datatab er uacceptabelt. Save inkluderer alt canonical brugerinput og kun schema-valideret brugerinput. Rejected input overlever F5 i sessionen, men blokerer `.eo`-save og skrives aldrig i filen. Persistér kun brugerindtastet/-valgt data; genberegn afledte værdier efter load.
- Load er atomisk medmindre brugeren eksplicit accepterer delvis load i preflight. Ingen in-memory state muteres før preflight-beslutningen er bekræftet. Ved load/apply-fejl: bevar nuværende state uændret og vis eksplicit fejl.
- Samme Zod-schemas (eller direkte schema-afledte validatorer) validerer både pre-save state og loaded `.eo`-data før apply.
- **Forward/backward-tolerant load:** En gammel `.eo`-fil indlæses med så meget schema-gyldigt input som muligt. Ukendte/fjernede felter eller sektioner må ikke i sig selv fejle hele loadet. Nye schema-felter der mangler i en ældre fil må aldrig blokere load eller udløse advarsel. App-settings/device-lokale defaults må ikke injiceres under load for at få en gammel fil til at se komplet ud. Kan alle faktisk tilstedeværende værdier loades, tæller loadet som vellykket.
- **Preflight** viser forventede/loadbare/fejlende counts og brugervenlige fejlårsager, med præcis disse valg: "Indlæs trods fejl", "Send fejloplysninger", "Stop og gør intet".
- Vellykket fejlfrit load skal opfylde streng save→load round-trip for brugerinput. Behold ikke legacy-runtimekode eller kompatibilitets-stier alene for at bevare gamle interne modeller.

## Kanoniske inputgrænser
Brug det mest restriktive niveau, der dækker behovet:

| Niveau | Grænse | Bruges af |
|--------|--------|-----------|
| **Læs** | `InputReader` eller navngiven typed projektion | Beregning, validering, save, dokumenter og read-only sideforbrug |
| **Rediger** | Felt-editorfacade med `FieldRef` og typed commands | Formular- og tabeloverflader; ingen rå sektionswrites |
| **System** | Autoritativ transaction/replace-port | Kun input-, persistence-, load/reset- og history-infrastruktur |

Kun inputinfrastrukturen må se aggregatets rå `sections` og rejected-input-map. `FormPersistenceContext`, sektionsselectors, `usePersistedForm`, `invalidDrafts`-/`fieldErrors`-API'erne og draft-hookene er SLETTET (2026-07-25) og må ikke genindføres — hverken under de gamle navne eller som en ny parallel inputmodel. Et AST-værn håndhæver det.

## Validering og fejl-UI
- Ugyldigt input: rød kant + tooltip ved hover. Ingen inline-valideringstekst under felter.
- Range/dato-tooltips skal indeholde konkrete grænser. Findes ingen gyldige datoer (min > max): tooltippen forklarer dette, viser begge grænser og navngiver de brugervendte inputs der producerer dem.
- Talformattering i UI/tooltips følger danske konventioner.
- Afledelige issues beregnes rent fra `InputReader`, feltdefinitioner og domænevalidatorer; mounted komponenter rapporterer dem ikke til en central store.
- Ethvert dokumentrelevant issue med fejlseverity blokerer download. Downloadknappen er både visuelt og funktionelt disabled på den senest afsluttede blokerede revision. En åben draft ændrer ikke gaten; aktivering finaliserer editoren og kører samme dokumentdefinition igen på en frisk revision før generator eller fil-I/O.

## Numerik
- Deterministisk numerik. Genbrug kanoniske afrundings-/formatterings-/currency-helpers; ingen ad hoc-afrunding eller inline numerik/currency i feature-komponenter. Indfør ikke nye numeriske strategier.

## Console-politik
Normal drift er console-tavs. `console.error`: reelle fejl (datatab, brudte invarianter). `console.warn`: exceptionelle ikke-fatale tilstande. `console.debug`: normale signaler, kun DEV. `console.log`: undgå.

## Desktop-only gate
- Appen blokeres på mobil/tablet. Den øverste capability-gate ligger i `src/apps/shared/bootstrapClientApp.tsx`, bruger touch-capability og en orienteringsstabil kortsidegrænse og kaldes fra hver app-entry (`src/main.tsx`, `src/apps/minprocesrente/minprocesrenteMain.tsx`).
- Ikke-understøttede enheder renderer `src/components/system/UnsupportedDevicePage.tsx` som hård stop; den holdes isoleret fra forretningslogik/state/persistence.
- Ingen viewport-responsiv adfærd (`@media (max|min-width)`, MUI-breakpoints) uden for den pinnede filliste i `app-shell-contract.md` §5.3 — standalone MinProcesrentes egne filer plus de få flader, der bevidst deles med den. Listen er håndhævet af `shell/viewport-responsive-styling-allowlist`; en ny responsiv fil gør harnesset rødt. Input-modalitet (`pointer: coarse`, `hover:`) er ikke omfattet.

## Normative kontrakter
Følg de kontrakter der er klassificeret som bindende i `src/contracts/contract-topology.json`. Bredt relevante: `form-contract.md`, `domain-boundary-contract.md`, `page-component-contract.md`, `keyboard-navigation.md`.

**Du ejer kontrakterne og enhver anden autoritativ beskrivelse.** Du er ikke bundet af deres nuværende tilstand — din opgave er at holde dem opdateret til det bedst mulige slutprodukt og derefter implementere på baggrund af den opdaterede kontrakt, ikke den gamle. Læs relevante kontrakter før du implementerer inden for deres scope. Kontrakter er bindende, **så længe de tjener det bedst mulige slutprodukt** — står en kontrakt i vejen for en reel forbedring eller er ude af sync med en sundere arkitektur, forbedrer du selve kontrakten frem for blindt at følge den. En kontraktændring er en arkitekturbeslutning: berører den ikke UI/UX eller beregningslogik, træffer du den selv; ellers forelægges den. Kode der afviger fra en gældende kontrakt uden at kontrakten er opdateret, er en arkitekturfejl. Ved tilføjelse/fjernelse/omdøbning/omklassificering af en kontrakt: følg `docs/architecture/contract-topology-procedure.md` og opdatér topologien i samme ændring.

**Kontrakthierarki ved overlap:** (1) mest specifikke domænekontrakt vinder for sit emne; (2) tværgående kontrakter (`domain-boundary`, `calculation-data`, `form`, `critical-action`, `persistence`, `schema-evolution`, `keyboard-navigation`, `error`, `document-format`, `document-output`, `periodisering`, `date`, `mineo-field-pattern`, `amount`, `undo-redo`, `app-settings`, `snapshot`, `auth-gate`, `app-shell`) begrænser øvrige; (3) `page-component-contract.md` underordnet de tværgående; (4) domænekontrakter underordnet relevante generelle, undtagen hvor de definerer domænespecifikke regler de generelle bevidst overlader; (5) `docs/architecture/*.md` informativt medmindre en kontrakt eksplicit ophøjer en regel derfra.

**Prioritet ved konflikt:** `src/contracts/*.md` > `AGENTS.md`.

## Filstruktur og placering — stående ansvar
Du har ansvar for, at filer og helpers/utils er korrekt navngivet og placeret. Hver gang du bliver opmærksom på, at noget hører mere hensigtsmæssigt hjemme et andet sted, **flytter og omdøber du det** — du venter ikke på tilladelse (det er en koderelateret beslutning). Du **opdeler** filer med for mange ansvarsområder og **merger** filer der overlapper, i det omfang det forbedrer kvalitet og en ensartet struktur. Opdatér alle imports/referencer i samme ændring, så intet efterlades brudt.

## Tilfældighedsfund — rapportér altid
Filnavngivning · filplacering · forældet indhold (kommentarer/config/kode der ikke afspejler virkeligheden) · filer der bør konsolideres eller splittes · overflødige/ubrugte filer og exports · død kode · kontraktdrift (kode ↔ dokumentation ude af sync) · inkonsistente mønstre (samme problem løst på to måder uden grund). Prioritér fund der påvirker korrekthed, vedligeholdbarhed eller konvergens; undgå mikro-nits.

## Tests
- **Stående ansvar for testdækning.** Hver gang du kommer i berøring med et område, vurderer du, om det er tilstrækkelig testdækket. Er det ikke det, tager du selv ansvar for at skrive de manglende tests — også når det blot er et tilfældighedsfund uden for det aktuelle scope, og også for kode du ikke selv har skrevet. Gælder især kritiske stier (beregning, validering, save/load).
- Kritiske stier (beregning, validering, save/load) skal have meningsfulde tests, der hævder korrekte invarianter — ikke implementeringsdetaljer. Tilføj/opdatér tests når adfærd ændres; prioritér beregnings- og persistence-tests før UI-tests.
- Følg eksisterende teststruktur og -mønstre (Vitest, `src/__tests__/` der spejler kildestrukturen); indfør ikke nye frameworks/paradigmer. Mindst ét top-level `describe('<modul-eller-funktion>')` pr. testfil; ingen flade top-level `it(...)`-filer.
- Undgå over-mocking og flakiness. Fjern kode der kun eksisterer for at understøtte tests.

## Kvalitetsgate før handoff
Verificér: krav-korrekthed · Zod↔TS-alignment · ingen usikker typing · ingen utilsigtede sideeffekter/datatab · arkitektonisk konsistens med kontrakter.

### Hvornår køres hvilke tjek
Tjekkene har forskellig dækning og pris. Vælg det smalleste tjek der realistisk kan fange fejl i den ændring, du netop har lavet; udvid først når risikofladen kræver det. Kør ikke hele gates rutinemæssigt efter mikro-ændringer, doc-only ændringer eller ren flytning uden adfærdsændring. Fejler et relevant tjek og kan det rettes deterministisk: ret det før handoff. Ellers stop og spørg.

**Grundregel:** Ingen tjek er nødvendige for rene ændringer i dokumentation/procesregler, medmindre ændringen berører scripts, config, genereret output eller en kontrakt der skal verificeres mod kode. For kodeændringer køres tjek efter en sammenhængende delændring, ikke efter hver enkelt hunk.

**Fuld Vitest-suite:** Den kan legitimt overstige to minutter (senest målt ca. 3½ minut). Brug mindst 10 minutters værktøjs-timeout ved `npm run test` eller `npm run test:coverage`; behold processen aktiv og aflæs status løbende frem for at genstarte den efter to minutter uden et afsluttet resultat.

| Tjek | Kommando | Hvornår |
|------|----------|---------|
| **Typecheck (kildekode)** | `npm run typecheck` | Efter en sammenhængende ændring af `.ts/.tsx` i `src/` uden for `__tests__`, når ændringen påvirker typer, imports/exports, props, schemas, hooks, state, domænefunktioner eller delt infrastruktur. Kan springes over ved ren tekst-/kommentarændring, CSS-only ændring, eller mekanisk flytning hvor imports allerede er verificeret af et smallere relevant tjek. |
| **Typecheck (tests)** | `npm run typecheck:test` | Når en testfil er oprettet, ændret eller flyttet, eller når produktionskode har ændret en type/signatur som tests bruger. Tests bruger en separat `tsconfig.test.json`, så `typecheck` alene er ikke nok for testkode. |
| **Typecheck (E2E)** | `npm run typecheck:e2e` | Når en Playwright-test eller `playwright.config.ts` er oprettet, ændret eller flyttet. |
| **Lint** | `npm run lint` | Før handoff når der er ændret kode, scripts, config eller tests på en måde der kan give lint-fejl. Kan springes over ved rene dokumentations-, kommentar- eller kontrakttekstændringer. Altid før commit. |
| **Tests** | `npm run test` eller målrettet `npx vitest run <sti>` | Kør målrettede tests for berørte moduler, når adfærd, validering, state-flow, persistence, beregning, parsing, formattering eller schema-regler er ændret. Kør fuld suite før handoff/commit når ændringen rører beregning, validering, save/load, persistence, delt state/infrastruktur, eller når flere områder kan være indirekte påvirket. Kan springes over ved ren refaktor uden adfærdsændring, hvis typecheck/lint dækker risikoen bedre. |
| **Browser/E2E** | `npm run test:e2e` eller målrettet `npx playwright test <sti>` | Når ændringen berører browserafhængig adfærd, brugerrejser, routing, auth, service workers, keyboard/focus, fil-I/O eller synligt UI. Brug derudover Playwright CLI/MCP til udforskende kontrol, når en fast test ikke alene kan verificere fundet. |
| **Afhængigheder** | `npm run check:dependencies` | Når `package.json`, `package-lock.json` eller `.agents/tools`-manifestet er ændret. Kontrollerer også, at ingen to top-level pakker slås om det samme kommandonavn i `node_modules/.bin`. |
| **Build** | `npm run build` | Kun når en ændring kan påvirke bundling, app-entry, Vite/build-config, dynamiske imports, asset-stier, dependency-opsætning eller generering af distributable output. Ikke rutinemæssigt efter domæne-/UI-ændringer der allerede er dækket af typecheck og relevante tests. |

**Før handoff:** Rapportér præcist hvilke tjek der er kørt, og hvilke der bevidst er sprunget over med kort begrundelse. For doc-only/procesændringer er det acceptabelt at skrive, at ingen tjek er kørt, fordi ingen kode er ændret.

**Rækkefølge før commit:** `typecheck` (hvis kildekode er rørt) → `typecheck:test` (hvis tests eller testbrugte typer er rørt) → `typecheck:e2e` (hvis Playwright er rørt) → `lint` → relevant testniveau, som fuld `test` og/eller `test:e2e` når tabellen kræver det. Alt relevant skal være grønt, før du committer. Husk at en kode-rettelse, der ændrer adfærd, også kræver at du opdaterer eller tilføjer de tests, der hævder den adfærd (jf. [Tests](#tests)).

## Holdning
Udfordr usikre arkitekturantagelser. Optimér for deterministisk adfærd, tillid og klarhed over hastighed. Foretræk eksplicit, auditerbar kode over smarte genveje; undgå skjult state og implicit adfærd. Anvend fail-closed på usikre/ugyldige kritiske data — gæt ikke i stilhed.
