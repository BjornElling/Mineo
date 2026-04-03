# TODO: Smårettelser

Oprettet: 2026-04-03

Hvert punkt indeholder: beskrivelse, relevante filer og felter, implementeringsplan med rækkefølge, samt potentielle faldgruber.

---

## 1. Advarsel på EO-beregningtab ved løn efter ansættelsesophør

### Beskrivelse
Hvis `ansaettelsesforholdOphoert === true` og der er angivet lønindkomst i `indtaegtsoplysningerTableData` for en periode, der helt eller delvist falder efter `sidsteArbejdsdag`, skal der vises en advarsel på beregning-fanen.

### Relevante felter
- `LoenindkomstAnsaettelsesforhold.ansaettelsesforholdOphoert` (boolean)
- `LoenindkomstAnsaettelsesforhold.sidsteArbejdsdag` (optionalIsoDateString)
- `LoenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData[].fraDato` + `tilDato` (tableDateCellString)
- Advarselsvisning: `EOberegningTab.tsx` linjer 249-291, via `collectAllDebugRows()`
- Eksisterende advarselsmønster: `getCustomDebugRowMessage()` i `EOberegningTab.tsx`

### Implementeringsplan
1. Find valideringslogikken for EO-debug-rækker i `src/domain/debug/eoDebugErstatningsopgoerelseModel.ts` (filen er verificeret og importerer fra alle relevante engines/helpers).
2. Tilføj en ny valideringsregel, der for hvert ansættelsesforhold med `ansaettelsesforholdOphoert === true` og en defineret `sidsteArbejdsdag` itererer over `indtaegtsoplysningerTableData`-rækkerne og tjekker, om `fraDato` eller `tilDato` er *efter* `sidsteArbejdsdag`.
3. Returner en advarsel (ikke fejl) — beregningen bør ikke blokeres, men brugeren skal adviseres.
4. Sørg for at advarslen vises pr. ansættelsesforhold og nævner det pågældende ansættelsesfelt (brug `navnPaaArbejdssted` eller ansættelses-index som identifikation).

### Faldgruber
- `fraDato`/`tilDato` i `standardLoenTableRow` er `tableDateCellString` (streng), ikke `IsoDateString`. Parsing skal håndtere ugyldige eller tomme værdier uden at kaste.
- Delvis overlap (perioden starter før men slutter efter `sidsteArbejdsdag`) skal fanges ligesom fuldstændigt overlap.
- Advarslen skal ikke aktiveres, hvis `sidsteArbejdsdag` er `undefined` — feltet er optionalt. Det ryddes automatisk, når `ansaettelsesforholdOphoert` sættes til `false` via `applyAnsaettelsesforholdToggleCleanup` i `loenindkomstStateCleanup.ts` linje 17 — så `sidsteArbejdsdag !== undefined` er tilstrækkeligt guard.
- `tafRowDerived.ts` håndterer TAF-perioder, ikke løn-indkomst-rækker — overlap-detektion her kan ikke genbruges direkte.

---

## 2. Systematisk validering af fra/til-datopar (til < fra)

### Beskrivelse
`periodeTilBeregningFra`/`periodeTilBeregningTil` på EO-oplysninger-fanen giver ingen fejl, hvis til-datoen er *før* fra-datoen. Der skal laves en systematisk gennemgang af samtlige steder med fra/til-datopar og indføres ensartet beskyttelse mod dette — med standardiserede fejlbeskeder.

### Datopar der skal tjekkes
| Felt (fra) | Felt (til) | Placering |
|---|---|---|
| `periodeTilBeregningFra` | `periodeTilBeregningTil` | `EOOplysningerTab.tsx` ~ linje 1689 |
| `svieSmertePerioder[].fra` | `svieSmertePerioder[].til` | Schema linjer 36–42 |
| `tafPerioder[].fra` | `tafPerioder[].til` | Schema linjer 45–51 |
| `ferieperioder[].fra` | `ferieperioder[].til` | Schema linjer 54–59 |
| `fravaerPerioder[].fra` | `fravaerPerioder[].til` | Schema linjer 54–59 |
| `sfggReferenceperiodeFra` | `sfggReferenceperiodeTil` | Schema linjer 80–91 |
| `offentligeYdelserRows[].fraDato` | `offentligeYdelserRows[].tilDato` | Schema linjer 105–115 |

### Implementeringsplan
1. Find (eller opret) en fælles hjælpefunktion til dato-rækkefølge-validering — fx `validateDateOrder(fra, til): string | undefined` — der returnerer en standardiseret fejlbesked, hvis til < fra. Placér den i `src/utils/` eller ved siden af eksisterende `StyledDateField`-validering.
2. Standardfejlbesked: `"Til-dato skal være efter fra-dato"` (konsulter eksisterende fejlbeskeder for præcis formulering — fx `"Dato skal være mellem [date] og [date]"` i `tafPeriodConstraints.ts`).
3. Tilføj reglen én tabeltype ad gangen, startende med de mest kritiske (TAF-perioder, før-løn-periode), og test hver ændring.
4. For tabeldatoer (`tableDateCellString`): valideringen skal ske ved commit, analogt med eksisterende `StyledDateField`-håndtering.
5. For standalone datofelt-par (`periodeTilBeregningFra`/`Til`): tilføj valideringen som en cross-field-kontrol i den relevante komponent eller validator.

### Faldgruber
- `tableDateCellString` og `IsoDateString` er ikke samme type — brug den rigtige parsing i hvert tilfælde.
- Mange datopar bor i tabeller hvor til-feltet valideres uafhængigt af fra-feltet. Cross-field-validering kræver adgang til begge værdier på commit-tidspunktet.
- Sørg for at tom/undefined til-dato *ikke* trigger fejlen — beskyttelsen gælder kun, når begge datoer er angivet.
- Undgå at duplikere fejlbeskeder: den standardiserede besked skal defineres ét sted og refereres alle andre steder.

