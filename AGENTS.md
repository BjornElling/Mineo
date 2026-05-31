# AGENTS.md — Mineo

## Projekt
Mineo er en trust-kritisk, 100 % client-side erstatningsberegner for danske arbejdsskadesager. Forkerte beregninger, datatab eller uforudsigelig adfærd er uacceptabelt.

**Fase:** Programmet er funktionelt næsten færdigt og fungerer i brugerens øjne, men er i intern testfase — der er ingen eksterne brugere. Arkitekturen er vokset organisk og er mange steder ustruktureret. Opgaven er at færdiggøre programmet til produktion: gennemstruktureret, ensartet og fejlfrit. Der er ingen tidshorisont; slutproduktets kvalitet er det eneste mål.

**Stack:** TypeScript (strict) · React 19 · Vite 7 · MUI 7 · Zustand 5 · Zod 4 · jsPDF · dayjs.

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

## Git-rettigheder
Du må læse frit fra git (log, diff, blame, show m.m.) og bruge ikke-destruktive arbejdsværktøjer som `git stash` i det omfang, du finder det relevant. Men du må ikke ændre den historik eller de ændringer, der allerede ligger i git. Konkret:
- **Commit kun på eksplicit besked.** Du committer kun, når brugeren udtrykkeligt beder om det. Når du gør, committer du **alle** uncommittede ændringer i working tree — intet efterlades ucommittet — og fordeler dem på de relevante commits, så ændringer der systematisk hører sammen, samles, med en dækkende commit-besked til hver.
- **Push aldrig.** Du må under ingen omstændigheder pushe til git, og du må heller ikke spørge om lov til at pushe. Kun brugeren pusher.

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
- **Kontrakter** (`src/contracts/*.md`): dansk uden undtagelse. (`date-contract.md` og `mineo-field-pattern.md` skal oversættes til dansk.)
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
- **Draft** = igangværende input under indtastning. **Committed** = schema-valideret kanonisk input brugt til beregning og save/load.
- Commit sker på `onBlur` (forms) og `onPersist` (table-grænse). Beregn/validér/vis **aldrig** afledt feedback fra `onChange`-draft. Beregninger og "har ændret sig"-baselines bruger kun committed state.
- **Eneste 3 immediate-commit-undtagelser:** (1) Delete/Backspace på fokuseret ikke-redigerende celle rydder og committer straks; (2) valg af dropdown-menupunkt committer straks (ikke søge-/filter-tekst); (3) toggle/radio-aktivering committer straks.

## Runtime data-integritet
- I en aktiv session må committed brugerinput ikke forsvinde, nulstilles eller muteres implicit pga. navigation, re-renders, tab-skift eller intern sync.
- State-synkronisering må aldrig overskrive committed brugerinput med afledte/default-værdier uden eksplicit brugerhandling. Effekter der synker props→state må aldrig overskrive allerede committed input.
- Brug eksplicitte immutable opdateringer; undgå skjult mutation i domæne-/state-flows.

## Save/load (.eo) — trust-kritisk
- Stille datatab er uacceptabelt. Save inkluderer alt brugerindtastet input og kun schema-valideret brugerinput. Persistér kun brugerindtastet/-valgt data; genberegn afledte værdier efter load.
- Load er atomisk medmindre brugeren eksplicit accepterer delvis load i preflight. Ingen in-memory state muteres før preflight-beslutningen er bekræftet. Ved load/apply-fejl: bevar nuværende state uændret og vis eksplicit fejl.
- Samme Zod-schemas (eller direkte schema-afledte validatorer) validerer både pre-save state og loaded `.eo`-data før apply.
- **Forward/backward-tolerant load:** En gammel `.eo`-fil indlæses med så meget schema-gyldigt input som muligt. Ukendte/fjernede felter eller sektioner må ikke i sig selv fejle hele loadet. Nye schema-felter der mangler i en ældre fil må aldrig blokere load eller udløse advarsel. App-settings/device-lokale defaults må ikke injiceres under load for at få en gammel fil til at se komplet ud. Kan alle faktisk tilstedeværende værdier loades, tæller loadet som vellykket.
- **Preflight** viser forventede/loadbare/fejlende counts og brugervenlige fejlårsager, med præcis disse valg: "Indlæs trods fejl", "Send fejloplysninger", "Stop og gør intet".
- Vellykket fejlfrit load skal opfylde streng save→load round-trip for brugerinput. Behold ikke legacy-runtimekode eller kompatibilitets-stier alene for at bevare gamle interne modeller.

## Kanoniske persistence-hooks
Brug det mest restriktive niveau der dækker behovet:

