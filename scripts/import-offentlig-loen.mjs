#!/usr/bin/env node

/**
 * Import-script: Læser KL og RLTN overenskomst Excel-filer og genererer TypeScript-datafiler.
 *
 * Kør: node scripts/import-offentlig-loen.mjs
 *
 * Scriptet:
 * 1. Læser Excel-filer fra src/data/KL/Excel/ og src/data/RLTN/Excel/
 * 2. Finder kolonner via header-detektion (ikke hardkodede indekser)
 * 3. Udtrækker månedsløn og timeløn for Gruppe 0-4, Løntrin 1-55+
 * 4. Validerer data med Zod
 * 5. Genererer src/data/KL/klLoenSatser.ts og src/data/RLTN/rltnLoenSatser.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ===== FILNAVNE-MØNSTER =====
// Navngivning er ufravigelig: KL-ÅÅÅÅ-MM-DD.xlsx/.xls og RLTN-ÅÅÅÅ-MM-DD.xlsx/.xls
// Dato i filnavnet er reguleringsperiodedatoen (effectiveDate).

const KL_PATTERN = /^KL-(\d{4})-(\d{2})-(\d{2})\.xlsx?$/i;
const RLTN_PATTERN = /^RLTN-(\d{4})-(\d{2})-(\d{2})\.xlsx?$/i;

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isValidDanishDate = (dd, mm, yyyy) => {
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const danishDateToNumber = (dateStr) => {
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) {
    throw new Error(`Ugyldig dansk datoformat: ${dateStr}`);
  }
  const [dd, mm, yyyy] = parts;
  if (!isValidDanishDate(dd, mm, yyyy)) {
    throw new Error(`Ugyldig dansk dato: ${dateStr}`);
  }
  return Number(yyyy) * 10000 + Number(mm) * 100 + Number(dd);
};

/**
 * Scanner en Excel-mappe og returnerer filer der matcher det forventede mønster.
 * Advarer om filer der IKKE matcher (undtagen kendte system-filer som desktop.ini og ~$ lock-filer).
 */
function discoverFiles(excelDir, pattern, overenskomstType) {
  if (!fs.existsSync(excelDir)) {
    throw new Error(`Excel-mappe ikke fundet: ${excelDir}`);
  }

  const allFiles = fs.readdirSync(excelDir);
  const matched = [];
  const ignored = ['desktop.ini', 'thumbs.db', '.ds_store'];

  for (const file of allFiles) {
    // Spring kendte system-filer og Excel lock-filer over
    if (file.startsWith('~$') || ignored.includes(file.toLowerCase())) continue;

    const m = file.match(pattern);
    if (m) {
      const [, yyyy, mm, dd] = m;
      const effectiveDate = `${dd}-${mm}-${yyyy}`; // DanishDateString: DD-MM-YYYY
      if (!isValidDanishDate(dd, mm, yyyy)) {
        throw new Error(
          `Ugyldig dato i filnavn: "${file}" → ${effectiveDate}. ` +
            `Datoen er ikke en gyldig kalenderdato.`
        );
      }
      matched.push({ file, effectiveDate });
    } else {
      console.warn(`  ⚠ ADVARSEL: Filen "${file}" i ${overenskomstType}/Excel/ matcher IKKE navngivningskravet (${overenskomstType}-ÅÅÅÅ-MM-DD.xlsx). Filen ignoreres.`);
    }
  }

  if (matched.length === 0) {
    throw new Error(`Ingen gyldige ${overenskomstType}-filer fundet i ${excelDir}. Forventet format: ${overenskomstType}-ÅÅÅÅ-MM-DD.xlsx`);
  }

  return matched;
}

// ===== ZOD SCHEMAS =====

const LoentrinSchema = z.union([z.number().int().min(1).max(55), z.literal('55+')]);

const LoenGruppeVaerdierSchema = z.object({
  0: z.number().positive().finite(),
  1: z.number().positive().finite(),
  2: z.number().positive().finite(),
  3: z.number().positive().finite(),
  4: z.number().positive().finite(),
});

const EntrySchema = z.object({
  loentrin: LoentrinSchema,
  maanedsLoen: LoenGruppeVaerdierSchema,
  timeLoen: LoenGruppeVaerdierSchema,
});

const ReguleringSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/)
    .refine((value) => {
      const [dd, mm, yyyy] = value.split('-');
      return isValidDanishDate(dd, mm, yyyy);
    }, 'Ugyldig dato (kalenderdato)'),
  entries: z.array(EntrySchema).length(56),
});

// ===== HEADER-BASERET KOLONNEDETEKTION =====

/**
 * Scanner header-rækker og finder kolonne-indekser for månedsløn, timeløn og evt. årsløn.
 *
 * Håndterer to kendte Excel-layouts:
 *
 * 1) NYT LAYOUT (2020+): Tre sektioner lineært i én blok
 *    [Løntrin | Årsløn×5 | Månedsløn×5 | Timeløn×5]
 *    → Returnerer maanedCols, timeCols, aarsLoenCols=null
 *
 * 2) GAMMELT LAYOUT (pre-2020): Årsløn og Månedsløn side om side, ingen Timeløn
 *    [Løntrin | Årsløn×5 | gap | Løntrin | Månedsløn×5]
 *    → Returnerer maanedCols, timeCols=null, aarsLoenCols (til beregning af timeløn)
 *
 * Gruppekolonner (0-4) scannes eksplicit — ingen antagelse om konsekutive kolonner.
 */
function detectColumns(sheet, filePath) {
  const ref = sheet['!ref'];
  if (!ref) {
    throw new Error(`Arket mangler !ref (kan ikke læse område): ${filePath}`);
  }
  const range = xlsxUtils.decode_range(ref);
  const headerMaxRow = Math.min(range.s.r + 30, range.e.r);

  // 1) Find sektionsoverskrifter (Årsløn, Månedsløn, Timeløn) i de første 10 rækker
  let sectionRow = -1;
  let aarsLoenCol = -1;
  let maanedCol = -1;
  let timeCol = -1;
  const sectionCandidates = {
    maaned: [],
    time: [],
    aars: [],
  };

  for (let r = range.s.r; r <= headerMaxRow; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsxUtils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = normalizeText(cell.v);
      if (!val) continue;
      if (val.includes('månedsløn')) {
        sectionCandidates.maaned.push({ r, c });
      }
      if (val.includes('timeløn')) {
        sectionCandidates.time.push({ r, c });
      }
      if (val.includes('årsløn')) {
        sectionCandidates.aars.push({ r, c });
      }
    }
  }

  const pickBestCandidate = (candidates, referenceRow) => {
    if (candidates.length === 0) return null;
    const aboveOrEqual = candidates.filter((c) => c.r <= referenceRow);
    if (aboveOrEqual.length > 0) {
      return aboveOrEqual.sort((a, b) => b.r - a.r || a.c - b.c)[0];
    }
    return candidates.sort((a, b) => a.r - b.r || a.c - b.c)[0];
  };

  if (sectionCandidates.maaned.length === 0) {
    throw new Error(`Kunne ikke finde sektionsoverskriften "Månedsløn" i arket (${filePath}).`);
  }

  // 2) Find gruppeRow: rækken der indeholder "Gruppe 0", "Gruppe 1", etc.
  let gruppeRow = -1;
  let bestGroupHits = 0;

  const getGroupHitsForRow = (r) => {
    const hits = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsxUtils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = normalizeText(cell.v);
      if (!val) continue;
      const match = val.match(/^gruppe\s*(\d)\b/);
      if (match) {
        hits.push({ gruppe: Number(match[1]), col: c });
      }
    }
    return hits;
  };

  for (let r = range.s.r; r <= headerMaxRow; r++) {
    const hits = getGroupHitsForRow(r);
    if (hits.length > bestGroupHits) {
      bestGroupHits = hits.length;
      gruppeRow = r;
    }
  }

  if (gruppeRow === -1) {
    throw new Error(`Kunne ikke finde "Gruppe 0" header-rækken (${filePath}).`);
  }

  const bestMaaned = pickBestCandidate(sectionCandidates.maaned, gruppeRow);
  const bestTime = pickBestCandidate(sectionCandidates.time, gruppeRow);
  const bestAars = pickBestCandidate(sectionCandidates.aars, gruppeRow);

  if (!bestMaaned) {
    throw new Error(`Kunne ikke finde sektionsoverskriften "Månedsløn" i arket (${filePath}).`);
  }

  sectionRow = bestMaaned.r;
  maanedCol = bestMaaned.c;
  timeCol = bestTime ? bestTime.c : -1;
  aarsLoenCol = bestAars ? bestAars.c : -1;

  const hasTimeLoen = timeCol !== -1;

  // 3) Scan hele gruppeRow og saml ALLE "Gruppe N"-celler med deres kolonne-positioner
  //    Resultat: array af { gruppe: 0-4, col: number }, sorteret per kolonne
  const gruppeHits = getGroupHitsForRow(gruppeRow);
  if (gruppeHits.length < 5) {
    throw new Error(
      `Kunne ikke finde alle "Gruppe 0-4" headers (${filePath}). ` +
        `Fandt kun ${gruppeHits.length} gruppe-kolonner.`
    );
  }

  // 4) Tildel gruppe-hits til sektioner baseret på sektionsoverskrifternes kolonne-positioner.
  //    En gruppe-kolonne tilhører den sektion hvis overskrift er den nærmeste til venstre
  //    (eller på præcis samme kolonne).

  /** Tildeler en kolonne til en sektion ud fra nærmeste overskrift til venstre */
  function assignSection(col) {
    // Kandidater: sektioner med overskrift <= col
    const candidates = [];
    if (aarsLoenCol !== -1 && aarsLoenCol <= col) candidates.push({ name: 'aarsLoen', startCol: aarsLoenCol });
    if (maanedCol !== -1 && maanedCol <= col) candidates.push({ name: 'maanedLoen', startCol: maanedCol });
    if (timeCol !== -1 && timeCol <= col) candidates.push({ name: 'timeLoen', startCol: timeCol });
    if (candidates.length === 0) return null;
    // Nærmeste = den med højest startCol (tættest til venstre)
    candidates.sort((a, b) => b.startCol - a.startCol);
    return candidates[0].name;
  }

  // Gruppér hits per sektion
  const sectionGrupper = { aarsLoen: {}, maanedLoen: {}, timeLoen: {} };
  for (const hit of gruppeHits) {
    const section = assignSection(hit.col);
    if (!section) continue;
    if (sectionGrupper[section][hit.gruppe] !== undefined) {
      throw new Error(`Duplikeret Gruppe ${hit.gruppe} i sektion "${section}" (${filePath}).`);
    }
    sectionGrupper[section][hit.gruppe] = hit.col;
  }

  const countGroups = (sectionMap) => Object.keys(sectionMap).length;
  const maanedCount = countGroups(sectionGrupper.maanedLoen);
  const timeCount = countGroups(sectionGrupper.timeLoen);
  const aarsCount = countGroups(sectionGrupper.aarsLoen);

  if (maanedCount !== 5) {
    throw new Error(`Månedsløn-sektionen skal have præcist 5 gruppekolonner (${filePath}).`);
  }

  if (hasTimeLoen) {
    if (timeCount !== 5) {
      throw new Error(`Timeløn-sektionen skal have præcist 5 gruppekolonner (${filePath}).`);
    }
    if (aarsCount !== 0 && aarsCount !== 5) {
      throw new Error(`Årsløn-sektionen har uventet antal gruppekolonner (${filePath}).`);
    }
  } else {
    if (aarsCount !== 5) {
      throw new Error(`Årsløn-sektionen skal have præcist 5 gruppekolonner (${filePath}).`);
    }
  }

  // 5) Byg kolonnearray for hver sektion og validér komplethed (Gruppe 0-4)
  function buildColsArray(sectionMap, sectionLabel) {
    const cols = [];
    for (let g = 0; g <= 4; g++) {
      if (sectionMap[g] === undefined) {
        throw new Error(`Manglende "Gruppe ${g}" i ${sectionLabel}-sektionen (${filePath}).`);
      }
      cols.push(sectionMap[g]);
    }
    return cols;
  }

  const maanedCols = buildColsArray(sectionGrupper.maanedLoen, 'Månedsløn');

  let timeCols = null;
  if (hasTimeLoen) {
    timeCols = buildColsArray(sectionGrupper.timeLoen, 'Timeløn');
  }

  let aarsLoenCols = null;
  if (!hasTimeLoen && aarsLoenCol !== -1) {
    aarsLoenCols = buildColsArray(sectionGrupper.aarsLoen, 'Årsløn');
  }

  if (!hasTimeLoen && !aarsLoenCols) {
    throw new Error(`Filen mangler både Timeløn og Årsløn — kan ikke beregne timelønssatser (${filePath}).`);
  }

  // 6) Find løntrin-kolonnen
  const loentrinCandidates = [];
  for (let r = range.s.r; r <= Math.min(gruppeRow, headerMaxRow); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsxUtils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = normalizeText(cell.v);
      if (val.includes('løntrin')) {
        loentrinCandidates.push({ r, c });
      }
    }
  }

  let loentrinCol = -1;
  if (loentrinCandidates.length > 0) {
    loentrinCandidates.sort((a, b) => {
      const aDist = a.c <= maanedCol ? maanedCol - a.c : a.c - maanedCol;
      const bDist = b.c <= maanedCol ? maanedCol - b.c : b.c - maanedCol;
      return aDist - bDist || a.r - b.r;
    });
    loentrinCol = loentrinCandidates[0].c;
  }
  if (loentrinCol === -1) {
    throw new Error(`Kunne ikke finde løntrin-kolonnen (${filePath}).`);
  }

  // 7) Find første datarække
  let firstDataRow = -1;
  for (let r = gruppeRow + 1; r <= Math.min(gruppeRow + 5, range.e.r); r++) {
    const cell = sheet[xlsxUtils.encode_cell({ r, c: loentrinCol })];
    if (cell && typeof cell.v === 'number') {
      firstDataRow = r;
      break;
    }
  }

  if (firstDataRow === -1) {
    throw new Error(`Kunne ikke finde første datarække med løntrin (${filePath}).`);
  }

  return { loentrinCol, maanedCols, timeCols, aarsLoenCols, firstDataRow, lastRow: range.e.r };
}