---

## 3. Ensartet sortering og gemning af rækkefølge i loose og standard grid-tabeller

### Beskrivelse
Sortering og persistering af rækkefølge skal fungere ens for `StandardLooseTable` (`tableKind: 'loose'`) og `StandardGridTable` (`tableKind: 'grid'`), baseret på fælles kode, og den *sorterede* rækkefølge skal gemmes — ikke blot vises.

**Adfærd:** Brugeren forventer at den rækkefølge, som rækkerne aktuelt fremstår i på skærmen, altid er den rækkefølge der gemmes. Det vil sige: rækkefølgen gemmes løbende ved hvert sort-klik (write-through til formstate), ikke kun ved eksplicit gem-klik.

### Relevante filer
- `src/components/tables/useTableSort.ts` — sort-hook (bekræftet: holder sortState i React-state, ikke persisteret). Returnerer `sortedRows` (memoized), `getSortRole`, `getSortDirection`, `handleHeaderClick`.
- `src/components/tables/gridCore/gridModel.ts` — `toggleGridSort()`, `sortGridRows()`
- `src/components/tables/StandardLooseTable.tsx` — loose-tabel
- `src/components/tables/StandardGridTable.tsx` (eller tilsvarende) — grid-tabel
- `saveOrderPath`-prop i `StandardLoenTable.tsx` linje 58 — eksisterende persisterings-hook (bekræftet)
- `useRegisterTableSaveOrder` (linje 394 i `StandardLoenTable.tsx`) — eksisterende gem-mekanisme

### Implementeringsplan
1. **Kortlæg** hvilke tabeller der aktuelt bruger `saveOrderPath`/`useRegisterTableSaveOrder`, og hvilke der ikke gør det.
2. **Kortlæg** hvilke tabeller der bruger `useTableSort`, og om begge tabeltyper har adgang til sorteringskomponenten.
3. Beslut: den sorterede rækkefølge gemmes ved at mutere `rows`-arrayet i formstate ved hvert sort-klik. Dette er konsistent med det forventede brugeradfærdsprincip og med det eksisterende `saveOrderPath`-mønster.
4. Indfør en fælles `useSortAndPersist`-hook (eller udvid `useTableSort`) der: (a) sorterer visuelt, (b) skriver den sorterede rækkefølge tilbage til formstate via en `onReorder`-callback.
5. Applicér samme hook på begge tabeltyper.

### Faldgruber
- "Tom trailing row"-mønsteret (`normalizeGridRows()`) skal bevares: trailing-rækken må ikke gemmes som en rigtig række.
- Mutation af `rows` ved sort-klik kan trigge unødvendige re-renders — brug memoization.
- `useTableSort` returnerer en memoized `sortedRows`, men skriver ikke tilbage til formstate — det er præcis det der mangler, og som den nye hook skal tilføje.

---

## 4. PDF-reguleringsside: Vis kun brugerens navn for manuel regulering

### Beskrivelse
I PDF-dokumentet for erstatningsopgørelser vises reguleringstypen i dag som `"Manuelt angivet (brugernavn)"`. Når brugeren har angivet et navn, skal *kun* brugerens navn vises i PDF — uden præfikset. I debug-visningen på beregning-fanen skal visningen **forblive uændret** (`"Manuelt angivet (brugernavn)"`).

### Relevante filer og kode
- `src/domain/erstatningsopgoerelse/helpers/loenudviklingDisplay.ts` linjer 20–22 (bekræftet):
  ```typescript
  return manuelNavn !== '' ? `Manuelt angivet (${manuelNavn})` : 'Manuelt angivet';
  ```
  Dette er den kanoniske kilde til visningsnavnet — og bruges af **begge** kontekster.
- Funktionen `resolveValgtReguleringDisplay()` returnerer teksten, der bruges i PDF (via `reguleringSection.ts` linje 345) **og** i debug-visningen (via `eoDebugErstatningsopgoerelseModel.ts` linje 34).
- `LoenindkomstAnsaettelsesforhold.loenudviklingManuelNavn` (optionalString) — brugerens angivne navn.

### Implementeringsplan
1. Da `resolveValgtReguleringDisplay()` bruges i **begge** kontekster (debug og PDF), må den **ikke** ændres direkte.
2. Opret i stedet en PDF-specifik formateringsfunktion — fx `resolveValgtReguleringDisplayForPdf()` — placeret i `loenudviklingDisplay.ts` eller i PDF-hjælpefiler:
   ```typescript
   return manuelNavn !== '' ? manuelNavn : 'Manuelt angivet';
   ```
3. Erstat kaldet til `resolveValgtReguleringDisplay()` i PDF-generatoren (`reguleringSection.ts` linje 345) med det nye kald.
4. Debug-visningen (`eoDebugErstatningsopgoerelseModel.ts` linje 34) forbliver uændret og bruger den eksisterende funktion.

### Faldgruber
- Ændr **ikke** den delte `resolveValgtReguleringDisplay()` — det ville bryde debug-visningen.
- Kontrollér at der ikke er andre steder i PDF-genereringen, der kalder den eksisterende funktion og bør skifte til den nye.

---

## 5. Beregning af fritvalg, SH/SO og pension baseret på overenskomstens reguleringssatser per periode

