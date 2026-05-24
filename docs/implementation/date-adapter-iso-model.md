# Implementeringsplan: dateAdapter ISO-model

**Status:** Implementeret og afsluttet (2026-05-24)  
**Scope:** `dateAdapter.ts`, `TableDateInput.tsx`, berørte tabeller og skemaer  
**Prioritet:** Korrekthed og konvergens — ét kanonisk datomodel-lag

> **Post-implementeringsreview (2026-05-24):** Alle stadier er gennemført. Reviewet nedenfor verificerer den faktiske implementering mod planens intentioner og noterer konkrete afvigelser og resterende problemer.

---

## Baggrund og problemformulering

### Nuværende tilstand

`dateAdapter.ts` har `TableDateInputModel = string`, hvor den committede model er en dansk display-string (fx `"24-05-2026"`). Det er en lækket repræsentationsbeslutning: committed state i adapteren er det samme format som brugerens input.

Det medfører, at tabeller der persisterer ISO-datoer (fx `FerieperiodeTable`, `TAFPeriodeTable`, `OevrigeKravTable`, `SvieSmerteTable`, `BeregningsperiodeFerieTable`, `BeregnetRenteTable`) ikke kan bruge `TableDateInput` direkte. I stedet er der oprettet et brokomponent, `TableDateIsoInput`, der:

1. Konverterer den persisterede ISO-dato til dansk display-string ved rendering.
2. Konverterer den committede danske string tilbage til ISO på `onBlur`.

`TableDateIsoInput` er ikke fejl i sig selv, men den er symptom på, at committed-modellen i `dateAdapter` er forkert. Analogt med hvad der skete med `percentAdapter`: committed model var en display-string, nu er den `number | undefined`.

Der er desuden et parallelt problem i **skema-laget**: `tableDateCellString` i `baseSchemas.ts` (linje 110–116) accepterer enten en ISO-dato og konverterer den til dansk display-string, eller passer en eksisterende string igennem uændret. Det betyder at gemte filer der indeholder danske display-strings, ISO-strings, eller blandede formater alle accepteres af skemaet. Der er ingen enkeltkanonisk lagerform for dato-tabel-celler.

> **Review-note — `tableDateCellString` konverterer ISO til dansk i stedet for omvendt:** Linje 110–116 i `baseSchemas.ts` kalder `isoToDanishDateString(val)` når indholdet er en gyldig ISO-dato. Det betyder at en fil gemt med ISO-format (`"2026-05-24"`) indlæses som dansk display-string (`"24-05-2026"`) — det er den *omvendte* migration af hvad vi ønsker. Det er den eksisterende "legacy-bro" der holder systemet i nuværende uønskede tilstand. Forstå dette inden Stadie 4: den nye `tableIsoDateCellString` skal fungere præcist modsat — genkende ISO og passere det igennem, og konvertere dansk til ISO.
>
> **Review-note — `offentligeYdelserRowSchema` og `loenudviklingManuelRowSchema` bruger `tableDateCellString` direkte:** `erstatningsopgoerelseSchemas.ts` linje 107–108 (`fraDato`, `tilDato`) og linje 120 (`dato`). Disse to schemas indlæser altså dansk display-string som committed row-type. Det bekræfter at `OffentligeYdelserTable` og `LoenudviklingManuelTable` er i den "forkerte" gruppe (de persisterer med dansk string). Det er korrekt beskrevet i planen, men det er nyttigt at vide præcis hvilke linjer der skal ændres.
>
> **Review-note — `svieSmertePeriodeRowSchema`, `tafPeriodeRowSchema`, `ferieperiodeRowSchema` og `oevrigeKravRowSchema` bruger allerede `optionalIsoDateString`:** Disse schemas i `erstatningsopgoerelseSchemas.ts` linje 36–101 har allerede `fra: optionalIsoDateString`, `til: optionalIsoDateString`, `dato: optionalIsoDateString`. Det bekræfter at tabellerne der bruger `TableDateIsoInput` allerede har den rigtige skemamodel — de skal blot skifte komponent til `TableDateInput` og skema-laget er allerede korrekt. Planen behøver ikke at migrere disse schemas.

> **Review-note:** Beskrivelsen er præcis. Èn tilføjelse til nuværende tilstand: `dateAdapter.ts` indeholder en `dateFingerprintFromCommittedValue`-hjælpefunktion der forsøger at normalisere den committede dansk-string til ISO inden fingerprinting via `coerceToISODateString`. Det er et ekstra tegn på at den nuværende model-type er forkert — fingerprint-laget ved godt at canonical bør være ISO, men adapterlaget giver det en dansk string. Denne hjælpefunktion forsvinder med den nye adapter (afløses af `makeDateFingerprintFromCanonical(value ?? '')`).

### Ønsket slutprodukt

| Lag | Format |
|---|---|
| Brugerens input (draft) | Dansk display-string: `"24-05-2026"` |
| Committed model (adapter) | `ISODateString \| undefined`: `"2026-05-24"` |
| Persisteret state | ISO-string: `"2026-05-24"` |
| Fingerprint/canonical | ISO-string: `"2026-05-24"` |

Brugeren ser og skriver præcis som nu. Intet ændrer sig i UI-oplevelsen.  
`TableDateIsoInput` forsvinder — `TableDateInput` bliver selv ISO-nativ.  
Dansk display-string eksisterer kun internt i `useTableInputCore` som draft og i `format()`-funktionen.

---

## Årsag til nuværende tilstand

`dateAdapter` er ældre end det mønster der opstod med `percentAdapter`. Da `percentAdapter` fik `TModel = number | undefined`, viste det klart, at committed model bør afspejle domænerepræsentationen, ikke display-representationen. Dato-adapteren fik aldrig den tilsvarende opdatering.

Derudover har skema-laget en legacy-kompatibilitetssti (`isoToDanishDateString` i `tableDateCellString`) der implicerer at filer med ISO-datoer har eksisteret i det persisterede format på et tidspunkt. Den sti er muligvis historisk arv fra en periode, hvor persisted state var ISO-datoer, og man lavede en migration til dansk display i schema-laget. Det er ikke verificeret.

> **Review-note:** Historikken kan verificeres: `git log --all --follow -p src/schemas/formSchemas/baseSchemas.ts | grep -A5 "isoToDanishDateString"` vil vise hvornår konverteringen opstod og med hvilken commit-besked. Det er ikke blokerende for implementeringen, men nyttigt at kende for at vide om den omvendte migration i `tableIsoDateCellString` dækker alle scenarier.
>
> **Review-note — `isoToDanishDateString` er en lokal privat funktion i `baseSchemas.ts`:** Den er ikke eksporteret og bruges kun i `tableDateCellString`. Den forsvinder naturligt når `tableDateCellString` ikke længere bruges til dato-tabel-celler. Ingen selvstændig oprydning nødvendig.

---

## Ændringernes fulde scope

### Direkte ændringer

| Fil | Ændring |
|---|---|
| `src/hooks/tableInput/adapters/dateAdapter.ts` | `TModel = ISODateString \| undefined`, opdater `parse`, `format`, `toCommittedPayload`, `toCommittedDatePayload`, `sanitizeTableDateDraft` |
| `src/components/inputs/table/TableDateInput.tsx` | `value?: ISODateString`, `onBlur` emitter `ISODateString \| undefined` |
| `src/components/inputs/table/TableDateIsoInput.tsx` | Slettes |
| `src/schemas/formSchemas/baseSchemas.ts` | `tableDateCellString` → `tableIsoDateCellString` der kun accepterer ISO eller tom/undefined |
| `src/schemas/formSchemas/sections/erhvervsevnetabSchemas.ts` | `tableDateCellString` → `tableIsoDateCellString` for dato-felter |
| `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` | Samme som over |

> **Review-note — manglende fil i scope-tabellen:** `src/config/persistenceVersion.ts` skal bumpes. Når persisted format for dato-tabel-celler ændres fra dansk string til ISO-string er det en breaking schema change, og persistenceVersion skal opdateres uanset om skemaet håndterer round-trip fra gammelt format. Versionen styrer om eksisterende filer advares om drift — uden bump ved brugere ikke at filen er migrereret ved næste load.

