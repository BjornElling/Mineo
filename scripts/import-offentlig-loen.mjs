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
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { z } from 'zod';

const PROJECT_ROOT = process.cwd();

// ===== FILNAVNE-MØNSTER =====
// Navngivning er ufravigelig: KL-ÅÅÅÅ-MM-DD.xlsx/.xls og RLTN-ÅÅÅÅ-MM-DD.xlsx/.xls
// Dato i filnavnet er reguleringsperiodedatoen (effectiveDate).

const KL_PATTERN = /^KL-(\d{4})-(\d{2})-(\d{2})\.xlsx?$/i;
const RLTN_PATTERN = /^RLTN-(\d{4})-(\d{2})-(\d{2})\.xlsx?$/i;

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
  effectiveDate: z.string().regex(/^\d{2}-\d{2}-\d{4}$/),
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
  const range = xlsxUtils.decode_range(sheet['!ref']);

  // 1) Find sektionsoverskrifter (Årsløn, Månedsløn, Timeløn) i de første 10 rækker
  let sectionRow = -1;
  let aarsLoenCol = -1;
  let maanedCol = -1;
  let timeCol = -1;

  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsxUtils.encode_cell({ r, c })];
      if (!cell) continue;
      const val = String(cell.v).trim();
      if (val.startsWith('Månedsløn')) {
        sectionRow = r;
        maanedCol = c;
      }
      if (val.startsWith('Timeløn')) {
        timeCol = c;
      }
      if (val.startsWith('Årsløn')) {
        aarsLoenCol = c;
      }
    }
  }

  if (sectionRow === -1 || maanedCol === -1) {
    throw new Error(`Kunne ikke finde sektionsoverskriften "Månedsløn" i arket (${filePath}).`);
  }

  const hasTimeLoen = timeCol !== -1;

  // 2) Find gruppeRow: rækken der indeholder "Gruppe 0", "Gruppe 1", etc.
  let gruppeRow = -1;
  for (let r = sectionRow; r <= Math.min(sectionRow + 5, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsxUtils.encode_cell({ r, c })];
      if (cell && String(cell.v).trim() === 'Gruppe 0') {
        gruppeRow = r;
        break;
      }
    }
    if (gruppeRow !== -1) break;
  }

  if (gruppeRow === -1) {
    throw new Error(`Kunne ikke finde "Gruppe 0" header-rækken (${filePath}).`);
  }

  // 3) Scan hele gruppeRow og saml ALLE "Gruppe N"-celler med deres kolonne-positioner
  //    Resultat: array af { gruppe: 0-4, col: number }, sorteret per kolonne
  const gruppeHits = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[xlsxUtils.encode_cell({ r: gruppeRow, c })];
    if (!cell) continue;
    const m = String(cell.v).trim().match(/^Gruppe (\d)$/);
    if (m) {
      gruppeHits.push({ gruppe: Number(m[1]), col: c });
    }
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
  let loentrinCol = -1;
  for (let r = sectionRow; r <= gruppeRow; r++) {
    for (let c = range.s.c; c <= Math.min(range.s.c + 2, range.e.c); c++) {
      const cell = sheet[xlsxUtils.encode_cell({ r, c })];
      if (cell && String(cell.v).trim().toLowerCase().startsWith('løn')) {
        loentrinCol = c;
        break;
      }
    }
    if (loentrinCol !== -1) break;
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
  return Math.round(value * 100) / 100;
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
    const toSortable = (d) => {
      const [dd, mm, yyyy] = d.split('-');
      return `${yyyy}-${mm}-${dd}`;
    };
    return toSortable(b.effectiveDate).localeCompare(toSortable(a.effectiveDate));
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

  // Clean slate: slet eksisterende genererede filer
  for (const outputFile of [klOutput, rltnOutput]) {
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
      console.log(`Slettet: ${path.relative(PROJECT_ROOT, outputFile)}`);
    }
  }
  console.log('');

  // Auto-discovery: find og parsér filer ud fra navngivningsmønster
  console.log('KL-filer:');
  const klReguleringer = processFiles(klExcelDir, KL_PATTERN, 'KL');

  console.log('\nRLTN-filer:');
  const rltnReguleringer = processFiles(rltnExcelDir, RLTN_PATTERN, 'RLTN');

  // Generér TypeScript-filer
  const klCode = generateTypeScript(klReguleringer, 'KL', 'src/data/KL/Excel/');
  const rltnCode = generateTypeScript(rltnReguleringer, 'RLTN', 'src/data/RLTN/Excel/');

  fs.writeFileSync(klOutput, klCode, 'utf-8');
  console.log(`\nSkrevet: ${path.relative(PROJECT_ROOT, klOutput)}`);

  fs.writeFileSync(rltnOutput, rltnCode, 'utf-8');
  console.log(`Skrevet: ${path.relative(PROJECT_ROOT, rltnOutput)}`);

  // Opsummering
  console.log(`\nOpsummering:`);
  console.log(`  KL:   ${klReguleringer.length} reguleringer, ${klReguleringer[0].entries.length} løntrin hver`);
  console.log(`  RLTN: ${rltnReguleringer.length} reguleringer, ${rltnReguleringer[0].entries.length} løntrin hver`);
  console.log(`\nFærdig!`);
}

main();