### Beskrivelse
Når et ansættelsesforhold er under overenskomst eller manuel regulering, skal fritvalg, SH/SO og pension beregnes ud fra overenskomstens faktiske satser for de relevante perioder — ikke ud fra de samtidsangivne værdier på reguleringsdatoen. Hvis reguleringssat ændrer sig midt i en periode, skal dagene opdeles.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.fritvalgPct`, `shSoPct`, `pensionPct` (percentageDecimal) — overordnede satser øverst på siden
- `syncManualBaseRowSatser()` i `LoenindkomstTab.tsx` linjer 173–200 (bekræftet) — synkroniserer satserne til manuel reguleringstabels baserow
- `src/data/overenskomstRates.ts`: `OverenskomstPeriodeSats` med `shSoSats`, `fritvalg`, `agPension` (alle decimal eller null)
- `getEffektiveSatserForDato()` — slår satser op for en given dato
- `getReguleringsDatoIntervalForOverenskomst()` — henter reguleringsintervaller
- Beregningslogik for lønindkomst-tabellen: Sandsynligvis i engine-filer under `src/domain/erstatningsopgoerelse/engines/`

### Implementeringsplan
1. Kortlæg præcis hvilken beregningsfunktion der bruger `fritvalgPct`/`shSoPct`/`pensionPct` til at beregne kolonner i lønindkomsttabellen (fx "FP/FV/SH/SO/St.B." og "Arb.g. Pension").
2. Identificér om disse beregninger allerede er periodiserede (dvs. opdeler beregningsperioden ved reguleringsdatoer), eller om de anvender én enkelt sats for hele perioden.
3. Hvis ikke periodiseret: implementér en segmenteringsfunktion analogt med `getLoenudviklingSegmenter()` (eller tilsvarende) — som opdeler en beregningsperiode ved reguleringsintervallernes skæringspoints og anvender den korrekte sats for hvert segment.
4. For manuel regulering: brug `loenudviklingManuelTableData`-rækkernes satser pr. periode i stedet for `fritvalgPct`/`shSoPct`/`pensionPct`.
5. Test med en overenskomst der skifter sats midt i en beregningsperiode.

### Faldgruber
- Dette er en potentielt stor ændring med høj beregningsrisiko. Lav tests *før* ændringen, der dokumenterer den eksisterende (forkerte) adfærd, og lav derefter tests for den ønskede adfærd.
- `getEffektiveSatserForDato()` returnerer `null` for felter, der ikke er angivet i overenskomsten — disse skal ikke overskrive brugerens egne angivelser.
- Dayjs-baseret dagsberegning: sørg for at brugen er konsistent med eksisterende mønstre (undgå lokale tidszone-problemer ved midnat).
- Afklar om "perioden" er baseret på `tafPerioder`, `loenperiode` eller `indtaegtsoplysningerTableData` — de kan have forskellig granularitet.

---

## 6. Midlertidig EET-checkbox på EO-beregningtab med tilhørende PDF-side

### Beskrivelse
På beregning-fanen skal der indsættes en ny `FormControlLabel`-checkbox med teksten "Midlertidig EET" efter checkboxen for "Offentlige ydelser". Default: `true`. Hvis afkrydset *og* der er løbende EET-ydelser med `afgoerelseType === 'Midlertidig'` eller `'Delvist endelig'`, indsættes en PDF-side med de tilsvarende tabeller. Ingen relevante ydelser = ingen PDF-side.

### Indhold på PDF-siden
PDF-siden skal indeholde præcis det samme som knappen "Indsæt midlertidigt EET fra Erhvervsevnetab-siden" på offentlige ydelser-fanen allerede beregner. Det vil sige: brug `buildMidlertidigtEetRowsFromEet()` fra `src/domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows.ts` som datakilde — denne funktion filtrerer allerede på `afgoerelseType === 'Midlertidig' | 'Delvist endelig'` via `computeEetLoebendeYdelser`. Resultatet er en liste af `OffentligeYdelserRow[]`, formateret som offentlige ydelser-rækker.

### Relevante filer og felter
- `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx` linjer 960–1025 — eksisterende checkbox-blok (bekræftet: "Offentlige ydelser"-checkboxen slutter linje 988)
- `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` linjer 191–199 — `eoBilagSelectionSchema` (bekræftet: 7 felter, bruger `.strict()`)
- `EOberegningTab.tsx` linje 521–529 — fallback-objekt for `eoBilagSelection` (bekræftet)
- `src/domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows.ts` — `buildMidlertidigtEetRowsFromEet()` (eksisterende funktion, klar til genbrug)
- `src/domain/erhvervsevnetab/eetLoebendeYdelserCalculation.ts` — `computeEetLoebendeYdelser()`, returnerer `EetLoebendeCalculationResult` med `computation.afgoerelser[]` — hvert element har `afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig'` og `perioder[]`
- PDF-genereringskæden i `src/pdf/domains/eo/erstatningsopgoerelsePdf.ts` og `src/pdf/domains/eo/index.ts`
- `AfgoerelseType`-enum: `'Midlertidig' | 'Delvist endelig' | 'Endelig'` (i `enumSchemas.ts` linje 69)

### Implementeringsplan
1. Tilføj `midlertidigEet: z.boolean()` til `eoBilagSelectionSchema` og opdater default til `true`. Da skemaet bruger `.strict()` **skal** feltet tilføjes i skemaet — ellers fejler parse ved eksisterende gem-filer.
2. Tilføj `midlertidigEet: true` til fallback-objektet i `EOberegningTab.tsx` linje 521–529.
3. Tilføj `FormControlLabel` med checkbox i `EOberegningTab.tsx` umiddelbart efter "Offentlige ydelser"-checkboxen (linje ~988, i det første `Box`-element).
4. I PDF-generatoren: find stedet hvor siden med offentlige ydelser indsættes, og indsæt betinget en ny side derefter.
5. Den nye PDF-side: hent data via `buildMidlertidigtEetRowsFromEet({ eetValues, skadesdato })`. Hvis resultatet er tomt, spring siden over. Ellers gengiv indholdet som en tabel svarende til offentlige ydelser-formatet, med overskriften "Midlertidig EET".
6. Kontrollér at EET-beregningsdata er tilgængeligt i EO-PDF-generatorens kontekst (det er sandsynligvis nødvendigt at sende EET-værdier og skadesdato ind som argument).