> **Review-note — eksporteret funktion med ændret signatur:** `toCommittedDatePayload` er pt. eksporteret fra `dateAdapter.ts` og bruges i `TableDateIsoInput.tsx` (indirekte via adapteren). Med den nye model ændres dens signatur fra `(value: string)` til `(value: ISODateString | undefined)`. `TableDateIsoInput` slettes, men scan `index.ts` og eventuelle andre imports af `toCommittedDatePayload` inden sletning.

### Call-site ændringer (tabeller der i dag bruger `TableDateIsoInput`)

Disse tabeller skifter fra `TableDateIsoInput` til `TableDateInput`:
- `src/components/tables/TAFPeriodeTable.tsx`
- `src/components/tables/OevrigeKravTable.tsx`
- `src/components/tables/SvieSmerteTable.tsx`
- `src/components/tables/FerieperiodeTable.tsx`
- `src/components/tables/BeregningsperiodeFerieTable.tsx`
- `src/components/tables/BeregnetRenteTable.tsx`

> **Review-note — `OevrigeKravTable.tsx` kræver ekstra opmærksomhed:** Tabellen bruger i dag `coerceToISODateString(minDate)` og `coerceToISODateString(maxDate)` til at beregne `minIso`/`maxIso` (linje 34–35), og `coerceToISODateString(committed?.dato)` til at beregne `committedDatoIso` (linje 78). Disse tre konverteringer bliver redundante med den nye model, men de er ufarlige at beholde og TypeScript vil markere det. Fjern dem aktivt — det er `|| undefined`-mønstret der er knap så indlysende: `coerceToISODateString` returnerer `ISODateString | undefined`, og med ny model er input allerede `ISODateString | undefined`, så kaldet er en no-op for gyldige værdier men ændrer `undefined` → `undefined`. Det bør fjernes for klarhedens skyld.

### Call-site ændringer (tabeller der allerede bruger `TableDateInput` med dansk string-model)

Disse tabeller bruger i dag `TableDateInput` med `value={row.dato}` og `onBlur={(e) => ...(e.target.value)}` hvor `e.target.value` er en dansk string. De skal opdateres til ISO:
- `src/components/tables/OffentligeYdelserTable.tsx` (felter: `fraDato`, `tilDato`)
- `src/components/tables/LoenudviklingManuelTable.tsx` (felt: `dato`)
- `src/components/tables/EetAslAfgoerelserTable.tsx` (felter: `afgoerelsesDato`, `virkningsDato`, `kapDato`, `tidlKapDato`)
- `src/components/tables/StandardLoenTable.tsx` (to dato-kolonner)

> **Review-note — `OffentligeYdelserTable.tsx`: sorteringslogik og `asValidDateBound`:** Tabellen bruger to steder `coerceToISODateString(row.fraDato?.trim() ?? '')` og `coerceToISODateString(row.tilDato?.trim() ?? '')` som sort-values (linje 254–255). Med ny model er `row.fraDato` allerede `ISODateString | undefined`, og konverteringen reduceres til `row.fraDato ?? ''`. Opdater dette aktivt — det er en korrekthedstingesting: `.trim()` og `?? ''` er defensive tricks der signalerer at man ikke stoler på formatet; med branded ISO-type er de unødvendige og vildledende. `asValidDateBound` (linje 68–73) udfører `coerceToISODateString(trimmed)` som sin eneste transformation. Med ny model er `row.tilDato` allerede `ISODateString | undefined`, og funktionen reduceres til `(raw) => raw ?? undefined` — eller den slettes og call-sites bruger `row.fraDato` direkte. Overvej at slette den. Se Risiko 6 i eksisterende plan.

> **Review-note — `LoenudviklingManuelTable.tsx`: intern ISO-konvertering i onBlur:** Linje 480 bruger `coerceToISODateString(raw?.trim() ?? '') ?? ''` som del af en intern `onBlur`-callback. Med ny model leverer adapteren allerede `ISODateString | undefined` — denne konvertering er overflødig og skal fjernes. Vær præcis om hvad der er adapteren og hvad der er lokal post-processing i tabellen.

### Row-typer og skemaer

`AslAfgoerelseRow`, `LoenudviklingManuelRow`, `OffentligeYdelserRow`, og de øvrige berørte row-typer har i dag dato-felter som `tableDateCellString` (dvs. `string | undefined`). De migreres til `optionalIsoDateString` (dvs. `ISODateString | undefined`).

> **Review-note — mangler `svieSmerteRowSchema` og `ferieperiodeRowSchema` i den navngivne liste:** Listen nævner kun `AslAfgoerelseRow`, `LoenudviklingManuelRow`, `OffentligeYdelserRow` og `oevrigeKravRowSchema`. Men `SvieSmerteTable`, `FerieperiodeTable`, `BeregningsperiodeFerieTable` og `BeregnetRenteTable` bruger alle `TableDateIsoInput` i dag og persisterer ISO — hvilket også betyder at de har tilhørende row-skemaer med dato-felter. Navngiv dem eksplicit i listen så intet row-skema glemmes under implementeringen.
>
> **Review-note — disse schemas kræver faktisk ingen ændringer:** `svieSmertePeriodeRowSchema`, `tafPeriodeRowSchema`, `ferieperiodeRowSchema`, `oevrigeKravRowSchema` bruger allerede `optionalIsoDateString` (verificeret i `erstatningsopgoerelseSchemas.ts` linje 36–101). Skema-migrationen berører kun `offentligeYdelserRowSchema` (`fraDato`, `tilDato`) og `loenudviklingManuelRowSchema` (`dato`) — plus `aslAfgoerelseRowSchema` i `erhvervsevnetabSchemas.ts`. Planen bør præcisere denne opdeling: "kræver schema-ændring" vs. "kræver kun komponent-skift".

---

## Detaljeret implementeringsplan

### Stadie 1 — Adapter og committed model (fundament)

> **Implementeringsstatus:** Gennemført korrekt. Alle planlagte ændringer er på plads.

> **Verifikation — `parsed.iso ?? undefined` forenklet til `parsed.iso`:** Implementeringen bruger `return parsed.ok ? parsed.iso : undefined` i `sanitizeTableDateDraft` (linje 49) og `parsed.iso` direkte i `parse`-returnen (linje 71). Det er korrekt — `ISODateString | undefined` er præcis typen, og den redundante `?? undefined` er fjernet som anbefalingen sagde.

> **Verifikation — `dateFingerprintFromCommittedValue` slettet:** Hjælpefunktionen er ikke til stede i `dateAdapter.ts`. Dead code er fjernet aktivt.

> **Verifikation — `toCommittedDatePayload` signatur:** Funktionen er eksporteret med `value: TableDateInputModel` (dvs. `ISODateString | undefined`) og `canonical: value ?? ''`. `TableDateIsoInput` er slettet. Ingen andre imports af `toCommittedDatePayload` er i vejen.

> **Fund — `parse` returnerer `parsed.iso` uden `?? undefined` i én gren, men med implicit `undefined` i den anden:** Linje 71 returnerer `{ ok: true, value: parsed.iso }`. Når `parsed.iso` er `undefined` (tom dato) og `rangeErrorMessage` er `null`, returneres `{ ok: true, value: undefined }`. Det er korrekt, men `parsed.iso` er `ISODateString | undefined` — TypeScript kræver at `value`-feltet i return-typen matcher `TableDateInputModel`. Verificer at TypeScript ikke klager (det bør den ikke, da typen er korrekt), men tilføj eksplicit `value: parsed.iso ?? undefined` hvis IDE viser `ISODateString | undefined` som `ISODateString` i inferens.

**Mål:** `createDateTableInputAdapter` returnerer `TableInputAdapter<ISODateString | undefined, string, DateFingerprint>`.

**Ændringer i `dateAdapter.ts`:**

```typescript
// Før:
export type TableDateInputModel = string;

// Efter:
export type TableDateInputModel = ISODateString | undefined;
```

