/** Dato-invarianter, hvor den forbudte kildeform er selve kontrakten. */
import { forbidTextPatterns } from '../ruleKit';

const SOURCE_SCOPE = {
  kind: 'scoped' as const,
  roots: ['src'],
  rationale: 'reglerne gælder hele den levende produktions-kildegraf',
};

export const millisecondDayCountRule = forbidTextPatterns({
  id: 'date/no-millisecond-day-count',
  description: 'Dage må ikke optælles ved division af millisekunder; brug UTC-daghjælperne.',
  liveTarget: SOURCE_SCOPE,
  allow: ['src/utils/utcDayMath.ts'],
  patterns: [
    { pattern: /\/\s*86400000\b/, message: 'Millisekunddivision til dagoptælling — brug countInclusiveUtcDays eller en anden kanonisk UTC-daghjælper.' },
    { pattern: /\/\s*\(\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\s*\)/, message: 'Millisekunddivision til dagoptælling — brug countInclusiveUtcDays eller en anden kanonisk UTC-daghjælper.' },
    { pattern: /\/\s*\(\s*1000\s*\*\s*60\s*\*\s*60\s*\*\s*24\s*\)/, message: 'Millisekunddivision til dagoptælling — brug countInclusiveUtcDays eller en anden kanonisk UTC-daghjælper.' },
  ],
  violatingFixtures: [
    { relativePath: 'src/domain/x.ts', code: 'const days = diffMs / 86400000;' },
    { relativePath: 'src/domain/x.ts', code: 'const days = diffMs / (24 * 60 * 60 * 1000);' },
  ],
  cleanFixtures: [
    { relativePath: 'src/domain/x.ts', code: 'const days = countInclusiveUtcDays(from, to);' },
  ],
});

export const materializedDayCountRule = forbidTextPatterns({
  id: 'date/no-materialized-day-count',
  description: 'Et helt ISO-datointerval må ikke materialiseres alene for at tælle dagene.',
  liveTarget: SOURCE_SCOPE,
  patterns: [
    { pattern: /collectIsoDatesInclusive\([^)]*\)\.length/, message: 'Materialiseret datointerval bruges kun til optælling — brug den kanoniske dagtæller.' },
    { pattern: /buildIsoDateSetInclusive\([^)]*\)\.size/, message: 'Materialiseret datosæt bruges kun til optælling — brug den kanoniske dagtæller.' },
  ],
  violatingFixtures: [
    { relativePath: 'src/domain/x.ts', code: 'const days = collectIsoDatesInclusive(from, to).length;' },
  ],
  cleanFixtures: [
    { relativePath: 'src/domain/x.ts', code: 'const days = countInclusiveUtcDays(from, to);' },
  ],
});

export const manualDayLoopRule = forbidTextPatterns({
  id: 'date/no-manual-day-loop',
  description: 'Dag-for-dag-iteration ejes af den kanoniske ISO-datohjælper.',
  liveTarget: SOURCE_SCOPE,
  allow: ['src/utils/isoDateHelpers.ts'],
  patterns: [{
    pattern: /while\s*\([^)]*(?:<=|<)[^)]*\)\s*{[\s\S]{0,1200}\.setUTCDate\([^)]*\.getUTCDate\(\)\s*\+\s*1\s*\)/,
    message: 'Håndskrevet dag-for-dag-løkke — brug iterateDatesInclusive eller en anden kanonisk datohjælper.',
  }],
  violatingFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: 'while (current <= end) { rows.push(current); current.setUTCDate(current.getUTCDate() + 1); }',
  }],
  cleanFixtures: [
    { relativePath: 'src/domain/x.ts', code: 'iterateDatesInclusive(from, to, (date) => rows.push(date));' },
  ],
});

export const DATE_RULES = [
  millisecondDayCountRule,
  materializedDayCountRule,
  manualDayLoopRule,
] as const;