### Faldgruber
- `eoBilagSelectionSchema` bruger `.strict()` — tilføj `midlertidigEet`-feltet med `.default(true)` for at håndtere eksisterende gem-filer uden feltet.
- Både schema og fallback-objektet i `EOberegningTab.tsx` skal opdateres i sync.
- `buildMidlertidigtEetRowsFromEet` kræver `ErhvervsevnetabValues` og `skadesdato` — disse skal være tilgængelige i PDF-konteksten. Tjek om EO-PDF-generatoren allerede modtager disse, eller om der kræves prop-drilling.
- Tabellerne på EET-løbende-ydelser-fanen bruger `StandardDisplayTable` — find om PDF-koden har en tilsvarende PDF-renderer til samme format, eller om `buildMidlertidigtEetRowsFromEet`'s `OffentligeYdelserRow[]`-output kan gengives med den eksisterende offentlige-ydelser-PDF-renderer.

---

## 7. Sygeferiegodtgørelse: Ekskluder ansættelsesforhold ikke ansat på skadestidspunktet

### Beskrivelse
I beregningen af sygeferiegodtgørelse må kun ansættelsesforhold med `ansatPaaSkadestidspunktet === true` indgå. Ansættelsesforhold med `false` skal behandles som om de ikke eksisterede.

### Relevante filer og felter
- `LoenindkomstAnsaettelsesforhold.ansatPaaSkadestidspunktet` (boolean, schema linje 286)
- `src/domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse.ts` — primær beregningsfil
- Indgangsfunction: `computeSygeferiegodtgoerelse()` (linje 863, bekræftet). Iterationen over `values.loenindkomstAnsaettelsesforhold` sker linje 911: `for (const employment of values.loenindkomstAnsaettelsesforhold ?? []) {`
- `getSfggRowForEmployment()` i `sygeferiegodtgoerelse.ts` linjer 373–377 — slår sfgg-rækken op per ansættelsesforhold
- `loenindkomstStateCleanup.ts` linjer 14–16 — eksisterende cleanup: `ansatPaaSkadestidspunktet === false` rydder allerede `ansaettelsesforholdOphoert` og `sidsteArbejdsdag`

### Implementeringsplan
1. I `computeSygeferiegodtgoerelse()` linje ~911: tilføj filter umiddelbart inden for-løkken:
   ```typescript
   for (const employment of (values.loenindkomstAnsaettelsesforhold ?? []).filter(af => af.ansatPaaSkadestidspunktet)) {
   ```
2. Kontrollér at `sfggAnsaettelsesforhold`-arrayet (adgang via `getSfggRowForEmployment`, der finder via `ansaettelsesforholdId`) ikke kræver yderligere filtrering — opslaget sker allerede pr. `employment.id`, så ekskludering af employment-rækken er tilstrækkeligt.
3. Test at en ændring af toggle på et ansættelsesforhold ændrer den beregnede sygeferiegodtgørelse.

### Faldgruber
- `sfggAnsaettelsesforhold` er et separat array med sfgg-specifikke data. Det er *ikke* identisk med `loenindkomstAnsaettelsesforhold` — de er forbundet via `ansaettelsesforholdId`. Da opslaget sker via `getSfggRowForEmployment` som finder på `ansaettelsesforholdId`, og vi aldrig når det kald for ekskluderede ansættelsesforhold, er der ingen risiko for stale data.
- Eksisterende `loenindkomstStateCleanup.ts` rydder `ansaettelsesforholdOphoert` og `sidsteArbejdsdag` når `ansatPaaSkadestidspunktet` sættes til `false` — ny filterlogik konflikter ikke med dette.
- Afklar om brugeren bør adviseres, hvis de har udfyldt sfgg-data for et ansættelsesforhold med `ansatPaaSkadestidspunktet === false` — det kan udgøre en datatab-risiko ved toggle.

---

## 8. Store Bededagstillæg: Automatisk beregnet felt (ikke redigerbart)

### Beskrivelse
Feltet `storeBededagPct` for store bededagstillæg på lønindkomst-siden skal beregnes automatisk og ikke være redigerbart. Værdien er 0, medmindre reguleringsdatoen er fra 1. januar 2024 eller senere *og* brugeren har fået fuld løn under SH-dage (`fuldLoenUnderFerie === 'Ja'` — check: faktisk valideret via `loenPaaHelligdage === 'Almindelig løn'`).

