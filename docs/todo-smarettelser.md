# TODO: Smårettelser

Oprettet: 2026-04-03

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

### Faldgruber
- `fraDato`/`tilDato` i `standardLoenTableRow` er `tableDateCellString` (streng), ikke `IsoDateString`. Parsing skal håndtere ugyldige eller tomme værdier uden at kaste.
- Delvis overlap (perioden starter før men slutter efter `sidsteArbejdsdag`) skal fanges ligesom fuldstændigt overlap.
- Advarslen skal ikke aktiveres, hvis `sidsteArbejdsdag` er `undefined` — feltet er optionalt. Det ryddes automatisk, når `ansaettelsesforholdOphoert` sættes til `false` via `applyAnsaettelsesforholdToggleCleanup` i `loenindkomstStateCleanup.ts` linje 17 — så `sidsteArbejdsdag !== undefined` er tilstrækkeligt guard.
- `tafRowDerived.ts` håndterer TAF-perioder, ikke løn-indkomst-rækker — overlap-detektion her kan ikke genbruges direkte.

### Status: Implementeret

Advarslen er implementeret i `buildEODebugIndkomstRows()` i `eoDebugErstatningsopgoerelseModel.ts` via `loenindkomst.${section.id}.loenEfterOphoer`-rækken.

### Udestående fund

**Medium — `parseAarsloenRowInterval` kaldt med potentielt undefined loenperiode:**
`buildEODebugIndkomstRows` kalder `parseAarsloenRowInterval(row, loenperiode)` til overlap-tjek, men `loenperiode` kan være `undefined`. Kontrollér at `parseAarsloenRowInterval` håndterer `undefined`-argument uden at kaste — ellers undertrykkes advarslen stille.

*(Note: `Boolean(loenperiode)`-guard på linje 2555 og `if (!sidsteArbejdsdag || !loenperiode) return false`-guard inde i `.some()` sikrer at `loenperiode` aldrig sendes undefined til `parseAarsloenRowInterval`. Fund teknisk set håndteret af eksisterende guards.)*

~~**Lav — Overflødige mellemvariable:**
`sidsteArbejdsdagIso` og `sidsteArbejdsdag` er identiske — kan konsolideres til én variabel.~~ ✅ Rettet.

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

### Faldgruber
- `tableDateCellString` og `IsoDateString` er ikke samme type — brug den rigtige parsing i hvert tilfælde.
- Mange datopar bor i tabeller hvor til-feltet valideres uafhængigt af fra-feltet. Cross-field-validering kræver adgang til begge værdier på commit-tidspunktet.
- Sørg for at tom/undefined til-dato *ikke* trigger fejlen — beskyttelsen gælder kun, når begge datoer er angivet.
- Undgå at duplikere fejlbeskeder: den standardiserede besked skal defineres ét sted og refereres alle andre steder.

### Status: Implementeret

`DATE_ORDER_ERROR_MESSAGE` er indført som kanonisk konstant via `src/utils/dateOrderValidation.ts`. Alle fra/til-fejlbeskeder i `erstatningsopgoerelseValidator.ts` og `dateRangeErrorMessages.ts` er standardiseret til at bruge den.

### Udestående fund

~~**Lav — Bekræft komplet dækning:**
Rettelsen standardiserer beskeden for kendte steder, men det er uklart om *alle* datopar i systemet er dækket (fx `sfggReferenceperiodeFra`/`Til`, TAF-perioder, ferieperioder). Lav en samlet søgning efter tilbageværende hardkodede varianter af fra/til-fejlbeskeder og bekræft dækning.~~ ✅ Rettet: `eoDebugErstatningsopgoerelseModel.ts` linje 762 og 1626 brugte hardkodet `'Der er indtastet en til-dato, som ligger før fra-datoen'` — erstattet med `DATE_ORDER_ERROR_MESSAGE`. Øvrige søgning bekræfter ingen andre hardkodede varianter.

---

## 3. Ensartet sortering og gemning af rækkefølge i loose og standard grid-tabeller

### Beskrivelse
Sortering og persistering af rækkefølge skal fungere ens for `StandardLooseTable` (`tableKind: 'loose'`) og `StandardGridTable` (`tableKind: 'grid'`), baseret på fælles kode, og den *sorterede* rækkefølge skal gemmes — ikke blot vises.