`format(value)`: Konverter ISO → dansk display.  
```typescript
format: (value) => (value ? coerceToDanishDateString(value) ?? '' : ''),
```

`parse(draft)`: Parser dansk draft og returnerer ISO som model.
```typescript
parse: (draft) => {
  const normalized = normalizeDateDraftOnCommit(draft);
  const parsed = parseDateDraftForCommit(normalized, { mode: 'commit', twoDigitYearPolicy: config.twoDigitYearPolicy });
  if (!parsed.ok) return { ok: false, errorMessage: parsed.message };
  // parsed.iso er ISODateString | undefined; parsed.danish er display-string
  const rangeError = parsed.iso ? getRangeErrorMessage(parsed.iso, config) : null;
  return rangeError
    ? { ok: true, value: parsed.iso ?? undefined, visualErrorMessage: rangeError }
    : { ok: true, value: parsed.iso ?? undefined };
},
```

`toCommittedPayload(value)`: Canonical er ISO.
```typescript
toCommittedPayload: (value) => ({
  model: value,
  canonical: value ?? '',
  fingerprint: makeDateFingerprintFromCanonical(value ?? ''),
}),
```

`getCommittedVisualError(value)`: Allerede ISO, ingen konvertering nødvendig.
```typescript
getCommittedVisualError: (value) => {
  if (!value) return '';
  return getRangeErrorMessage(value, config) ?? '';
},
```

> **Review-note — nuværende `getCommittedVisualError` kalder `coerceToISODateString(value)` fordi model er dansk string:** `dateAdapter.ts` linje 66–69 gør netop dette — det er endnu et tegn på at adapteren ved godt at canonical burde være ISO. Med ny model forsvinder dette kald og `getCommittedVisualError` bliver rent: `if (!value) return ''; return getRangeErrorMessage(value, config) ?? '';`. Planen er korrekt.

`sanitizeTableDateDraft`: Returnerer ISO i stedet for dansk.
```typescript
export const sanitizeTableDateDraft = (
  rawValue: string,
  config: Pick<TableDateAdapterConfig, 'twoDigitYearPolicy'>
): ISODateString | undefined => {
  const raw = normalizeDateDraftOnCommit(rawValue);
  const parsed = parseDateDraftForCommit(raw, { mode: 'commit', twoDigitYearPolicy: config.twoDigitYearPolicy });
  return parsed.ok ? parsed.iso ?? undefined : undefined;
};
```

> **Review-note — `sanitizeTableDateDraft` returnerer i dag `parsed.danish` ved success (linje 59):** Det er præcis den linje der skal ændres til `parsed.iso ?? undefined`. Returtypen ændres fra `string` til `ISODateString | undefined`. `TableDateSanitizeCallback` i `TableDateInput.tsx` (linje 20) ændres tilsvarende fra `(value: string) => string` til `(value: string) => ISODateString | undefined`. Vær opmærksom på at alle call-sites der modtager sanitize-callbacks (via `onRegisterSanitize`) skal acceptere den nye returtype. Grep bekræfter at ingen tabeller i codebase sender `onRegisterSanitize`-prop ned til `TableDateInput` — ændringen er derfor ufarlig.

**Potentielle fejlkilder:**
- `parseDateDraftForCommit` returnerer `parsed.iso` som `ISODateString | undefined`. Verificer at denne property altid er sat ved `parsed.ok === true` for ikke-tomme inputs. Verificer ved at læse `dateDraftCommit.ts`.
- Tomme drafts: `parse('')` skal returnere `{ ok: true, value: undefined }` (tom celle = ingen dato), ikke `{ ok: false, ... }`. Det eksisterende `parseDate`-flow skal håndtere dette — kontrollér at det allerede gør det.

> **Review-note — begge ovenstående fejlkilder er verificerbare ved læsning af `dateDraftCommit.ts`:**
>
> **Tom draft:** `parseDateDraftForCommit` returnerer `{ ok: true, danish: '', iso: undefined }` for tomme strings og `shouldClearField`-inputs (linje 17 i `dateDraftCommit.ts`). Det er korrekt — `parse('')` i adapteren vil returnere `{ ok: true, value: undefined }`.
>
> **Ikke-tom, gyldig draft:** Når `parseDateDraftForCommit` returnerer `{ ok: true }` for en ikke-tom dato, er `parsed.iso` altid en `ISODateString` — det sættes på linje der kalder `coerceToISODateString(danish)` og returnerer `invalidDate` hvis det fejler (linje 54–56 i `dateDraftCommit.ts`). `parsed.iso ?? undefined` er teknisk korrekt men `?? undefined` er redundant på en `ISODateString | undefined`-type; skriv blot `parsed.iso`.
>
> **Uberørt risiko:** `normalizeDateDraftOnCommit` kaldes i adapteren inden `parseDateDraftForCommit`. Kontrollér at `normalizeDateDraftOnCommit` ikke transformerer en tom string til noget der ikke matches af `shouldClearField`/`trim() === ''` inde i parseren. Læs `dateDraftNormalization.ts` inden implementering.

> **Review-note — slet `dateFingerprintFromCommittedValue`:** Den interne hjælpefunktion `dateFingerprintFromCommittedValue` i `dateAdapter.ts` er et produkt af den forkerte model og forsvinder. Den er ikke eksporteret, men sørg for at den fjernes aktivt i stedet for at ligge som dead code.

> **Review-note — `toCommittedDatePayload` er eksporteret og bruges potentielt eksternt:** Scan imports — se scope-note ovenfor.

---

### Stadie 2 — `TableDateInput` prop-typer

> **Implementeringsstatus:** Gennemført korrekt. Planen's anbefalede type-split er implementeret.

> **Verifikation — separate event-typer:** `TableDateInputChangeEvent = { target: { value: string } }` (draft, linje 20) og `TableDateInputCommitEvent = { target: { value: ISODateString | undefined } }` (commit, linje 21) er defineret. Prop-typerne for `onChange` og `onBlur` er korrekt opdelt. Planens anbefalede navne er fulgt præcist.

> **Verifikation — `value ?? ''` fjernet:** `useTableInputCore` kaldes med `value` direkte (linje 136 i `TableDateInput.tsx`). Ingen `?? ''` at se.

> **Fund — tre steder i tests sender dansk string som `value` prop:** `TableDateInput.test.tsx` linje 88, 128, 182, 239, 356 sender strenge som `"01-01-2020"`, `"01-01-2023"`, `"15-06-2025"`, `"01-05-2023"` direkte som `value`-prop. Typen er `ISODateString | undefined`, og disse er *ikke* ISO-datoer — de er danske display-strings. TypeScript fanger det ikke fordi `value=""` er en `string` som implicit coerces (og test-filen caster den ikke). Det er et type-lie: testen sender ugyldige værdier men TypeScript advarer ikke.
>
> **Specifikt:** `TableDateInput.test.tsx`:
> - Linje 88: `value={value}` hvor `value` er `React.useState('')` — tom streng er ok, men `string` matches ikke `ISODateString | undefined` ved strict check.
> - Linje 128: `value="01-01-2020"` — dansk format, ikke ISO.
> - Linje 163: `value="15-06-2025"` — dansk format, ikke ISO.
> - Linje 182: `value={'01-01-2023'}` — dansk format, ikke ISO.
> - Linje 356: `value="01-05-2023"` — dansk format, ikke ISO.
>
> **Risiko:** Testen for "history-restore" (linje 121) sender `value="01-01-2020"` og forventer at `input` viser `"01-01-2020"` efter restore (linje 149). Det virker fordi adapteren kalder `coerceToDanishDateString("01-01-2020")` — men `"01-01-2020"` er ikke en gyldig ISO-dato, så `coerceToDanishDateString` returnerer `undefined` og `format` returnerer `''`. Testen forventer `"01-01-2020"` men vil faktisk vise `''`. Kør testen og verificer — hvis den **passerer**, er der et problem i logikken eller i testens assertion.
>
> **Anbefaling:** Erstat alle `value="dd-mm-åååå"`-props i tests med ISO-format (`value={'2020-01-01' as ISODateString}`). Brug `toISODateString()` fra projektets helpers som MEMORY.md anbefaler.