// ===== PARSING =====

/**
 * Afrunding til 2 decimaler.
 *
 * Regel: Standard half-up rounding (Math.round).
 * Anvendes på alle Excel-værdier FØR Zod-validering.
 *
 * Eksempel: 19078.833333... → 19078.83, 99169.666... → 99169.67
 * Timelønner fra Excel har allerede 2 decimaler; afrunding er en no-op for dem.
 */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Beregner timeløn fra årsløn: årsløn / 1924, afrundet til 2 decimaler.
 * 1924 er det normerede årsværk i timer (kommunal/regional overenskomst).
 * Bruges kun for ældre Excel-filer (pre-2020) der ikke har en Timeløn-sektion.
 */
const TIMER_PR_AAR = 1924;

function parseSheet(sheet, filePath) {
  const { loentrinCol, maanedCols, timeCols, aarsLoenCols, firstDataRow, lastRow } = detectColumns(sheet, filePath);
  const hasDirectTimeLoen = timeCols !== null;
  const entries = [];

  for (let r = firstDataRow; r <= lastRow; r++) {
    const ltCell = sheet[xlsxUtils.encode_cell({ r, c: loentrinCol })];
    if (!ltCell) continue;

    let loentrin;
    if (typeof ltCell.v === 'number') {
      loentrin = ltCell.v;
      if (!Number.isInteger(loentrin) || loentrin < 1 || loentrin > 55) continue;
    } else if (String(ltCell.v).trim() === '55+') {
      loentrin = '55+';
    } else {
      continue; // Spring over rækker der ikke er løntrin
    }

    const maanedsLoen = {};
    const timeLoen = {};

    for (let g = 0; g <= 4; g++) {
      const mCell = sheet[xlsxUtils.encode_cell({ r, c: maanedCols[g] })];
      if (!mCell || typeof mCell.v !== 'number') {
        throw new Error(`Manglende/ugyldig månedsløn for løntrin ${loentrin}, Gruppe ${g} i ${filePath} (række ${r + 1}).`);
      }
      maanedsLoen[g] = round2(mCell.v);

      if (hasDirectTimeLoen) {
        // Nyt layout: timeløn direkte fra Excel
        const tCell = sheet[xlsxUtils.encode_cell({ r, c: timeCols[g] })];
        if (!tCell || typeof tCell.v !== 'number') {
          throw new Error(`Manglende/ugyldig timeløn for løntrin ${loentrin}, Gruppe ${g} i ${filePath} (række ${r + 1}).`);
        }
        timeLoen[g] = round2(tCell.v);
      } else {
        // Gammelt layout: beregn timeløn fra årsløn (årsløn / 1924)
        const aCell = sheet[xlsxUtils.encode_cell({ r, c: aarsLoenCols[g] })];
        if (!aCell || typeof aCell.v !== 'number') {
          throw new Error(`Manglende/ugyldig årsløn for løntrin ${loentrin}, Gruppe ${g} i ${filePath} (række ${r + 1}).`);
        }
        timeLoen[g] = round2(aCell.v / TIMER_PR_AAR);
      }
    }

    entries.push({ loentrin, maanedsLoen, timeLoen });
  }

  return entries;
}