### Eksisterende logik (verificeret)
Der er allerede en indlejret valideringslogik:
- `validateStoreBededag()` i `LoenindkomstTab.tsx` linje ~400 validerer felt-input mod den forventede beregnede værdi og viser en fejlbesked, hvis brugeren har tastet forkert.
- `getReguleringsDatoForAnsaettelsesforhold()` i `LoenindkomstTab.tsx` linje ~457 bestemmer den relevante dato: `af.saerligFraDatoRegulering || stamdataValues?.skadesdato`. Det er **denne** dato — ikke overenskomstens reguleringsdatoer — der er autoritativ for Store Bededag-beregningen.
- Konstanten `STORE_BEDEDAG_PCT = 0.45` er defineret i `src/config/regulatoryRates.ts` linje 13.
- Konstanten `STORE_BEDEDAG_START = iso('2024-01-01')` er defineret i `src/config/dateRanges.ts` linje 25.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.storeBededagPct` (percentageDecimal, schema linje 291)
- `LoenindkomstAnsaettelsesforhold.loenPaaHelligdage` — betingelse: `=== 'Almindelig løn'`
- `LoenindkomstAnsaettelsesforhold.saerligFraDatoRegulering` — manuel dato; fallback: `stamdataValues?.skadesdato`
- `STORE_BEDEDAG_START = iso('2024-01-01')` i `src/config/dateRanges.ts` linje 25
- `STORE_BEDEDAG_PCT = 0.45` i `src/config/regulatoryRates.ts` linje 13
- `StyledPercentField` for `storeBededagPct` i `LoenindkomstTab.tsx` linjer 2091–2102
- `handleValidatedSatsCommit()` og `validateStoreBededag()` — eksisterende validerings- og commit-logik

### Implementeringsplan
1. Beregn den korrekte `storeBededagPct`-værdi ud fra den eksisterende logik i `validateStoreBededag()`:
   - `STORE_BEDEDAG_PCT` (0.45) hvis `reguleringsDato >= STORE_BEDEDAG_START && loenPaaHelligdage === 'Almindelig løn'`
   - `0` i alle andre tilfælde
2. Indfør auto-beregning via et `useEffect` eller direkte i commit-handleren for `loenPaaHelligdage` og `saerligFraDatoRegulering` — analogt med `syncManualBaseRowSatser`.
3. Skriv den beregnede værdi til formstate (ikke kun vis den) så det korrekte tal gemmes.
4. Gør `StyledPercentField` ikke-redigerbart ved at sætte `readOnly` eller `disabled` — feltet skal vise den beregnede værdi, men brugeren skal ikke kunne overskrive den.
5. `validateStoreBededag()` kan bevares som intern konsistenstjek, men bør ikke længere producere fejl på et auto-beregnet felt — overvej om validatoren skal fjernes eller omkonverteres til en debug-advarsel.

### Faldgruber
- `loenPaaHelligdage` er **ikke** en boolean — sammenlign med strengen `'Almindelig løn'` (ikke `fuldLoenUnderFerie === 'Ja'` som angivet i den oprindelige beskrivelse — det er `loenPaaHelligdage` der bruges).
- Reguleringsdatoen for Store Bededag er `saerligFraDatoRegulering || skadesdato` — **ikke** overenskomstens reguleringsdatoer.
- Sørg for at det auto-beregnede felt skrives til formstate, så det korrekte tal indgår i beregninger.
- Feltet må ikke kunne redigeres manuelt — test at det opdateres korrekt, når `loenPaaHelligdage` ændres eller `saerligFraDatoRegulering` ændres.

---

## 9. Overenskomst auto-udfyld af fritvalg, SH/SO og pension

### Beskrivelse
Når brugeren vælger en overenskomst (`harOverenskomst === true` og `overenskomstId` er sat), skal `fritvalgPct`, `shSoPct` og `pensionPct` auto-udfyldes med overenskomstens satser og låses for redigering. Hvis overenskomsten ikke har satser for et felt (null), bevares brugerens input og feltet forbliver redigerbart. Hvis overenskomsten eksplicit fastlægger, at der *ikke* er ret til en ydelse (0), slettes input og feltet låses til 0.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.harOverenskomst` (boolean), `.overenskomstId` (optionalString)
- `LoenindkomstAnsaettelsesforhold.fritvalgPct`, `.shSoPct`, `.pensionPct`
- `getEffektiveSatserForDato()` i `src/data/overenskomstRates.ts` — returnerer `OverenskomstPeriodeSats` med `fritvalg: number | null`, `shSoSats: number | null`, `agPension: number | null`
- `StyledPercentField`-komponenter for satserne i `LoenindkomstTab.tsx` linjer 2053–2116
- `syncManualBaseRowSatser()` — eksisterende mønster for synkronisering af satser

### Dato for opslag
Dato til `getEffektiveSatserForDato()` skal afklares. Kandidater er skadestidspunktet eller lønperiodens startdato. **Valg har beregningskonsekvenser** — en overenskomst kan have forskellige satser på tværs af disse tidspunkter. Dette punkt er relateret til punkt 5 (periodisering), men angår her kun de overordnede felter, ikke den periodiserede beregning.

### Implementeringsplan
1. Find stedet i `LoenindkomstTab.tsx` hvor `overenskomstId` ændres (commit-handler).
2. Slå satser op med `getEffektiveSatserForDato()` på et repræsentativt tidspunkt (se "Dato for opslag" ovenfor — afklar inden implementering).
3. For hvert sats-felt: Hvis overenskomsten returnerer en numerisk værdi (inkl. 0), skriv den til formstate og markér feltet som låst. Hvis overenskomsten returnerer `null`, lad brugerens eksisterende input stå og bevar redigerbarhed.
4. Lås felterne via en ny `readOnly`-prop på `StyledPercentField` (eller `disabled`) — brug en udledt boolean baseret på om overenskomsten har en sats for det pågældende felt.
5. Når `harOverenskomst` skifter til `false` eller `overenskomstId` ryddes: frigiv felterne for redigering og bevar (eller ryd) de auto-indsatte værdier.

### Faldgruber
- **Null vs. 0 er semantisk forskelligt**: `null` = overenskomsten angiver ikke satsen (brugeren skal indtaste); `0` = overenskomsten fastlægger at der ikke er ret til ydelsen. Disse to tilfælde skal håndteres forskelligt, som beskrevet ovenfor.
- Overenskomster kan have ændrede satser over tid (jf. punkt 5 ovenfor) — auto-udfyld her angår kun de overordnede felter (ikke den periodiserede beregning).
- `syncManualBaseRowSatser()` skal stadig køre korrekt efter auto-udfyld — tjek at den eksisterende funktion fungerer med auto-indsatte værdier.