**Mål:** `TableDateInput` accepterer og emitter `ISODateString | undefined`.

**Ændringer i `TableDateInput.tsx`:**
- `value?: ISODateString` (var `string`)
- `onBlur`-eventet emitter `ISODateString | undefined` (var `string`)
- `useTableInputCore` kaldes med `value: value ?? undefined` (var `value ?? ''`)

**Nyt event-type:**
```typescript
export type TableDateInputChangeEvent = { target: { value: ISODateString | undefined } };
```

`onRegisterSanitize`-callback returnerer `ISODateString | undefined` i stedet for `string`. Opdater `TableDateSanitizeCallback`.

**Bounds-validering (`boundsStatus`):** Uændret — den bruger allerede `coerceToISODateString(minDate)` internt, og `minDate`/`maxDate` props er fortsat `string` (ISO-format kræves).

> **Review-note — `boundsStatus`-blokken i `TableDateInput.tsx` kalder `coerceToISODateString(minDate)` og `coerceToISODateString(maxDate)` (linje 87–91):** Med ny model er `minDate`/`maxDate` props fortsat `string` (tabellerne sender ISO-strenge hertil), så disse kald er korrekte og uberørte. Det eneste der ændres er at `value`-prop'en gøres `ISODateString | undefined`. Bekræftet: ingen ændringer i `boundsStatus`-logikken er nødvendige.
>
> **Review-note — `TableDateInput.tsx` linje 134 sender `value ?? ''` til `useTableInputCore`:** Med ny model skal dette ændres til `value` (eller `value ?? undefined`, men `ISODateString | undefined` er allerede korrekt uden `?? ''`). Den nuværende `value ?? ''` eksisterer netop fordi `useTableInputCore` forventer `TModel` og man historisk har sendt `string` ind. Med ny model er `value` direkte `ISODateString | undefined` — send den som-er.

**Potentielle fejlkilder:**
- `useTableInputCore` har `value: string` som parameter. Denne skal opdateres til `ISODateString | undefined`. Kontrollér hvad `useTableInputCore` gør med `value` internt — det er formatet der sendes til `adapter.format()`. Med den nye adapter er det korrekt: `format(undefined)` → `''`.
- `core.renderedValue` er hvad `InputBase` viser. Det kommer fra `adapter.format(committedValue)`. Når committed model er ISO, skal `format` returnere dansk display-string. Det er nu korrekt med ovenstående adapter-ændring.

> **Review-note — `onChange`-eventet er uberørt men inkonsistent:** `onChange` emitter fortsat `{ target: { value: string } }` (draft-change). Det er korrekt — draft er altid en rå string under redigering. Men `TableDateInputChangeEvent` bruges pt. til begge events (`onChange` og `onBlur`), og med den nye model er de to events af forskellige typer. Introducer et separat type-alias for draft-change for at gøre det klart:
> ```typescript
> export type TableDateDraftChangeEvent = { target: { value: string } };
> export type TableDateCommitEvent = { target: { value: ISODateString | undefined } };
> ```
> og opdater prop-typen: `onChange?: (e: TableDateDraftChangeEvent) => void`, `onBlur?: (e: TableDateCommitEvent) => void`. `TableDateInputChangeEvent` kan enten slettes eller bevares som alias for commit-event for bagudkompatibilitet med `TableDateIsoInput`-migreringen.

> **Review-note — `useTableInputCore` kaldes med `value: value ?? ''`:** Planen siger at dette ændres til `value: value ?? undefined`. Verificer at `useTableInputCore` accepterer `TModel = ISODateString | undefined` og ikke har en `value: string` hardkodet type i sin parameter (se Stadie 3 nedenfor — det har den ikke, `value: TModel` er generisk).

---

### Stadie 3 — `useTableInputCore` kompatibilitet

> **Implementeringsstatus:** Ingen ændringer var nødvendige — verificeret korrekt som planens review-noter forudsagde.

**Mål:** `useTableInputCore` understøtter `TModel = ISODateString | undefined`.

`useTableInputCore` er generisk over `TModel`. Det bør allerede understøtte nullable models, da `percentAdapter` bruger `number | undefined`. Kontrollér at `value`-prop til `useTableInputCore` accepterer `ISODateString | undefined`.

Hvis `useTableInputCore` har `value: string` hardkodet i sin signatur (som dato-cellen pt. sender `value ?? ''` som string), skal signaturen gøres generisk over model-typen. Kontrollér `src/hooks/tableInput/useTableInputCore.ts`.

**Potentielle fejlkilder:**
- Historisk opbygning: dato-adapteren sender `value ?? ''` ind i `useTableInputCore` som `string`. Med den nye model skal `value` sendes som `ISODateString | undefined`. `useTableInputCore` kalder `adapter.format(value)` for at producere display-string. Det virker kun korrekt hvis adapteren nu modtager `ISODateString | undefined`, ikke `string`.

> **Review-note — `useTableInputCore` kræver ingen ændringer:** `UseTableInputCoreOptions` er parameteriseret over `TModel` og `value: TModel` — der er ingen `string`-hardkodning. `percentAdapter` bruger allerede `TModel = number | undefined` og det virker. Stadie 3 er reelt blot en verifikation — planen kan fjerne den potentielle fejlkilde og notere at ingen ændringer er nødvendige.
>
> **Ét sted der bør tjekkes:** `useTableInputHistoryRestore` modtager `value: TModel` og `formatCommittedValue: (v: TModel) => string`. Begge er generiske og vil automatisk acceptere `ISODateString | undefined`. Ingen ændringer her.
>
> **`onChange` i `useTableInputCore`:** `latest.current.onChange?.({ target: { value: nextDraft } })` emitter altid `string` (draft-change). Det er korrekt og uberørt. `onBlur` emitter `{ target: { value: nextPayload.model } }` som er `TModel` — med ny model er det `ISODateString | undefined`. Typekorrekt.

---

### Stadie 4 — Skema-migration

> **Implementeringsstatus:** Gennemført. `tableIsoDateCellString` er implementeret i `baseSchemas.ts` og brugt i alle berørte schemas.

> **Verifikation — `tableIsoDateCellString` implementation:** Linje 103–112 i `baseSchemas.ts`. Implementeringen er renere end planens udkast: den to-grens struktur (`isISODateString` guard + `coerceToISODateString` fallback) er erstattet med en enkelt `coerceToISODateString`-kald (linje 109), da `coerceToISODateString` allerede håndterer begge formater. Det er korrekt og simplere. Den hurtige `isISODateString`-fastpath (linje 108) er bevaret for effektivitet.

> **Verifikation — `tableDateCellString` slettet:** Grep af `tableDateCellString` i hele `src/` giver nul resultater. Den er slettet fuldstændigt. Den eksplicitte beslutning om at slette (ikke deprecated-markere) er taget.

> **Verifikation — schemas der kræver ændring:** `offentligeYdelserRowSchema` (`fraDato`, `tilDato`) og `loenudviklingManuelRowSchema` (`dato`) bruger nu `tableIsoDateCellString`. `aslAfgoerelseRowSchema` i `erhvervsevnetabSchemas.ts` bruger `tableIsoDateCellString` for alle fire dato-felter. Schemas der allerede brugte `optionalIsoDateString` er uberørte.

> **Verifikation — `persistenceVersion` og fingerprint:** Version er '1.3' i `persistenceVersion.ts`. Fingerprint-snapshot er opdateret til `'fnv1a-b8bf9180'` med kommentar der eksplicit nævner migration fra danske display-strings til ISO. Korrekt.

> **Fund — dobbelt preprocess-lag er bibeholdt (men uskadeligt):** Planen nævnte at `z.preprocess(fn, optionalIsoDateString)` skaber et dobbelt preprocess-lag fordi `optionalIsoDateString` selv har `normalizeEmptyToUndefined` indeni. Den faktiske implementering bruger `isoDateString.optional()` direkte som anden parameter (linje 112) — ikke `optionalIsoDateString`. Det er den renere løsning som planens review-note anbefalte. Korrekt.

**Mål:** Persisted dato-tabel-celler gemmes og valideres som ISO-strings.

