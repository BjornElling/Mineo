# EO TAF-/svie-smerte clamping- og behandlingsrækkefølge (informativ)

**Status:** Informativ arkitektur-dokumentation (ikke normativ)
**Relaterer til:** `src/contracts/eo-snapshot-contract.md` (normativ — ejer invarianterne)

---

Dette dokument beskriver **den faktiske behandlingsrækkefølge** for committede TAF- og
svie/smerte-perioder i `computeEoSnapshot`. Det er en informativ pipeline-beskrivelse, der
udfolder rækkefølgen og trinene bag de normative invarianter i `eo-snapshot-contract.md`.

De **bindende** regler — clampingmodellen (stille vs. fejlgivende clamping, §2.1/§2.2),
clampinggarantien (§2.4), invariant-klassificeringen (§3) og kravet om én autoritativ
beregningskilde uden parallelle totaler (§1) — ligger i kontrakten. Hvis denne pipeline-doc
og kontrakten er uenige, **vinder kontrakten**. Denne doc holdes opdateret som hjælp til at
forstå implementeringen, ikke som selvstændig kilde til sandhed.

---

## Fuld behandlingsrækkefølge for TAF-perioder

1. **Syntaksvalidering:** Ufuldstændige datoer (fx `dd-mm`) afvises i inputfeltet og
   committes ikke. Kun gyldige ISO-datoer committes.

2. **Semantisk validering (fejlgivende bounds):** Efter commit undersøges de committede
   datoer mod fejlgivende bounds (kontrakt §2.2). Violation giver feltfejl (rød kant + tooltip) og
   blokerer download via EOBeregningTab. Disse checks inkluderer: fra-dato mod 2005-grænse,
   skadedato/anmeldedato-grænse, fra > til, til < fra, til >= differencekravDato,
   til >= EET-virkningsdato (ikke påklaget), overlap mellem rækker.

   Validering sker på de committede rækker som sådanne — ikke først efter en
   relevansvurdering mod de autoritative, clampede ranges. En ugyldig TAF-række bliver
   derfor ikke "reddet" af, at den senere ville være uden betydning for det autoritative
   beregningsinterval.

3. **Clamping mod fejlgivende øvre grænser:** Til-dato clampes mod strengeste af:
   `differencekravDato − 1`, `endelig EET-virkningsdato − 1`, og (ved skadedato < 2011-06-16)
   `midlertidig EET-virkningsdato − 1`. Alle tre EET-grænser ophæves hvis `verserendeKlageEet = 'Ja'`.
   Validator rapporterer violation som feltfejl der blokerer download. Rækkefølge: FØR
   EO-periode-clamping, så feltfejlen ikke skjules af at EO-perioden forinden har afkortet perioden.

4. **Løse feriedage er række-bundne før merge:** Hvis brugeren har indtastet
   `loseFeriedage` på en TAF-række, knyttes disse dage til den oprindelige indtastede række
   og placeres fra periodens start i netop denne række. Hvis flere TAF-rækker efterfølgende
   merges, ændrer merge ikke den logiske placering af løse feriedage; placeringen sker
   dermed pre-merge, ikke på baggrund af den samlede merged periode.

5. **Merge:** Overlappende og tilstødende ranges slås sammen til sammenhængende perioder
   (`mergeAdjacent: true`) via den kanoniske EO-helper i
   `src/domain/erstatningsopgoerelse/engines/periodMerging.ts`.

6. **Stille clamping mod EO-perioden:** Fra-dato `< vedroererPeriodeFra` clampes til
   `vedroererPeriodeFra`. Til-dato `> vedroererPeriodeTil` clampes til `vedroererPeriodeTil`.
   Ingen fejlindikation. Sker EFTER fejlgivende clamping.

7. De resulterende ranges lægges til grund for beregning i EODebug, EODebugTabel og
   EOBeregning. Download er blokeret hvis der er fejl fra trin 2.

Bemærk om projektioner: EO-domænet kan have flere tekniske TAF-forbrugere, fx en
per-række/merged-output-sti og en snapshot-baseret aggregationssti. Det er ikke i sig selv
et kontraktbrud, så længe de følger samme autoritative domænesemantik: clampede ranges som
beregningsgrundlag, pre-merge placering af løse feriedage og ingen parallelle fallback-totaler.

---

## Tilsvarende proces for svie/smerte-perioder

1. **Syntaksvalidering:** Ufuldstændige datoer (fx `dd-mm`) afvises i inputfeltet og
   committes ikke. Kun gyldige ISO-datoer committes.

2. **Semantisk validering (fejlgivende bounds):** Efter commit undersøges de committede
   datoer mod fejlgivende bounds (kontrakt §2.2). Violation giver feltfejl (rød kant + tooltip) og
   blokerer download via EOBeregningTab. Disse checks inkluderer: fra-dato mod 2005-grænse,
   skadedato/anmeldedato-grænse, fra > til, til < fra, til >= ménafgørelsesdato
   (ikke påklaget), overlap mellem rækker.

3. **Clamping mod fejlgivende øvre grænse:** Til-dato clampes mod
   `menAfgoerelseDato − 1`, når ménafgørelsen er endelig
   (`varigeMenAfgorelse = 'Ja'` og `verserendeKlageMen = 'Nej'`).
   Validator rapporterer violation som feltfejl der blokerer download. Rækkefølge: FØR
   EO-periode-clamping, så feltfejlen ikke skjules af at EO-perioden forinden har afkortet
   perioden.

4. **Merge:** Overlappende og tilstødende ranges slås sammen til sammenhængende perioder
   (`mergeAdjacent: true`) via den kanoniske EO-helper i
   `src/domain/erstatningsopgoerelse/engines/periodMerging.ts`.

5. **Stille clamping mod EO-perioden:** Fra-dato `< vedroererPeriodeFra` clampes til
   `vedroererPeriodeFra`. Til-dato `> vedroererPeriodeTil` clampes til `vedroererPeriodeTil`.
   Ingen fejlindikation. Sker EFTER fejlgivende clamping.

6. De resulterende ranges lægges til grund for beregning i EODebug, EODebugTabel og
   EOBeregning. Download er blokeret hvis der er fejl fra trin 2.

Implementeringen bruger parallelle constraint-typer (`SvieSmerteConstraintBounds`,
`resolveSvieSmerteFejlgivendeBounds`, `resolveSvieSmerteEoPeriodeBounds`) i
`svieSmerteConstraints.ts`.

> **Bemærk om overlap (svie/smerte):** Ethvert overlap mellem svie/smerte-perioder afvises —
> også overlap mellem perioder med samme tilstand. Validator og `svieSmerteEngine` afviser
> ethvert overlap (engine returnerer `null` ved `overlap.size > 0`), og tabel-/debug-laget
> markerer ethvert overlap rødt, så fejlen er synlig før gem. Der findes ikke længere en
> "samme tilstand er tilladt"-undtagelse.

---

## Periodemerge er centraliseret

- `mergeIsoDateRanges(...)` / `mergeDateRanges(...)` i `src/domain/erstatningsopgoerelse/engines/periodMerging.ts`
- Lokale, ad hoc merge-implementeringer i TAF-, svie/smerte-, ferie- eller SFGG-flow er arkitektonisk fejl, medmindre en kontrakt udtrykkeligt kræver en afvigende merge-semantik.