| Niveau | Hook / API | Bruges af |
|--------|-----------|-----------|
| **Læs** | `usePersistedSectionSelector(pageKey)` (`hooks/useFormPersistenceSelectors`) | Al kode der læser persisted data (read-only, re-rendrer kun ved ændring i sektionen) |
| **Rediger** | `usePersistedForm(schema, pageKey, initialValues)` | Sidekomponenter med formularer (`setValues`, `handleChange`, commitOnBlur) |
| **System** | `useFormPersistence()` context direkte | Kun `MainLayout`, `FormPersistenceProvider`, persistence-infrastruktur (fuld API: `replaceAllPersistedData`, `clearAllData`, `persistData`) |

`FormPersistenceContext` er en facade over `formPersistenceStore` (Zustand) — storen er source of truth. Importér aldrig `FormPersistenceContext` direkte fra domæne-/sidekomponenter.

## Validering og fejl-UI
- Ugyldigt input: rød kant + tooltip ved hover. Ingen inline-valideringstekst under felter.
- Range/dato-tooltips skal indeholde konkrete grænser. Findes ingen gyldige datoer (min > max): tooltippen forklarer dette, viser begge grænser og navngiver de brugervendte inputs der producerer dem.
- Talformattering i UI/tooltips følger danske konventioner.

## Numerik
- Deterministisk numerik. Genbrug kanoniske afrundings-/formatterings-/currency-helpers; ingen ad hoc-afrunding eller inline numerik/currency i feature-komponenter. Indfør ikke nye numeriske strategier.

## Console-politik
Normal drift er console-tavs. `console.error`: reelle fejl (datatab, brudte invarianter). `console.warn`: exceptionelle ikke-fatale tilstande. `console.debug`: normale signaler, kun DEV. `console.log`: undgå.

## Desktop-only gate
- Appen blokeres på mobil/tablet. Den øverste capability-gate ligger i `src/apps/shared/bootstrapClientApp.tsx` og kaldes fra hver app-entry (`src/main.tsx`, `src/apps/minprocesrente/minprocesrenteMain.tsx`).
- Ikke-understøttede enheder renderer `src/components/pages/UnsupportedDevicePage.tsx` som hård stop; den holdes isoleret fra forretningslogik/state/persistence.
- Mobil/tablet-specifik styling må kun findes i `UnsupportedDevicePage.tsx`. Ingen global responsiv adfærd (`@media`) i delte/globale styles.

## Normative kontrakter
Følg de kontrakter der er klassificeret som bindende i `src/contracts/contract-topology.json`. Bredt relevante: `form-contract.md`, `domain-boundary-contract.md`, `page-component-contract.md`, `keyboard-navigation.md` (+ QA: `docs/testing/keyboard-navigation-test-checklist.md`).

**Du ejer kontrakterne og enhver anden autoritativ beskrivelse.** Du er ikke bundet af deres nuværende tilstand — din opgave er at holde dem opdateret til det bedst mulige slutprodukt og derefter implementere på baggrund af den opdaterede kontrakt, ikke den gamle. Læs relevante kontrakter før du implementerer inden for deres scope. Kontrakter er bindende, **så længe de tjener det bedst mulige slutprodukt** — står en kontrakt i vejen for en reel forbedring eller er ude af sync med en sundere arkitektur, forbedrer du selve kontrakten frem for blindt at følge den. En kontraktændring er en arkitekturbeslutning: berører den ikke UI/UX eller beregningslogik, træffer du den selv; ellers forelægges den. Kode der afviger fra en gældende kontrakt uden at kontrakten er opdateret, er en arkitekturfejl. Ved tilføjelse/fjernelse/omdøbning/omklassificering af en kontrakt: følg `docs/architecture/contract-topology-procedure.md` og opdatér topologien i samme ændring.

**Kontrakthierarki ved overlap:** (1) mest specifikke domænekontrakt vinder for sit emne; (2) tværgående kontrakter (`domain-boundary`, `form`, `persistence`, `schema-evolution`, `keyboard-navigation`, `error-debug`, `pdf`, `pdf-layout`, `periodisering`, `date`, `mineo-field-pattern`, `amount`, `undo-redo`, `app-settings`) begrænser øvrige; (3) `page-component-contract.md` underordnet de tværgående; (4) domænekontrakter underordnet relevante generelle, undtagen hvor de definerer domænespecifikke regler de generelle bevidst overlader; (5) `docs/architecture/*.md` informativt medmindre en kontrakt eksplicit ophøjer en regel derfra.

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

Kør efter hver kodeændring: `npm run typecheck`. Fejler typecheck/lint/test/build og kan rettes deterministisk: ret det før handoff. Ellers stop og spørg.

## Holdning
Udfordr usikre arkitekturantagelser. Optimér for deterministisk adfærd, tillid og klarhed over hastighed. Foretræk eksplicit, auditerbar kode over smarte genveje; undgå skjult state og implicit adfærd. Anvend fail-closed på usikre/ugyldige kritiske data — gæt ikke i stilhed.