**Ændring i `baseSchemas.ts`:**

Nuværende `tableDateCellString` har en `isoToDanishDateString`-konvertering der bruges ved fil-load. Den er en legacy-bro. Den beholder sin funktion i én overgangsperiode: hvis filen indeholder en ISO-dato (fordi den er gemt af en ældre eller ny klient), konverteres den til dansk. Med den nye model skal det modsatte ske: alt transformeres til ISO ved load.

```typescript
// Ny: tableIsoDateCellString
export const tableIsoDateCellString = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (trimmed === '') return undefined;
  // Accepter ISO direkte
  if (isISODateString(trimmed)) return trimmed as ISODateString;
  // Accepter dansk format — migrer til ISO (round-trip for gamle filer)
  const iso = coerceToISODateString(trimmed);
  return iso ?? undefined;
}, optionalIsoDateString);
```

Dette sikrer:
- Filer gemt med det nye format (ISO) loader korrekt.
- Filer gemt med det gamle format (dansk display) migreres automatisk ved load.
- Filer med hverken gyldigt ISO eller gyldigt dansk format bliver `undefined`.

**Brug i skemaerne:**  
`aslAfgoerelseRowSchema`, `offentligeYdelserRowSchema`, `loenudviklingManuelRowSchema`, `oevrigeKravRowSchema`, og de berørte `erstatningsopgoerelseSchemas`-rækker skifter fra `tableDateCellString` til `tableIsoDateCellString`.

**Potentielle fejlkilder:**
- `tableDateCellString` bruges muligvis andre steder end de direkte dato-rækker. Scan alle imports af `tableDateCellString` og vurdér om de alle bør migreres til `tableIsoDateCellString`, eller om nogen specifikt kræver dansk format.
- Den nuværende `tableDateCellString` returnerer `string | undefined`. Den nye `tableIsoDateCellString` returnerer `ISODateString | undefined`. Row-typer der er `z.infer<...>` vil automatisk opdateres — men alle steder der assignerer til `row.fraDato` osv. skal kompatibilitetstjekkes af TypeScript.

> **Review-note — `tableDateCellString` bør beholdes midlertidigt:** Planen siger kun at de berørte schemas skifter til `tableIsoDateCellString`. Men `tableDateCellString` bør ikke slettes i samme commit — scan alle brug via grep først. Aktuelt er der præcis to brug: `erhvervsevnetabSchemas.ts` og `erstatningsopgoerelseSchemas.ts`. Begge migreres. Men tag stilling til om `tableDateCellString` skal deprecates-markeres og slettes, eller beholdes for fremtidige ikke-ISO tabeller. En eksplicit beslutning bør stå i planen.

> **Review-note — `coerceToISODateString` kan håndtere dansk format:** `coerceToISODateString` i `branded.ts` accepterer både ISO og dansk format (den normaliserer). Det betyder at `isISODateString(trimmed)` guard-check i preprocess-funktionen er korrekt, men den efterfølgende `coerceToISODateString(trimmed)` vil også virke for ISO-input. De to grene er dermed: (1) ISO direkte, (2) dansk → ISO. Der er ingen tredje format der konverteres via `coerceToISODateString` men ikke er dækket af `isISODateString`. Det er logisk konsistent — men tilføj en kommentar der forklarer at `coerceToISODateString` bruges som fallback for dansk format og ikke som generisk "normalisér hvad som helst"-funktion.

> **Review-note — `optionalIsoDateString` som Zod-validator i `tableIsoDateCellString`:** `optionalIsoDateString` er defineret som `z.preprocess(normalizeEmptyToUndefined, isoDateString.optional())`. At bruge den som anden parameter i `z.preprocess(fn, optionalIsoDateString)` er korrekt og det er den samme konstruktion som `tableAmountCellValue` bruger. Men vær opmærksom på at `optionalIsoDateString` har sin egen preprocess (`normalizeEmptyToUndefined`) indeni — det betyder der er to preprocess-trin. Det første (outer) transformerer og returnerer `ISODateString | undefined`. Det andet (inner, fra `optionalIsoDateString`) kalder `normalizeEmptyToUndefined` igen på resultatet, som er et no-op for `undefined` og `ISODateString`. Uskadeligt, men det er et subtilt lag der kan forvirre læseren. Alternativt: definer `tableIsoDateCellString` med `z.preprocess(fn, isoDateString.optional())` direkte.

---

### Stadie 5 — Call-sites og sletning af `TableDateIsoInput`

> **Implementeringsstatus:** `TableDateIsoInput` er slettet. Alle tabeller bruger `TableDateInput` direkte. Git-status viser at `TableDateIsoInput.tsx` er slettet (D).

> **Verifikation — `tableCommitContract.test.tsx`:** Filen bruger udelukkende `TableDateInput` (ikke `TableDateIsoInput`). Commit-kontrakten for dato-input (`typedDraft: '1-2-2025'`, `expectedCommitted: '2025-02-01'`) tester ISO-output korrekt.

> **Fund — `tableCommitContract.test.tsx` `value`-props bruger `typeof value === 'string' ? value as ISODateString : undefined`:** Linje 425, 540, 591, 624. Dette er en usikker cast: `value as ISODateString` tvinger en vilkårlig string til branded type uden validering. Hvis `value` er en dansk string (fx fra en tidligere commit i test-state-maskinen), er casted type forkert. Erstat med `isISODateString(value) ? value : undefined` eller brug `toISODateString(value)` — det er den korrekte branched narrowing.

> **Fund — `tableCommitContract.test.tsx` `initialValue: '2025-01-01'` og `expectedCommitted: '2025-02-01'`:** Linje 420 og 535 angiver `initialValue` og `expectedCommitted` som plain strings. Test-harnesses sender disse som `value as ISODateString`. Verificer at `initialValue: '2025-01-01'` faktisk er en valid ISO-dato (det er den) og at assertion `expectedCommitted: '2025-02-01'` sammenlignes med `e.target.value` som er `ISODateString | undefined`. Hvis `onBlur(e.target.value)` gemmer `undefined` i stedet for ISO'en, vil `expectedCommitted` aldrig matche. Kør testen og verificer at den passerer.

**Mål:** Alle tabeller bruger `TableDateInput` direkte; `TableDateIsoInput` slettes.

**Tabeller der i dag bruger `TableDateIsoInput`:**  
Disse er allerede korrekt koblet med ISO-værdier og ISO-callbacks. Det kræver kun at importene skiftes fra `TableDateIsoInput` til `TableDateInput`. `onBlur` signaturen er nu identisk: `(e: { target: { value: ISODateString | undefined } }) => void`.

**Tabeller der bruger `TableDateInput` med dansk string-model:**  
Disse sender i dag `row.afgoerelsesDato` (en dansk string) som `value`, og henter `e.target.value` som en dansk string i `onBlur`. Med den nye model:
- `value={row.afgoerelsesDato}` — typen ændres til `ISODateString | undefined` automatisk via skema-migration.
- `onBlur={(e) => commitRowUpdate(row.id, { afgoerelsesDato: e.target.value || undefined })}` — `e.target.value` er nu `ISODateString | undefined`. Fjern `|| undefined`-opskæringen og brug `e.target.value` direkte.

**Særtilfælde — `EetAslAfgoerelserTable.tsx`:**  
Tabellen bruger `coerceToISODateString(row.afgoerelsesDato)` til at beregne `kapDatoMin`. Med den nye model er `row.afgoerelsesDato` allerede en `ISODateString | undefined`, og `coerceToISODateString` kan fjernes.

