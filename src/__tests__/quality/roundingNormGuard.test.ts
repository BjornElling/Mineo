/// <reference types="vitest/globals" />

/**
 * Afrundingsnorm-guard
 *
 * Håndhæver at kode i src/ ikke omgår de kanoniske afrundnings- og formateringshelpers.
 *
 * Kanonisk hierarki:
 *   Beregning:   roundByMethod(v, n, method)       — utils/rounding.ts
 *   Beløb UI:    formatAsAmount() / formatCurrency() — utils/formatUtils.ts
 *   Beløb PDF:   formatCurrencyFromOre() m.fl.      — pdf/shared/pdfFormatUtils.ts
 *   Procent:     formatPercent()                    — utils/formatUtils.ts
 *
 * Forbudte mønstre og deres kanoniske erstatning:
 *   Math.round/floor/ceil(x)        → roundByMethod(x, 0, 'halfAwayFromZero'|'floor'|'ceil')
 *   x.toFixed(n)                    → formatAsAmount(x, n)  /  formatAsAmountTrimmed(x, n)
 *   x.toLocaleString('da-DK', {...})→ formatAsAmount(x, n)  /  formatCurrency(x)
 *   new Date(iso + 'T00:00:00Z')    → isoDateToDate(iso)   fra domain/dates/isoDate.ts
 *   Number.isNaN(x)                 → Number.isFinite(x) / isISODateString(x) ved datoer
 *
 * Overstyring af allowlisten:
 *   Tilføj kun en fil til en allowliste når brugen er veldokumenteret
 *   og IKKE er finansiel beregning eller brugersynlig formatering.
 *   Skriv en kommentar der forklarer hvorfor undtagelsen er nødvendig.
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../../');

// ---------------------------------------------------------------------------
// Fil-scanner (ekskluderer __tests__ og node_modules)
// ---------------------------------------------------------------------------

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      results.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function relPath(absPath: string): string {
  return path.relative(SRC_ROOT, absPath).replace(/\\/g, '/');
}

function scanLines(
  files: string[],
  allowlist: Set<string>,
  pattern: RegExp,
  opts: { stripLineComments?: boolean } = {},
): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const rel = relPath(file);
    if (allowlist.has(rel)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (opts.stripLineComments) {
        // Remove content from // onward (outside string literals — simple heuristic)
        const commentIdx = line.indexOf('//');
        if (commentIdx !== -1) {
          // Only strip if // is not inside a string — simple approximation:
          // count unescaped quotes before the //
          const before = line.slice(0, commentIdx);
          const singleQuotes = (before.match(/'/g) ?? []).length;
          const doubleQuotes = (before.match(/"/g) ?? []).length;
          const backticks = (before.match(/`/g) ?? []).length;
          const inString = singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0;
          if (!inString) line = before;
        }
        if (line.trimStart().startsWith('*')) continue; // JSDoc line
      }
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Allowlister
// ---------------------------------------------------------------------------

/**
 * Filer der lovligt bruger Math.round / Math.floor / Math.ceil.
 *
 * Kriterium for optagelse:
 *   a) Selve den kanoniske rounding-implementation (rounding.ts, eetRounding.ts)
 *   b) Ren matematisk algoritme uden finansielt output (påskealgo, heltalsdimensioner)
 *   c) UI-hjælpeberegning der aldrig producerer et vist beløb (scroll, inputbredde)
 *   d) Binær søgning / listeinddeling (ikke finansielt)
 */
const MATH_ROUND_ALLOWLIST = new Set([
  // Kanonisk implementation — definerer roundByMethod
  'utils/rounding.ts',
  // Kanonisk domain-wrapper — tyndt lag oven på roundByMethod (tidl. eetRounding.ts)
  'utils/roundingShortcuts.ts',
  // Påskealgortime (Meeus/Jones/Butcher) — ren talteori, intet finansielt output
  'domain/dates/shDageBeregning.ts',
  // UI-virtualisering: scroll offset i pixels — aldrig vist til bruger som beløb
  'components/tables/VirtualizedDisplayTable.tsx',
  // UI-inputbredde: antal cifre til at dimensionere et tekstfelt
  'components/inputs/StyledPercentField.tsx',
  // Binær søgning i lønopslag-tabel (indeksaritmetik)
  'data/offentligLoenLookup.ts',
  // Bug-rapport: binær søgning til tekstafkortning (ikke finansielt)
  'utils/bugReport.ts',
  // Dato-aritmetik: Math.min til clamping af månedsdag
  'utils/dateUtils.ts',
  // detectDecimalPlaces: tolerance-tjek (Math.abs + Math.round til heltalstjek)
  'domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts',
  // formatUtils: Math.abs og Math.trunc til sign-håndtering — aldrig selvstændig runding
  'utils/formatUtils.ts',
  // pdfFormatUtils: Math.abs på allerede-afrundet tal til fortegnsfjernelse
  'pdf/shared/pdfFormatUtils.ts',
  // Canvas/PDF dimension: pixelbredde/-højde (ikke finansielt)
  'pdf/shared/pdfHelpers.ts',
  'pdf/infrastructure/pdfWriter.ts',
]);