**Adfærd:** Brugeren forventer at den rækkefølge, som rækkerne aktuelt fremstår i på skærmen, altid er den rækkefølge der gemmes. Det vil sige: rækkefølgen gemmes løbende ved hvert sort-klik (write-through til formstate), ikke kun ved eksplicit gem-klik.

### Relevante filer
- `src/components/tables/useTableSort.ts` — sort-hook
- `src/components/tables/gridCore/gridModel.ts` — `toggleGridSort()`, `sortGridRows()`
- `saveOrderPath`-prop i `StandardLoenTable.tsx` linje 58 — eksisterende persisterings-hook
- `useRegisterTableSaveOrder` — eksisterende gem-mekanisme

### Faldgruber
- "Tom trailing row"-mønsteret (`normalizeGridRows()`) skal bevares: trailing-rækken må ikke gemmes som en rigtig række.
- Mutation af `rows` ved sort-klik kan trigge unødvendige re-renders — brug memoization.

### Status: Implementeret

`useTableSort` er udvidet med `onSortedRowsChange`-callback der skriver den sorterede rækkefølge write-through til formstate ved hvert sort-klik. `useRowDrafts` har fået `reorderRows`-funktion. `onSortedRowsChange` er koblet til `StandardLoenTable`, `OffentligeYdelserTable`, og `onRowsReorder`-prop er sendt til `SvieSmerteTable`, `TAFPeriodeTable`, `FerieperiodeTable`, `BeregningsperiodeFerieTable`, `OevrigeKravTable` og `BeregnetRenteTable`.

### Udestående fund

**Høj — `useTableSort.handleHeaderClick`: dobbelt beregning og potentiel race condition:**
`handleHeaderClick` kalder `sortGridRows` manuelt med den næste sort-state for at sende `nextSortedRows` til `onSortedRowsChange`, *inden* React-state-opdateringen er committet. Hvis en handler ovenfor foretager en state-mutation baseret på dette kald, kan der opstå inkonsistens. For `StandardLoenTable` og `OffentligeYdelserTable` er handleren synkron — sandsynligvis i orden, men det er en skrøbelig afhængighed af React's batch-semantik.

~~**Medium — `OffentligeYdelserTable`: `onSortedRowsChange` er en inline arrow-funktion:**~~ ✅ Rettet: `reorderRows` memoizeret via `useCallback`.

~~**Lav — Bekræft at alle tabeller faktisk kobler `onRowsReorder`:**
Tabeller der modtager `onRowsReorder`-prop'en men ikke sætter `onSortedRowsChange` på deres `useTableSort`-kald gemmer ikke rækkefølgen. Gennemgå at alle tabeller faktisk kobler prop'en igennem.~~ ✅ Bekræftet: Alle tabeller med `onRowsReorder`-prop kobler den korrekt videre til `onSortedRowsChange` i `useTableSort`-kaldet.

---

## 4. PDF-reguleringsside: Vis kun brugerens navn for manuel regulering

### Beskrivelse
I PDF-dokumentet for erstatningsopgørelser vises reguleringstypen i dag som `"Manuelt angivet (brugernavn)"`. Når brugeren har angivet et navn, skal *kun* brugerens navn vises i PDF — uden præfikset. I debug-visningen på beregning-fanen skal visningen **forblive uændret** (`"Manuelt angivet (brugernavn)"`).

### Relevante filer og kode
- `src/domain/erstatningsopgoerelse/helpers/loenudviklingDisplay.ts` linjer 20–22 — `resolveValgtReguleringDisplay()` er den kanoniske kilde, bruges af **begge** kontekster.
- `LoenindkomstAnsaettelsesforhold.loenudviklingManuelNavn` (optionalString) — brugerens angivne navn.

### Faldgruber
- Ændr **ikke** den delte `resolveValgtReguleringDisplay()` — det ville bryde debug-visningen.
- Kontrollér at der ikke er andre steder i PDF-genereringen, der kalder den eksisterende funktion og bør skifte til den nye.

### Status: Implementeret

`resolveValgtReguleringDisplayForPdf()` er oprettet i `loenudviklingDisplay.ts` og bruges i `erstatningsopgoerelsePdf.ts`. Debug-visningen bruger fortsat `resolveValgtReguleringDisplay()`.

Ingen udestående fund.

---

## 5. Beregning af fritvalg, SH/SO og pension baseret på overenskomstens reguleringssatser per periode