> **Review-note — `EetAslAfgoerelserTable.tsx` bruger `coerceToISODateString(row.afgoerelsesDato)` præcist to steder:** Linje 300 (`const afgoerelsesDatoIso = coerceToISODateString(row.afgoerelsesDato)` til `kapDatoMin`) og linje 334 (samme kald til `tidlKapMax`). Med ny model er `row.afgoerelsesDato` allerede `ISODateString | undefined` — erstat begge kald med blot `row.afgoerelsesDato`. Returtypen er identisk (`ISODateString | undefined`), så den omgivende logik (`?? skadedatoMin`, `getDayBeforeIso(...)`) er uberørt.
>
> **Review-note — `EetAslAfgoerelserTable.tsx` `onBlur`-callbacks bruger `|| undefined` i dag:** Linje 252: `{ afgoerelsesDato: e.target.value || undefined }`. Med ny model er `e.target.value` `ISODateString | undefined` — `|| undefined` er teknisk korrekt (en `ISODateString` er aldrig falsy), men det er en korrektere model at bruge `e.target.value` direkte. Fjern aktiv.
>
> **Review-note — `LoenudviklingManuelTable.tsx` `onBlur` linje 567:** `{ dato: e.target.value }` — `e.target.value` er i dag en dansk string. Med ny model er det `ISODateString | undefined`. Da `loenudviklingManuelRowSchema` ændres til `optionalIsoDateString`, matcher typen direkte og intet `|| undefined`-mønster er nødvendigt.
>
> **Review-note — `LoenudviklingManuelTable.tsx` sort-kolonnen for `dato` (linje 478–481):** Kalder `coerceToISODateString(raw?.trim() ?? '') ?? ''`. Med ny model er `row.dato` allerede `ISODateString | undefined`, og `baseDateDisplay` er en `string` (dansk format, prop til base-rækken). For base-rækken (der bruger `baseDateDisplay`) er `coerceToISODateString`-kaldet stadig relevant. For de øvrige rækker er det en no-op. Behold kaldet — men det er muligt at simplificere til `raw ?? ''` for de ikke-base-rækker, hvis `baseDateDisplay` ændres til ISO. Det er en sekundær beslutning; planen bør nævne at sort-kolonnen kræver bevidst stillingtagen.
>
> **Review-note — `OffentligeYdelserTable.tsx` sort-kolonner (linje 254–255):** `coerceToISODateString(row.fraDato?.trim() ?? '') ?? ''` og `coerceToISODateString(row.tilDato?.trim() ?? '') ?? ''`. Med ny model er `row.fraDato` og `row.tilDato` `ISODateString | undefined` — erstat med `row.fraDato ?? ''` og `row.tilDato ?? ''`. `.trim()` og den ydre `coerceToISODateString` er begge no-ops på en branded ISO-type.
>
> **Review-note — `StandardLoenTable.tsx` dato-sort-kolonner bruger `danishToISO()` (linje 422–432):** `danishToISO(committed.col0_dag ?? '')` og `danishToISO(committed.col1_dag ?? '')`. Med ny model er `col0_dag` og `col1_dag` `ISODateString | undefined` — erstat med `committed.col0_dag ?? ''` og `committed.col1_dag ?? ''`. `danishToISO` er en fejlkilde hvis den modtager en ISO-string: verificer hvad `danishToISO` gør med ISO-input inden ændringen (`danishToISO('2026-05-24')` bør returnere `undefined` eller lignende, ikke en gyldig sort-nøgle).
>
> **Review-note — `StandardLoenTable.tsx` `maxDate`/`minDate` for dato-inputs bruger `danishToISO()` (linje 655–700):** Linje 655: `maxDate={danishToISO(committedRow.col1_dag ?? '') || dateRanges_aarsloen.tabelAarsloenFra.fallbackMax}`. Linje 700: `minDate={danishToISO(committedRow.col0_dag ?? '') || dateRanges_aarsloen.tabelAarsloenTil.fallbackMin}`. Med ny model er `col0_dag`/`col1_dag` `ISODateString | undefined` — erstat med `committedRow.col1_dag ?? dateRanges_aarsloen...fallbackMax` og tilsvarende. `danishToISO` på en ISO-string er et problem (se note ovenfor).

**`TableDateIsoInput.tsx` slettes** efter alle call-sites er migreret.  
Opdater exports i `src/components/inputs/table/index.ts` (eller tilsvarende barrel-fil).

> **Review-note — `TableDateIsoInput.tsx` er ikke eksporteret fra nogen barrel-fil:** Grep af `src/components/inputs/table/` og `src/hooks/tableInput/index.ts` viser at `TableDateIsoInput` importeres direkte (ikke via barrel) i de tabeller der bruger den. Der er ingen `index.ts`-eksport at opdatere for `TableDateIsoInput`. Sletning er ren: fjern filen og opdater de direkte imports i tabellerne.

> **Review-note — `|| undefined` i `EetAslAfgoerelserTable` er nu en type-fejl:** `e.target.value` er `ISODateString | undefined` med den nye model. `e.target.value || undefined` er `(ISODateString | undefined) || undefined` — det er stadig logisk korrekt i JavaScript (falsy ISODateString er aldrig mulig da branded strings er non-empty), men det er nu en redundant expression der TypeScript muligvis vil advare om. Fjern aktivt.

> **Review-note — `EetAslAfgoerelserTable` bruger `coerceToISODateString(row.afgoerelsesDato)` to steder:** Linje 300 og linje 334 i `EetAslAfgoerelserTable.tsx`. Begge skal fjernes. Planen nævner det men kun implicit under "kapDatoMin" — vær eksplicit om at det er linje 300 og 334 der er relevante.

> **Review-note — manglende særtilfælde: `BeregnetRenteTable.tsx`:** Er ikke nævnt i listen over tabeller der bruger `TableDateIsoInput`, men grep-resultatet viser at `BeregnetRenteTable.tsx` importerer `TableDateIsoInput` (linje 6 og 127). Tilføj den til listen under "Tabeller der i dag bruger `TableDateIsoInput`".

---

### Stadie 6 — Tests

> **Implementeringsstatus:** Delvist. Nye tests er tilføjet. Men eksisterende tests har systematiske type-problemer med `value`-props (se Stadie 2-fund og nedenfor).

> **Fund — `TableDateInput.test.tsx` sender danske strings som `value` i adskillige tests:** Se Stadie 2-fund. Kritisk: testen "history-restore rydder invalid table-date draft" (linje 121) sender `value="01-01-2020"` og forventer at displayet viser `"01-01-2020"` efter restore (linje 149). Men `format("01-01-2020")` kalder `coerceToDanishDateString("01-01-2020")` — og `"01-01-2020"` er ikke en gyldig ISO-dato (dag og år er byttet om i forhold til ISO), så `coerceToDanishDateString` sandsynligvis returnerer en forkert dato eller `undefined`. **Hvis testen passerer, er der et skjult fejl — enten returnerer `coerceToDanishDateString` den input-streng uændret (forkert), eller formattering fejler lydløst.** Kør `coerceToDanishDateString("01-01-2020")` manuelt og verificer.
>
> **Konklusion:** Alle tests der sender dansk-format strings som `value` til `TableDateInput` tester sandsynligvis den forkerte sti. De bør bruge `'2020-01-01' as ISODateString` (ISO) i stedet. Det er den eneste korrekte input-type for `value`-prop'en.

> **Fund — test "viser ISO-model som dansk display" (linje 68) er korrekt:** `value={'2026-05-24' as ...}` og assertion `expect(screen.getByRole('textbox')).toHaveValue('24-05-2026')`. Det er præcis det ønskede round-trip. Den nye test dækker dette korrekt.

> **Fund — `persistenceVersionDrift.test.ts` kommentar er præcis:** Linje 21–22 forklarer hvad der ændrede fingerprint. Det er den korrekte historikstyring som planens review-note anbefalede.

> **Manglende test — `tableIsoDateCellString` skema-migration:** Planen specificerede en test for at danske datoer i gemte filer migreres korrekt ved load. Der er ingen eksisterende test i `src/__tests__/schemas/formSchemas.test.ts` eller tilsvarende der dækker `tableIsoDateCellString` med dansk-format-input. Den er kritisk for back-compat: en gammel fil med `"24-05-2026"` skal loade som `"2026-05-24"`.

**Eksisterende test:**  
`src/__tests__/components/inputs/TableDateInput.test.tsx` tester `TableDateInput` med dansk-format `value` og forventer dansk-format `e.target.value` i `onBlur`. Disse tests skal opdateres:
- `value` props skifter til ISO.
- Assertions på `e.target.value` skifter til ISO.
- Display-værdien i `input.value` (via `screen.getByRole('textbox')`) bør fortsat vise dansk — kontrollér at `format()` stadig giver dansk display.

