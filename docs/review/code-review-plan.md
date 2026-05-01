# Code Review Plan — Mineo

## Status

| Punkt | Navn | Status | Fil |
|---|---|---|---|
| 1.1 | Kontrakter: persistence, schema-evolution, form, page-component | ⬜ Ikke startet | — |
| 1.2 | Kontrakter: domain-boundary, periodisering, snapshot, eo-snapshot | ⬜ Ikke startet | — |
| 1.3 | Kontrakter: date, mineo-field-pattern, error-debug, app-settings | ⬜ Ikke startet | — |
| 1.4 | Kontrakter: pdf, pdf-layout, keyboard-navigation (+ checklist) | ⬜ Ikke startet | — |
| 1.5 | Arkitektur-dokumentation: calculation, pdf, debug-builder | ⬜ Ikke startet | — |
| 1.6 | Helhedsvurdering af kontraktlandskabet og arkitektoniske grundprincipper | ⬜ Ikke startet | — |
| 2.1 | Persistence-arkitektur | ✅ Gennemgået | [2.1-persistence-arkitektur.md](2.1-persistence-arkitektur.md) |
| 2.2 | Undo/redo-store | ⬜ Ikke startet | — |
| 2.3 | FormPersistenceContext og store | ⬜ Ikke startet | — |
| 2.4 | Persistence: load, apply, sanitering, session-hydration | ⬜ Ikke startet | — |
| 2.5 | Schema-evolution og versionering | ⬜ Ikke startet | — |
| 3.1 | Zod-schemas: Erstatningsopgørelse | ⬜ Ikke startet | — |
| 3.2 | Zod-schemas: Årsløn, Erhvervsevnetab, Forsørgertab | ⬜ Ikke startet | — |
| 3.3 | Zod-schemas: Renteberegning, Varige Mén, Stamdata, Satser | ⬜ Ikke startet | — |
| 3.4 | Schema-fingerprint og save-order-registry | ⬜ Ikke startet | — |
| 4.1 | Årsløn: beregning og validering | ⬜ Ikke startet | — |
| 4.2 | Erhvervsevnetab (EET): kernemotor og delberegninger | ⬜ Ikke startet | — |
| 4.3 | EET: aldersreduktion, regulering, differencekrav | ⬜ Ikke startet | — |
| 4.4 | EET: kapitalisering og løbende ydelser | ⬜ Ikke startet | — |
| 4.5 | Forsørgertab: beregning og snapshot | ⬜ Ikke startet | — |
| 4.6 | Varige Mén: motor og beregning | ⬜ Ikke startet | — |
| 4.7 | Renteberegning: motor, procesrente og validering | ⬜ Ikke startet | — |
| 4.8 | Erstatningsopgørelse (EO): periodiseringsmotor og engines | ⬜ Ikke startet | — |
| 4.9 | EO: helpers, initial values og tabeller | ⬜ Ikke startet | — |
| 4.10 | EO: snapshot og validation | ⬜ Ikke startet | — |
| 5.1 | Datohåndtering: isoDate, dateUtils, dateFormatting | ⬜ Ikke startet | — |
| 5.2 | Datohåndtering: input-validering, range-errors, utcDayMath | ⬜ Ikke startet | — |
| 5.3 | SH-dage: beregning og oversigt | ⬜ Ikke startet | — |
| 5.4 | Talbehandling: parsing, afrunding, sammenligning | ⬜ Ikke startet | — |
| 6.1 | Data: renter, satser, lovbestemte rater, KRL | ⬜ Ikke startet | — |
| 6.2 | Data: folkepension, sygedagpenge, overenskomst, ydelsestyper | ⬜ Ikke startet | — |
| 6.3 | Data: Offentlig løn — KL og RLTN lookup og typer | ⬜ Ikke startet | — |
| 6.4 | Data: Kapitaliseringstabeller | ⬜ Ikke startet | — |
| 7.1 | Input-komponenter: StyledField-familien | ⬜ Ikke startet | — |
| 7.2 | Input-komponenter: Table-inputs og inputKeyFilters | ⬜ Ikke startet | — |
| 7.3 | Grid-infrastruktur: gridCore, navigation, model | ⬜ Ikke startet | — |
| 7.4 | Table-komponenter: Standard-tabeller og specialiserede tabeller | ⬜ Ikke startet | — |
| 8.1 | Page-komponenter: Stamdata, Årsløn, Satser | ⬜ Ikke startet | — |
| 8.2 | Page-komponenter: Erhvervsevnetab og underkomponenter | ⬜ Ikke startet | — |
| 8.3 | Page-komponenter: Erstatningsopgørelse og underkomponenter | ⬜ Ikke startet | — |
| 8.4 | Page-komponenter: Forsørgertab, Varige Mén, Renteberegning | ⬜ Ikke startet | — |
| 8.5 | Layout: MainLayout, SideMenu, Container, ContentBox | ⬜ Ikke startet | — |
| 9.1 | Hooks: usePersistedForm, usePersistedActiveTab, useUndoRedo | ⬜ Ikke startet | — |
| 9.2 | Hooks: useFileSaveLoad, usePwaLaunchQueue, useUnsavedChangesGuard | ⬜ Ikke startet | — |
| 9.3 | Hooks: domæne-hooks (useAarsloenBeregning, useDraftField m.fl.) | ⬜ Ikke startet | — |
| 10.1 | PDF: Erstatningsopgørelse — model og renderer | ⬜ Ikke startet | — |
| 10.2 | PDF: Renteberegning og delte PDF-utilities | ⬜ Ikke startet | — |
| 10.3 | PDF: utils/pdf og pdf-contracts | ⬜ Ikke startet | — |
| 11.1 | Config: persistenceRegistry, storageManifest, dateRanges | ⬜ Ikke startet | — |
| 11.2 | Config: regulatoryRates, versioning, appTheme, tableTheme | ⬜ Ikke startet | — |
| 11.3 | ~~Auth: AuthGate, auth.ts, authConfig.ts~~ *(fjernet — ikke relevant)* | — | — |
| 12.1 | Testkvalitet: domæneberegninger (årsløn, EET, forsørgertab, varige mén) | ⬜ Ikke startet | — |
| 12.2 | Testkvalitet: EO-motor og EO-snapshot | ⬜ Ikke startet | — |
| 12.3 | Testkvalitet: persistence og schema-evolution | ⬜ Ikke startet | — |
| 12.4 | Testkvalitet: quality-tests og integrationsdækning | ⬜ Ikke startet | — |
| 13.1 | Kontrakt-alignment: src/contracts/ vs. implementering | ⬜ Ikke startet | — |
| 13.2 | Tværgående: duplikering, inkonsistens og dødkode | ⬜ Ikke startet | — |