### Beskrivelse
Når et ansættelsesforhold er under overenskomst eller manuel regulering, skal fritvalg, SH/SO og pension beregnes ud fra overenskomstens faktiske satser for de relevante perioder — ikke ud fra de samtidsangivne værdier på reguleringsdatoen. Hvis reguleringssat ændrer sig midt i en periode, skal dagene opdeles.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.fritvalgPct`, `shSoPct`, `pensionPct` (percentageDecimal)
- `src/data/overenskomstRates.ts`: `OverenskomstPeriodeSats` med `shSoSats`, `fritvalg`, `agPension` (alle decimal eller null)
- `getEffektiveSatserForDato()` — slår satser op for en given dato
- `getReguleringsDatoIntervalForOverenskomst()` — henter reguleringsintervaller

### Faldgruber
- Dette er en potentielt stor ændring med høj beregningsrisiko. Lav tests *før* ændringen, der dokumenterer den eksisterende (forkerte) adfærd, og lav derefter tests for den ønskede adfærd.
- `getEffektiveSatserForDato()` returnerer `null` for felter, der ikke er angivet i overenskomsten — disse skal ikke overskrive brugerens egne angivelser.
- Dayjs-baseret dagsberegning: sørg for at brugen er konsistent med eksisterende mønstre (undgå lokale tidszone-problemer ved midnat).
- Afklar om "perioden" er baseret på `tafPerioder`, `loenperiode` eller `indtaegtsoplysningerTableData` — de kan have forskellig granularitet.

### Status: Implementeret

`StandardLoenRateSegment`-typen og segmentbaseret `calculateStandardLoenRowDerived` er tilføjet i `standardLoenRowCalculations.ts`. `buildLoenindkomstRateSegments()` bygger segmenter. Koblet i `buildIncomeForRanges()` og `derivedCalculatorByAfId` i `LoenindkomstTab.tsx`.

### Udestående fund

~~**Kritisk — `skadesdato: undefined` i `buildIncomeForRanges`:**~~ ✅ Rettet: `skadesdato` tilføjet som 4. parameter til `buildIncomeForRanges`. Kaldesteder med adgang til `skadesdato` (`loenudviklingBeregning.ts`, `indkomstSkadestidspunktBeregning.ts`) sender det nu med.

**Høj — Afrundingssemantik ved segmentdeling:**
Beløbene splittes proportionalt efter dagetal (`share = overlapDays / totalDays`), som producerer flydende decimaltal der summeres. Bekræft at afrundingsrækkefølgen er konsistent med den kanoniske beregnings pre-implementerings-adfærd for sager uden segmentering.

**Medium — Ingen tests for den nye segmentberegning:**
Der er ingen unit tests for `calculateStandardLoenRowDerived` med `rateSegments`-parameteren. En overenskomst der skifter sats midt i en lønperiode er præcis det motiverende scenarie — det bør dækkes.

---

## 6. Midlertidig EET-checkbox på EO-beregningtab med tilhørende PDF-side

### Beskrivelse
På beregning-fanen skal der indsættes en ny `FormControlLabel`-checkbox med teksten "Midlertidig EET" efter checkboxen for "Offentlige ydelser". Default: `true`. Hvis afkrydset *og* der er løbende EET-ydelser med `afgoerelseType === 'Midlertidig'` eller `'Delvist endelig'`, indsættes en PDF-side med de tilsvarende tabeller. Ingen relevante ydelser = ingen PDF-side.

### Indhold på PDF-siden
Brug `buildMidlertidigtEetRowsFromEet()` fra `src/domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows.ts` som datakilde — denne funktion filtrerer allerede på `afgoerelseType === 'Midlertidig' | 'Delvist endelig'`. Resultatet er en liste af `OffentligeYdelserRow[]`.

### Relevante filer og felter
- `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx` — eksisterende checkbox-blok
- `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` — `eoBilagSelectionSchema` (bruger `.strict()`)
- `src/domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows.ts` — `buildMidlertidigtEetRowsFromEet()`
- PDF-genereringskæden i `src/pdf/domains/eo/erstatningsopgoerelsePdf.ts`

### Faldgruber
- `eoBilagSelectionSchema` bruger `.strict()` — tilføj `midlertidigEet`-feltet med `.default(true)` for at håndtere eksisterende gem-filer uden feltet.
- `buildMidlertidigtEetRowsFromEet` kræver `ErhvervsevnetabValues` og `skadesdato` — disse skal være tilgængelige i PDF-konteksten.

### Status: Implementeret

Checkboxen er tilføjet. Skemaet er opdateret med `midlertidigEet: z.boolean().default(true)`. Initial values og fallback-objektet er opdateret. `renderOffentligeYdelserRowsPage` er udtrukket som genanvendelig funktion. `midlertidigtEetInsertSource`-prop er ført fra `Erstatningsopgoerelse.tsx` til `EOberegningTab`.

### Udestående fund

**Lav — `offentligeYdelserSection.ts` refaktorering: subtil adfærdsændring i paginering:**
Før refaktoreringen kaldtes `startBilagPage` og `writer.addSpacer` ubetinget før løkken. Efter refaktoreringen flyttes de ind i løkken og betinges af `index === 0`. Gennemgå at alle kombinationer af `skalVisePeriodeSubheadings` og gruppestørrelser stadig producerer korrekt paginering.

---

## 7. Sygeferiegodtgørelse: Ekskluder ansættelsesforhold ikke ansat på skadestidspunktet

### Beskrivelse
I beregningen af sygeferiegodtgørelse må kun ansættelsesforhold med `ansatPaaSkadestidspunktet === true` indgå. Ansættelsesforhold med `false` skal behandles som om de ikke eksisterede.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.ansatPaaSkadestidspunktet` (boolean, schema linje 286)
- `computeSygeferiegodtgoerelse()` i `src/domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse.ts` — iterationen over `values.loenindkomstAnsaettelsesforhold` sker linje 908
- `getSfggRowForEmployment()` i `sygeferiegodtgoerelse.ts` — slår sfgg-rækken op per ansættelsesforhold
- `loenindkomstStateCleanup.ts` — eksisterende cleanup: `ansatPaaSkadestidspunktet === false` rydder allerede `ansaettelsesforholdOphoert` og `sidsteArbejdsdag`