> **Review-note — `TableDateInput.test.tsx` tester aktuelt med `value=''` og forventer `e.target.value` som dansk string:** Den første test (linje 27–) sender `value={''}` og tjekker committed `e.target.value`. Testens `Wrapper`-komponent (linje 30–50) bruger `React.useState('')` og opdaterer via `onBlur`. Med ny model ændres `value` til `undefined` (tom), og assertions på `e.target.value` skifter til at verificere ISO. Alle eksisterende `value`-props i tests skal skifte fra dansk string til `ISODateString`.

**Nye tests der skal tilføjes:**
- `TableDateInput` modtager `ISODateString` og viser dansk display-string.
- `TableDateInput` committer `ISODateString | undefined` på blur.
- `TableDateInput` modtager `undefined` og viser tom celle.
- Round-trip test: ISO ind → dansk display → bruger-input → ISO ud.
- `tableIsoDateCellString` schema-test: ISO-input passerer, dansk-format-input migreres, tom input giver `undefined`, og ugyldig ikke-tom input afvises fail-closed.
- Fil-load round-trip: at gamle filer med dansk dato-format loades korrekt (skema-migration).

**Eksisterende test der skal tjekkes men sandsynligvis ikke kræver ændringer:**  
`dateContractGuard.test.ts` er strukturel og uberørt. `dateCommit.test.ts` og `isoDate.test.ts` tester hjælpefunktioner der ikke ændres.

> **Review-note — `tableCommitContract.test.tsx` indeholder eksplicit test for `TableDateIsoInput` commit-model:** Linje 1222 i `tableCommitContract.test.tsx` tester at `TableDateIsoInput` med input `'1-2-2025'` committer `'2025-02-01'` (ISO) via `onBlur`. Med den nye model overtager `TableDateInput` denne adfærd. Når `TableDateIsoInput` slettes, skal denne test flyttes til at teste `TableDateInput` direkte med ISO-input/output. Kontrakten er den samme — kun komponentnavnet ændres.
>
> **Review-note — `tableCommitContract.test.tsx` har 1672 linjer og indeholder tests for alle tabel-inputs:** Scan specifikt for alle steder der sætter `value` på `TableDateInput` (ikke `TableDateIsoInput`) med en dansk string — disse skal opdateres. Brug grep: `TableDateInput.*value=` i test-filen.

> **Review-note — mangler persistenceVersion-test:** Når `persistenceVersion.ts` bumpes (se scope-note ovenfor), skal `persistenceVersionDrift.test.ts` opdateres med den nye forventede version. Det er ikke nævnt i Stadie 6.

> **Review-note — `onRegisterSanitize` har ingen test-dækning i den eksisterende liste:** `sanitizeTableDateDraft` returnerer nu `ISODateString | undefined` i stedet for en dansk string. Tilføj en test der verificerer at kald til den registrerede sanitize-callback med et gyldigt dansk input returnerer ISO, og at ugyldigt input returnerer `undefined`. Det er kritisk fordi sanitize-callbacks bruges ved fil-save med draft-state — forkert format her kan persistere ugyldige datoer.

> **Review-note — `tableCommitContract.test.tsx` bør tjekkes:** Planen nævner ikke `tableCommitContract.test.tsx`, men git-status viser at den er modified (M). Kontrollér om den allerede har assertions på commit-model-typen for dato-adapteren, og opdater i givet fald.

---

## Post-implementeringsreview: lukkede fund

Implementeringen er færdig og korrekt i sin kerne. Følgende fund blev håndteret 2026-05-24:

### Fund 1 — `TableDateInput.test.tsx` sendte danske strings som `value` (Høj)

**Lokation:** `src/__tests__/components/inputs/TableDateInput.test.tsx` linje 88, 128, 163, 182, 239, 356  
**Problem:** `value="01-01-2020"`, `value="15-06-2025"`, `value="01-05-2023"` osv. er danske display-strings, ikke ISO-datoer. `value`-prop'en er nu `ISODateString | undefined`. TypeScript fanger det ikke fordi `string` er assignerbart uden strict brand-check, og testkoden bruger ikke `as ISODateString`.  
**Risiko:** Testen tester et forkert scenario. `format("01-01-2020")` vil kalde `coerceToDanishDateString("01-01-2020")` som sandsynligvis returnerer `undefined` (ikke en gyldig ISO-streng), så `renderedValue` er `''`. Testen der forventer `"01-01-2020"` i displayet efter history-restore vil enten fejle eller passere ved en tilfældighed.  
**Status:** Løst. Testen bruger nu `toISODateString()` til committed ISO-values og bruger `undefined` for tom dato-model.

### Fund 2 — `tableCommitContract.test.tsx` brugte usikker `as ISODateString`-cast (Medium)

**Lokation:** `src/__tests__/components/inputs/tableCommitContract.test.tsx` linje 425, 540, 591, 624  
**Problem:** `typeof value === 'string' ? value as ISODateString : undefined` tvinger en vilkårlig string til branded type uden validering.  
**Risiko:** Hvis test-state-maskinen producerer en dansk string som `value` (fx via et loop der starter med ISO men ikke validerer mellemtilstande), caster koden den til `ISODateString` og sender det til komponenten — et type-lie der kan maskere fejl.  
**Status:** Løst. Dynamiske test-values snævres nu med `isISODateString(value) ? value : undefined`; statiske ISO-fixtures oprettes med `toISODateString()`.

### Fund 3 — Manglende test for `tableIsoDateCellString` back-compat migration (Medium)

**Lokation:** Mangler i `src/__tests__/schemas/formSchemas.test.ts` eller tilsvarende  
**Problem:** Der er ingen test der verificerer at en gammel fil med `"24-05-2026"` (dansk format) i et dato-tabel-felt loades korrekt som `"2026-05-24"` (ISO) via `tableIsoDateCellString`-preprocess.  
**Risiko:** Skema-migrationen er kritisk for back-compat. Uden test kan en fremtidig refaktorering af `coerceToISODateString` eller `tableIsoDateCellString` bryde back-compat lydløst.  
**Status:** Løst og strammet. Der er tilføjet schema-test for ISO passthrough, legacy dansk dato → ISO, tom string → `undefined`, og ugyldig ikke-tom dato → schema-fejl. Den sidste afviger bevidst fra den oprindelige anbefaling, fordi silent `undefined` for korrupt persisted data ville bryde fail-closed/save-load-kontrakten.

---

## Potentielle fejlkilder og risici

### 1. `parseDateDraftForCommit` — tom dato-håndtering

**Risiko:** Hvis `parseDateDraftForCommit('')` returnerer `{ ok: false }` i stedet for `{ ok: true, iso: undefined }`, vil en tom celle producere en parse-fejl i stedet for at committe `undefined`.

**Handling:** Læs `src/utils/dateDraftCommit.ts` og verificer opførslen for tomme inputs, inden adapteren skrives. Hvis nødvendigt, tilføj explcit check: `if (draft.trim() === '') return { ok: true, value: undefined }`.

> **Review-note — allerede verificeret:** Se Stadie 1 review-note. `parseDateDraftForCommit` returnerer `{ ok: true, danish: '', iso: undefined }` for tomme inputs. Det eksplicitte check i adapteren er ikke nødvendigt.

### 2. `useTableInputCore` — model-type

**Risiko:** `useTableInputCore` kan have antagelser om at committed model er en string (fx i undo-historik eller fingerprint-sammenligning). Hvis det er tilfældet, vil TypeScript-fejl opstå.

**Handling:** Læs `src/hooks/tableInput/useTableInputCore.ts` og `src/hooks/tableInput/tableInputAdapter.ts` fuldt ud i Stadie 3, inden der skrives kode til Stadie 2.

> **Review-note — allerede verificeret:** Se Stadie 3 review-note. `useTableInputCore` er fuldt generisk over `TModel`. Ingen ændringer nødvendige. Risikoen er ikke-eksisterende.