---

## Reviewinstruktion

### Formål

Dette review gennemgår Mineo systematisk og kontrollerer tre dimensioner:

1. **Kodekvalitet og korrekthed** — Er koden fri for fejl, der kan producere forkerte beregninger, datatab eller inkonsistent tilstand?
2. **Struktur og arkitektur** — Følger koden de etablerede kontrakter og mønstre? Er grænser mellem lag klare og konsistente?
3. **Robusthed over for inputkombinationer** — Er der scenarier, hvor programmet vil crashe eller opføre sig forkert ved manglende, ugyldige eller usædvanlige kombinationer af brugerinput?

Hvert punkt reviewes i sin egen sektion efter nedenstående instruktioner.

---

### Hvad reviewet skal afdække

#### Korrekthed og determinisme
- Beregninger der afhænger af render-timing, sideeffekter, implicit typecasting, locale, tidszoner eller floating-point-afrunding.
- Invarianter der ikke er håndhævet af typer, Zod-schemas eller tests.
- Stier der kan producere inkonsistente afledte værdier eller partielle state-opdateringer.
- Numerisk logik der afviger fra projektets kanoniske helpers for afrunding, formatering og valuta.

#### Crashrisici og inputrobusthed
- Edge cases: tomme felter, `undefined`, `null`, `NaN`, 0, negative tal, fremtidige datoer, datoer udenfor lovlige intervaller.
- Kombinationer af felter der er gyldige i isolation, men ugyldige sammen (fx dato A efter dato B).
- Manglende guards ved grænser: brugerinput der ikke valideres før beregning, persistence-data der ikke saniteres ved load.
- Array-operationer der antager mindst ét element.
- Division der kan ske med 0.