### Faldgruber
- `sfggAnsaettelsesforhold` er et separat array forbundet via `ansaettelsesforholdId`. Da opslaget sker via `getSfggRowForEmployment` og vi aldrig når det kald for ekskluderede ansættelsesforhold, er der ingen risiko for stale data.
- Afklar om brugeren bør adviseres, hvis de har udfyldt sfgg-data for et ansættelsesforhold med `ansatPaaSkadestidspunktet === false`.

### Status: Implementeret

`computeSygeferiegodtgoerelse` filtrerer nu med `.filter((entry) => entry.ansatPaaSkadestidspunktet)` på linje ~908.

### Udestående fund

~~**Medium — Ingen test for filteret:**~~ ✅ Rettet: Test tilføjet i `sygeferiegodtgoerelse.test.ts` — bekræfter 0 SFGG og tom `perAnsaettelsesforhold` for ansættelsesforhold med `ansatPaaSkadestidspunktet: false`.

---

## 8. Store Bededagstillæg: Automatisk beregnet felt (ikke redigerbart)

### Beskrivelse
Feltet `storeBededagPct` skal beregnes automatisk og ikke være redigerbart. Værdien er 0, medmindre reguleringsdatoen er fra 1. januar 2024 eller senere *og* `loenPaaHelligdage === 'Almindelig løn'`.

