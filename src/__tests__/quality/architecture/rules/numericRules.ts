/**
 * Afrundingsnorm-guard
 *
 * Håndhæver at kode i src/ ikke omgår de kanoniske afrundnings- og formateringshelpers.
 *
 * Kanonisk hierarki:
 *   Beregning:   roundByMethod(v, n, method)       — utils/rounding.ts
 *   Beløb UI:    formatAsAmount() / formatCurrency() — utils/formatUtils.ts
 *   Beløb PDF:   formatCurrencyFromOre() m.fl.      — document/layout/documentFormatUtils.ts
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

import { forbidTextPatterns } from '../ruleKit';

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
  // Påskealgortime (Meeus/Jones/Butcher) — ren talteori, intet finansielt output
  'domain/dates/shDageBeregning.ts',
  // UI-virtualisering: scroll offset i pixels — aldrig vist til bruger som beløb
  'components/tables/VirtualizedDisplayTable.tsx',
  // Binær søgning i lønopslag-tabel (indeksaritmetik)
  'data/offentligLoenLookup.ts',
  // Bug-rapport: binær søgning til tekstafkortning (ikke finansielt)
  'utils/bugReport.ts',
  // Dato-aritmetik: Math.min til clamping af månedsdag
  'utils/dateUtils.ts',
  // detectDecimalPlaces: tolerance-tjek (Math.abs + Math.round til heltalstjek)
  'domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts',
  // formatUtils: Math.abs og Math.trunc til sign-håndtering — aldrig selvstændig runding
  // Versions-footer-billede: Math.ceil på målt tekstbredde i canvas-pixels
  // til at dimensionere footer-billedets højde (ikke finansielt)
  'document/layout/documentFooterImage.ts',
  // Word-tabel layout: estimeret kolonnebredde i DXA (Math.ceil), ikke finansielt
  'docx/infrastructure/docxWriter.ts',
  // Graf-rendering: akse-skridt (nice-ceil magnitude), heltals-tickantal og
  // glidende-gennemsnits-radius — ren talgeometri, ikke finansielt output
  // (de viste beløbs-ticks afrundes via roundByMethod).
  'document/generators/tafFordelt/tafKravGrafScene.ts',
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
]);

/**
 * Filer der lovligt bruger .toLocaleString().
 *
 * Kriterium for optagelse:
 *   a) Den kanoniske formateringsimplementation bruger toLocaleString internt
 *   b) Logging/fejlrapport: teknisk output der aldrig vises til slutbruger
 *   c) Devtools/debug: kun synligt for udviklere
 */
const TO_LOCALE_STRING_ALLOWLIST = new Set<string>();

/**
 * Filer der lovligt bruger `new Date(value)` uden `Date.UTC`/`getTime()`.
 *
 * Listen står på modulniveau og ikke inde i sin `it(...)`, fordi kun en hoistet allowlist kan
 * anti-rot-kontrolleres. Det er ikke kosmetik: en undtagelse, der kun findes inde i sin egen test,
 * kan blive stående længe efter at filen, den fritog, er slettet — og en fritagelse for en fil, der
 * ikke findes, skjuler at listen er blevet forældet.
 */
const NEW_DATE_ALLOWLIST = new Set([
  // createDate er den kanoniske constructor — bruger Date.UTC internt
  'types/branded.ts',
  'utils/dateUtils.ts',      // bruger createDate og new Date(date.getTime())
  'domain/dates/shDageBeregning.ts',
  // Logging/rapport — timestamp, ikke dato-aritmetik
  'utils/devtoolsMonitor.ts',
  'utils/bugReport.ts',
  'utils/logger.ts',
  'utils/logStorage.ts',
  // `.eo`-codec: exportDate = new Date().toISOString() er et export-timestamp, ikke dato-aritmetik
  // (flyttet hertil fra fileSave.ts sammen med container-byggeriet).
  'utils/eoFileCodec.ts',
  // EO-oplysninger view-model: formatLabelDayAfterIsoDate bruger new Date(dateObj) —
  // kopi af UTC Date fra isoDateToDate(), ikke string-parsing.
  // Devtools-fejlnotice: ny Date fra ISO timestamp til lokal display (ikke domæne-dato)
  'components/errors/DevtoolsIssueNotice.tsx',
  // NB: dokumentgeneratorerne for renteberegning og SH-dage bruger slet ikke `new Date(` og skal
  // derfor IKKE undtages — en undtagelse for dem ville være en fritagelse for ingenting.
]);

/** Filer der lovligt bruger `.toISOString().slice()`. Hoistet sammen med `NEW_DATE_ALLOWLIST`. */
const TO_ISO_STRING_SLICE_ALLOWLIST = new Set<string>();

const sourceScope = {
  kind: 'scoped' as const,
  roots: ['src'],
  rationale: 'numerik- og datoformreglerne gælder hele den levende produktions-kildegraf',
};

const withSrc = (paths: ReadonlySet<string>): readonly string[] =>
  [...paths].map((path) => `src/${path}`);

const stripComments = (text: string): string => text
  .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

export const directRoundingRule = forbidTextPatterns({
  id: 'numeric/no-direct-rounding',
  description: 'Direkte Math.round/floor/ceil må kun bruges i auditerede ikke-finansielle eller kanoniske moduler.',
  liveTarget: sourceScope,
  allow: withSrc(MATH_ROUND_ALLOWLIST),
  patterns: [{ pattern: /\bMath\.(?:round|floor|ceil)\s*\(/, message: 'Direkte afrunding — brug roundByMethod fra utils/rounding.ts.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const value = Math.round(amount);' }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: "const value = roundByMethod(amount, 0, 'halfAwayFromZero');" }],
});