#### Arkitektur og grænser
- Brud på `src/contracts/*.md` og `AGENTS.md`.
- Overcoupling: UI der indeholder beregningslogik; beregningslogik der importerer UI.
- Uklar ejerskab på tværs af moduler.
- Duplikerede sandheder (samme logik to steder, to sources of truth for samme dato eller rente).

#### Type-sikkerhed
- Zod ↔ TypeScript-mismatches ("type lies").
- Usikre assertions (`as`, `!`), `any`, implicit narrowing.
- Manglende validering ved domænegrænser.

#### Tests
- Manglende dækning af beregninger, validering, save/load round-trip og edge cases.
- Tests der tester implementeringsdetaljer frem for invarianter.
- Flakiness og over-mocking.

#### Kompleksitet og vedligeholdbarhed
- Unødvendig indirektion og accidental complexity.
- Duplikeret logik, dødkode og ubrugte exports.
- Filer der er for store eller har for mange ansvarsområder.

---

### Særlig instruktion til gruppe 1 — kontrakter og arkitektur-dokumentation

Punkterne 1.1–1.6 reviewer ikke kode, men de normative dokumenter i `src/contracts/*.md` og `docs/architecture/*.md`. Disse dokumenter er den autoritative kilde til Mineos arkitektur, og resten af reviewet håndhæver dem. Derfor skal de revideres først — og med en bredere optik end den øvrige kode.

For hvert kontraktdokument skal reviewet besvare to dimensioner:

**Dimension A — Korrekthed og fyldestgørelse (intern konsistens):**
- Er kontraktens regler entydige, modsigelsesfri og operationaliserbare?
- Mangler der dækning af kendte cases (edge cases, fejlhåndtering, tværgående scenarier)?
- Er der områder hvor implementeringen er drevet ud over kontraktens dækning, så kontrakten er "haltet bagud"?
- Er kontrakten stadig sand i forhold til den nuværende kode (kontraktdrift)?
- Er ansvar og ejerskab klart afgrænset mod tilstødende kontrakter? Er der overlap eller huller mellem kontrakter?
- Er terminologien konsistent på tværs af kontrakter (samme begreb = samme ord)?

**Dimension B — Arkitektonisk kritik (de bagvedliggende valg):**
- Er de grundprincipper kontrakten hviler på de rigtige? Ville Mineo være et bedre program hvis det blev bygget op om andre kontraktmæssige principper?
- Er ansvarsfordelingen mellem lag (UI · hooks · domæne · persistence · PDF) den optimale, eller er der grænser der ligger forkert?
- Er der kontrakter der burde slås sammen, splittes, omfordeles, eller helt afskaffes?
- Mangler der kontrakter for områder der i dag styres af konvention eller implicit aftale?
- Er der invarianter der i dag håndhæves runtime, men burde løftes ind i typer/schemas — eller omvendt?
- Er kontrakten på det rigtige abstraktionsniveau? For abstrakt = svag styring; for konkret = bremser udvikling.

Output for gruppe 1 skal — udover det normale fund-format — indeholde en sektion **"Arkitektoniske grundprincipper"** der eksplicit tager stilling til om kontraktens fundament er sundt, og hvis ikke, hvilke alternative principper der ville give et bedre system. Dette er ikke en stilistisk øvelse: forslag skal være konkrete, begrundede og knyttet til faktiske smertepunkter.