---

## 10. Satser-siden: Sammenslå to fri proces-rækker til én

### Beskrivelse
De to `DataRow`-komponenter for fri proces-beløbsgrænser på satser-siden skal samles i én `DataRow` (eller tilsvarende komponent), hvor begge værdier vises under hinanden uden linjeafstand.

### Relevante filer
- `src/components/pages/Satser.tsx` linjer 267–279 — de to `DataRow`-komponenter der skal samles (bekræftet)
- `DataRow`-komponenten defineret i `Satser.tsx` linjer 55–79
- Datakilderne: `satser.diverse.friProcesEnlig`, `satser.diverse.friProcesSamlevende`, `satser.diverse.friProcesBarn`

### Nuværende kode (opsummeret)
```
DataRow("Beløbsgrænse for fri proces (enlig/samlevende)", formatKronerPair(...))
DataRow("+ Tillæg per barn under 18 år", formatKroner(...))
```

### Implementeringsplan
1. Erstat de to `DataRow`-komponenter med én samlet blok. Det enkleste er at definere en lokal `MultiLineDataRow`-variant eller inline-stil med en `Box` der indeholder to label/value-par stablet uden margin.
2. Alternativt: udvid `DataRow` til at acceptere en liste af label/value-par.
3. Bevar den eksisterende null-check-adfærd (DataRow returnerer null hvis value er tom).

### Faldgruber
- Minimal risiko — ren præsentationsændring uden beregningskonsekvenser.
- Sørg for at den samlede blok stadig skjules, hvis begge værdier er tomme.

---

## 11. Sidemenu: Undgå linjeskift i "Varige mén"

### Beskrivelse
Teksten "Varige mén" i sidemenuen brydes over to linjer, når menuen folder ud. Den skal holdes på én linje.

### Relevante filer
- `src/components/layout/SideMenu.tsx` linje 69 — `{ id: 'varigemen', label: 'Varige mén', icon: <PersonalInjury /> }` (bekræftet)
- `Button`-styling i `SideMenu.tsx` linjer 198–222 (bekræftet) — ingen `whiteSpace`-property er sat. Knappen har `height: '44px'` og `minWidth: 0`.

### Implementeringsplan
1. Tilføj `whiteSpace: 'nowrap'` til `Button`-komponentens `sx`-prop i `SideMenu.tsx` for menu-items.
   - Alternativt: tilføj det kun for det specifikke menu-item med label "Varige mén".
2. Kontrollér at det ikke bryder layout for andre menu-items med længere etiketter.

### Faldgruber
- `whiteSpace: 'nowrap'` på `Button` kan påvirke alle menu-items — hvis andre labels er lange nok til at de bør brydes, er en global ændring forkert. I så fald: anvend kun på "Varige mén"-item specifikt via en betingelse på `item.id === 'varigemen'`.
- Kontrollér at ikonet og teksten stadig er korrekt placeret ved smalle viewports. Ikonet vises via `startIcon`-prop og er allerede `minWidth: '24px'`.

---

## 12. Info-ikon med tooltip — standardiseret komponent

### Beskrivelse
Der skal oprettes et lille standardiseret info-ikon-komponent (`InfoTooltipIcon`), der vises som et lille hævet overlay med en MUI `Tooltip`-besked ved hover. Det skal indsættes tre steder:
1. I lønindkomsttabellen efter overskriften "Løn (2)" — tekst: *"Opdelingen af løn er rent visuel - værdierne lægges sammen i beregningen"*
2. Samme sted i årslønsberegningstabellen
3. På offentlige ydelser-fanen efter overskriften "Ydelser (2)" — tilpasset tekst om at opdelingen er visuel

### Relevante filer
- `src/domain/aarsloen/standardLoenTableColumns.ts` linje 7 — `STANDARD_LOEN_COL3_LABEL = 'Løn (2)'` og header-generering (bekræftet)
- `StandardLoenTable.tsx` — tabel-komponent der bruger kolonnenavnene
- `src/components/pages/Aarsloen.tsx` — årslønsberegning, bruger `StandardLoenTable`
- `src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx` linje 194 — "Ydelser (2)"-header (OBS: ved verifikation stod der "Offentlige ydelser" på linje 194 — tjek den præcise linje for "Ydelser (2)")
- MUI `Tooltip` + `Info` ikon fra `@mui/icons-material` — allerede i brug i `SideMenu.tsx`

### Implementeringsplan
1. Opret `src/components/common/InfoTooltipIcon.tsx`:
   ```tsx
   // Props: { title: string }
   // Render: <Tooltip title={title}><Info sx={{ fontSize: '0.85em', verticalAlign: 'super', ml: 0.5, cursor: 'default', color: 'text.secondary' }} /></Tooltip>
   ```
2. Indsæt komponenten i kolonneheaderen for "Løn (2)" og "Ydelser (2)":
   - I `standardLoenTableColumns.ts`: Ændr `STANDARD_LOEN_COL3_LABEL` fra en streng til en render-funktion, eller giv tabel-komponenten en måde at knytte et tooltip til et specifikt kolonnenavn.
   - Alternativt: Lav kolonneheaderen til en React-node i stedet for en streng, hvis tabel-komponenten understøtter det.
3. Indsæt tilsvarende i `OffentligeYdelserTab.tsx` efter "Ydelser (2)"-headeren.