// ===== INTEGRITETSTJEK =====

function validateEntries(entries, effectiveDate, filePath) {
  // Tjek at alle 56 løntrin er til stede
  const seenTrin = new Set();
  for (const e of entries) {
    const key = String(e.loentrin);
    if (seenTrin.has(key)) {
      throw new Error(`Duplikeret løntrin ${key} i ${filePath}.`);
    }
    seenTrin.add(key);
  }

  for (let t = 1; t <= 55; t++) {
    if (!seenTrin.has(String(t))) {
      throw new Error(`Manglende løntrin ${t} i ${filePath}.`);
    }
  }
  if (!seenTrin.has('55+')) {
    throw new Error(`Manglende løntrin 55+ i ${filePath}.`);
  }

  if (entries.length !== 56) {
    throw new Error(`Forventede 56 løntrin, fandt ${entries.length} i ${filePath}.`);
  }

  // Tjek at løntrin 42+ har identiske gruppeværdier
  for (const e of entries) {
    const is42Plus = e.loentrin === '55+' || (typeof e.loentrin === 'number' && e.loentrin >= 42);
    if (is42Plus) {
      const mVals = Object.values(e.maanedsLoen);
      const tVals = Object.values(e.timeLoen);
      if (new Set(mVals).size !== 1) {
        throw new Error(`Løntrin ${e.loentrin}: månedsløn-grupper er ikke identiske (${mVals.join(', ')}) i ${filePath}.`);
      }
      if (new Set(tVals).size !== 1) {
        throw new Error(`Løntrin ${e.loentrin}: timeløn-grupper er ikke identiske (${tVals.join(', ')}) i ${filePath}.`);
      }
    }
  }

  // Zod-validering af hele reguleringen
  const regulering = { effectiveDate, entries };
  const result = ReguleringSchema.safeParse(regulering);
  if (!result.success) {
    console.error(`Zod-valideringsfejl for ${filePath}:`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error(`Zod-validering fejlede for ${filePath}.`);
  }
}

// ===== FILBEHANDLING =====

function writeAtomic(targetPath, content) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tempPath = path.join(dir, `.${base}.tmp`);

  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.rmSync(targetPath, { force: true });
  fs.renameSync(tempPath, targetPath);
}