/**
 * Filer der lovligt bruger .toFixed().
 *
 * Kriterium for optagelse:
 *   a) Den kanoniske formateringsimplementation bruger toFixed internt
 *   b) Fingerprint-serialisering: deterministisk kanonisk streng-form (ikke display)
 *   c) Ikke-finansielle størrelser (bytes→MB, pixels)
 *   d) UI-input: genskaber præcist brugerens tastede format i en inputkomponent
 */
const TO_FIXED_ALLOWLIST = new Set([
  // Kanoniske implementations — bruger toFixed internt i formatAsAmount/roundFloor/roundCeil
  'utils/formatUtils.ts',
  'utils/rounding.ts',
  // Fingerprint: deterministisk canonical streng til ændringsdetektion (ikke display)
  'utils/fingerprintParsers.ts',
  'components/inputs/table/TableAmountInput.tsx',
  // Filstørrelse: bytes→MB i fejlbeskeder til brugeren (ikke finansielt beløb)
  'utils/fileLoad.ts',
  // PDF canvas: cache-nøgle baseret på dimensioner (ikke finansielt)
  'pdf/infrastructure/pdfWriter.ts',
  // UI procentinput: genskaber nøjagtigt brugerens commit-format i tabellen
  'components/inputs/table/TablePercentInput.tsx',
]);

/**
 * Filer der lovligt bruger .toLocaleString().
 *
 * Kriterium for optagelse:
 *   a) Den kanoniske formateringsimplementation bruger toLocaleString internt
 *   b) Logging/fejlrapport: teknisk output der aldrig vises til slutbruger
 *   c) Devtools/debug: kun synligt for udviklere
 */