### 3. Skema-migration — dobbeltformat i gemte filer

**Risiko:** Eksisterende brugerfiler kan indeholde danske datostrings (fx `"24-05-2026"`) i dato-felter. Hvis `tableIsoDateCellString` ikke håndterer dansk-format-input, vil disse felter blive `undefined` ved load.

**Handling:** `tableIsoDateCellString`'s preprocess-funktion skal eksplicit forsøge `coerceToISODateString(trimmed)` som fallback, hvis strengen ikke er gyldig ISO. Dette er beskrevet i Stadie 4 ovenfor.

### 4. `StandardLoenTable` — verificer dato-model

`StandardLoenTable.tsx` bruger `TableDateInput` med to dato-kolonner. Verificer hvilke felter der bruges og hvilket schema de er bundet til, inden de ændres.

> **Review-note — `StandardLoenTable` dato-felter er `col0_dag` og `col1_dag`:** Verificeret ved læsning af `StandardLoenTable.tsx` linje 650 og 693. Row-typen er `StandardLoenTableRow` fra `aarsloenSchemas.ts`. Felternes schema-type skal verificeres — søg `col0_dag` og `col1_dag` i `aarsloenSchemas.ts`. Tabellen har en avanceret draft/committed-separation (`rowsState.draft` vs. `rowsState.committed`) og bruger `danishToISO()` aktivt til sort-værdier og `minDate`/`maxDate`-beregning (se Stadie 5 review-noter ovenfor). Disse kald skal erstattes når col0_dag/col1_dag ændres til ISO.
>
> **Review-note — `danishToISO()` vs. `coerceToISODateString()`:** `StandardLoenTable` bruger `danishToISO` (direkte fra `branded.ts`), mens de andre tabeller bruger `coerceToISODateString`. `danishToISO` håndterer kun dansk format (returnerer `undefined` for ISO-input), mens `coerceToISODateString` håndterer begge. Med ny model er feltet allerede ISO, og `danishToISO` vil returnere `undefined` — det er en stille fejl, ikke en TypeScript-fejl. Erstat aktiv med `row.col0_dag ?? ''`.

### 5. `onRegisterSanitize` — ekstern brug

`TableDateInput` eksponerer `onRegisterSanitize` som registrerer en sanitize-callback til brug i formularer der gemmer draft-værdier. Med den nye model returnerer `sanitizeTableDateDraft` en `ISODateString | undefined` i stedet for en dansk string. Verificer alle steder der kalder `onRegisterSanitize` og opdater typerne.

> **Review-note — `onRegisterSanitize` bruges kun i `TableDateInput` selv:** Grep bekræfter at `onRegisterSanitize` kun er defineret og bruges som callback-registration i `TableDateInput.tsx`. Ingen andre filer i codebase bruger det. Den eneste risiko er at call-sites der sender `onRegisterSanitize` prop ned til `TableDateInput` — søg efter `onRegisterSanitize=` i tabellerne. Hvis ingen tabeller sender denne prop, er ændringen ufarlig (type-update i `TableDateSanitizeCallback` + `sanitizeTableDateDraft`-returtype).

### 6. `asValidDateBound` i call-sites

`OffentligeYdelserTable.tsx` bruger `asValidDateBound(row.tilDato)` til at beregne `maxDate`. `asValidDateBound` tager sandsynligvis en dato-string og returnerer en gyldig dato-bound eller undefined. Med den nye model er `row.tilDato` en `ISODateString | undefined`. Verificer at `asValidDateBound` accepterer `ISODateString | undefined` eller juster kaldet.

> **Review-note — `asValidDateBound` bør slettes:** Koden er verificeret: `asValidDateBound` i `OffentligeYdelserTable.tsx` linje 68–73 gør kun én ting — `coerceToISODateString(trimmed)`. Med ny model er `row.fraDato`/`row.tilDato` allerede `ISODateString | undefined`. Kaldet reduceres til `row.tilDato` (eller `row.fraDato ?? undefined` for undefined-handling). Funktionen er en no-op og bør slettes aktivt.

---

## Rækkefølge og afhængigheder

```
Stadie 1 (adapter)
    ↓
Stadie 2 (TableDateInput props)
    ↓
Stadie 3 (useTableInputCore — blokerer Stadie 2 hvis nødvendigt)
    ↓
Stadie 4 (skema-migration) — kan påbegyndes parallelt med Stadie 2/3
    ↓
Stadie 5 (call-sites + slet TableDateIsoInput)
    ↓
Stadie 6 (tests)
```

Stadie 3 bør afklares (ved at læse `useTableInputCore.ts`) inden Stadie 2 påbegyndes, da det kan kræve ændringer i signaturen der påvirker alle andre stadier.

> **Review-note — rækkefølgen kan forenkles:** Stadie 3 er ikke et egentligt stadie — det er en verifikation der allerede er foretaget (se ovenfor). Flyt noten til Stadie 2 og fjern Stadie 3 som selvstændigt trin. Det reducerer de seks stadier til fem og fjerner en falsk afhængighed.
>
> Den reelle rækkefølge:
> ```
> Stadie 1 (adapter + slet dateFingerprintFromCommittedValue)
>     ↓
> Stadie 2 (TableDateInput props — ingen useTableInputCore-ændringer nødvendige)
>     ↓
> Stadie 3 (skema-migration + persistenceVersion bump) — parallelt med Stadie 2 muligt
>     ↓
> Stadie 4 (call-sites: OevrigeKravTable, TAFPeriodeTable, SvieSmerteTable,
>           FerieperiodeTable, BeregningsperiodeFerieTable, BeregnetRenteTable,
>           OffentligeYdelserTable, LoenudviklingManuelTable,
>           EetAslAfgoerelserTable, StandardLoenTable)
>     ↓
> Stadie 5 (slet TableDateIsoInput + opdater exports)
>     ↓
> Stadie 6 (tests inkl. persistenceVersion + sanitizeCallback)
> ```

---

## Verifikation

> **Post-implementeringsstatus:** Typecheck og test-suite er kørt (2026-05-24, persistenceVersionDrift opdateret). Åbne fund (se ovenfor) bør adresseres inden filen arkiveres.

Kør inden merge:

```
npm run typecheck
npm test -- --run \
  src/__tests__/components/inputs/TableDateInput.test.tsx \
  src/__tests__/components/inputs/tableCommitContract.test.tsx \
  src/__tests__/config/persistenceVersionDrift.test.ts \
  src/__tests__/schemas/eoFileSchema.test.ts \
  src/__tests__/utils/fileSave.test.ts \
  src/__tests__/quality/dateContractGuard.test.ts \
  src/__tests__/domain/dates/dateCommit.test.ts \
  src/__tests__/types/branded.date.test.ts \
  src/__tests__/domain/erstatningsopgoerelse/ \
  src/__tests__/domain/erhvervsevnetab/
```

Manuelt: åbn en eksisterende fil med gemte dato-felter og verificer at de indlæses korrekt efter skema-migrationen. Rediger en dato-celle og verificer at displayet forbliver dansk, mens det gemte format er ISO.

> **Review-note — `persistenceVersionDrift.test.ts` har fingerprint `'fnv1a-3939538'` (opdateret 2026-05-24 for percent-adapter-migrering):** Dato-adapter-migreringen er en ny breaking change — fingerprint vil ændres igen. Husk at opdatere kommentaren i testen der forklarer *hvilke* ændringer der triggede bump, så fremtidige reviewere kan forstå historikken.
>
> **Review-note — kør `npm run typecheck` allerede efter Stadie 1 og 2:** TypeScript-fejl på call-sites er den primære mekanisme til at opdage glemte ændringspositioner. Kør typecheck tidligt og brug fejloutput som en levende checkliste for Stadie 4 og 5. Vent ikke til alle stadier er færdige.
>
> **Review-note — manuel verifikation: `StandardLoenTable` med `loenperiode='dag'`:** Skift til dag-mode og rediger begge dato-kolonner. Verificer at sort fungerer korrekt efter migration (se review-noter om `danishToISO` i Stadie 5). Dette er en regressionsfælder der ikke fanges af unit tests.