export const directToFixedRule = forbidTextPatterns({
  id: 'numeric/no-direct-to-fixed',
  description: 'Direkte toFixed må kun bruges af kanoniske formatterings- og serialiseringsmoduler.',
  liveTarget: sourceScope,
  allow: withSrc(TO_FIXED_ALLOWLIST),
  patterns: [{ pattern: /\.toFixed\s*\(/, message: 'Direkte toFixed — brug den kanoniske formatteringshelper.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const text = amount.toFixed(2);' }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const text = formatAsAmount(amount, 2);' }],
});

export const directLocaleFormattingRule = forbidTextPatterns({
  id: 'numeric/no-direct-locale-formatting',
  description: 'Direkte toLocaleString må kun bruges af auditerede formatterings- og diagnosemoduler.',
  liveTarget: sourceScope,
  allow: withSrc(TO_LOCALE_STRING_ALLOWLIST),
  patterns: [{ pattern: /\.toLocaleString\s*\(/, message: 'Direkte toLocaleString — brug den kanoniske danske formatteringshelper.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: "const text = amount.toLocaleString('da-DK');" }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const text = formatAsAmount(amount);' }],
});

export const isoMidnightConstructionRule = forbidTextPatterns({
  id: 'date/no-manual-iso-midnight-construction',
  description: 'ISO-datoer må ikke konstrueres manuelt ved at tilføje T00:00:00Z.',
  liveTarget: sourceScope,
  patterns: [{ pattern: /new\s+Date\s*\([^)]*T00:00:00Z/, message: 'Manuel ISO-midnatskonstruktion — brug isoDateToDate.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: "const date = new Date(iso + 'T00:00:00Z');" }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const date = isoDateToDate(iso);' }],
});

export const directDateParsingRule = forbidTextPatterns({
  id: 'date/no-direct-date-parsing',
  description: 'Direkte new Date(value) er kun tilladt i auditerede dato-, diagnose- og renderingsmoduler.',
  liveTarget: sourceScope,
  allow: withSrc(NEW_DATE_ALLOWLIST),
  patterns: [{
    pattern: /new\s+Date\s*\(\s*(?!Date\.UTC|[a-zA-Z_$][a-zA-Z0-9_$]*\s*\.\s*getTime)/,
    message: 'Timezone-afhængig new Date(value) — brug isoDateToDate, createDate eller Date.UTC.',
  }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const date = new Date(iso);' }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const date = new Date(Date.UTC(year, month, day));' }],
});

export const isoStringDateExtractionRule = forbidTextPatterns({
  id: 'date/no-iso-string-date-extraction',
  description: 'toISOString().slice/substring må ikke bruges som kalenderdatokonvertering uden for auditerede timestamp-moduler.',
  liveTarget: sourceScope,
  allow: withSrc(TO_ISO_STRING_SLICE_ALLOWLIST),
  patterns: [{ pattern: /\.toISOString\s*\(\s*\)\s*\.\s*(?:slice|substring)\s*\(/, message: 'UTC-datoekstraktion via toISOString — brug dateToISO.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const iso = date.toISOString().slice(0, 10);' }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const iso = dateToISO(date);' }],
});

export const localDateMethodRule = forbidTextPatterns({
  id: 'date/no-local-date-methods',
  description: 'Lokaltidsmetoder på Date er kun tilladt i getTodayLocalISO.',
  liveTarget: sourceScope,
  allow: ['src/utils/dateUtils.ts'],
  patterns: [{ pattern: /\.(?:getFullYear|getMonth|getDate)\s*\(\s*\)/, message: 'Lokaltidsafhængig Date-metode — brug UTC-varianten.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const year = date.getFullYear();' }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const year = date.getUTCFullYear();' }],
});

export const dateParseRule = forbidTextPatterns({
  id: 'date/no-date-parse',
  description: 'Date.parse er implementation- og timezone-afhængig og er derfor forbudt.',
  liveTarget: sourceScope,
  normalizeText: stripComments,
  patterns: [{ pattern: /\bDate\.parse\s*\(/, message: 'Date.parse er forbudt — brug en kanonisk datoparser.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const value = Date.parse(input);' }],
  cleanFixtures: [
    { relativePath: 'src/domain/x.ts', code: 'const value = parseISODate(input);' },
    { relativePath: 'src/domain/x.ts', code: '// Date.parse(input) må ikke bruges.\nconst value = parseISODate(input);' },
  ],
});

export const globalIsNaNRule = forbidTextPatterns({
  id: 'numeric/no-global-is-nan',
  description: 'Global isNaN coercer input og er derfor forbudt.',
  liveTarget: sourceScope,
  patterns: [{ pattern: /(?<![.\w])isNaN\s*\(/, message: 'Global isNaN — brug Number.isNaN eller Number.isFinite.' }],
  violatingFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const invalid = isNaN(value);' }],
  cleanFixtures: [{ relativePath: 'src/domain/x.ts', code: 'const invalid = Number.isNaN(value);' }],
});

export const NUMERIC_RULES = [
  directRoundingRule,
  directToFixedRule,
  directLocaleFormattingRule,
  isoMidnightConstructionRule,
  directDateParsingRule,
  isoStringDateExtractionRule,
  localDateMethodRule,
  dateParseRule,
  globalIsNaNRule,
] as const;
