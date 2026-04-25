# Tilføjelse af ny overenskomst i `overenskomstRates`

Denne guide er den faste opskrift til at indlægge en ny overenskomst i MinEO.
Målet er korrekt data, ens struktur og forudsigelig gennemslagskraft i hele appen.

## 1. Inddata der skal være afklaret først

Følgende skal foreligge, før du koder:

- `Navn` (præcis UI-tekst)
- `Overenskomst-ID` (kebab-case, unikt)
- `Lønmodtagerorganisation(er)` (liste)
- `Arbejdsgiverorganisation(er)` (liste)
- `Grundløn angivet per` (`'Time'` eller `'Måned'`)
- Historiske satser med konkrete `fraDato`
- Om `shDageAlmindeligLoenRegel` skal bruges:
  - `fritvalgDelta`
  - `shSoDelta`
  - `shSoOverride`

Ved tvivl i domænedata: stop og afklar før implementering.

## 2. Primær ændring (data-kilde)

Fil: `src/data/overenskomstRates.ts`

Tilføj overenskomsten som nyt element i `overenskomster` med samme tabellignende indrykning som eksisterende poster.

Brug dette mønster:

```ts
// <Navn>
{
  meta: {
    id:               toOverenskomstId('<nyt-id>'),
    navn:             '<Navn>',
    loenmodtagerOrg:  ['...'],
    arbejdsgiverOrg:  ['...'],
    grundloenAngivetPer: 'Time',
  },
  shDageAlmindeligLoenRegel: { fritvalgDelta: -0.04 }, // kun hvis relevant
  satser: satserFromTable(
    { shSoSats: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
    [
      // fraDato          │ Grundløn         │ Fritvalg            │ AG-pens.
      ['01-03-2027',            146.90,            0.1750,            0.1100 ],
      ['01-03-2026',            143.40,            0.1650,            0.1100 ],
      ['01-05-2025',            139.90,            0.1550,            0.1100 ],
      ['01-03-2024',            136.15,            0.1550,            0.1000 ]
    ]
  ),
},
```

## 3. Formateringsregler i `overenskomstRates.ts`

- Der skal være præcis én tom linje over hver `// <overenskomstnavn>`-kommentar.
- Der må ikke være ekstra tomme linjer mellem overenskomst-blokke.
- Indrykning skal følge eksisterende kolonneopstilling i `meta` og `satser` (tabellignende layout).
- Kommentarlinjen over satserækker (`// fraDato ...`) skal bevares i samme kolonneformat som de øvrige.
- Brug konsekvent mellemrum i arrays og objekter (ingen tilfældige ekstra spaces).
- Undgå trailing whitespace på linjer.

## 4. Datakontrakter der skal holdes

- `satser` skal være sorteret med nyeste først.
- `fraDato` skal være `DD-MM-YYYY`.
- Brug decimaler for procenter (`0.1550` = 15,5%).
- Brug `null` for felter der ikke findes i overenskomsten.
- Brug ikke ad hoc parsing/afrunding udenfor eksisterende helpers.
- `id` må aldrig kollidere med eksisterende overenskomster.

## 5. Gennemslag i resten af appen

Når posten er lagt korrekt i `overenskomstRates.ts`, bliver den automatisk tilgængelig via:

- `getOverenskomstMetaById`
- `getOverenskomsterByOrg`
- `getAlleLoenmodtagerOrg`
- `getAlleArbejdsgiverOrg`
- `getEffektiveSatserForDato`
- `getEffektiveSatserForPeriode`

Typisk kræves derfor ingen ekstra ændringer i UI-komponenter.

## 6. Testkrav ved tilføjelse

Fil: `src/__tests__/data/overenskomstRates.test.ts`

Opdatér/tilføj mindst:

- test der verificerer at nyt ID findes via `getOverenskomstMetaById`
- test af evt. `shDageAlmindeligLoenRegel` (fx `fritvalgDelta: -0.04`)

Brug `toBeCloseTo(...)` ved decimal-sammenligning, hvor floating point kan afvige minimalt.

## 7. Obligatorisk verifikation før handoff

Kør altid:

```bash
npm run typecheck
```

Kør derefter relevante tests, minimum:

```bash
npm run test -- src/__tests__/data/overenskomstRates.test.ts
```

## 8. Kort leverance-checkliste

- [ ] Ny overenskomst oprettet i `overenskomster`
- [ ] Præcis én tom linje over hver overenskomst-kommentar
- [ ] Mønster og indrykning matcher eksisterende tabellayout
- [ ] Satser/datoer/procenter indlagt korrekt
- [ ] `shDageAlmindeligLoenRegel` indlagt korrekt (hvis relevant)
- [ ] Metadata-opslag testet
- [ ] Regel-adfærd testet (hvis relevant)
- [ ] `typecheck` grøn
- [ ] Relevant testfil grøn