const TO_LOCALE_STRING_ALLOWLIST = new Set([
  // Kanoniske implementations
  'utils/formatUtils.ts',
  'pdf/shared/pdfFormatUtils.ts',
  // Logging og teknisk fejlrapport — ikke brugersynligt finansielt tal
  'utils/bugReport.ts',
  'utils/logger.ts',
  'utils/logStorage.ts',
  'utils/devtoolsMonitor.ts',
  // Debug-output — kun synligt via devtools, ikke i produktionsflow
  'domain/debug/eoDebugErstatningsopgoerelseModel.ts',
  'domain/debug/eoDebugSammentaelling.ts',
  // DevTools-fejlmeddelelse: viser dato (ikke beløb) til udvikler
  'components/errors/DevtoolsIssueNotice.tsx',
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Afrundingsnorm-guard', () => {
  const allFiles = collectTsFiles(SRC_ROOT);

  // ── 1. Math.round / floor / ceil ──────────────────────────────────────────

  it('forbyder Math.round/floor/ceil uden for godkendte filer', () => {
    const violations = scanLines(
      allFiles,
      MATH_ROUND_ALLOWLIST,
      /\bMath\.(round|floor|ceil)\s*\(/,
    );
    if (violations.length > 0) {
      throw new Error(
        'Direkte Math.round/floor/ceil fundet uden for allowlisten.\n' +
        'Brug roundByMethod() fra utils/rounding.ts i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 2. .toFixed() ─────────────────────────────────────────────────────────

  it('forbyder .toFixed() uden for godkendte filer', () => {
    const violations = scanLines(
      allFiles,
      TO_FIXED_ALLOWLIST,
      /\.toFixed\s*\(/,
    );
    if (violations.length > 0) {
      throw new Error(
        'Direkte .toFixed() fundet uden for allowlisten.\n' +
        'Brug formatAsAmount() / formatAsAmountTrimmed() fra utils/formatUtils.ts i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 3. .toLocaleString() ──────────────────────────────────────────────────

  it('forbyder .toLocaleString() uden for godkendte filer', () => {
    const violations = scanLines(
      allFiles,
      TO_LOCALE_STRING_ALLOWLIST,
      /\.toLocaleString\s*\(/,
    );
    if (violations.length > 0) {
      throw new Error(
        'Direkte .toLocaleString() fundet uden for allowlisten.\n' +
        'Brug formatAsAmount() / formatCurrency() fra utils/formatUtils.ts i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 4. new Date(iso + 'T00:00:00Z') ──────────────────────────────────────

  it('forbyder new Date(iso + T00:00:00Z) dato-konstruktion (ingen undtagelser)', () => {
    // Matcher begge varianter:
    //   new Date(someIso + 'T00:00:00Z')
    //   new Date(`${someIso}T00:00:00Z`)
    const violations = scanLines(
      allFiles,
      new Set<string>(), // ingen undtagelser — mønsteret er altid forkert
      /new\s+Date\s*\([^)]*T00:00:00Z/,
    );
    if (violations.length > 0) {
      throw new Error(
        "Manuel dato-konstruktion med 'T00:00:00Z' fundet.\n" +
        'Brug isoDateToDate() fra domain/dates/isoDate.ts i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 5. new Date(stringLiteral) — direkte ISO-streng-parsing ───────────────

  it('forbyder new Date(iso-literal) som kan forårsage timezone-shift', () => {
    // Matcher: new Date("2024-01-01") eller new Date('2024-01-01')
    // og varianter som new Date(someVar + '-01-01')
    // Undgår at matche lovlige mønstre som new Date(num), new Date(), Date.UTC(...)
    //
    // Tillad-mønster: new Date(Date.UTC(...)) er OK — bruges af createDate()
    // Tillad-mønster: new Date(existingDate.getTime()) er OK — kopi af Date-objekt
    // Forbudt: new Date(isoStringValue) direkte — timezone-afhængig
    const violations = scanLines(
      allFiles,
      new Set([
        // createDate er den kanoniske constructor — bruger Date.UTC internt
        'types/branded.ts',
        'utils/dateUtils.ts',      // bruger createDate og new Date(date.getTime())
        'utils/isoDateHelpers.ts', // new Date(start.getTime()) — kopi, ikke parsing
        // Renteberegning — bruger Date.UTC til månedsafgrænsning
        'domain/renteberegning/procesrenteCalculator.ts',
        'pdf/domains/renteberegning/rentePdf.ts',
        // Måned-slutdag-beregning via Date.UTC(y, m, 0) — kanonisk trick
        'config/dateRanges.ts',
        'components/inputs/StyledDateField.tsx',
        'domain/forsoergertab/forsoergertabAslYdelser.ts',
        'domain/erstatningsopgoerelse/engines/periodMerging.ts',
        'domain/erstatningsopgoerelse/engines/periodiseringsMotor.ts',
        'domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts',
        'domain/erstatningsopgoerelse/engines/tafDaySets.ts',
        'domain/erstatningsopgoerelse/engines/ferieCalculations.ts',
        'domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning.ts',
        'domain/debug/eoDebugErstatningsopgoerelseModel.ts',
        'domain/debug/eoDebugCoreModel.ts',
        'domain/debug/eoDebugRegulationCore.ts',
        'domain/dates/shDageBeregning.ts',
        'pdf/domains/aarsloen/shDagePdf.ts',
        // Logging/rapport — timestamp, ikke dato-aritmetik
        'utils/devtoolsMonitor.ts',
        'utils/bugReport.ts',
        'utils/logger.ts',
        'utils/logStorage.ts',
        'utils/fileSave.ts',
        'domain/debug/eoDebugSnapshot.ts',
        // UI-komponent: validering af datokomponent (år/måned/dag som tal)
        'components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx',
        // Rente-validering
        'domain/renteberegning/rentekravValidation.ts',
        // Periode-iteration: new Date(dateObj) — kopi af UTC Date-objekt, ikke string-parsing
        'utils/periodeBeregning.ts',
        'domain/erstatningsopgoerelse/engines/arbejdsdageMaaneder.ts',
        // Devtools-fejlnotice: ny Date fra ISO timestamp til lokal display (ikke domæne-dato)
        'components/errors/DevtoolsIssueNotice.tsx',
      ]),
      // Matcher new Date( ... ) hvor indholdet IKKE starter med Date.UTC eller getTime
      // Vi bruger en simpel heuristik: new Date( efterfulgt af streng-literal eller variabel-navn
      /new\s+Date\s*\(\s*(?!Date\.UTC|[a-zA-Z_$][a-zA-Z0-9_$]*\s*\.\s*getTime)/,
    );
    if (violations.length > 0) {
      throw new Error(
        'new Date(value) uden Date.UTC eller getTime() fundet.\n' +
        'Risiko: string-argument giver timezone-afhængig parsing.\n' +
        'Brug isoDateToDate() eller createDate() / Date.UTC() i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 6. .toISOString() brugt til dato-ekstraktion ──────────────────────────

  it('forbyder .toISOString().slice() til dato-ekstraktion', () => {
    // Mønsteret .toISOString().slice(...) bruges typisk til at udtrækker
    // en dato fra et Date-objekt — men det giver UTC-datoen, som kan afvige
    // ±1 dag fra lokal kalenderdag.
    // Kanonisk alternativ: dateToISO() fra types/branded.ts
    const violations = scanLines(
      allFiles,
      new Set([
        // utcDayMath.ts — bruger ikke toISOString
        'utils/utcDayMath.ts',
        // Logging/rapport: timestamp-formatering (UTC er korrekt her)
        'utils/logger.ts',
        'utils/logStorage.ts',
        'utils/devtoolsMonitor.ts',
        'utils/bugReport.ts',
        'utils/fileSave.ts',
        'domain/debug/eoDebugSnapshot.ts',
      ]),
      /\.toISOString\s*\(\s*\)\s*\.\s*(slice|substring)\s*\(/,
    );
    if (violations.length > 0) {
      throw new Error(
        '.toISOString().slice() til dato-ekstraktion fundet.\n' +
        'Risiko: toISOString() returnerer UTC-tidspunkt; slice(0,10) giver UTC-dato, ikke lokal dato.\n' +
        'Brug dateToISO() fra types/branded.ts i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 7. Lokal-tids date-metoder (getFullYear, getMonth, getDate) ────────────

  it('forbyder lokal-tids date-metoder uden for getTodayLocalISO', () => {
    // .getFullYear(), .getMonth(), .getDate() bruger lokal tidszone og kan
    // give forkert dato nær midnat i sommertid.
    // Kanonisk alternativ: .getUTCFullYear(), .getUTCMonth(), .getUTCDate()
    // Undtagelse: getTodayLocalISO() i dateUtils.ts bruger bevidst lokal tid
    // for at afspejle brugerens kalenderdag.
    const violations = scanLines(
      allFiles,
      new Set([
        // getTodayLocalISO() bruger bevidst local-tid (se kommentar i filen)
        'utils/dateUtils.ts',
      ]),
      /\.(getFullYear|getMonth|getDate)\s*\(\s*\)/,
    );
    if (violations.length > 0) {
      throw new Error(
        'Lokal-tids date-metode fundet uden for getTodayLocalISO.\n' +
        'Risiko: returnerer lokal tidszone; kan give ±1 dag fejl nær midnat.\n' +
        'Brug .getUTCFullYear() / .getUTCMonth() / .getUTCDate() i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 8. Date.parse() ───────────────────────────────────────────────────────

  it('forbyder Date.parse() overalt (ingen undtagelser)', () => {
    // Date.parse() er implementerings-afhængig og giver timezone-afhængig output.
    // Der er ingen legitimate use cases i denne codebase.
    const violations = scanLines(
      allFiles,
      new Set<string>(), // ingen undtagelser
      /\bDate\.parse\s*\(/,
      { stripLineComments: true },
    );
    if (violations.length > 0) {
      throw new Error(
        'Date.parse() fundet.\n' +
        'Date.parse() er implementation-defined og timezone-afhængig.\n' +
        'Brug isoDateToDate() / parseISODate() / parseDanishDate() i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });

  // ── 9. isNaN() (svag guard — float coercion) ─────────────────────────────

  it('forbyder global isNaN() — brug Number.isNaN() eller Number.isFinite()', () => {
    // isNaN("") === false  (coercer til 0 først — forkert)
    // Number.isNaN("") === false (korrekt — vil dog ikke fange Infinity)
    // Number.isFinite(x) er den bedste guard til finansielle tal
    //
    // Undtagelse: ingen — alle kanoniske guards bruger Number.isNaN/isFinite
    const violations = scanLines(
      allFiles,
      new Set<string>(), // ingen undtagelser
      /(?<![.\w])isNaN\s*\(/,  // negativ lookbehind: ikke Number.isNaN
    );
    if (violations.length > 0) {
      throw new Error(
        'Global isNaN() fundet.\n' +
        'isNaN() coercer string til number først — kan give falsk-negative resultater.\n' +
        'Brug Number.isNaN() eller Number.isFinite() i stedet.\n\n' +
        violations.join('\n'),
      );
    }
  });
});