### Faldgruber
- Tjek om kolonneheaders i `StandardLoenTable` og `StandardLooseTable` er defineret som `string` eller `React.ReactNode`. Hvis kun strenge understøttes, kræver det en ændring i komponentens props-type.
- `verticalAlign: 'super'` virker kun korrekt i inline-kontekst — test visuelt.
- Tooltips i tabelheaders kan have z-index-problemer hvis tabellen har `overflow: hidden` — tjek at tooltipet vises korrekt.
- Ikonet skal ikke påvirke kolonnens sorterings-klik-adfærd — sørg for at `onClick`-propagation ikke forstyrres.
- OffentligeYdelserTab linje 194 skal verificeres — ved review stod der "Offentlige ydelser" på den linje, ikke "Ydelser (2)".

---

## 13. Advarsel i EOberegningTab: TAF-periode løber til efter folkepensionsalderen

### Beskrivelse
På beregning-fanen skal der vises en advarsel — ikke en fejl — hvis én eller flere TAF-perioder efter den naturlige clamping rækker til efter skadelidtes folkepensionsalder. Advarslen udløses *kun* hvis:
1. Der er angivet en fødselsdato for skadelidte (`stamdataValues.skadelidteFodselsdato` er defineret), og
2. Mindst én TAF-periode (efter clamping til EO-periodens grænser) har en `til`-dato, der er lig med eller efter den dato, hvor skadelidte når folkepensionsalderen.

Folkepensionsalderen bestemmes ud fra den kapitaliseringsbekendtgørelse, der ville have fundet anvendelse, hvis der skulle kapitaliseres på EO-beregningsdatoen.

### Relevante filer og felter
- `stamdataValues.skadelidteFodselsdato` — fødselsdato (ISODateString | undefined), tilgængeligt som prop i `EOberegningTab.tsx` linje 38
- `stamdataValues.skadesdato` — skadestidspunkt, bruges til bekendtgørelse-opslag
- `eoValues.tafPerioder` — TAF-perioderne der skal tjekkes
- `eoValues.vedroererPeriodeTil` — EO-periodens øvre grænse (stille clamping)
- `resolveKapitaliseringTabelvalgForControlDate(skadesdato, fodselsdato, controlDate)` i `src/domain/erhvervsevnetab/eetKapitaliseringOpslag.ts` linje ~205 — **dette er den kanoniske funktion** der kombinerer bekendtgørelse-opslag og folkepensionsalder-beregning. Returnerer `ResolvedKapitaliseringTabelvalg` med `folkepensionsalderMaaneder: number`.
- `calculateAgeYearsMonths(fodselsdato, referenceDato)` i `eetKapitaliseringOpslag.ts` linje ~132 — bruges til at beregne datoen for folkepensionsalder ud fra fødselsdato og `folkepensionsalderMaaneder`
- `clampTafRange()` i `src/domain/erstatningsopgoerelse/validation/tafPeriodConstraints.ts` linje ~150 — stille clamping til EO-periodens grænser
- `resolveTafEoPeriodeBounds()` i `tafPeriodConstraints.ts` — returnerer kun EO-periode-bounds (ikke fejlgivende bounds), der anvendes til den stille clamping
- Eksisterende advarselsvisning: `EOberegningTab.tsx` via `collectAllDebugRows()` og `getCustomDebugRowMessage()`

### Beregning af folkepensionsdatoen
1. Bestem `controlDate` = `eoValues.opgørelseLavetDen` (feltnavnet i schema, UI-label: "Opgørelse lavet den" i `EOOplysningerTab.tsx` linje 1134). Dette er den dato der svarer til "EO-beregningsdatoen" — det er præcis denne dato der bestemmer hvilken kapitaliseringsbekendtgørelse der ville have fundet anvendelse. Feltet er `optionalIsoDateString` — advarslen må kun aktiveres, hvis datoen er defineret.
2. Kald `resolveKapitaliseringTabelvalgForControlDate(skadesdato, fodselsdato, controlDate)` — returnerer `folkepensionsalderMaaneder`.
3. Beregn folkepensionsdatoen: `fodselsdato` + `folkepensionsalderMaaneder` måneder. Brug `addMonths()` fra `src/utils/dateUtils.ts`.
4. En TAF-periode "løber til efter folkepensionsalderen" hvis dens clampede `til`-dato >= folkepensionsdatoen.

### Implementeringsplan
1. Find eller opret en hjælpefunktion i debug-modellen (`eoDebugErstatningsopgoerelseModel.ts`) der beregner folkepensionsdatoen givet `fodselsdato`, `skadesdato` og `controlDate`. Undgå at duplikere logikken fra `eetKapitaliseringOpslag.ts` — kald den eksisterende funktion.
2. Iterér over `values.tafPerioder`: for hver periode, hent den clampede range (via `clampTafRange` med `resolveTafEoPeriodeBounds`-bounds), og tjek om `til >= folkepensionsdato`.
3. Generer en advarsel (status `'warning'`, ikke `'error'`) pr. periode der overtræder grænsen. Formulér teksten klart: fx *"TAF-perioden løber til efter skadelidtes folkepensionsalder ([dato]). Kontrollér om dette er korrekt."*
4. Advarslen skal vises i den eksisterende debug-rækkeviser i `EOberegningTab.tsx` via `collectAllDebugRows()`.

### Faldgruber
- `resolveKapitaliseringTabelvalgForControlDate` returnerer `null` hvis bekendtgørelse ikke kan slås op (fx manglende skadesdato eller ugyldig dato). Advarslen må ikke aktiveres i dette tilfælde.
- `opgørelseLavetDen` er `optionalIsoDateString` — advarslen må ikke aktiveres, hvis feltet ikke er udfyldt.
- Clamping skal ske med `resolveTafEoPeriodeBounds` (stille clamping), *ikke* `resolveTafConstraintBounds` (som også inkluderer EET-fejlgivende bounds). Advarslen angår hvad der faktisk *indgår* i beregningen, ikke hvad der ville være ugyldig input.
- `addMonths()` skal bruges konsistent med eksisterende mønstre for at undgå tidszone-problemer ved midnat.
- Advarslen bør kun vises én gang pr. periode, ikke pr. dag.