Punkt 1.6 er en helhedsvurdering der bygger på fundene fra 1.1–1.5 og adresserer kontraktlandskabet samlet — herunder om der er strukturelle huller, om hierarkiet `src/contracts/*.md > AGENTS.md > CLAUDE.md` (jf. `CLAUDE.md`) er fornuftigt, og om kontrakternes samlede dækning matcher Mineos faktiske kompleksitet.

---

### Format for hvert enkelt review

Hvert review gemmes i en separat fil i `docs/review/` og navngives efter punktnummeret, fx `2.1-persistence-arkitektur.md`.

Filen følger dette format:

```
# Review: [punktnummer] [navn]

**Dato:** ÅÅÅÅ-MM-DD  
**Filer gennemgået:** [liste]  
**Filer ikke gennemgået:** [hvis relevant]

## Fund

[Nummereret liste: severity, lokation, problem, risiko, anbefaling]

## Tilfældighedsfund

[Alt bemærket undervejs der falder udenfor scope]

## Sammenfatning

[2–5 bullets med de vigtigste pointer]
```

Severity-skala:
- **Kritisk** — Kan producere forkerte beregninger, datatab eller bryde invarianter.
- **Høj** — Arkitekturfejl, type-usikkerhed eller manglende validering med reel risiko.
- **Medium** — Kompleksitet, duplikering eller manglende tests der hæmmer vedligeholdelse.
- **Lav** — Inkonsistens, mindre forbedringer eller oprydning.

---

### Rækkefølgerationale

Reviewet følger afhængighedsorden nedefra og op:

| Gruppe | Indhold | Begrundelse |
|---|---|---|
| **1 — Kontrakter og arkitektur-dokumentation** | `src/contracts/*.md` og `docs/architecture/*.md` | Kontrakterne er normative og styrer alt øvrigt review. Hvis kontrakterne er forkerte, ufuldstændige eller hviler på tvivlsomme arkitektoniske grundprincipper, vil resten af reviewet blot håndhæve fejlbehæftede regler. Dette punkt skal både validere indholdet (er det dækkende og korrekt?) og udfordre de bagvedliggende valg (burde Mineo bygges på andre principper?) |
| **2 — Persistence** | Store, context, load/apply, schema-evolution | Alt andet afhænger af at data gemmes og loades korrekt |
| **3 — Schemas** | Alle Zod-schemas | Schemas definerer grænsefladen til persistence og beregning |
| **4 — Domænelogik** | Alle beregninger | Kernen i systemet — reviewes før UI |
| **5 — Hjælpefunktioner** | Dato, tal, serialisering | Fundamentale utilities brugt af al domænelogik |
| **6 — Data** | Ratetabeller og opslag | Statiske data der er forudsætning for korrekte beregninger |
| **7 — UI-inputs** | Input-komponenter og grid | Brugergrænsefladen mod beregningslagene |
| **8 — Pages** | Sider og layout | Sammensætning af input og præsentation |
| **9 — Hooks** | Custom React hooks | Lim mellem UI og domæne |
| **10 — PDF** | PDF-generering | Separat outputkanal, men afhænger af domænedata |
| **11 — Config** | Konfiguration | Rammeværk og applikationsopsætning |
| **12 — Testkvalitet** | Tests for ovenstående | Verificerer at de foregående reviews er testsikrede |
| **13 — Tværgående** | Kontrakt-alignment og duplikering | Helhedsvurdering når alle dele er set |

---

## Procesbeskrivelse

1. Vælg et punkt fra listen øverst.
2. Bed om review af det specifikke punkt med filerne nævnt.
3. Reviewet skrives ind i en ny fil `docs/review/[punkt]-[navn].md`.
4. Status i tabellen øverst opdateres til ✅ Gennemgået med link til filen.

Et punkt behøver ikke dække alle filer i en mappe — scope er hvad der giver mening som en sammenhængende reviewenhed.