function processFiles(excelDir, pattern, overenskomstType) {
  const fileConfigs = discoverFiles(excelDir, pattern, overenskomstType);
  const reguleringer = [];

  for (const { file, effectiveDate } of fileConfigs) {
    const filePath = path.join(excelDir, file);

    console.log(`  Læser: ${file} → ${effectiveDate}`);

    const buf = fs.readFileSync(filePath);
    const workbook = xlsxRead(buf);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const entries = parseSheet(sheet, filePath);
    validateEntries(entries, effectiveDate, filePath);

    reguleringer.push({ effectiveDate, entries });
  }

  // Sortér nyeste først (DanishDateString: DD-MM-YYYY → sammenlign som YYYY-MM-DD)
  reguleringer.sort((a, b) => {
    return danishDateToNumber(b.effectiveDate) - danishDateToNumber(a.effectiveDate);
  });

  return reguleringer;
}

// ===== KODEGENERERING =====

function formatEntry(entry) {
  const lt = typeof entry.loentrin === 'string' ? `lt('${entry.loentrin}')` : `lt(${entry.loentrin})`;
  const m = entry.maanedsLoen;
  const t = entry.timeLoen;
  return `      { loentrin: ${lt}, maanedsLoen: { 0: ${m[0]}, 1: ${m[1]}, 2: ${m[2]}, 3: ${m[3]}, 4: ${m[4]} }, timeLoen: { 0: ${t[0]}, 1: ${t[1]}, 2: ${t[2]}, 3: ${t[3]}, 4: ${t[4]} } }`;
}