---

## 14. Fjern generisk fejlmeddelelse ved umuligt datointerval i inputfelter

### Beskrivelse
`StyledDateField`-komponenten viser i dag fejlmeddelelsen `"Ingen gyldige datoer: min-dato (...) er efter max-dato (...)."` når `minDate > maxDate` — dvs. når der ikke *kan* indtastes nogen gyldig dato. Denne adfærd skal fjernes. Der må kun vises fejl, når brugeren har *indtastet* en ugyldig værdi — ikke blot fordi rammen for gyldige værdier er tom. En situation, hvor alle mulige datoer er ugyldige, medfører per definition, at *enhver* dato brugeren taster vil give en valideringsfejl, og det er acceptabelt.

### Relevante filer og kode
- `src/components/inputs/StyledDateField.tsx` linjer 122–143 (bekræftet):
  - `configErrorMessage` (linje 122–133): genererer fejlbeskeden når `minDate > maxDate`
  - `hasConfigError` (linje 135): sættes til `true` hvis `configErrorMessage !== ''`
  - Når `hasConfigError` er `true`: `effectiveMinDate` og `effectiveMaxDate` sættes til `undefined` (linje 142–143) — dvs. range-validering deaktiveres, men fejlmeddelelsen vises stadig
  - Feltet forbliver *redigerbart* selv ved config-fejl
- `src/domain/debug/eoDebugCommon.ts` linjer 54–66 — `buildNoValidDateRangeMessage()`: genererer tilsvarende fejlbesked i debug-visningen
- Kaldere af `buildNoValidDateRangeMessage()` i `eoDebugErstatningsopgoerelseModel.ts` linje 699, 712, 1470 — disse genererer debug-fejlrækker med samme besked

### Implementeringsplan
1. I `StyledDateField.tsx`: fjern genereringen af `configErrorMessage` når `minDate > maxDate`. Feltets adfærd, når `minDate > maxDate`, skal være: ingen fejlbesked fra config, og range-validering anvendes som normalt (feltet kan kun validere, når en dato er indtastet). Effekten er: brugeren ser ingen fejl på et tomt felt, men vil se en valideringsfejl på enhver dato de taster.
2. Fjern eller gør `hasConfigError`-logikken inaktiv, da den ikke længere har et formål.
3. I `eoDebugCommon.ts` og `eoDebugErstatningsopgoerelseModel.ts`: fjern kaldene til `buildNoValidDateRangeMessage()` der genererer fejlrækker *udelukkende* baseret på at intervallet er tomt (dvs. ingen indhold). Valideringsfejl på konkrete indtastede datoer (via `validateISODateRange()`) bevares.

### Faldgruber
- `validateRowDate()` i `eoDebugErstatningsopgoerelseModel.ts` linje ~1465 returnerer i dag `buildNoValidDateRangeMessage(...)` som fejl, *inden* den tjekker om feltet er udfyldt (linje 1469: `if (args.minDate > args.maxDate) return buildNoValidDateRangeMessage(...)`). Denne rækkefølge skal ændres: hvis `args.iso` er `undefined`, returnér `undefined` (ingen fejl); hvis `args.iso` er defineret, valider den mod de (muligvis umulige) grænser.
- `noValidRangeCause`-prop'en på `StyledDateField` er designet til at understøtte config-fejlbeskeden — ved fjernelse af config-fejlbeskeden er denne prop ikke længere nødvendig. Den kan bevares for fremtidig brug eller fjernes; vælg det der er enklest.
- Kontrollér om `hasConfigError` bruges til *andet* end at generere fejlbeskeden — fx til at deaktivere knapper eller gating-logik. Hvis ja, skal denne afhængighed opløses separat.
- Effekten af ændringen er bevidst: en bruger i en situation med umuligt datointerval vil opleve fejl uanset hvad de taster. Dette er den ønskede adfærd og bør afspejles i en kommentar i koden.

---

## Prioriteret rækkefølge (forslag)

| Prioritet | Punkt | Begrundelse |
|---|---|---|
| 1 | **11** (Varige mén linjeskift) | Triviel, lav risiko, høj synlighed |
| 2 | **4** (PDF Manuel regulering navn) | Triviel, ét-linje rettelse |
| 3 | **10** (Fri proces samlet række) | Triviel præsentationsændring |
| 4 | **12** (Info-ikon tooltip) | Lille, selvstændig komponent |
| 5 | **2** (Fra/til-dato validering) | Høj korrekthedsmæssig værdi, systematisk |
| 6 | **1** (Advarsel ved løn efter ophørsdato) | Korrekthedsmæssig advarsel |
| 7 | **8** (Store Bededag auto-beregning) | Regelbaseret auto-beregning |
| 8 | **7** (Sygeferiegodtgørelse filter) | Beregningslogik, isoleret ændring |
| 9 | **9** (Overenskomst auto-udfyld) | Afhænger af punkt 5 for periodisering |
| 10 | **6** (Midlertidig EET PDF-side) | Ny feature, kræver PDF-integration |
| 11 | **14** (Fjern config-fejlbesked i StyledDateField) | Lille, isoleret UI-ændring |
| 12 | **13** (TAF over folkepensionsalder advarsel) | Ny beregningslogik, kræver bekendtgørelse-opslag |
| 13 | **3** (Sortering og gemning) | Tværgående arkitekturændring |
| 14 | **5** (Periodiseret fritvalg/SH/SO/pension) | Størst ændring, høj beregningsrisiko |
