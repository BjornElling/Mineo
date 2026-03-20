# PDF Formateringsprincipper

Dette lag har en fælles formateringskontrakt for alle PDF-filer.

## Grundregel

Formatering må ikke være unik for en enkelt PDF-fil.
Alle typografiske/layout-mønstre skal implementeres i de delte API'er i `pdfWriter.ts` eller `pdfHelpers.ts` og genbruges.

## Kanoniske skrive-API'er

- `writer.writeTitle(text)`
  - Dokumenttitel (stor titel + fælles bundafstand).
- `writer.writeSectionHeader(text, nextLineHeight)`
  - Hovedafsnit (større font, 2 linjeafstand over, 1 linjeafstand under).
- `writer.writeSubheader(text, nextLineHeight, options?)`
  - Underoverskrift (normal font size, fed).
  - Standard: 1 fuld linjeafstand over, men 0 ekstra topafstand når den kommer direkte efter `writeSectionHeader` eller `writeTitle`.
  - `options.addTopSpacing` overstyrer standardadfærden eksplicit (`true` = 1 linjeafstand, `false` = 0).
- `writer.writeWrappedText(text)`
  - Løbende brødtekst.
- `writer.writeLeftRightText(left, right, options)`
  - Eneste API til linjer med venstre/højre-kolonne. Bruges til alt: faste labels, formeltekster, dynamiske beløb.
  - Venstretekst wrapper altid til næste linje ved pladsmangel — trunkering sker aldrig.
- `renderEoStylePdfTable(...)`
  - Kun til faktiske tabeller med kolonneoverskrifter og tabelstruktur.

## Wrapping-princip

**Venstretekst wrappes altid — aldrig trunkeret.**

`writeLeftRightText` er det eneste API til linjer med venstre/højre-kolonne. Venstreteksten bryder til næste linje hvis nødvendigt; beløbet højrejusteres på den afsluttende linje.

`writeLeftRightTextSingleLine` er fjernet. Brug udelukkende `writeLeftRightText`.

## Forbudt mønster

- Lokal, filspecifik typografi- eller spacing-logik for generiske overskrifter/tekst.
- Headerløse pseudo-tabeller til almindelige oplysningslinjer.
- Parallelle implementationer af samme formatering i flere PDF-filer.

Hvis en ny formatteringsvariant er nødvendig, skal den først lægges ind centralt i `pdfWriter.ts`/`pdfHelpers.ts` og derefter bruges fra de enkelte PDF-filer.