function generateTypeScript(reguleringer, overenskomstType, excelRelPath) {
  const varName = overenskomstType === 'KL' ? 'klLoenSatser' : 'rltnLoenSatser';
  const label = overenskomstType === 'KL' ? 'KL (Kommunale)' : 'RLTN (Regionale)';
  const datoer = reguleringer.map(r => r.effectiveDate).join(', ');

  const lines = [];
  lines.push(`/**`);
  lines.push(` * ${label} lønninger – Løntrin-baserede satser`);
  lines.push(` *`);
  lines.push(` * AUTO-GENERERET FIL – Redigér IKKE manuelt.`);
  lines.push(` * Genereret af: scripts/import-offentlig-loen.mjs`);
  lines.push(` * Kilde: ${excelRelPath}`);
  lines.push(` *`);
  lines.push(` * Indeholder månedsløn og timeløn for Gruppe 0-4, Løntrin 1-55+`);
  lines.push(` * Reguleringsperioder: ${datoer}`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import { toDanishDateString } from '../../types/branded';`);
  lines.push(`import { toLoentrin } from '../offentligLoenTypes';`);
  lines.push(`import type { OffentligLoenRegulering } from '../offentligLoenTypes';`);
  lines.push(``);
  lines.push(`const d = (s: string) => toDanishDateString(s);`);
  lines.push(`const lt = toLoentrin;`);
  lines.push(``);
  lines.push(`export const ${varName}: ReadonlyArray<OffentligLoenRegulering> = [`);

  for (const reg of reguleringer) {
    lines.push(`  {`);
    lines.push(`    effectiveDate: d('${reg.effectiveDate}'),`);
    lines.push(`    entries: [`);
    for (const entry of reg.entries) {
      lines.push(`${formatEntry(entry)},`);
    }
    lines.push(`    ],`);
    lines.push(`  },`);
  }

  lines.push(`];`);
  lines.push(``);

  return lines.join('\n');
}

// ===== MAIN =====

function main() {
  console.log('Importerer offentlige lønsatser fra Excel...\n');

  const klExcelDir = path.join(PROJECT_ROOT, 'src/data/KL/Excel');
  const rltnExcelDir = path.join(PROJECT_ROOT, 'src/data/RLTN/Excel');
  const klOutput = path.join(PROJECT_ROOT, 'src/data/KL/klLoenSatser.ts');
  const rltnOutput = path.join(PROJECT_ROOT, 'src/data/RLTN/rltnLoenSatser.ts');
  const missingDirs = [klExcelDir, rltnExcelDir].filter((dir) => !fs.existsSync(dir));
  if (missingDirs.length > 0) {
    throw new Error(`Excel-mapper mangler: ${missingDirs.join(', ')}`);
  }

  // Auto-discovery: find og parsér filer ud fra navngivningsmønster
  console.log('KL-filer:');
  const klReguleringer = processFiles(klExcelDir, KL_PATTERN, 'KL');

  console.log('\nRLTN-filer:');
  const rltnReguleringer = processFiles(rltnExcelDir, RLTN_PATTERN, 'RLTN');

  // Generér TypeScript-filer
  const klCode = generateTypeScript(klReguleringer, 'KL', 'src/data/KL/Excel/');
  const rltnCode = generateTypeScript(rltnReguleringer, 'RLTN', 'src/data/RLTN/Excel/');

  writeAtomic(klOutput, klCode);
  console.log(`\nSkrevet: ${path.relative(PROJECT_ROOT, klOutput)}`);

  writeAtomic(rltnOutput, rltnCode);
  console.log(`Skrevet: ${path.relative(PROJECT_ROOT, rltnOutput)}`);

  // Opsummering
  console.log(`\nOpsummering:`);
  console.log(`  KL:   ${klReguleringer.length} reguleringer, ${klReguleringer[0].entries.length} løntrin hver`);
  console.log(`  RLTN: ${rltnReguleringer.length} reguleringer, ${rltnReguleringer[0].entries.length} løntrin hver`);
  console.log(`\nFærdig!`);
}

main();