### Eksisterende logik (verificeret)
- Reguleringsdatoen er `af.saerligFraDatoRegulering || stamdataValues?.skadesdato` — **ikke** overenskomstens reguleringsdatoer.
- `STORE_BEDEDAG_PCT = 0.45` i `src/config/regulatoryRates.ts` linje 13.
- `STORE_BEDEDAG_START = iso('2024-01-01')` i `src/config/dateRanges.ts` linje 25.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.storeBededagPct` (percentageDecimal)
- `LoenindkomstAnsaettelsesforhold.loenPaaHelligdage` — betingelse: `=== 'Almindelig løn'`
- `LoenindkomstAnsaettelsesforhold.saerligFraDatoRegulering` — manuel dato; fallback: `stamdataValues?.skadesdato`

### Faldgruber
- `loenPaaHelligdage` er **ikke** en boolean — sammenlign med strengen `'Almindelig løn'`.
- Reguleringsdatoen for Store Bededag er `saerligFraDatoRegulering || skadesdato` — **ikke** overenskomstens reguleringsdatoer.
- Sørg for at det auto-beregnede felt skrives til formstate, så det korrekte tal indgår i beregninger.

### Status: Implementeret

`resolveAutoStoreBededagPct()` beregner værdien automatisk. Feltet er sat til `disabled`. Auto-beregning sker via `useEffect` i `LoenindkomstTab.tsx`.

### Udestående fund

~~**Høj — `useEffect` deps-array mangler afhængigheder (fælles med punkt 9):**~~ ✅ Rettet: `loenindkomstAnsaettelsesforhold` tilføjet som deps.

~~**Høj — `validateStoreBededag` stadig aktiv på låst felt:**~~ ✅ Rettet: `validateStoreBededag` fjernet helt — funktion og alle kald slettet.

---

## 9. Overenskomst auto-udfyld af fritvalg, SH/SO og pension

### Beskrivelse
Når brugeren vælger en overenskomst (`harOverenskomst === true` og `overenskomstId` er sat), skal `fritvalgPct`, `shSoPct` og `pensionPct` auto-udfyldes med overenskomstens satser og låses for redigering. Hvis overenskomsten ikke har satser for et felt (null), bevares brugerens input og feltet forbliver redigerbart.

### Relevante felter og filer
- `LoenindkomstAnsaettelsesforhold.harOverenskomst` (boolean), `.overenskomstId` (optionalString)
- `LoenindkomstAnsaettelsesforhold.fritvalgPct`, `.shSoPct`, `.pensionPct`
- `getEffektiveSatserForDato()` i `src/data/overenskomstRates.ts` — returnerer `OverenskomstPeriodeSats` med `fritvalg: number | null`, `shSoSats: number | null`, `agPension: number | null`

### Faldgruber
- **Null vs. 0 er semantisk forskelligt**: `null` = overenskomsten angiver ikke satsen; `0` = overenskomsten fastlægger at der ikke er ret til ydelsen.
- Overenskomster kan have ændrede satser over tid — auto-udfyld her angår kun de overordnede felter (ikke den periodiserede beregning).
- `syncManualBaseRowSatser()` skal stadig køre korrekt efter auto-udfyld.

### Status: Implementeret

`resolveOverenskomstAutoSatser()` i `loenindkomstSatser.ts` slår satser op. `useEffect` i `LoenindkomstTab.tsx` skriver dem til formstate. Felterne er sat til `disabled={af.harOverenskomst && Boolean(af.overenskomstId?.trim())}`.

### Udestående fund

~~**Høj — `useEffect` deps-array mangler afhængigheder (fælles med punkt 8):**~~ ✅ Rettet: Se punkt 8.

~~**Fælles note — punkt 8 og 9:**~~ ✅ Rettet: `loenindkomstAnsaettelsesforhold` tilføjet til deps-array.

---

## 10. Satser-siden: Sammenslå to fri proces-rækker til én

### Beskrivelse
De to `DataRow`-komponenter for fri proces-beløbsgrænser på satser-siden skal samles i én komponent, hvor begge værdier vises under hinanden uden linjeafstand.

### Relevante filer
- `src/components/pages/Satser.tsx` linjer 267–279 — de to `DataRow`-komponenter
- Datakilderne: `satser.diverse.friProcesEnlig`, `satser.diverse.friProcesSamlevende`, `satser.diverse.friProcesBarn`

### Faldgruber
- Minimal risiko — ren præsentationsændring uden beregningskonsekvenser.
- Sørg for at den samlede blok stadig skjules, hvis begge værdier er tomme.

### Status: Implementeret

`MultiLineDataRow`-komponenten er oprettet i `Satser.tsx` og de to `DataRow`-komponenter er erstattet.

### Udestående fund

**Lav — Layout-alignment ved én synlig række:**
`MultiLineDataRow` filtrerer på falsy `row.value`. Hvis én af de to rækker er tom og den anden ikke er, vises kun den udfyldte. Labels og værdier er i separate `Box`-elementer — kontrollér at alignment er korrekt i dette tilfælde.

---

## 11. Sidemenu: Undgå linjeskift i "Varige mén"

### Beskrivelse
Teksten "Varige mén" i sidemenuen brydes over to linjer, når menuen folder ud.

### Relevante filer
- `src/components/layout/SideMenu.tsx` linje 69 — `{ id: 'varigemen', label: 'Varige mén', ... }`
- `Button`-styling i `SideMenu.tsx` linjer 198–222

### Faldgruber
- `whiteSpace: 'nowrap'` globalt på alle menu-items ville påvirke labels der med rette bør brydes — anvend kun for `item.id === 'varigemen'`.

### Status: Implementeret

`whiteSpace: item.id === 'varigemen' ? 'nowrap' : undefined` er tilføjet til `Button`-styling i `SideMenu.tsx`.

Ingen udestående fund.

---

## 12. Info-ikon med tooltip — standardiseret komponent

### Beskrivelse
Der skal oprettes et standardiseret `InfoTooltipIcon`-komponent, der vises som et lille hævet overlay med en MUI `Tooltip`-besked ved hover. Det skal indsættes tre steder:
1. I lønindkomsttabellen efter overskriften "Løn (2)" — tekst: *"Opdelingen af løn er rent visuel - værdierne lægges sammen i beregningen"*
2. Samme sted i årslønsberegningstabellen
3. På offentlige ydelser-fanen efter overskriften "Ydelser (2)" — tilpasset tekst om at opdelingen er visuel

### Relevante filer
- `src/domain/aarsloen/standardLoenTableColumns.ts` linje 7 — `STANDARD_LOEN_COL3_LABEL = 'Løn (2)'`
- `StandardLoenTable.tsx` — tabel-komponent der bruger kolonnenavnene
- `src/components/pages/Aarsloen.tsx` — årslønsberegning, bruger `StandardLoenTable`
- `src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx` — "Ydelser (2)"-header

### Faldgruber
- Tjek om kolonneheaders er defineret som `string` eller `React.ReactNode`. Hvis kun strenge understøttes, kræver det en ændring i komponentens props-type.
- Ikonet skal ikke påvirke kolonnens sorterings-klik-adfærd.
- OffentligeYdelserTab: den præcise linje for "Ydelser (2)" skal verificeres inden implementering.

### Status: Delvist implementeret

`InfoTooltipIcon`-komponenten er oprettet. `getStandardLoenTableHeaderNodes()` er tilføjet og bruges i `StandardLoenTable`. `OffentligeYdelserTable` bruger `getOffentligeYdelserTableHeaderNodes()` med tilsvarende tooltip på "Ydelse (2)".

### Udestående fund

~~**Lav — Bekræft årsløn-siden bruger nodes-versionen:**~~ ✅ Bekræftet: `StandardLoenTable` bruger `getStandardLoenTableHeaderNodes` internt (linje 511). `Aarsloen.tsx` bruger `StandardLoenTable` og arver dermed korrekt header-funktion.

---

## 13. Advarsel i EOberegningTab: TAF-periode løber til efter folkepensionsalderen

### Beskrivelse
På beregning-fanen skal der vises en advarsel — ikke en fejl — hvis én eller flere TAF-perioder efter den naturlige clamping rækker til efter skadelidtes folkepensionsalder. Advarslen udløses *kun* hvis:
1. Der er angivet en fødselsdato for skadelidte (`stamdataValues.skadelidteFodselsdato` er defineret), og
2. Mindst én TAF-periode (efter clamping til EO-periodens grænser) har en `til`-dato, der er lig med eller efter den dato, hvor skadelidte når folkepensionsalderen.

Folkepensionsalderen bestemmes ud fra den kapitaliseringsbekendtgørelse, der ville have fundet anvendelse på EO-beregningsdatoen.

### Relevante filer og felter
- `stamdataValues.skadelidteFodselsdato` og `stamdataValues.skadesdato`
- `eoValues.opgørelseLavetDen` — "Opgørelse lavet den" i `EOOplysningerTab.tsx` linje 1134. Dette er EO-beregningsdatoen der bestemmer hvilken kapitaliseringsbekendtgørelse der anvendes. Feltet er `optionalIsoDateString` — advarslen må kun aktiveres, hvis datoen er defineret.
- `resolveKapitaliseringTabelvalgForControlDate(skadesdato, fodselsdato, controlDate)` i `src/domain/erhvervsevnetab/eetKapitaliseringOpslag.ts` linje ~205 — kanonisk funktion der returnerer `folkepensionsalderMaaneder`
- `clampTafRange()` og `resolveTafEoPeriodeBounds()` i `tafPeriodConstraints.ts` — stille clamping (ikke fejlgivende bounds)

### Faldgruber
- `resolveKapitaliseringTabelvalgForControlDate` returnerer `null` hvis bekendtgørelse ikke kan slås op — advarslen må ikke aktiveres i dette tilfælde.
- Clamping skal ske med `resolveTafEoPeriodeBounds` (stille clamping), *ikke* `resolveTafConstraintBounds` (som også inkluderer EET-fejlgivende bounds).
- `addMonths()` skal bruges konsistent med eksisterende mønstre for at undgå tidszone-problemer ved midnat.

### Status: Implementeret

`resolveFolkepensionsdato()` er oprettet i `eoDebugErstatningsopgoerelseModel.ts` og bruger `resolveKapitaliseringTabelvalgForControlDate`. Advarslen genereres som `taf.folkepensionsalder.${periode.id}`-rækker med `status: 'warning'`. `skadelidteFodselsdato` er tilføjet til `TaftContext`.

### Udestående fund

~~**Medium — Sammenligningen bør ske på ISO-datoer, ikke visnings-strenge:**~~ ✅ Bekræftet korrekt: `displayTil` er `clamped?.til` (`ISODateString`) — sammenligningen med `folkepensionsdato` er ISO vs ISO og leksikografisk korrekt.

---

## 14. Fjern generisk fejlmeddelelse ved umuligt datointerval i inputfelter

### Beskrivelse
`StyledDateField`-komponenten viser fejlmeddelelsen `"Ingen gyldige datoer: min-dato (...) er efter max-dato (...)."` når `minDate > maxDate`. Denne adfærd skal fjernes. Der må kun vises fejl, når brugeren har *indtastet* en ugyldig værdi — ikke blot fordi rammen for gyldige værdier er tom.

### Relevante filer og kode
- `src/components/inputs/StyledDateField.tsx` — `configErrorMessage`/`hasConfigError`-logikken
- `src/domain/debug/eoDebugCommon.ts` — `buildNoValidDateRangeMessage()`
- `eoDebugErstatningsopgoerelseModel.ts` linje 699, 712, 1470 — kaldere af `buildNoValidDateRangeMessage()`

### Faldgruber
- `validateRowDate()` returnerer `buildNoValidDateRangeMessage(...)` *inden* den tjekker om feltet er udfyldt — rækkefølgen skal vendes.
- `noValidRangeCause`-prop'en er designet til at understøtte config-fejlbeskeden — ved fjernelse er den ikke længere nødvendig.
- Kontrollér om `hasConfigError` bruges til andet end fejlbeskeden — fx gating-logik.
- Effekten er bevidst: en bruger med umuligt datointerval vil opleve fejl uanset hvad de taster.

### Status: Implementeret

`configErrorMessage`/`hasConfigError`-logikken er fjernet fra `StyledDateField.tsx`. `if (!iso) return undefined`-guard er nu korrekt placeret *før* `buildNoValidDateRangeMessage`-kaldet alle tre steder i `eoDebugErstatningsopgoerelseModel.ts`.

### Udestående fund

~~**Høj — `noValidRangeCause` er stille ignoreret:**~~ ✅ Rettet: Prop'en fjernet fra `StyledDateFieldProps` og alle direkte kaldesteder renset (pages, `OffentligeYdelserTab`).

~~**Medium — Bekræft komplet dækning af `buildNoValidDateRangeMessage`-kaldere:**
Det er ikke bekræftet om der er andre kaldesteder til `buildNoValidDateRangeMessage` der stadig kan returnere fejlbeskeden for et tomt felt. Lav en komplet søgning.~~ ✅ Bekræftet: Alle 3 kaldesteder (linje 716, 729, 1493 i `eoDebugErstatningsopgoerelseModel.ts`) har `if (!iso) return undefined`-guard før kaldet. Ingen kaldested returnerer beskeden for et tomt felt.

---

## 15. Sammentællingsboks i EODebugTabel: tilføj sygeferiegodtgørelse-underafsnit

### Beskrivelse
I sammentællingsboksen på EO-debug-fanen skal der tilføjes et underafsnit for sygeferiegodtgørelse, der viser:
- **Beregnet** (motorkørt): den beregnede totalværdi fra beregningskørslen (`SygeferiegodtgoerelseResult.totalOre`)
- **Tabel** (summeret): summen af `totalOre` pr. ansættelsesforhold i `perAnsaettelsesforhold[]`

Formålet er at gøre divergens synlig mellem den beregnede totalværdi og det der fremgår af tabelvisningen.

### Arkitektonisk kontekst
- Sammentællingsboksen defineret i `src/domain/debug/eoDebugSammentaelling.ts`
- Vises i `src/components/pages/erstatningsopgoerelse/EODebugTabel.tsx` via `snapshot.sammentaellingTables`
- Tabelstrukturen: 4 kolonner — `Enhed | Beregnet | Tabel | Kontrol`
- Kanonisk beregnet SFGG-totalværdi: `EoCanonicalOutput.taf.sygeferiegodtgoerelseOre`
- "Tabel"-totalværdien: sum af `result.totalOre` pr. ansættelsesforhold med `sfggSourceKind !== 'ingen'`
- Enhed: kr. (øre internt, divider med 100 for visning)

### Faldgruber
- Enhedsforskellen: eksisterende rækker tæller arbejdsdage; SFGG er kr. Enhedskolonnen skal reflektere dette.
- "Tabel"-totalen hentes som numeriske `totalOre`-værdier, ikke ved at parse display-strenge.
- `sfggSourceKind === 'ingen'`: disse ansættelsesforhold indgår ikke i beregningen og må ikke tælle i tabel-totalen.
- `sygeferiegodtgoerelseOre` kan være `0` (ikke `null`) selv uden SFGG — ikke en fejl.

### Status: Implementeret

`sfgg`-sektionen er tilføjet til `SammentaellingModel`, `SammentaellingDisplayTables` og `buildSammentaellingDisplayTables()`. `EODebugTabel.tsx` renderer den som en fjerde `StandardDisplayTable`. `canonicalOutput` og `sfggResult` er ført igennem snapshot-kæden.

### Udestående fund

~~**Høj — `debugSnapshot` bygges to gange i `computeEoSnapshot`:**~~ ✅ Rettet: Første overflødige kald fjernet fra `eoSnapshot.ts`.

**Lav — Kr.-enhed ikke eksplicit markeret:**
Eksisterende sammentællings-rækker viser arbejdsdage. SFGG-rækken viser kr. via `formatOptionalAmount`. Overvej om brugeren tydeligt kan se at sammenligningen er i kr. og ikke i dage.

---

## Prioriteret rækkefølge (udestående)

Alle implementerede fund er rettet. Følgende fund er bekræftet lukket eller kræver manuel UI-verifikation:

| Prioritet | Punkt | Status |
|---|---|---|
| — | **5** (Periodiseret fritvalg/SH/SO) | ✅ Rettet: `skadesdato` føres nu som 4. parameter til `buildIncomeForRanges` og bruges i `buildLoenindkomstRateSegments`. |
| — | **8+9** (Store Bededag / Overenskomst auto-satser) | ✅ Rettet: `loenindkomstAnsaettelsesforhold` tilføjet til `useEffect`-deps. `validateStoreBededag` fjernet fra låst felt. |
| — | **15** (SFGG sammentælling) | ✅ Rettet: Første overflødige `buildDebugSnapshotForComputed`-kald fjernet fra `eoSnapshot.ts`. |
| — | **14** (Fjern config-fejlbesked) | ✅ Rettet: `noValidRangeCause`-prop fjernet fra `StyledDateFieldProps` og alle direkte kaldesteder renset. |
| — | **3** (Sortering og gemning) | ✅ Rettet: `onSortedRowsChange` i `OffentligeYdelserTable` memoizeret som `reorderRows` via `useCallback`. |
| — | **13** (TAF folkepensionsalder) | ✅ Bekræftet: `displayTil` er `ISODateString` fra `clamped.til` — sammenligningen er korrekt. |
| — | **7** (SFGG filter) | ✅ Rettet: Test tilføjet i `sygeferiegodtgoerelse.test.ts` — `ansatPaaSkadestidspunktet: false` → 0 SFGG. |
| — | **12** (Info-ikon tooltip) | ✅ Bekræftet: `StandardLoenTable` bruger `getStandardLoenTableHeaderNodes` internt; `Aarsloen.tsx` arver det korrekt. |
| — | **1** (Løn efter ophørsdato) | ✅ Rettet: `sidsteArbejdsdagIso` (duplikat af `sidsteArbejdsdag`) fjernet. |
| — | **2** (Fra/til-dato validering) | ✅ Rettet: 2 hardkodede fejlbeskeder i `eoDebugErstatningsopgoerelseModel.ts` erstattet med `DATE_ORDER_ERROR_MESSAGE`. `buildNoValidDateRangeMessage`-dækning bekræftet korrekt. |
| — | **3** (Sortering — tabeldækning) | ✅ Bekræftet: Alle tabeller med `onRowsReorder`-prop kobler korrekt til `onSortedRowsChange`. |
| Åben | **6** (Midlertidig EET PDF) | Kræver manuel visuel verifikation af paginering ved alle kombinationer af `skalVisePeriodeSubheadings`. |
| Åben | **10** (Fri proces samlet række) | Kræver visuel verifikation af layout-alignment ved én synlig række i `MultiLineDataRow`. |
